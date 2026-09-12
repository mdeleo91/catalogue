// PriceCharting — the price guide for this hobby, and the one database that
// actually holds what the user is asking for: loose / CIB / new / graded /
// box-only / manual-only prices per release, refreshed daily from eBay sold
// listings, keyed by a stable product id.
//
// Matching an item to that id once is what makes "live" cheap: every later
// refresh is a deterministic lookup rather than an AI search. The token is a
// paid subscription key and stays on the server.
//
// Response shape, per the API docs as of writing: prices are integers in
// cents under hyphenated keys ("loose-price", "cib-price", ...). The
// normaliser below is deliberately tolerant so a missing or renamed field
// degrades to null rather than a crash; /api/market-status shows a real
// response so a mismatch is visible in Settings, not silent.

const BASE = 'https://www.pricecharting.com/api'

export function marketCredential(env = process.env) {
  return env.PRICECHARTING_TOKEN || null
}

const cents = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) / 100 : null)

export function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  const name = raw['product-name'] || raw.product_name || null
  const console_ = raw['console-name'] || raw.console_name || null
  return {
    provider: 'pricecharting',
    productId: String(raw.id),
    name,
    console: console_,
    releaseDate: raw['release-date'] || null,
    upc: raw.upc || null,
    // The API does not return a page URL; a product search by name lands on
    // the right page reliably.
    url: `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(
      [name, console_].filter(Boolean).join(' '),
    )}`,
    prices: {
      loose: cents(raw['loose-price']),
      cib: cents(raw['cib-price']),
      new: cents(raw['new-price']),
      graded: cents(raw['graded-price']),
      boxOnly: cents(raw['box-only-price']),
      manualOnly: cents(raw['manual-only-price']),
    },
  }
}

async function call(path, params, token) {
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('t', token)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    const err = new Error(`PriceCharting responded ${res.status}`)
    err.status = res.status
    throw err
  }
  const body = await res.json()
  if (body?.status && body.status !== 'success') {
    const err = new Error(body['error-message'] || `PriceCharting: ${body.status}`)
    err.status = 502
    throw err
  }
  return body
}

// One product: by id, by UPC (exact — the barcode on the box), or the API's
// own best match for a query.
export async function fetchProduct({ id, upc, q }, token) {
  const body = await call('product', { id, upc, q }, token)
  return normalizeProduct(body)
}

// Several candidates for a query, so the app can pick by platform and let
// the user correct a wrong match.
export async function searchProducts(q, token) {
  const body = await call('products', { q }, token)
  const list = Array.isArray(body?.products) ? body.products : []
  return list.map(normalizeProduct).filter(Boolean)
}

// Console names on PriceCharting vs. the platform strings the identify step
// produces. Loose matching on purpose: "SNES" should find "Super Nintendo".
const PLATFORM_ALIASES = {
  snes: ['super nintendo'],
  'super nes': ['super nintendo'],
  nes: ['nes'],
  n64: ['nintendo 64'],
  gc: ['gamecube'],
  gba: ['gameboy advance', 'game boy advance'],
  gbc: ['gameboy color', 'game boy color'],
  gb: ['gameboy', 'game boy'],
  ps1: ['playstation'],
  psx: ['playstation'],
  ps2: ['playstation 2'],
  ps3: ['playstation 3'],
  psp: ['psp'],
  genesis: ['sega genesis'],
  'mega drive': ['sega genesis', 'pal sega mega drive'],
  dreamcast: ['sega dreamcast'],
  saturn: ['sega saturn'],
  xbox: ['xbox'],
  ds: ['nintendo ds'],
  '3ds': ['nintendo 3ds'],
  wii: ['wii'],
}

const fold = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export function consoleMatches(platform, consoleName) {
  const p = fold(platform)
  const c = fold(consoleName)
  if (!p || !c) return false
  if (c.includes(p) || p.includes(c)) return true
  return (PLATFORM_ALIASES[p] || []).some((alias) => c.includes(alias))
}

// Pick the candidate for this item: same console first, then the closest
// title. Returns the ranked list so the caller can offer alternatives.
export function rankCandidates(candidates, { title, platform, region }) {
  const t = fold(title)
  const pal = /pal|europe/i.test(region || '')
  const jp = /japan|ntsc-j/i.test(region || '')
  const score = (c) => {
    let s = 0
    if (consoleMatches(platform, c.console)) s += 10
    const n = fold(c.name)
    if (n === t) s += 6
    else if (n.startsWith(t) || t.startsWith(n)) s += 4
    else if (n.includes(t) || t.includes(n)) s += 2
    const cPal = /pal/.test(fold(c.console))
    const cJp = /jp|japan/.test(fold(c.console))
    if (pal === cPal) s += 2
    if (jp === cJp) s += 2
    // A plain listing beats a variant unless the title asked for it.
    if (/\[|\(|greatest hits|player's choice|not for resale/i.test(c.name) && !/greatest hits|player's choice/i.test(title || '')) s -= 1
    return s
  }
  return [...candidates].map((c) => ({ ...c, score: score(c) })).sort((a, b) => b.score - a.score)
}
