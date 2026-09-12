// One vocabulary for where copies come from: the fixed list plus every
// source already on an item, so "eBay", "EBAY" and "E bay" can never become
// three sources.

import { SOURCES } from './constants.js'

const fold = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

export function knownSources(items = []) {
  const out = [...SOURCES]
  for (const it of items) {
    if (it?.source && !out.some((s) => fold(s) === fold(it.source))) out.push(it.source)
  }
  return out
}

// A typed source that matches an existing one — by case, spacing, or
// punctuation — becomes that existing one rather than a near-duplicate.
export function canonicalSource(typed, known) {
  const clean = String(typed || '').trim()
  if (!clean) return ''
  return known.find((s) => fold(s) === fold(clean)) || clean
}
