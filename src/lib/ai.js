import { dataUrlToBase64 } from './image'
import { supabase } from './supabase'

// AI identification runs on the server (api/identify.js) using a key held in
// the Vercel project, so no API key is ever entered into, stored by, or sent
// from the app. The caller's existing Catalog session is the credential.
//
// In the installed APK the page origin is the bundled app, not the website,
// so the deployed URL is baked in at build time.
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '')

export class AiUnavailableError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

async function accessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

// True when the user could plausibly run a scan: cloud mode + signed in.
// Whether the server actually has a key configured is only known once we ask.
export async function aiSignedIn() {
  return Boolean(await accessToken())
}

export async function identifyItem(photoDataUrls) {
  const token = await accessToken()
  if (!token) {
    throw new AiUnavailableError(
      'Sign in to your Catalog account to use AI identification.',
      'signed_out',
    )
  }

  const images = photoDataUrls.map((dataUrl) => dataUrlToBase64(dataUrl))

  let res
  try {
    res = await fetch(`${API_BASE}/api/identify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ images }),
    })
  } catch {
    throw new AiUnavailableError(
      'Could not reach the identification service. Check your connection and try again.',
      'network',
    )
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* fall through to the status-based message below */
  }

  if (!res.ok) {
    throw new AiUnavailableError(
      payload?.error || `Identification failed (HTTP ${res.status}).`,
      payload?.code || (res.status === 503 ? 'not_configured' : 'error'),
    )
  }

  if (!payload?.fields?.title) {
    throw new AiUnavailableError(
      'Could not confidently identify this item. Enter the details manually.',
      'no_match',
    )
  }

  return {
    fields: payload.fields,
    confidence: payload.confidence || {},
    summary: payload.summary || '',
  }
}

// Current market value, searched rather than recalled. Returns null when the
// deployment has scanning switched off; throws AiUnavailableError otherwise so
// the caller can show why.
export async function lookupValue({ title, platform, region, edition, completeness, type }) {
  const token = await accessToken()
  if (!token) throw new AiUnavailableError('Sign in to look up market value.', 'signed_out')

  let res
  try {
    res = await fetch(`${API_BASE}/api/value`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, platform, region, edition, completeness, type }),
    })
  } catch {
    throw new AiUnavailableError('Could not reach the value service.', 'network')
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    throw new AiUnavailableError(
      payload?.error || `Value lookup failed (HTTP ${res.status}).`,
      payload?.code || 'error',
    )
  }
  return payload
}
