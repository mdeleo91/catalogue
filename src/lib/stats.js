import { ITEM_TYPES, LIBRARY_SIZES } from './constants'
import { rootOf } from './locations'

export function countBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export function sumBy(items, keyFn, valueFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    const v = valueFn(item)
    if (!key || v == null || isNaN(v)) continue
    map.set(key, (map.get(key) || 0) + v)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export const decadeOf = (item) =>
  item.releaseYear ? `${Math.floor(item.releaseYear / 10) * 10}s` : null

export function overview(items) {
  const totalValue = items.reduce((s, i) => s + (i.estimatedValue || 0), 0)
  const totalSpent = items.reduce((s, i) => s + (i.purchasePrice || 0), 0)
  const byType = ITEM_TYPES.map((t) => ({
    ...t,
    count: items.filter((i) => i.type === t.id).length,
  })).filter((t) => t.count > 0)
  const complete = items.filter((i) => i.completeness === 'Complete').length
  return {
    total: items.length,
    games: items.filter((i) => i.type === 'game').length,
    totalValue,
    totalSpent,
    gain: totalValue - totalSpent,
    byType,
    completePct: items.length ? Math.round((complete / items.length) * 100) : 0,
  }
}

export function byHouse(items, locations) {
  const map = new Map()
  let floating = 0
  for (const item of items) {
    if (!item.locationId) {
      floating += 1
      continue
    }
    const root = rootOf(locations, item.locationId)
    const name = root ? root.name : 'Other'
    map.set(name, (map.get(name) || 0) + 1)
  }
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1])
  if (floating) rows.push(['Other / Temporary', floating])
  return rows
}

export function platformCompletion(items) {
  return Object.entries(LIBRARY_SIZES)
    .map(([platform, librarySize]) => {
      const owned = new Set(
        items.filter((i) => i.type === 'game' && i.platform === platform).map((i) => i.title.toLowerCase()),
      ).size
      return { platform, owned, librarySize, pct: Math.round((owned / librarySize) * 1000) / 10 }
    })
    .filter((r) => r.owned > 0)
    .sort((a, b) => b.pct - a.pct)
}

export function duplicates(items) {
  const map = new Map()
  for (const item of items) {
    if (item.type !== 'game') continue
    const key = `${item.title.toLowerCase()}|${item.platform || ''}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.values()].filter((group) => group.length > 1)
}

export function franchises(items) {
  const map = new Map()
  for (const item of items) {
    if (!item.franchise) continue
    if (!map.has(item.franchise)) map.set(item.franchise, [])
    map.get(item.franchise).push(item)
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

export function insights(items) {
  const out = []
  for (const { platform, owned, librarySize, pct } of platformCompletion(items)) {
    out.push(`Your ${platform} collection is ${pct}% complete (${owned} of ~${librarySize} titles).`)
  }
  const games = items.filter((i) => i.type === 'game')
  if (games.length) {
    const missingManual = games.filter(
      (g) => g.components?.some((c) => c.name === 'Manual' && !c.present),
    ).length
    if (missingManual) {
      out.push(`${Math.round((missingManual / games.length) * 100)}% of your games are missing original manuals.`)
    }
  }
  for (const group of duplicates(items)) {
    out.push(`You own ${group.length} copies of ${group[0].title}.`)
  }
  const total = items.reduce((s, i) => s + (i.estimatedValue || 0), 0)
  if (total > 0) {
    for (const [franchise, group] of franchises(items)) {
      const v = group.reduce((s, i) => s + (i.estimatedValue || 0), 0)
      const share = Math.round((v / total) * 100)
      if (share >= 15) out.push(`${franchise} represents ${share}% of your collection's estimated value.`)
    }
  }
  return out
}
