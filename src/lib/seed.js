import { uid } from './id'
import { DEFAULT_COMPONENTS } from './constants'

// Demo data so the app is explorable on first launch. "Reset demo data" in
// Settings rebuilds this; clearing it entirely leaves an empty collection.

const comps = (type, missing = []) =>
  (DEFAULT_COMPONENTS[type] || []).map((name) => ({
    id: uid('comp'),
    name,
    present: !missing.includes(name),
    condition: null,
  }))

export function buildSeedState() {
  const users = [
    { id: 'user_michael', name: 'Michael' },
    { id: 'user_brother', name: 'Brother' },
  ]

  // Locations
  const L = {}
  const loc = (key, name, kind, parentKey, extra = {}) => {
    const l = {
      id: uid('loc'),
      name,
      kind,
      parentId: parentKey ? L[parentKey].id : null,
      qrCode: kind === 'container' ? `CAT-${String(Object.keys(L).length + 1).padStart(4, '0')}` : null,
      ...extra,
    }
    L[key] = l
    return l
  }

  loc('mh', "Michael's House", 'house', null)
  loc('mh_office', 'Office', 'room', 'mh')
  loc('mh_garage', 'Garage', 'room', 'mh')
  loc('mh_bookshelf', 'Bookshelf', 'area', 'mh_office')
  loc('mh_shelf2', 'Shelf 2', 'shelf', 'mh_garage')
  loc('mh_shelf3', 'Shelf 3', 'shelf', 'mh_bookshelf')
  loc('snesbox3', 'SNES Storage Box #3', 'container', 'mh_shelf2', { containerType: 'Cardboard box' })
  loc('snesbox2', 'SNES Storage Box #2', 'container', 'mh_shelf3', { containerType: 'Cardboard box' })

  loc('bh', "Brother's House", 'house', null)
  loc('bh_gameroom', 'Game Room', 'room', 'bh')
  loc('bh_closet', 'Closet', 'area', 'bh_gameroom')
  loc('bh_display', 'Display Case', 'area', 'bh_gameroom')
  loc('bin7', 'Plastic Bin #7', 'container', 'bh_closet', { containerType: 'Plastic bin' })

  const locations = Object.values(L)

  const baseItem = (over) => ({
    id: uid('item'),
    type: 'game',
    title: '',
    platform: null,
    publisher: null,
    developer: null,
    releaseYear: null,
    region: 'North America (NTSC-U)',
    franchise: null,
    genre: null,
    edition: null,
    condition: 'Very Good',
    completeness: 'Incomplete',
    components: [],
    photos: [],
    locationId: null,
    tempStatus: null,
    purchasePrice: null,
    purchaseDate: null,
    acquisitionMethod: 'Unknown',
    source: null,
    estimatedValue: null,
    notes: null,
    aiFields: {},
    createdAt: new Date().toISOString(),
    createdBy: 'user_michael',
    updatedAt: new Date().toISOString(),
    ...over,
  })

  const items = [
    baseItem({
      title: 'Super Metroid', platform: 'SNES', publisher: 'Nintendo', developer: 'Nintendo R&D1',
      releaseYear: 1994, franchise: 'Metroid', genre: 'Action-Adventure',
      condition: 'Very Good', completeness: 'Near Complete',
      components: comps('game', ['Registration Card']),
      locationId: L.snesbox3.id, purchasePrice: 85, purchaseDate: '2024-06-12',
      acquisitionMethod: 'Purchase', source: 'Retro Games Plus', estimatedValue: 160,
    }),
    baseItem({
      title: 'Chrono Trigger', platform: 'SNES', publisher: 'Square', developer: 'Square',
      releaseYear: 1995, genre: 'RPG', condition: 'Excellent', completeness: 'Complete',
      components: comps('game'),
      locationId: L.snesbox2.id, purchasePrice: 85, purchaseDate: '2024-06-12',
      acquisitionMethod: 'Purchase', source: 'eBay', estimatedValue: 247,
    }),
    baseItem({
      title: 'F-Zero', platform: 'SNES', publisher: 'Nintendo', releaseYear: 1991,
      franchise: 'F-Zero', genre: 'Racing', condition: 'Good', completeness: 'Cartridge Only',
      components: comps('game', ['Box', 'Manual', 'Inserts', 'Registration Card']),
      locationId: L.snesbox2.id, estimatedValue: 25, acquisitionMethod: 'Original Owner',
    }),
    baseItem({
      title: 'Super Mario World', platform: 'SNES', publisher: 'Nintendo', releaseYear: 1991,
      franchise: 'Super Mario', genre: 'Platformer', condition: 'Good', completeness: 'Cartridge Only',
      components: comps('game', ['Box', 'Manual', 'Inserts', 'Registration Card']),
      locationId: L.snesbox3.id, estimatedValue: 30, acquisitionMethod: 'Original Owner',
    }),
    baseItem({
      title: 'Super Mario World', platform: 'SNES', publisher: 'Nintendo', releaseYear: 1991,
      franchise: 'Super Mario', genre: 'Platformer', condition: 'Excellent', completeness: 'Complete',
      components: comps('game'),
      edition: 'Player’s Choice',
      locationId: L.bin7.id, purchasePrice: 60, purchaseDate: '2025-02-01',
      acquisitionMethod: 'Purchase', source: 'Flea market', estimatedValue: 95, createdBy: 'user_brother',
    }),
    baseItem({
      title: 'The Legend of Zelda', platform: 'NES', publisher: 'Nintendo', releaseYear: 1987,
      franchise: 'The Legend of Zelda', genre: 'Action-Adventure', condition: 'Very Good',
      completeness: 'Near Complete', components: comps('game', ['Inserts', 'Registration Card']),
      locationId: L.bh_display.id, estimatedValue: 140, createdBy: 'user_brother',
    }),
    baseItem({
      title: 'Super Mario Bros. 3', platform: 'NES', publisher: 'Nintendo', releaseYear: 1990,
      franchise: 'Super Mario', genre: 'Platformer', condition: 'Good', completeness: 'Cartridge Only',
      components: comps('game', ['Box', 'Manual', 'Inserts', 'Registration Card']),
      locationId: L.bin7.id, estimatedValue: 35, createdBy: 'user_brother',
    }),
    baseItem({
      type: 'magazine', title: 'Nintendo Power #42', platform: 'Multi-platform',
      publisher: 'Nintendo of America', releaseYear: 1992, issueNumber: 42,
      publicationDate: '1992-11-01', franchise: 'Nintendo Power',
      condition: 'Very Good', completeness: 'Near Complete',
      components: comps('magazine', ['Inserts']),
      locationId: L.bin7.id, estimatedValue: 22, createdBy: 'user_brother',
    }),
    baseItem({
      type: 'magazine', title: 'Nintendo Power #87', platform: 'Multi-platform',
      publisher: 'Nintendo of America', releaseYear: 1996, issueNumber: 87,
      publicationDate: '1996-08-01', franchise: 'Nintendo Power',
      condition: 'Good', completeness: 'Incomplete',
      components: comps('magazine', ['Poster', 'Inserts']),
      locationId: L.bin7.id, estimatedValue: 15, createdBy: 'user_brother',
    }),
    baseItem({
      type: 'guide', title: 'Super Metroid Player’s Guide', publisher: 'Nintendo of America',
      releaseYear: 1994, platform: 'SNES', franchise: 'Metroid', condition: 'Very Good',
      completeness: 'Complete', components: comps('guide'),
      locationId: L.mh_shelf3.id, estimatedValue: 45,
    }),
    baseItem({
      type: 'console', title: 'Super Nintendo Entertainment System', platform: 'SNES',
      publisher: 'Nintendo', model: 'SNS-001', serialNumber: 'UN241587332', releaseYear: 1991,
      condition: 'Good', completeness: 'Incomplete', workingStatus: 'Working',
      components: comps('console', ['Box', 'Manual']),
      locationId: L.mh_shelf2.id, estimatedValue: 90, acquisitionMethod: 'Original Owner',
    }),
    baseItem({
      type: 'accessory', title: 'SNES Controller (OEM)', platform: 'SNES', publisher: 'Nintendo',
      model: 'SNS-005', condition: 'Very Good', completeness: 'Complete',
      components: comps('accessory', ['Box', 'Manual']),
      locationId: L.mh_shelf2.id, estimatedValue: 20,
    }),
    baseItem({
      type: 'manual', title: 'Super Mario World Manual', platform: 'SNES',
      publisher: 'Nintendo', condition: 'Good', completeness: 'Complete',
      components: comps('manual'), notes: 'Standalone replacement manual.',
      locationId: L.snesbox3.id, estimatedValue: 12,
    }),
  ]

  const locationHistory = items
    .filter((i) => i.locationId)
    .map((i) => ({
      id: uid('hist'),
      subjectType: 'item',
      subjectId: i.id,
      locationId: i.locationId,
      tempStatus: null,
      path: '(initial catalog entry)',
      at: i.createdAt,
      by: i.createdBy,
    }))

  return {
    version: 1,
    users,
    currentUserId: 'user_michael',
    items,
    locations,
    locationHistory,
    activityLog: [],
    wishlist: [
      {
        id: uid('wish'), title: 'EarthBound', platform: 'SNES', desiredCondition: 'Very Good',
        desiredCompleteness: 'Complete', targetPrice: 300, priority: 'High',
        createdAt: new Date().toISOString(),
      },
      {
        id: uid('wish'), title: 'Mega Man 6', platform: 'NES', desiredCondition: 'Good',
        desiredCompleteness: 'Cartridge Only', targetPrice: 60, priority: 'Medium',
        createdAt: new Date().toISOString(),
      },
    ],
    settings: {},
  }
}
