import Anthropic from '@anthropic-ai/sdk'
import { NOT_CONFIGURED, authenticate, consumeScan, cors, sharedCredential, DAILY_SCAN_LIMIT } from './_lib.js'

// Market value lookup.
//
// Deliberately a *searched* answer rather than a remembered one: collectible
// prices move, and a model reciting a number from training data would be
// confidently stale.
//
// Two things make the difference between a usable answer and "no pricing
// found". First, budget: a handful of searches gets spent on result pages
// whose snippets carry no dollar figures at all. Second, fetching — the price
// table on a guide site or a row of completed sales is in the page body, not
// in a search snippet, so the model has to be able to open the page.
//
// Every source that reaches the app is checked against the URLs actually
// searched or fetched; a citation the model invented is dropped rather than
// shown as evidence.

const MAX_SEARCHES = Number(process.env.AI_VALUE_MAX_SEARCHES || 8)
const MAX_FETCHES = Number(process.env.AI_VALUE_MAX_FETCHES || 4)
// Fetched pages are resent on each continuation turn, so this cap is the main
// thing standing between a lookup and a surprising token bill.
const MAX_CONTENT_TOKENS = Number(process.env.AI_VALUE_MAX_CONTENT_TOKENS || 6000)
const MAX_TURNS = 8

// Asking for ranges by completeness rather than one figure is what lets the
// lookup run before the user has chosen a condition: the app positions the
// copy inside the range locally, so the number updates as they tap.
const SYSTEM = `You price physical retro video game collectibles using current market data.

Method:
1. Search for recent SOLD prices for the exact release. Try more than one phrasing — "<title> <platform> sold", "<title> <platform> price", the specific edition or label, and a price-guide site — rather than giving up after one query.
2. Search snippets usually do not contain prices. Open the most promising pages with web_fetch and read the actual figures out of the page.
3. Build a price range for each level of completeness you have evidence for.

Then respond with ONLY a JSON object, no markdown fences:
{
  "priced": string,                 // the exact release you priced, in your own words
  "anchors": {
    "loose":    { "low": number, "high": number } | null,   // cartridge/disc only, no box or manual
    "boxed":    { "low": number, "high": number } | null,   // box + game, manual missing
    "complete": { "low": number, "high": number } | null    // everything it originally shipped with
  },
  "confidence": "high" | "medium" | "low",
  "note": string,                   // one or two sentences: what drives the spread
  "sources": [
    {
      "label": string,              // e.g. "eBay sold listing" or "PriceCharting"
      "price": number | null,       // USD
      "kind": "sold" | "asking" | "guide",
      "completeness": "loose" | "boxed" | "complete" | null,
      "date": string | null,        // YYYY-MM or YYYY-MM-DD if shown
      "url": string                 // a URL you actually retrieved
    }
  ]
}

Rules:
- low and high are the ordinary spread for that completeness across conditions — not the single cheapest and most expensive listing ever seen.
- Fill in every completeness level you found evidence for, and null only the ones you genuinely did not. Most releases have at least loose and complete data.
- Do not blend markets: a loose cartridge and a complete-in-box copy are different items.
- Sold prices are the best evidence. If you can only find asking prices or guide figures, still give the range — say so in note and set confidence to "low". Returning nothing is worse than returning a clearly-labelled weak answer.
- Only cite URLs you actually retrieved.
- All figures in USD.`

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  const { title, platform, region, edition, type, present } = req.body || {}
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'An item title is required.' })
  }

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  // Searching costs search and fetch fees on top of tokens, so it can be
  // switched off independently of scanning.
  if ((process.env.AI_VALUE_LOOKUP || 'on').toLowerCase() === 'off') {
    return res.status(503).json({ error: 'Value lookup is switched off for this deployment.', code: 'disabled' })
  }

  const cred = sharedCredential()
  if (!cred) return res.status(503).json({ error: NOT_CONFIGURED, code: 'not_configured' })

  // A lookup costs more than a scan, so it counts against the same allowance.
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
    (Array.isArray(present) && present.length ? `Parts this copy has: ${present.join(', ')}\n` : '') +
    '\nResearch this release and return the JSON object.'

  try {
    const client = new Anthropic({ apiKey: cred.apiKey })
    const messages = [{ role: 'user', content: ask }]
    let response
    const retrieved = new Set()

    // The model pauses between server-tool turns; continue until it finishes.
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      response = await client.messages.create({
        model: process.env.ANTHROPIC_VALUE_MODEL || cred.model,
        max_tokens: 4096,
        system: SYSTEM,
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES },
          {
            type: 'web_fetch_20260209',
            name: 'web_fetch',
            max_uses: MAX_FETCHES,
            max_content_tokens: MAX_CONTENT_TOKENS,
          },
        ],
        messages,
      })

      collectUrls(response.content, retrieved)

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

    const { sources, verifiedRatio } = verifySources(parsed.sources, retrieved)
    const anchors = cleanAnchors(parsed.anchors)

    if (!anchors.loose && !anchors.boxed && !anchors.complete) {
      return res.status(200).json({
        anchors,
        confidence: 'low',
        note: typeof parsed.note === 'string' ? parsed.note : '',
        priced: typeof parsed.priced === 'string' ? parsed.priced : described,
        sources,
        asOf: new Date().toISOString().slice(0, 10),
        retrievedCount: retrieved.size,
      })
    }

    return res.status(200).json({
      anchors,
      // A range whose citations mostly failed verification is not "high"
      // confidence no matter what the model said.
      confidence: verifiedRatio < 0.5 ? 'low' : parsed.confidence || 'medium',
      note: typeof parsed.note === 'string' ? parsed.note : '',
      priced: typeof parsed.priced === 'string' ? parsed.priced : described,
      sources,
      asOf: new Date().toISOString().slice(0, 10),
      retrievedCount: retrieved.size,
    })
  } catch (error) {
    console.error('value lookup failed', error)
    const status = error?.status
    if (status === 401 || status === 403) {
      return res.status(502).json({ error: "Anthropic rejected this deployment's API key." })
    }
    if (status === 429) return res.status(429).json({ error: 'Rate limited by Anthropic — try again shortly.' })
    return res.status(502).json({ error: 'Value lookup failed.' })
  }
}

