import Anthropic from '@anthropic-ai/sdk'
import { NOT_CONFIGURED, authenticate, consumeScan, cors, sharedCredential, DAILY_SCAN_LIMIT } from './_lib.js'

// Market value lookup.
//
// Deliberately a *searched* answer rather than a remembered one: collectible
// prices move, and a model reciting a number from training data would be
// confidently stale. The web_search server tool runs on Anthropic's side, and
// every source the model cites is checked against the URLs the search actually
// returned before it reaches the app — a citation that did not come back from
// a real search is dropped rather than shown as evidence.

const MAX_SEARCHES = 4
const MAX_TURNS = 6

const SYSTEM = `You price physical retro video game collectibles using current market data.

Search for what the exact item is selling for NOW and what it has SOLD for recently. Prefer completed/sold listings over asking prices, and prefer sources that show actual transactions.

Then respond with ONLY a JSON object, no markdown fences:
{
  "estimate": number | null,        // best single USD figure for the stated completeness
  "low": number | null,             // typical low end seen
  "high": number | null,            // typical high end seen
  "confidence": "high" | "medium" | "low",
  "note": string,                   // one sentence: what drives the range, e.g. condition sensitivity
  "sources": [
    {
      "label": string,              // where, e.g. "eBay sold listing" or "PriceCharting"
      "price": number | null,       // USD
      "kind": "sold" | "asking" | "guide",
      "date": string | null,        // YYYY-MM or YYYY-MM-DD if the listing shows one
      "url": string                 // must be a URL you actually retrieved
    }
  ]
}

Rules:
- Price the specific release and the stated completeness. A loose cartridge and a complete-in-box copy are very different markets; do not blend them.
- Only cite URLs you actually retrieved from search results.
- If searches do not produce usable pricing, return estimate/low/high as null with confidence "low" and say so in note. Do not guess a number.
- All figures in USD.`

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  const { title, platform, region, edition, completeness, type } = req.body || {}
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'An item title is required.' })
  }

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  // Searching costs a search fee on top of tokens, so it can be switched off
  // independently of scanning.
  if ((process.env.AI_VALUE_LOOKUP || 'on').toLowerCase() === 'off') {
    return res.status(503).json({ error: 'Value lookup is switched off for this deployment.', code: 'disabled' })
  }

  const cred = sharedCredential()
  if (!cred) return res.status(503).json({ error: NOT_CONFIGURED, code: 'not_configured' })

  // A lookup costs more than a scan (search fees on top of tokens), so it
  // counts against the same daily allowance.
  const { count, limited } = await consumeScan(auth.supabase)
  if (limited) {
    return res.status(429).json({
      error: `Daily limit reached (${DAILY_SCAN_LIMIT} per person). It resets at midnight UTC.`,
      code: 'daily_limit',
      count,
    })
  }

  const described = [title, platform, region, edition, type && `(${type})`].filter(Boolean).join(' · ')
  const ask =
    `Item: ${described}\n` +
    `Completeness: ${completeness || 'unknown'}\n\n` +
    'Find current market value for this exact item at this completeness, then return the JSON object.'

  try {
    const client = new Anthropic({ apiKey: cred.apiKey })
    const messages = [{ role: 'user', content: ask }]
    let response
    const searchedUrls = new Set()

    // The model may pause between tool turns; continue until it finishes.
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      response = await client.messages.create({
        model: cred.model,
        max_tokens: 4096,
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES }],
        messages,
      })

      collectUrls(response.content, searchedUrls)

      if (response.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: response.content })
    }

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The model declined this lookup.' })
    }

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const parsed = extractJson(text)
    if (!parsed) {
      return res.status(422).json({ error: 'Could not read a value from the search results.' })
    }

    const { sources, verifiedRatio } = verifySources(parsed.sources, searchedUrls)

    return res.status(200).json({
      estimate: num(parsed.estimate),
      low: num(parsed.low),
      high: num(parsed.high),
      // A figure whose citations mostly failed verification is not "high"
      // confidence no matter what the model said.
      confidence: verifiedRatio < 0.5 ? 'low' : parsed.confidence || 'medium',
      note: typeof parsed.note === 'string' ? parsed.note : '',
      sources,
      completeness: completeness || null,
      asOf: new Date().toISOString().slice(0, 10),
      searchCount: searchedUrls.size,
    })
  } catch (error) {
    console.error('value lookup failed', error)
    const status = error?.status
    if (status === 401 || status === 403) {
      return res.status(502).json({ error: "Anthropic rejected this deployment's API key." })
    }
    if (status === 429) return res.status(429).json({ error: 'Rate limited by Anthropic — try again shortly.' })
    return res.status(502).json({ error: 'Value lookup failed. You can still enter a value yourself.' })
  }
}

// Server tool errors arrive as HTTP 200 with an object (not a list) in
// `content`, so branch on shape before iterating.
export function collectUrls(content, into) {
  for (const block of content || []) {
    if (block.type !== 'web_search_tool_result') continue
    if (!Array.isArray(block.content)) continue // an error object, not results
    for (const result of block.content) {
      if (result?.url) into.add(normalize(result.url))
    }
  }
}

// A citation is only evidence if it came back from an actual search. Anything
// else is the model filling in a plausible-looking URL, which is exactly the
// failure this feature must not have.
export function verifySources(claimed, searchedUrls) {
  const list = Array.isArray(claimed) ? claimed : []
  const sources = list.filter((s) => s?.url && searchedUrls.has(normalize(s.url))).slice(0, 6)
  return { sources, verifiedRatio: list.length ? sources.length / list.length : 1 }
}

function normalize(url) {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`.replace(/\/$/, '').toLowerCase()
  } catch {
    return String(url).toLowerCase()
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)

function extractJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}
