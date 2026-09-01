# Catalog

A mobile-first collection management app for retro video games and related media —
games, magazines, strategy guides, manuals, boxes, consoles, and accessories.

The core loop: **SCAN → IDENTIFY → CATALOG → LOCATE → ANALYZE.**

Catalog treats the collection like a museum collections-management system: it doesn't
just know *"we have Super Metroid"* — it knows *this specific physical copy*, its
components (cartridge, box, manual, map), their condition, and that it's currently in
SNES Storage Box #3 on Shelf 2 in the garage at Michael's house.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

The app launches with a small demo collection so every screen is explorable.
Settings → "Reset to demo data" restores it; Export/Import moves the collection
between browsers as JSON.

## What's in the MVP

- **Scan** — photograph an item (multiple angles of the same physical artifact
  supported). With an Anthropic API key saved in Settings, Claude vision identifies
  the release and pre-fills metadata with **per-field confidence scores**; anything
  below high confidence is flagged for user confirmation, never silently treated as
  fact. Without a key, the same flow continues as guided manual entry with the
  photos attached.
- **Collection** — browse, full-text search (titles, publishers, franchises, even
  location paths), filter by type/platform/condition/completeness, and sort.
- **Items as physical artifacts** — per-item component checklists (cartridge, box,
  manual, inserts…) drive a completeness percentage separate from condition; each
  present component can carry its own condition. Duplicate copies are kept as
  distinct physical items and surfaced on each other's detail pages, alongside
  franchise-related items.
- **Locations** — a structured hierarchy (house → room → storage area → shelf →
  container), never a text field. Containers are first-class: moving a container
  moves everything inside it, and each container gets a printable QR label that
  opens its contents. Temporary statuses (On Loan, In Transit, Being Repaired…)
  cover physical reality outside the shelf hierarchy. Location history is
  append-only — moves never destroy where something used to be.
- **Analytics** — totals, estimated value vs. amount spent (always labeled as
  estimates), breakdowns by platform / media type / decade / location, set
  completion against known library sizes (NES, SNES, Genesis…), and generated
  insights ("41% of your games are missing original manuals", duplicate detection).
- **Shared collection** — two users (switchable in Settings) with an activity
  history recording who added, updated, and moved what.
- **Wishlist** — separate from the collection, with desired condition,
  completeness, target price, and priority.

## Architecture

- **Front end:** React 18 + Vite + Tailwind CSS 4, mobile-first, hash-routed so it
  can be hosted statically.
- **State:** a single reducer store (`src/lib/store.jsx`) persisted to
  `localStorage`, seeded with demo data (`src/lib/seed.js`). Photos are compressed
  to small JPEG data URLs on-device (`src/lib/image.js`) so they fit in local
  storage.
- **AI:** `src/lib/ai.js` calls the Anthropic API (`claude-opus-5`, official
  `@anthropic-ai/sdk`) directly from the browser with the user's own key, which is
  stored only on-device. It returns structured fields plus per-field confidence,
  rendered as confirm-me badges in the add-item form.
- **Backend path:** `supabase/schema.sql` contains the production schema —
  collections + members, the location tree, items, components, images, append-only
  location history, valuations, wishlist, and activity, all under row-level
  security so only collection members can read or write. The local store mirrors
  this shape, so swapping the persistence layer is contained to `store.jsx`.

## Layout

```
src/
  lib/         store, seed data, location & stats helpers, AI service, constants
  components/  UI primitives, item cards, bar charts, the location picker
  pages/       Home, Collection, ItemDetail, ItemForm, Scan, Locations,
               LocationDetail, Analytics, Wishlist, Settings
supabase/
  schema.sql   production PostgreSQL schema with RLS
```

All prices and values shown in the app are estimates for planning, not guaranteed
resale prices.
