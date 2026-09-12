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
| `AI_VALUE_LOOKUP` | Set to `off` to turn off the market-value search. Default on. See below — it is the costly half. |
| `PRICECHARTING_TOKEN` | PriceCharting API token for live prices. See *Live market prices*. |

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

### What a complete copy includes

The components step asks about the parts *this release* shipped with, not a
generic list: for a two-disc PlayStation game it lists Disc 1, Disc 2, the
longbox, the manual, and the registration card, and for a SNES cartridge it
lists the box, manual, map, and tray instead.

There is no database of that. Metadata databases cover title and publisher,
not inserts; price guides define "complete" generically; disc counts are
catalogued but a fold-out map is community knowledge. So it comes from two
layers:

1. **The identify call** already knows the release, so it also returns the
   release's as-sold contents. This is free with the scan and instant, so the
   components step shows the right list immediately, pre-ticked from what was
   visible in the photos. An insert the model isn't sure shipped with the
   release is kept and tagged *unsure* rather than dropped — being asked
   about a part you might have beats never being asked.
2. **The value lookup** is already reading sold listings for the exact
   release, and sellers describe what a complete copy includes. Anything the
   listings mention that the checklist lacks is added as a *seen in listings*
   row, and an *unsure* part the listings corroborate loses its tag. This only
   ever adds; nothing is silently removed.

You can add a part by hand, and the standard list for the item type is the
fallback when the release isn't known well enough.

Each row has three states, not two: present, missing, or **omitted**. Omit
is for when the discovery was wrong — the release never shipped with the
part — and an omitted part leaves the completeness denominator entirely
instead of reading as a missing piece. It stays on screen struck through
with a *Restore* link, and is dropped from the item when saved.

Completeness is then inferred from the ticks rather than asked: media + box +
manual with a missing insert is *Near Complete*; everything but the manual is
*Incomplete*, because that's a different market; one disc of two is *Parts*.
It's shown live on the components step and is what the value lookup prices
against.

### Condition graded from the photos

The same identify call grades the copy the way a collector would from what's
visible — a cracked hinge, a crushed corner, creased artwork, label wear —
and says what it saw. The result step shows the grade with those
observations; tap *Change* to disagree, and the app remembers what the photos
suggested. It also grades each part it can see, so the box can be *Fair* while
the cartridge is *Very Good*; those per-part grades are saved on the item.
When the photos don't show enough to grade from, it says so and asks rather
than guessing.

Between the two, the scan asks you only what the photos can't answer: the
details step is purchase price, date, how acquired, and source. Condition
and completeness are discovered and confirmed on the earlier steps, and the
value follows from them on the review step.

**Source** is a picker, not a text field. It offers a fixed vocabulary plus
every source already on an item in the collection, and a typed addition that
matches an existing one by case, spacing, or punctuation — "EBAY", "e bay",
"E-Bay" — becomes that existing one, so the collection never ends up with
three spellings of eBay to filter by.

### Live market prices

Every item can carry a **live price** — the current market figure for that
release, refreshed as the market moves — and the app's estimated values and
analytics follow it.

