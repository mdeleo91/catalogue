// Turning a searched market range into the number for *this* copy.
//
// The lookup runs once, when the match is accepted — before the user has told
// us what condition the copy is in. So it does not ask for a single figure.
// It asks for what the market pays at each level of completeness, and this
// module positions the user's copy inside that range as they pick a condition.
// One search, a number that updates instantly, and arithmetic the app can
// explain rather than a figure the model invented.

// Where each condition sits between the low and high end of a range. Mint is
// the top of what the comps show; Poor is near the floor.
const POSITION = {
  Mint: 1,
  'Near Mint': 0.88,
  Excellent: 0.72,
  'Very Good': 0.55,
  Good: 0.35,
  Fair: 0.15,
  Poor: 0.05,
}

// Which market a given completeness state trades in. Box Only / Manual Only /
// Parts are deliberately absent: comps for a whole copy say nothing about what
// a loose manual sells for, and guessing from them would be making it up.
const MARKET = {
  Complete: 'complete',
  'Near Complete': 'near',
  Incomplete: 'boxed',
  'Cartridge Only': 'loose',
  'Disc Only': 'loose',
}

const LABEL = {
  loose: 'loose — no box or manual',
  boxed: 'boxed, without the manual',
  complete: 'complete',
  near: 'between boxed and complete',
}

const valid = (r) =>
  r && typeof r.low === 'number' && typeof r.high === 'number' && r.high >= r.low && r.high > 0

// Near Complete genuinely straddles two markets, so it spans them rather than
// picking one and fudging it.
function rangeFor(anchors, market) {
  if (market === 'near') {
    const boxed = valid(anchors.boxed) ? anchors.boxed : null
    const complete = valid(anchors.complete) ? anchors.complete : null
    if (complete && boxed) return { low: boxed.low, high: complete.high }
    return complete || boxed
  }
  return valid(anchors[market]) ? anchors[market] : null
}

// Falls back through progressively less specific markets rather than showing
// nothing: a loose price is still information about a boxed copy.
const FALLBACK = { complete: ['complete', 'near', 'boxed', 'loose'], near: ['near', 'complete', 'boxed', 'loose'], boxed: ['boxed', 'complete', 'near', 'loose'], loose: ['loose', 'boxed', 'near', 'complete'] }

export function valueFor(data, { condition, completeness } = {}) {
  const anchors = data?.anchors
  if (!anchors) return null

  const wanted = MARKET[completeness]
  if (!wanted) {
    return { amount: null, reason: `The listings found price whole copies, not a ${(completeness || 'partial').toLowerCase()} one.` }
  }

  let market = null
  let range = null
  for (const candidate of FALLBACK[wanted]) {
    range = rangeFor(anchors, candidate)
    if (range) {
      market = candidate
      break
    }
  }
  if (!range) return { amount: null, reason: 'No usable prices came back from the search.' }

  const position = POSITION[condition] ?? POSITION['Very Good']
  const amount = Math.round(range.low + (range.high - range.low) * position)

  return {
    amount,
    low: Math.round(range.low),
    high: Math.round(range.high),
    basis: LABEL[market],
    // True when we had to price against a different market than the user's
    // copy actually sits in, which the card says out loud.
    approximate: market !== wanted,
    condition: condition || 'Very Good',
  }
}
