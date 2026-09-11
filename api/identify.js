import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Server-side AI identification.
//
// The provider key lives here, in a Vercel environment variable, and never
// reaches a browser or the APK. Callers authenticate with their existing
// Catalog (Supabase) session, so nobody has to obtain or paste an API key —
// signing in to Catalog is the only step.
//
// Either provider works. Set whichever you already have an account with:
//   ANTHROPIC_API_KEY   Claude  (default model claude-opus-5)
//   OPENAI_API_KEY      GPT     (default model gpt-6-astra)
// If both are set, AI_PROVIDER ("anthropic" | "openai") picks between them;
// otherwise whichever key is present wins. Override the model per provider
// with ANTHROPIC_MODEL / OPENAI_MODEL.

const MAX_IMAGES = 6
const MAX_TOTAL_BYTES = 4 * 1024 * 1024

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-6-astra',
}

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

// Which provider to use, or null when nothing is configured.
export function resolveProvider(env = process.env) {
  const available = {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
  }
  const explicit = (env.AI_PROVIDER || '').trim().toLowerCase()
  if (explicit) return available[explicit] ? explicit : null
  if (available.anthropic) return 'anthropic'
  if (available.openai) return 'openai'
  return null
}

// Auth is by bearer token and no cookies are involved, so a permissive origin
// is safe here: a token, not the browser's origin check, is what gates access.
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  const provider = resolveProvider()
  if (!provider) {
    return res.status(503).json({
      error:
        'AI identification is not configured yet. The collection owner needs to add either ANTHROPIC_API_KEY or OPENAI_API_KEY in the Vercel project settings.',
      code: 'not_configured',
    })
  }

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

  // 2. Who is calling? Must be a signed-in Catalog user.
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '').trim()
  if (!token) return res.status(401).json({ error: 'Sign in to use AI identification.' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Your session has expired — sign in again.' })
  }

  // 3. Are they in a collection? Row-level security scopes this query to the
  //    caller, so a stranger who merely signed up gets nothing back and is
  //    refused — otherwise anyone could spend the owner's API budget.
  const { data: memberships, error: memberError } = await supabase
    .from('collection_members')
    .select('collection_id')
    .limit(1)
  if (memberError) {
    return res.status(500).json({ error: 'Could not verify your collection membership.' })
  }
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ error: 'Only members of a collection can use AI identification.' })
  }

  // 4. Ask the model.
  try {
    const text =
      provider === 'anthropic' ? await askClaude(images) : await askOpenAI(images)

    const parsed = extractJson(text)
    if (!parsed?.title) {
      return res.status(422).json({
        error: 'Could not confidently identify this item. Enter the details manually.',
      })
    }

    const { confidence = {}, summary = '', ...fields } = parsed
    return res.status(200).json({ fields, confidence, summary, provider })
  } catch (error) {
    console.error(`${provider} call failed`, error)
    return res.status(error.httpStatus || 502).json({ error: describeError(provider, error) })
  }
}

export async function askClaude(images) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic,
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

export async function askOpenAI(images) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
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

function describeError(provider, error) {
  if (error.declined) return 'The model declined to analyze this image. Try a different photo.'

  const status = error?.status
  const label = provider === 'anthropic' ? 'Anthropic' : 'OpenAI'
  const modelVar = provider === 'anthropic' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL'

  if (status === 401 || status === 403) return `The configured ${label} API key was rejected.`
  if (status === 429) return `Rate limited by ${label} — wait a moment and try again.`
  // Usually a model name that no longer exists or isn't enabled on the account.
  if (status === 404) {
    return `${label} does not recognise the configured model. Set ${modelVar} in Vercel to a model your account can use.`
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
