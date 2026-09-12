import { API_BASE, AiUnavailableError, accessToken } from './ai'

// Client side of the price guide: every call goes through the server, which
// holds the PriceCharting token and checks collection membership.

async function post(path, body, signedOutMessage) {
  const token = await accessToken()
  if (!token) throw new AiUnavailableError(signedOutMessage, 'signed_out')
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiUnavailableError('Could not reach the price guide.', 'network')
  }
  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* handled below */
  }
  if (!res.ok) throw new AiUnavailableError(payload?.error || `Price guide failed (HTTP ${res.status}).`, payload?.code || 'error')
  return payload
}

// Find the guide product for an identified item. Barcode first when we have
// one; otherwise ranked title candidates.
export function matchMarket({ upc, title, platform, region }) {
  return post('/api/market', { upc, title, platform, region }, 'Sign in to look up market prices.')
}

// Current prices for a product already matched.
export function readMarket(productId) {
  return post('/api/market', { id: productId }, 'Sign in to refresh market prices.')
}

export async function marketStatus() {
  const token = await accessToken()
  if (!token) return { enabled: false, signedOut: true }
  try {
    const res = await fetch(`${API_BASE}/api/market-status`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? await res.json() : { enabled: false, error: `HTTP ${res.status}` }
  } catch {
    return { enabled: false, error: 'unreachable' }
  }
}
