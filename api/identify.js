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
  "upc": string|null,              // the barcode digits if legible in any photo
  "author": string|null,
  "model": string|null,
  "manifest": array of { "name": string, "confidence": number 0-1 } — everything a
    complete, as-sold copy of THIS exact release (region, edition) included,
  "components": array of strings — the physical parts you can actually SEE in
    the photos, using the exact "name" from manifest where it is the same part,
  "condition": {
    "overall": one of ["Mint","Near Mint","Excellent","Very Good","Good","Fair","Poor"] | null,
    "confidence": number 0-1,
    "notes": array of short strings — the specific things you saw that drove the grade,
    "parts": array of { "name": manifest name, "grade": one of the same list, "note": string|null }
  },
  "summary": one-sentence identification,
  "confidence": { "<each populated field>": number between 0 and 1 }
}

Rules:
- Identify the specific release when possible (region, edition).
- Give honest per-field confidence; use low values when guessing.
- Multiple photos are different views of the SAME physical item.
- For "manifest", list what a collector would call complete for this release:
  the media first, one entry per disc or cartridge for multi-disc releases
  ("Disc 1", "Disc 2"); the packaging by its real form ("Box" for cardboard,
  "Jewel Case", "Keep Case", "Longbox"); "Manual"; then only the inserts you
  believe this release shipped with, by their collector name ("Poster", "Map",
  "Registration Card", "Nintendo Power Insert", "Memory Card Insert",
  "Precautions Sheet"). Contents vary by region and edition — the manifest is
  for the release you identified, not the game in general. If you are not
  sure an insert was included, include it with low confidence rather than
  leaving it out: the user will confirm each part, and being asked about a
  part beats never being asked. An empty array means you do not know the
  release well enough to say.
- For "components", list only parts visibly present in the photos. Do not infer
  a part just because the release normally shipped with it.
- For "condition", grade the copy the way a collector would from what is
  actually visible: cracked or crushed packaging, creased or faded artwork,
  label wear, scratches, yellowing, sun fade, missing seals. Grade each part
  you can see in "parts" and explain in "note" ("cracked hinge", "crushed
  corner"). Packaging usually drives the overall grade more than the media.
  Be conservative — Mint and Near Mint need clear evidence, not the absence of
  visible flaws in a small photo. Put the flaws you saw in "notes" so the user
  can check them; if the photos do not show enough to grade, set overall to
  null rather than guessing.
- For "upc", transcribe the barcode number only if every digit is legible;
  it is used as an exact key, so a guessed digit is worse than null.
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
    max_tokens: 4096,
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
