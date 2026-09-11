import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  DAILY_SCAN_LIMIT, MAX_IMAGES, MAX_TOTAL_BYTES, NOT_CONFIGURED,
  authenticate, consumeScan, cors, resolveCredential,
} from './_lib.js'

// Server-side AI identification.
//
// Whichever key is used, it lives on the server and never reaches a browser
// or the APK. Each member's own key is preferred, so scanning is billed to
// whoever does it; a deployment-wide key (ANTHROPIC_API_KEY / OPENAI_API_KEY)
// is an optional fallback for whoever sets one.

const SYSTEM = `You identify physical retro video game collection artifacts from photographs: games, magazines, strategy guides, manuals, boxes, consoles, and accessories.

Respond with ONLY a JSON object, no markdown fences, matching:
{
  "type": one of ["game","magazine","guide","manual","box","console","accessory"],
  "title": string,
  "platform": string|null,
  "publisher": string|null,
  "developer": string|null,
  "releaseYear": number|null,
  "region": string|null,
  "edition": string|null,
  "genre": string|null,
  "franchise": string|null,
  "issueNumber": number|null,
  "publicationDate": "YYYY-MM-DD"|null,
  "isbn": string|null,
  "author": string|null,
  "model": string|null,
  "summary": one-sentence identification,
  "confidence": { "<each populated field>": number between 0 and 1 }
}

Rules:
- Identify the specific release when possible (region, edition).
- Give honest per-field confidence; use low values when guessing.
- Multiple photos are different views of the SAME physical item.
- Use null for anything you cannot determine.`

const PROMPT = 'Identify this item and return the JSON object.'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  // 1. Cheap shape checks first, so junk never costs a lookup.
  const images = req.body?.images
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Send at least one photo.' })
  }
  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ error: `Send at most ${MAX_IMAGES} photos of one item.` })
  }
  const totalBytes = images.reduce((n, i) => n + (i?.data?.length || 0), 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    return res.status(413).json({ error: 'Those photos are too large — retake them and try again.' })
  }

  // 2. Who is calling, and are they a collection member?
  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  // 3. Whose key pays for this?
  const cred = await resolveCredential(auth.supabase)
  if (!cred.source) {
    return res.status(503).json({ error: NOT_CONFIGURED, code: 'not_configured' })
  }

  // 4. Quota, but only on the shared key — someone scanning on their own key
  //    is spending their own money. Counted before the provider call so a
  //    runaway loop is stopped rather than merely recorded.
  if (cred.source === 'app') {
    const { count, limited } = await consumeScan(auth.supabase)
    if (limited) {
      return res.status(429).json({
        error: `Daily scan limit reached (${DAILY_SCAN_LIMIT} on the shared key). It resets at midnight UTC — or add your own API key under Settings to scan without this limit.`,
        code: 'daily_limit',
        count,
        limit: DAILY_SCAN_LIMIT,
      })
    }
  }

  // 5. Ask the model.
  try {
    const text =
      cred.provider === 'anthropic' ? await askClaude(images, cred) : await askOpenAI(images, cred)

    const parsed = extractJson(text)
    if (!parsed?.title) {
      return res.status(422).json({
        error: 'Could not confidently identify this item. Enter the details manually.',
      })
    }

    const { confidence = {}, summary = '', ...fields } = parsed
    return res
      .status(200)
      .json({ fields, confidence, summary, provider: cred.provider, source: cred.source })
  } catch (error) {
    console.error(`${cred.provider} call failed`, error)
    return res.status(error.httpStatus || 502).json({ error: describeError(cred, error) })
  }
}

export async function askClaude(images, cred) {
  const client = new Anthropic({ apiKey: cred.apiKey })
  const response = await client.messages.create({
    model: cred.model,
    max_tokens: 2048,
    // Extraction task with a waiting user: medium keeps identification
    // accurate without paying for deep deliberation.
    output_config: { effort: 'medium' },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data },
          })),
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    const err = new Error('declined')
    err.declined = true
    err.httpStatus = 422
    throw err
  }

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

export async function askOpenAI(images, cred) {
  const client = new OpenAI({ apiKey: cred.apiKey })
  const completion = await client.chat.completions.create({
    model: cred.model,
    max_completion_tokens: 2048,
    // The system prompt already demands a bare JSON object; this enforces it.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image_url',
            image_url: { url: `data:${img.mediaType || 'image/jpeg'};base64,${img.data}` },
          })),
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })
  return completion.choices?.[0]?.message?.content || ''
}

function describeError(cred, error) {
  if (error.declined) return 'The model declined to analyze this image. Try a different photo.'

  const status = error?.status
  const label = cred.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'
  const whose =
    cred.source === 'user'
      ? 'your saved key'
      : 'the deployment-wide key'

  if (status === 401 || status === 403) {
    return cred.source === 'user'
      ? `${label} rejected your saved API key. Check it under Settings → AI identification.`
      : `${label} rejected ${whose}.`
  }
  if (status === 429) return `Rate limited by ${label} — wait a moment and try again.`
  if (status === 400 && /credit|billing|quota/i.test(error?.message || '')) {
    return `${label} reports no available credit on ${whose}.`
  }
  // Usually a model name that no longer exists or isn't enabled on the account.
  if (status === 404) {
    return `${label} does not recognise the configured model. Pick a different model under Settings → AI identification.`
  }
  if (status) return `Identification failed (${label} returned ${status}).`
  return 'Identification failed. Try again.'
}

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
