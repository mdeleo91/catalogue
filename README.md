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
3. Under **Authentication → Sign In / Providers → Email**, make sure the Email
   provider is enabled and turn **"Confirm email" OFF**, then Save. Accounts
   then work the moment you create them, with no email involved.

   This is not just a convenience — Supabase's built-in email service is for
   testing only. It is rate-limited to a couple of messages an hour and will
   only deliver to addresses attached to your Supabase organization, so a
   family member signing up from their own address would never receive a
   confirmation link. (Leaving confirmation on is only workable if you first
   configure your own SMTP provider under **Authentication → Emails → SMTP
   Settings**. The app supports either flow.)

   If you already signed up before changing this, that account is stuck
   unconfirmed — delete it under **Authentication → Users** and sign up again.
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

The publishable key is safe to expose in the front end: every table is
protected by row-level security, so a signed-in user can only touch the
collection they are a member of, and signed-out requests can touch nothing.

## Turning on AI identification

Neither Anthropic nor OpenAI lets a third-party app run on a user's Claude or
ChatGPT *subscription* — Anthropic explicitly prohibits it and blocks it
server-side, and ChatGPT Plus has never included API access. So there is no
"sign in with your Claude account" option to offer. What this app does instead
is hold one API key on the server, so that **nobody using the app ever handles
a key** — signing in to Catalog is the only step, for you and anyone you
invite.

1. Create a key at [console.anthropic.com](https://console.anthropic.com) →
   **API keys**, and add a little credit under Billing.
2. In Vercel → Project → **Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY` with that value. Leave the `VITE_` prefix off — that
   prefix is what compiles a value into the public browser bundle, and this
   one must stay server-side.
3. Redeploy. Scan now works for every member of the collection.

Usage is billed to that key, roughly a few cents per scan at the configured
model and effort. `api/identify.js` caps each request at 6 photos and 4 MB and
refuses anyone who is not a signed-in member of a collection. To trade accuracy
for cost, change `model` or `output_config.effort` in that file.

## Installing on a phone

### As an Android APK

The APK is built by GitHub Actions — nothing needs to be installed on your
machine. The web build is wrapped in a native shell by
[Capacitor](https://capacitorjs.com): the app ships with its own icon and
runs full-screen, and because the UI is bundled inside the APK it opens
instantly without downloading anything. It talks to the same Supabase
collection as the website, so both stay in sync. (Note there is no offline
mode — viewing or editing the collection needs a connection, since the data
lives in Supabase.)

1. In GitHub → your repo → **Settings → Secrets and variables → Actions**, add
   the same two values you gave Vercel. Either tab works — "Variables" is the
   honest choice since both are public-by-design, "Secrets" also works:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

   The build fails fast with a clear message if these are missing, rather than
   silently shipping an APK stuck in offline demo mode.
2. Go to the **Actions** tab → **Build Android APK** → **Run workflow**.
3. When it finishes (~5 minutes) it publishes a **GitHub Release** tagged
   `v1.0.<build number>` with `catalog.apk` attached. From then on the app
   itself links to it — open the site on your phone and use **Settings →
   Android app → Download APK**. (The release page and the run's
   `catalog-apk` artifact both work too.)
4. Tap the downloaded file to install. Android will ask you to allow
   installing unknown apps from whatever app you opened it with; that prompt
   is expected for any app not installed from the Play Store.

Pushes that touch the app publish a new release automatically, so the
download link is always current.

### Updating

The version number flows from the build into the web app, the APK, and the
release tag, so the installed app can compare them. **Settings → App
version** checks the latest release on open: when there's a newer build it
shows a *Download update* button, otherwise it confirms you're current.
Installing over the existing app keeps your collection — that lives in
Supabase, not on the phone.

The same card on the website shows a *Download APK* button instead, since
there's nothing installed to update.

**About signing:** every build is signed with the keystore committed at
`android/app/catalog-signing.jks`, so all builds share one signature and a new
APK installs straight over the previous one. Left to itself Gradle invents a
throwaway key per machine, which makes Android reject the upgrade with "App
not installed" — pinning the keystore is what prevents that.

That key is in the repo on purpose: it is a self-signed key for sideloading a
personal app, not a credential for any service, and every build needs the same
one. If these APKs are ever distributed more widely, generate a private
keystore (`keytool -genkeypair -keystore catalog.jks -alias catalog -keyalg
RSA -keysize 2048 -validity 10000`), keep it in Actions secrets, and have the
workflow write it out before building.

### As an installable web app (no APK)

The deployed site is also a PWA, which takes seconds and works on iPhone too:
open it in the phone browser and choose **Add to Home Screen** (Safari share
menu, or Chrome's ⋮ menu → *Add to Home screen* / *Install app*). You get the
icon and a full-screen, chrome-less window. What the APK adds over this is a
real installed app entry in the launcher and app list, and a UI bundled in
the package rather than fetched from the network on open.

### Working on the native project

```bash
npm run icons          # regenerate app icons/splash from the brand palette
npm run android:sync   # rebuild the web app and copy it into android/
```

`npx cap open android` opens the project in Android Studio if you want to
build or debug locally instead of via CI.

## What's in the MVP

- **Scan** — photograph an item (multiple angles of the same physical artifact
  supported). Claude vision identifies the release and pre-fills metadata with
  **per-field confidence scores**; anything below high confidence is flagged for
  user confirmation, never silently treated as fact. Identification runs on the
  server, so no one signing in has to obtain or paste an API key. If it is
  unconfigured or unavailable, the same flow continues as guided manual entry
  with the photos attached.
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
- **Shared collection** — real accounts sharing one collection via an invite
  code (a user switcher stands in for this in demo mode), with an activity
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
- **AI:** `api/identify.js` is a Vercel serverless function that calls Claude
  (`claude-opus-5`) with a key held in the server environment. `src/lib/ai.js`
  posts photos to it using the caller's existing Supabase session; the function
  verifies that session and that the caller belongs to a collection before
  spending anything, so the endpoint can't be used by strangers. No API key
  reaches the browser or the APK, and the client bundle no longer carries the
  Anthropic SDK at all.
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
