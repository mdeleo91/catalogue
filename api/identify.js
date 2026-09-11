import Anthropic from '@anthropic-ai/sdk'
import {
  DAILY_SCAN_LIMIT, MAX_IMAGES, MAX_TOTAL_BYTES, NOT_CONFIGURED,
  authenticate, consumeScan, cors, sharedCredential,
} from './_lib.js'

// Server-side AI identification.
//
// ANTHROPIC_API_KEY lives on the server and never reaches a browser or the
// APK. Every member scans on it, so a per-member daily quota is what keeps
// the bill bounded.

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

  // 3. Is scanning switched on at all?
  const cred = sharedCredential()
  if (!cred) {
    return res.status(503).json({ error: NOT_CONFIGURED, code: 'not_configured' })
  }

  // 4. Quota, counted before the provider call so a runaway loop is stopped
  //    rather than merely recorded.
  const { count, limited } = await consumeScan(auth.supabase)
  if (limited) {
    return res.status(429).json({
      error: `Daily scan limit reached (${DAILY_SCAN_LIMIT} per person). It resets at midnight UTC.`,
      code: 'daily_limit',
      count,
      limit: DAILY_SCAN_LIMIT,
    })
  }

  // 5. Ask the model.
  try {
    const text = await askClaude(images, cred)

    const parsed = extractJson(text)
    if (!parsed?.title) {
      return res.status(422).json({
        error: 'Could not confidently identify this item. Enter the details manually.',
      })
    }

    const { confidence = {}, summary = '', ...fields } = parsed
    return res
      .status(200)
      .json({ fields, confidence, summary })
  } catch (error) {
    console.error('Anthropic call failed', error)
    return res.status(error.httpStatus || 502).json({ error: describeError(error) })
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

function describeError(error) {
  if (error.declined) return 'The model declined to analyze this image. Try a different photo.'

  const status = error?.status

  if (status === 401 || status === 403) {
    return 'Anthropic rejected this deployment\'s API key — check ANTHROPIC_API_KEY.'
  }
  if (status === 429) return 'Rate limited by Anthropic — wait a moment and try again.'
  if (status === 400 && /credit|billing|quota/i.test(error?.message || '')) {
    return 'Anthropic reports no available credit on this deployment\'s key.'
  }
  // Usually a model name that no longer exists or isn't enabled on the account.
  if (status === 404) {
    return 'Anthropic does not recognise the configured model. Set ANTHROPIC_MODEL to one this account can use.'
  }
  if (status) return `Identification failed (Anthropic returned ${status}).`
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
