// What a copy is supposed to contain, and what this one actually does.
//
// The checklist a user confirms against should be the release's own as-sold
// contents — two discs, a longbox, a registration card — not a generic list
// that asks whether every game has a poster. There is no database of that;
// the identify call supplies it from what it knows about the release, and the
// value lookup corroborates from the listings it reads. This module merges
// those into one list without ever silently removing a row.

import { DEFAULT_COMPONENTS } from './constants.js'
import { uid } from './id.js'

const key = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Aliases the model and listings use interchangeably for one physical part,
// so "Disc" and "Cartridge/Disc" don't become two rows.
const ALIAS = {
  'cartridge disc': 'media', cartridge: 'media', cart: 'media', disc: 'media', 'game disc': 'media', 'game cartridge': 'media',
  'map poster': 'poster', poster: 'poster', map: 'poster', 'poster map': 'poster', 'map poster insert': 'poster',
  'registration card': 'reg', 'reg card': 'reg', 'warranty card': 'reg', 'warranty registration card': 'reg',
  box: 'box', 'outer box': 'box', 'cardboard box': 'box',
  'jewel case': 'case', 'keep case': 'case', case: 'case', 'dvd case': 'case', longbox: 'case', 'long box': 'case',
  manual: 'manual', 'instruction manual': 'manual', 'instruction booklet': 'manual', booklet: 'manual',
  inserts: 'inserts', insert: 'inserts',
  'tray insert': 'tray', tray: 'tray', 'cardboard tray': 'tray', 'plastic tray': 'tray',
}

export const sameName = (a, b) => {
  const ka = key(a)
  const kb = key(b)
  return ka === kb || Boolean(ALIAS[ka] && ALIAS[ka] === ALIAS[kb])
}

const row = (name, extra = {}) => ({ id: uid('comp'), name, present: false, condition: null, ...extra })

// Build the checklist. Prefers the release manifest; falls back to the
// standard list for the item type. Parts the model saw in the photos are
// pre-ticked, matched by alias so "Disc" ticks "Disc 1"-style rows only when
// the name is genuinely the same part.
export function buildComponents(type, detected = [], manifest = []) {
  const seen = (name) => detected.some((d) => sameName(d, name))
  const list = Array.isArray(manifest)
    ? manifest.filter((m) => m && typeof m.name === 'string' && m.name.trim())
    : []

  let rows
  if (list.length) {
    rows = list.map((m) =>
      row(m.name.trim(), {
        present: seen(m.name),
        source: 'release',
        // Below this the model was guessing about the insert; the row says so.
        unsure: typeof m.confidence === 'number' && m.confidence < 0.6,
      }),
    )
  } else {
    const base = DEFAULT_COMPONENTS[type] || DEFAULT_COMPONENTS.game
    rows = base.map((name) => row(name, { present: seen(name), source: 'standard' }))
  }

  // Anything seen in the photos that neither list mentions still belongs on
  // this copy's checklist.
  for (const d of detected) {
    if (!rows.some((r) => sameName(r.name, d))) rows.push(row(d, { present: true, source: 'photo' }))
  }
  return rows
}

// Listings evidence arrives later and only ever adds: a part that sellers
// describe a complete copy including, which the checklist lacks, becomes an
// unticked row tagged with where it came from.
export function mergeListingContents(components, contents = []) {
  if (!Array.isArray(contents) || !contents.length) return components
  const added = contents
    .filter((c) => typeof c === 'string' && c.trim())
    .filter((c) => !components.some((r) => sameName(r.name, c)))
    .map((c) => row(c.trim(), { source: 'listing' }))
  if (!added.length) return components
  // Corroborated rows lose their "unsure" tag.
  const corroborated = components.map((r) =>
    r.unsure && contents.some((c) => sameName(r.name, c)) ? { ...r, unsure: false } : r,
  )
  return [...corroborated, ...added]
}

export function addComponent(components, name) {
  const clean = String(name || '').trim()
  if (!clean || components.some((r) => sameName(r.name, clean))) return components
  return [...components, row(clean, { present: true, source: 'user' })]
}

const isMedia = (name) => ALIAS[key(name)] === 'media' || /\b(disc|cartridge|cart|cd)\b/i.test(name)

// Derives the completeness state from the ticks, so the user is not asked the
// same question twice and the value lookup prices the right market.
export function inferCompleteness(components, type = 'game') {
  const total = components.length
  const present = components.filter((c) => c.present)
  if (!total || !present.length) return 'Incomplete'
  if (present.length === total) return 'Complete'

  if (present.length === 1) {
    const only = present[0].name
    if (isMedia(only)) return /disc|cd/i.test(only) ? 'Disc Only' : 'Cartridge Only'
    if (ALIAS[key(only)] === 'box' || ALIAS[key(only)] === 'case') return 'Box Only'
    if (ALIAS[key(only)] === 'manual') return 'Manual Only'
  }
  // What collectors mean by "CIB" is media + box + manual; the inserts are
  // what separate near-complete from complete. So a copy with those three
  // and a missing poster is Near Complete, and a copy with everything except
  // the manual is not — that is the boxed market, which prices differently.
  const mediaRows = components.filter((c) => isMedia(c.name))
  const mediaAllPresent = mediaRows.length > 0 && mediaRows.every((c) => c.present)
  if (mediaRows.length && !mediaAllPresent) return type === 'game' ? 'Parts' : 'Incomplete'

  const has = (kind) => components.some((c) => c.present && ALIAS[key(c.name)] === kind)
  const listed = (kind) => components.some((c) => ALIAS[key(c.name)] === kind)
  const packaging = listed('box') || listed('case') ? has('box') || has('case') : true
  const manual = listed('manual') ? has('manual') : true
  if (packaging && manual) return 'Near Complete'
  // No box or manual row to judge by (a magazine, a guide): missing one part
  // of a short list is still near complete.
  if (!listed('box') && !listed('case') && !listed('manual') && total - present.length === 1) return 'Near Complete'
  return 'Incomplete'
}

// Keyword icons, since release manifests use free-form names.
export function iconFor(name) {
  const k = key(name)
  if (/disc|cd|dvd/.test(k)) return '💿'
  if (/cart|cartridge/.test(k)) return '🕹'
  if (/case|box|longbox/.test(k)) return '📦'
  if (/manual|booklet/.test(k)) return '📄'
  if (/poster|map/.test(k)) return '🗺'
  if (/registration|warranty|reg card/.test(k)) return '✉'
  if (/controller/.test(k)) return '🎮'
  if (/console|system/.test(k)) return '🎮'
  if (/power supply|ac adapter|power adapter|psu/.test(k)) return '🔌'
  if (/cable|av|rf/.test(k)) return '🔗'
  if (/magazine/.test(k)) return '📖'
  if (/guide/.test(k)) return '📘'
  if (/tray/.test(k)) return '📦'
  if (/sticker|decal/.test(k)) return '🏷'
  if (/insert|sheet|card|flyer|catalog|ad/.test(k)) return '🧾'
  return '▢'
}
