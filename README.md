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

Anthropic does not let a third-party app run on a user's Claude *subscription*
— it explicitly prohibits it and blocks it server-side — so "sign in with your
Claude account" is not on offer. An API key is the only route. (The same is
true of OpenAI: ChatGPT Plus has never included API access.)

The deployment holds one key, so **nobody using the app ever handles one** —
signing in to Catalog is the only step, for you and anyone you invite.

1. Create a key at [console.anthropic.com](https://console.anthropic.com) →
   **API keys**, and add a little credit under Billing.
2. In Vercel → Project → **Settings → Environment Variables**, add
   `ANTHROPIC_API_KEY`. Leave the `VITE_` prefix off — that prefix is what
   compiles a value into the public browser bundle, and this must stay
   server-side.
3. Redeploy. Environment variables only take effect on a new build.

**Settings → AI identification** then reads "Scanning is on" with each
member's usage for the day.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | The key every scan runs on. Unset means scanning is off. |
| `ANTHROPIC_MODEL` | Override the model. Default `claude-opus-5`. |
| `AI_DAILY_SCAN_LIMIT` | Scans per member per day. Default 100. |
| `AI_VALUE_LOOKUP` | Set to `off` to turn off the market-value search. Default on. |

### What a scan costs, and keeping it bounded

Photos are capped at 640px, so a one-photo scan is roughly 690 input tokens
and 350–1,150 output tokens depending on how much the model reasons. Extra
photos add about 10% each — the text and reasoning dominate, not the images.

| Model | Per scan | Per 1,000 scans |
|---|---|---|
| Claude Opus 5 *(default)* | ~$0.032 | ~$32 |
| Claude Sonnet 5 | ~$0.011 | ~$11 |
| Claude Haiku 4.5 | ~$0.0024 | ~$2.44 |

Normal use is cheap — cataloging a 500-item collection costs about $16 on the
default model. The exposure is a loop hammering the endpoint, which unchecked
could reach roughly $130/hour. Three things bound it:

1. **Per-member daily cap.** Scans are counted and refused past
   `AI_DAILY_SCAN_LIMIT`. The counter is server-enforced: members can read
   their own usage, but the only thing that can change it is a
   `security definer` function that increments the caller's own row, so the
   limit cannot be raised from the client.
2. **Membership.** The endpoint refuses anyone who is not in a collection,
   and checks that before it reveals anything about the configuration.
3. **A provider spend cap.** Set a monthly limit in the Anthropic console
   (Billing → limits). This is the only backstop that holds if something in
   the app itself is wrong, so set it regardless.

Run `supabase/add-ai-usage-limit.sql` once to create the counter on an
existing project; `schema.sql` already includes it for fresh installs.

If you plan a long cataloging session, raise `AI_DAILY_SCAN_LIMIT` — at the
default of 100 a day, a 1,000-item collection takes ten days.

### Estimated value, with sources

After you accept a match, Catalog looks up what that exact release is going
for. It runs while you're ticking off components, so the answer is waiting by
the time you reach the details step rather than making you sit through it.

The number is **searched, not remembered**. A model reciting a price from
training data would be confidently out of date — collectible prices move — so
this uses Claude's `web_search` tool and asks specifically for *sold* prices
over asking prices. You get an estimate, a typical low–high range, and the
listings behind it: each with its price, its date, and whether it's a
completed sale, a current asking price, or a price-guide figure. Tap **Use
$X** to accept it as the item's estimated value; the sources stay on the item
page under *Where this value came from*.

Completeness is part of the question, not an afterthought — a loose cartridge
and a complete-in-box copy are different markets, so the lookup is told which
components you ticked and prices that configuration.

**Every citation is verified.** The URLs the model cites are checked against
the URLs the search actually returned; anything that doesn't match is dropped
rather than displayed as evidence, and if more than half of them fail the
check the result is marked low confidence. A fabricated source is the one
failure mode that would make this worse than useless, so it can't reach the
screen.

Web search is billed separately from tokens — about **$10 per 1,000
searches** — and a lookup makes up to four. That works out to roughly
**$0.05 per item on top of the ~$0.032 scan**, so cataloging with values on
costs a bit over twice as much. Lookups count against the same
`AI_DAILY_SCAN_LIMIT`. Set `AI_VALUE_LOOKUP=off` to turn it off and keep
scanning; the details step then just shows a plain estimated-value field.

Prices are for planning. They are not an appraisal and not a guaranteed
resale price.

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
  user confirmation, never silently treated as fact. Accepting a match kicks off
  a web-searched **market value lookup** with the listings it came from, priced
  for the components you actually have. Identification runs on the server, so
  no one signing in has to obtain or paste an API key. If it is unconfigured or
  unavailable, the same flow continues as guided manual entry with the photos
  attached.
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
  create-or-join a shared collection via an invite code (server-side RPCs).
- **AI:** `api/identify.js` is a Vercel serverless function that calls Claude
  with a key held in the server environment. `src/lib/ai.js` posts photos to
  it using the caller's existing Supabase session; the function verifies that
  session and collection membership, counts the scan against the caller's
  daily quota, and only then spends anything. `api/value.js` is the same shape
  for market value, adding Anthropic's `web_search` server tool and a
  verification pass that drops any cited URL the search did not actually
  return. `api/ai-status.js` reports whether scanning is on and the caller's
  usage. No API key reaches the browser or the APK, and the client bundle
  carries no AI SDK.

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