// Server tool errors arrive as HTTP 200 with an object (not a list) in
// `content`, so branch on shape before iterating. A page the model opened is
// evidence just as much as one the search returned, so both count.
export function collectUrls(content, into) {
  for (const block of content || []) {
    if (block.type === 'web_search_tool_result') {
      if (!Array.isArray(block.content)) continue // an error object, not results
      for (const result of block.content) {
        if (result?.url) into.add(normalize(result.url))
      }
    } else if (block.type === 'web_fetch_tool_result') {
      const url = block.content?.url
      if (url) into.add(normalize(url))
    }
  }
}

// A citation is only evidence if it came back from an actual search or fetch.
// Anything else is the model filling in a plausible-looking URL, which is
// exactly the failure this feature must not have.
export function verifySources(claimed, retrieved) {
  const list = Array.isArray(claimed) ? claimed : []
  const sources = list.filter((s) => s?.url && retrieved.has(normalize(s.url))).slice(0, 8)
  return { sources, verifiedRatio: list.length ? sources.length / list.length : 1 }
}

// Drop anything that is not a sane, ordered, positive range rather than
// letting a malformed pair through to the arithmetic.
export function cleanAnchors(raw) {
  const out = { loose: null, boxed: null, complete: null }
  if (!raw || typeof raw !== 'object') return out
  for (const key of Object.keys(out)) {
    const low = num(raw[key]?.low)
    const high = num(raw[key]?.high)
    if (low == null || high == null || low <= 0 || high < low) continue
    out[key] = { low, high }
  }
  return out
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
