// Turning a price-guide product into the number for this copy, and keeping
// it current.
//
// PriceCharting gives one figure per completeness — loose, CIB, new, box
// only, manual only — as a median of recent sold listings. Condition is then
// an explicit, visible adjustment around that median. These multipliers are
// a stated house rule, not market data; the card says so, and they live here
// so they can be argued with in one place.

export const CONDITION_ADJUST = {
  Mint: 1.3,
  'Near Mint': 1.2,
  Excellent: 1.1,
  'Very Good': 1.0,
  Good: 0.9,
  Fair: 0.75,
  Poor: 0.6,
}

// Which guide figure a completeness state trades at. Incomplete (boxed, no
// manual) is derived as CIB minus the manual-only price when both exist —
// the guide prices the parts separately, so the arithmetic is theirs.
export function guidePriceFor(prices, completeness) {
  if (!prices) return null
  const p = prices
  switch (completeness) {
    case 'Complete':
      return p.cib != null ? { amount: p.cib, basis: 'complete in box' } : null
    case 'Near Complete':
      return p.cib != null ? { amount: p.cib, basis: 'complete in box, less a minor insert' } : null
    case 'Incomplete':
      if (p.cib != null && p.manualOnly != null && p.cib > p.manualOnly) {
        return { amount: p.cib - p.manualOnly, basis: 'complete price less the manual' }
      }
      if (p.loose != null && p.boxOnly != null) return { amount: p.loose + p.boxOnly, basis: 'loose plus box' }
      return p.loose != null ? { amount: p.loose, basis: 'loose — closest figure available', approximate: true } : null
    case 'Cartridge Only':
    case 'Disc Only':
      return p.loose != null ? { amount: p.loose, basis: 'loose' } : null
    case 'Box Only':
      return p.boxOnly != null ? { amount: p.boxOnly, basis: 'box only' } : null
    case 'Manual Only':
      return p.manualOnly != null ? { amount: p.manualOnly, basis: 'manual only' } : null
    case 'Parts':
      return p.loose != null ? { amount: p.loose, basis: 'loose — closest figure available', approximate: true } : null
    default:
      return p.cib != null ? { amount: p.cib, basis: 'complete in box' } : null
  }
}

// The number for this copy: the guide figure for its completeness, adjusted
// for its condition. Returns null when the guide has no figure for that
// configuration rather than inventing one.
export function marketValueFor(market, { condition, completeness } = {}) {
  const base = guidePriceFor(market?.prices, completeness)
  if (!base) return null
  const factor = CONDITION_ADJUST[condition] ?? 1
  return {
    amount: Math.round(base.amount * factor),
    guide: Math.round(base.amount),
    basis: base.basis,
    approximate: Boolean(base.approximate),
    condition: condition || 'Very Good',
    factor,
  }
}

// Bounded price history on the item, so the detail page can show how the
// figure has moved. One point per refresh; oldest dropped past the cap.
export const HISTORY_CAP = 60

export function appendHistory(history, prices, at) {
  const point = { at, loose: prices?.loose ?? null, cib: prices?.cib ?? null, new: prices?.new ?? null }
  const list = Array.isArray(history) ? history : []
  const last = list[list.length - 1]
  // Same prices as the last point: record the check, not a duplicate point.
  if (last && last.loose === point.loose && last.cib === point.cib && last.new === point.new) {
    return [...list.slice(0, -1), { ...last, checkedAt: at }]
  }
  return [...list, point].slice(-HISTORY_CAP)
}

// Change since the previous distinct price point, for the completeness the
// copy trades at.
export function priceChange(item) {
  const history = item?.market?.history
  if (!Array.isArray(history) || history.length < 2) return null
  const key = /Only|Parts/.test(item.completeness || '') ? 'loose' : 'cib'
  const now = history[history.length - 1][key]
  const before = history[history.length - 2][key]
  if (now == null || before == null || before === 0) return null
  return { key, from: before, to: now, delta: now - before, pct: (now - before) / before, since: history[history.length - 2].at }
}

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function isStale(market, now = Date.now()) {
  if (!market?.fetchedAt) return true
  return now - new Date(market.fetchedAt).getTime() > STALE_AFTER_MS
}

// Applies a fresh product read to an item: prices, history, and — unless the
// user set the value by hand — the estimated value the analytics run on.
export function applyMarket(item, product, at = new Date().toISOString()) {
  const market = {
    ...(item.market || {}),
    provider: product.provider,
    productId: product.productId,
    name: product.name,
    console: product.console,
    url: product.url,
    prices: product.prices,
    fetchedAt: at,
    history: appendHistory(item.market?.history, product.prices, at),
  }
  const patch = { market }
  if (item.valueSource !== 'manual') {
    const v = marketValueFor(market, { condition: item.condition, completeness: item.completeness })
    if (v) {
      patch.estimatedValue = v.amount
      patch.valueSource = 'market'
    }
  }
  return patch
}
