export const ITEM_TYPES = [
  { id: 'game', label: 'Game', plural: 'Games' },
  { id: 'magazine', label: 'Magazine', plural: 'Magazines' },
  { id: 'guide', label: 'Strategy Guide', plural: 'Strategy Guides' },
  { id: 'manual', label: 'Manual', plural: 'Manuals' },
  { id: 'box', label: 'Box / Packaging', plural: 'Boxes' },
  { id: 'console', label: 'Console', plural: 'Consoles' },
  { id: 'accessory', label: 'Accessory', plural: 'Accessories' },
]

export const typeLabel = (id, plural = false) => {
  const t = ITEM_TYPES.find((t) => t.id === id)
  return t ? (plural ? t.plural : t.label) : id
}

export const PLATFORMS = [
  'NES', 'SNES', 'Nintendo 64', 'GameCube', 'Game Boy', 'Game Boy Color',
  'Game Boy Advance', 'Sega Master System', 'Sega Genesis', 'Sega CD',
  'Sega 32X', 'Sega Saturn', 'Dreamcast', 'Game Gear', 'PlayStation',
  'PlayStation 2', 'Atari 2600', 'Atari 7800', 'TurboGrafx-16', 'Neo Geo',
  'Multi-platform', 'Other',
]

export const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor']

export const COMPLETENESS_STATES = [
  'Complete', 'Near Complete', 'Incomplete',
  'Cartridge Only', 'Disc Only', 'Box Only', 'Manual Only', 'Parts',
]

export const REGIONS = ['North America (NTSC-U)', 'Japan (NTSC-J)', 'Europe (PAL)', 'Other']

export const ACQUISITION_METHODS = ['Purchase', 'Trade', 'Gift', 'Found', 'Original Owner', 'Unknown']

// Where copies come from. A fixed vocabulary plus whatever the collection
// already uses, so "eBay", "EBAY" and "E bay" never become three sources.
export const SOURCES = [
  'eBay', 'Local game store', 'Retro game convention', 'Facebook Marketplace', 'Mercari',
  'Craigslist', 'Garage sale', 'Flea market', 'Thrift store', 'Friend or family', 'Amazon',
  'GameStop', 'Original purchase',
]

export const TEMP_STATUSES = [
  'On Display', 'In Transit', 'Being Repaired', 'Being Photographed',
  'On Loan', 'At Convention', 'Temporary Storage', 'Unknown Location',
]

export const LOCATION_KINDS = [
  { id: 'house', label: 'House / Building' },
  { id: 'room', label: 'Room' },
  { id: 'area', label: 'Storage Area' },
  { id: 'shelf', label: 'Shelf' },
  { id: 'container', label: 'Container' },
]

export const CONTAINER_TYPES = [
  'Cardboard box', 'Plastic bin', 'Storage tote', 'Cabinet', 'Display case',
  'Magazine box', 'Binder', 'Drawer',
]

// Default component checklists per item type — the basis for completeness %.
export const DEFAULT_COMPONENTS = {
  game: ['Cartridge/Disc', 'Box', 'Manual', 'Inserts', 'Registration Card'],
  magazine: ['Magazine', 'Poster', 'Inserts'],
  guide: ['Guide', 'Poster/Map', 'Inserts'],
  manual: ['Manual'],
  box: ['Box', 'Tray/Insert'],
  console: ['Console', 'Box', 'Manual', 'Power Supply', 'AV Cables', 'Controller'],
  accessory: ['Accessory', 'Box', 'Manual'],
}

// Approximate licensed North American library sizes, used for set-completion
// stats where we have a reasonable public figure.
export const LIBRARY_SIZES = {
  NES: 677,
  SNES: 717,
  'Nintendo 64': 296,
  'Sega Genesis': 713,
  'Game Boy': 1046,
  PlayStation: 1300,
}

export const conditionRank = (c) => CONDITIONS.indexOf(c) // 0 = Mint

// A part the release never shipped with (omitted during the scan) is not a
// missing part, so it is left out of the denominator.
export function completenessPercent(components) {
  const counted = (components || []).filter((c) => !c.omitted)
  if (counted.length === 0) return null
  const present = counted.filter((c) => c.present).length
  return Math.round((present / counted.length) * 100)
}

export const currency = (n) =>
  n == null || isNaN(n)
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const timeAgo = (iso) => {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
