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

The app has two modes:

- **Demo mode** (no configuration): launches with a small seeded collection stored
  in the browser's localStorage, with a user switcher instead of real accounts.
- **Cloud mode** (Supabase configured): real email/password accounts, one shared
  collection for the family, live sync between devices.

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor**, paste the entire contents of
   `supabase/schema.sql`, and run it once. This creates the tables, row-level
   security, invite-code functions, and realtime publication.
3. Under **Authentication → Sign In / Up**, make sure the **Email** provider is
   enabled. Optional: turn off "Confirm email" so accounts work instantly
   (otherwise each account must click a confirmation link first — the app
   handles that flow too).
4. In Vercel → Project → **Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL` — Supabase → **Settings → Data API → Project URL**.
     It is always `https://<project-ref>.supabase.co`, and the project ref is
     the id in your dashboard's address bar.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase → **Settings → API Keys →
     Publishable key** (starts with `sb_publishable_`). This is the
     browser-safe key that replaced the old `anon` key; on older projects the
     legacy `anon` JWT works too, under either this name or
     `VITE_SUPABASE_ANON_KEY`.

   Never put a **secret** key (`sb_secret_…` / `service_role`) in either
   variable — those bypass row-level security and must stay server-side.
5. Redeploy. The app now opens with a sign-in screen.

First use: create an account, tap **Start a collection**, and enter your name.
Settings then shows an **invite code** — the second family member creates their
own account, taps **Join with a code**, and enters it. Both accounts now see and
edit the same live collection; every add/edit/move is attributed in the shared
activity history and syncs to other signed-in devices within a second or two.

The anon key is safe to expose in the front end: every table is protected by
row-level security, so a signed-in user can only touch the collection they are
a member of, and signed-out requests can touch nothing.

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
- **State:** a single reducer store (`src/lib/store.jsx`) with two persistence
  backends behind the same dispatch API. Demo mode persists the whole state to
  `localStorage` (seeded from `src/lib/seed.js`). Cloud mode loads the shared
  collection from Supabase, diffs each reducer transition, and upserts/deletes
  the changed rows; realtime `postgres_changes` events (and tab re-focus)
  trigger a refetch so other members' edits appear live. Photos are compressed
  to small JPEG data URLs on-device (`src/lib/image.js`).
- **Auth:** `src/lib/auth.jsx` + `src/pages/SignIn.jsx` /
  `src/pages/CollectionSetup.jsx` — Supabase email/password accounts, then
  create-or-join a shared collection via an invite code (server-side RPCs). The
  Anthropic API key stays per-device in localStorage, never in the database.
- **AI:** `src/lib/ai.js` calls the Anthropic API (`claude-opus-5`, official
  `@anthropic-ai/sdk`) directly from the browser with the user's own key, which is
  stored only on-device. It returns structured fields plus per-field confidence,
  rendered as confirm-me badges in the add-item form.
- **Backend:** `supabase/schema.sql` — collections and members are relational;
  collection content (items, locations, history, activity, wishlist) is stored
  document-style with the app's row shape in a `jsonb` column, since all search
  and analytics happen client-side over a family-sized collection. Everything
  sits behind row-level security keyed on collection membership, and the
  create/join flows are `security definer` RPCs.

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