The source is [PriceCharting](https://www.pricecharting.com), the price
guide for this hobby: loose, complete-in-box, new, graded, box-only and
manual-only figures per release, recomputed daily from eBay sold listings.
It's the database the question "what is this worth right now" actually has
an answer in, and it's what most other price sources are downstream of. The
API needs a paid PriceCharting subscription; set the token as
`PRICECHARTING_TOKEN` (server-side, no `VITE_` prefix) and redeploy.
**Settings → Market prices** then runs a real test lookup and shows what came
back, so a bad token or a changed API is visible there rather than as
silently empty prices.

How it works:

- **Match once, refresh cheaply.** When a scan is accepted, the item is
  matched to a guide product — by barcode when the photos showed one, which
  is exact, otherwise by title ranked against the platform and region. That
  gives it a stable product id. From then on a refresh is a lookup by id:
  no AI, no web search, a fraction of a cent. The review step shows the
  match and lets you pick a different candidate ("Not the right product?")
  if it chose, say, the Greatest Hits reissue.
- **The number for *your* copy.** The guide gives one figure per completeness
  (a median of recent sales). The app picks the figure for the item's
  completeness — including box-only and manual-only, which a listing search
  could never price — and applies an explicit condition factor: Mint ×1.3,
  Near Mint ×1.2, Excellent ×1.1, Very Good ×1.0, Good ×0.9, Fair ×0.75,
  Poor ×0.6. That factor is this app's stated rule, not market data, and the
  card says so. It lives in `src/lib/market.js` to be argued with in one place.
- **It fluctuates.** Prices more than a day old are re-read in the background
  when a signed-in member opens the app (a few at a time, at most one sweep
  per device every six hours), and the results sync to the shared collection
  like any other change. Each item keeps a bounded price history, and its
  page shows the current figure with the change since the last distinct
  price — ▲ $5 (4%) — and when it was last checked, plus a *Refresh* button.
  Estimated values you set by hand are never overwritten.
- **Existing collections.** Settings shows how many items are matched,
  unmatched and stale, with *Refresh all prices* and *Match unmatched items*
  to bring an existing collection onto the guide. An item's page also has
  *Match to price guide* for one-offs.

Without a token nothing breaks: scans fall back to the AI web search below,
and the item page simply offers nothing to refresh. With a token, the AI
search only runs for releases the guide doesn't cover — which also means the
"seen in listings" corroboration of a release's parts (above) only happens
for those items.

### Estimated value, with sources

After you accept a match, Catalog looks up what that exact release is going
for. It runs while you're ticking off components, so the answer is waiting by
the time you reach the details step rather than making you sit through it.

The number is **searched, not remembered**. A model reciting a price from
training data would be confidently out of date — collectible prices move — so
this searches the web and asks specifically for *sold* prices over asking
prices. Crucially it can also **open the pages it finds**: the price table on
a guide site and a row of completed sales live in the page body, not in a
search snippet, so a lookup limited to snippets reads a lot of navigation text
and comes back with nothing.

**Estimated value is not a field you fill in.** It's a market fact about a
specific copy, so the lookup asks what the market pays at each level of
completeness — loose, boxed, complete — and the app positions *your* copy
inside that range from the condition and completeness you picked. Tap through
Mint → Poor and the number moves immediately, with no second search. You can
still override it, but typing is the fallback, not the default way in.

Pricing by range rather than by single figure is also what makes the timing
work: the lookup fires when you accept the match, before you've said what
condition the copy is in, and one search covers every answer you might give.

**Every citation is verified.** The URLs the model cites are checked against
the pages it actually searched or fetched; anything that doesn't match is
dropped rather than displayed as evidence, and if more than half of them fail
the check the result is marked low confidence. A fabricated source is the one
failure mode that would make this worse than useless, so it can't reach the
screen. Ranges that come back malformed — inverted, negative, non-numeric —
are discarded rather than fed into the arithmetic.

When the comps genuinely don't cover what you have, it says so instead of
inventing a figure: sold data for whole copies tells you nothing about what a
loose manual is worth. Where it has to price against a neighbouring market it
labels that too.

| Variable | Purpose |
|---|---|
| `AI_VALUE_LOOKUP` | `off` disables the lookup; scanning is unaffected. |
| `ANTHROPIC_VALUE_MODEL` | Run lookups on a cheaper model than scans. Defaults to `ANTHROPIC_MODEL`. |
| `AI_VALUE_MAX_SEARCHES` | Searches per lookup. Default 8. |
| `AI_VALUE_MAX_FETCHES` | Pages opened per lookup. Default 4. |
| `AI_VALUE_MAX_CONTENT_TOKENS` | Cap on how much of each page enters context. Default 6,000. |

**Cost.** This is the expensive part of the app. Web search is billed on top
of tokens at about **$10 per 1,000 searches**, and fetched page content is
billed as input tokens — up to 6,000 per page, resent on each continuation
turn. At the defaults a lookup lands around **$0.15–0.35**, against ~$0.032
for a scan alone, so values roughly quintuple the per-item cost.

Three dials, in the order worth reaching for: set `ANTHROPIC_VALUE_MODEL` to
`claude-sonnet-5` (the lookup is search-and-summarize, not the vision work the
scan does, and Sonnet is 2.5× cheaper per token); lower
`AI_VALUE_MAX_CONTENT_TOKENS`, which is what actually drives the token half of
the bill; or lower `AI_VALUE_MAX_SEARCHES`. Cutting the search budget too far
is what produces "no pricing found" — that failure is what the defaults above
are set to avoid. Lookups count against the same `AI_DAILY_SCAN_LIMIT`, and
the Anthropic console spend cap remains the real backstop.

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
- **Items as physical artifacts** — per-item component checklists drive a
  completeness percentage separate from condition; each present component can
  carry its own condition. The checklist is the **release's own as-sold
  contents** — two discs, a longbox, a registration card — not a generic list,
  so you're asked about the parts this copy could actually have (see below). Duplicate copies are kept as
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
