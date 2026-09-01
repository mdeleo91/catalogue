import Anthropic from '@anthropic-ai/sdk'
import { dataUrlToBase64 } from './image'
import { ITEM_TYPES, PLATFORMS, REGIONS } from './constants'

// Identify a physical collection item from one or more photographs using
// Claude vision. Runs directly from the browser against the user's own API
// key (entered in Settings and stored only on-device). Returns:
//   { fields: {...}, confidence: { field: 0..1 }, summary }
// or throws with a readable message.

const SYSTEM = `You identify physical retro video game collection artifacts from photographs: games, magazines, strategy guides, manuals, boxes, consoles, and accessories.

Respond with ONLY a JSON object, no markdown fences, matching:
{
  "type": one of ${JSON.stringify(ITEM_TYPES.map((t) => t.id))},
  "title": string,
  "platform": one of ${JSON.stringify(PLATFORMS)} or null,
  "publisher": string|null,
  "developer": string|null,
  "releaseYear": number|null,
  "region": one of ${JSON.stringify(REGIONS)} or null,
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

export function hasApiKey(settings) {
  return Boolean(settings?.anthropicApiKey?.trim())
}

export async function identifyItem(photoDataUrls, apiKey) {
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })

  const imageBlocks = photoDataUrls.map((dataUrl) => {
    const { mediaType, data } = dataUrlToBase64(dataUrl)
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
  })

  let response
  try {
    response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: 'Identify this item and return the JSON object.' },
          ],
        },
      ],
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error('The Anthropic API key in Settings was rejected. Check it and try again.')
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error('Rate limited by the Anthropic API — wait a moment and try again.')
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Identification failed (${error.status}): ${error.message}`)
    }
    throw new Error('Could not reach the Anthropic API. Check your connection and try again.')
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to analyze this image. Try a different photo.')
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const parsed = extractJson(text)
  if (!parsed || !parsed.title) {
    throw new Error('The model could not confidently identify this item. Enter it manually below.')
  }

  const { confidence = {}, summary = '', ...fields } = parsed
  return { fields, confidence, summary }
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
