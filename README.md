# RightProperty365 web

The Next.js web application for RightProperty365, a property marketplace for any country (it started in Zimbabwe). This repository also holds the [design system](design/README.md).

The Go API, worker and database migrations live in a separate repository (`RightProperty365-Backend`).

## Stack

- Next.js 16 (App Router, Cache Components, Turbopack) and React 19, TypeScript
- Tailwind CSS 4, themed entirely from `design/tokens`
- Standalone Docker output for Sevalla

> Next.js 16 differs from earlier versions. Read the relevant guide in `node_modules/next/dist/docs/` before changing routing, caching or data fetching. See `AGENTS.md`.

## Getting started

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. Start the backend API on http://localhost:8080 as well: listings, the directory and every drop-down come from it. Without it, pages show an error state with a "Try again" link.

## Environment variables

| Variable | Read | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | build time, compiled into the client bundle | Public address of the Go API. Browsers use it for sign-in, enquiries and the inbox. |
| `API_URL` | run time, server only | Address the web server uses to read listings, directory and reference data, for example a cluster-internal one. Optional; defaults to `NEXT_PUBLIC_API_URL`. Never sent to browsers. |
| `NEXT_PUBLIC_SITE_URL` | build time | Public origin of the site, for canonical URLs, the sitemap and structured data. |
| `BUILD_WITHOUT_API` | build time | Set to `1` to build without reading the API even when one is reachable. See "Builds and the API". |
| `NEXT_PUBLIC_MAP_TILE_URL` | build time | Raster tile URL template for the maps (Leaflet), such as `https://tiles.example.com/{z}/{x}/{y}.png`; https only. Unset: OpenStreetMap's public tiles in development and on a test site, and **no map at all on production** (the Map view, the listing page map and the editor map are left out; every list works as before). OpenStreetMap's tiles must not carry production traffic, so production needs a paid or self-hosted tile source. See "Maps". |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | build time | The credit the tile provider requires, shown on every map (HTML allowed, such as a link). Defaults to "© OpenStreetMap contributors" for OpenStreetMap's tiles. |
| `REVALIDATE_SECRET` | run time, server only | Turns on `POST /api/revalidate` and is the bearer token it requires. Unset by default, which leaves the route off (404). See "Onboarding and verification". |
| `ANDROID_APP_SHA256_FINGERPRINTS` | run time, server only | Comma-separated SHA-256 fingerprints (`AB:CD:…`, 32 colon-separated hex bytes) of the Android app's signing certificate: Play Console's "App signing key certificate", plus the upload or debug key only if those builds should open links too. Builds `/.well-known/assetlinks.json`, which answers 404 while this is unset or invalid. See "Mobile app links". |
| `ANDROID_APP_PACKAGE` | run time, server only | Android package name for `assetlinks.json`. Optional; defaults to `com.rightproperty365.rightproperty365`. |
| `APPLE_TEAM_ID` | run time, server only | Apple Developer Team ID (10 letters and digits). Builds `/.well-known/apple-app-site-association`, which answers 404 while this is unset or invalid. See "Mobile app links". |
| `IOS_BUNDLE_ID` | run time, server only | iOS bundle id for `apple-app-site-association`. Optional; defaults to `com.rightproperty365.rightproperty365`. |

## Data from the API

Everything the site lists comes from the Go API (`api/openapi.yaml` in the backend repository). The backend's seed is the only source of sample data; this repository holds none.

| On the site | API |
| --- | --- |
| Every drop-down, filter option and label: deal types, property categories and types, regions, cities, suburbs, listing features, request types, contact methods, what a price is charged per ("per month", "per night"), sign-up roles with their groups and descriptions, organisation kinds, directories, service trades | `GET /v1/reference` |
| The countries that have listings: search filters, the hero's location list, the landing page's country row, the footer, the curated pages | `GET /v1/markets?has_listings=true` (the same data as `/v1/countries`) |
| Every country (249), for naming the country of a search and for the country field of onboarding | `GET /v1/countries` |
| Listing search by country, region, city, suburb and the advanced filters, its facet counts and pages; the landing page rows, city and suburb tiles and counts | `GET /v1/listings` |
| Listing detail; "no longer available" for a 410 | `GET /v1/listings/{slug}` |
| The availability calendar of a short stay: with the page, and again in the browser after a refused request | `GET /v1/listings/{slug}/availability` |
| A request to stay (dates and guests; not a booking), with every other customer request | `POST /v1/property-requests` |
| Suggestions when a keyword search finds nothing | `GET /v1/listings/suggest` |
| Directories with counts (Real Estate Agencies, Estate Agents, Solicitors and the rest), directory lists, profiles, the footer's directory links | `GET /v1/directory`, `/v1/directory/{kind}`, `/v1/directory/{kind}/{slug}` |
| Who advertises a listing (name, title, logo, whether they are verified) and when they were verified | `advertiser.display`, `advertiser.agent_display` and `verification` of a listing |
| Logos of agencies, businesses and agents, loaded by the visitor's browser | `GET /v1/directory/{kind}/{slug}/logo` (the public API address in front of the path the API gives) |
| The numbers of the assurance band on the landing page | `GET /v1/trust/summary` |
| "Your public profile" on the account page: upload or remove a logo | `GET /v1/me/profiles`, `PUT` and `DELETE /v1/me/profiles/{kind}/{slug}/logo` |
| Sitemap; which listings and profiles are prerendered | `GET /v1/sitemap` |
| "Your listings" and the lister's availability calendar of a short stay (read and changed in the browser with the session): nights booked, blocked or available with a private note, and the stay rules | `GET /v1/me/listings`, `GET` and `PUT /v1/me/listings/{id}/availability`, `PATCH /v1/me/listings/{id}/stay-rules` |
| Appointments: a person's own, and those a professional received (read in the browser with the session) | `GET /v1/me/appointments`, `GET /v1/inbox/appointments`, `GET /v1/inbox/summary` and their action routes |

How it is wired:

- **`src/lib/api/server/`** holds the server-side readers. Each is a `'use cache'` function with a lifetime and a tag: reference data and the list of every country for an hour (`reference`, `markets`), the countries that have listings, listings and the directory for a minute (`listings`, `listing:<slug>`, `directory`, `profile:<kind>:<slug>`). A reader throws when the API fails, so a failure is never cached. Pages call them through `load()`, which turns a failure into an error state.
- **Server Components fetch; Client Components receive props.** Forms such as the search bars, the sign-up role picker, the property request form and the request inbox get their option lists and labels from the page that renders them. Nothing fetches reference data in the browser.
- **Results that depend on `searchParams`** (the listing search) are read with the parsed filters passed as arguments, so each search is its own cache entry. The page is rendered by the server for each request (see "Builds and the API").
- **There is no default country or currency.** `getCatalogue()` returns the reference sets and the countries that have listings, nothing else. Regions, cities and suburbs come in one read for every country that has them, each row with its `market_code`; the forms offer the places of the countries that have listings (and of the chosen one), and `placesIn()` gives one country's. Most countries have no reference places: their listings and profiles name the city as free text (`code: null`), which is shown but never linked or filtered.
- **One currency per search.** The price filters and the price range are in the chosen `currency`, else the chosen country's, else the only currency of the results. With several and nothing chosen the API sends no price range and lists the currencies; the form then asks for one (`design/components/README.md`, "ListingFilterPanel").
- **Codes are checked against the reference data** before they are sent to the API, which answers 400 for a code it does not know. Whether places fit together (a suburb in its city, a city in its region) and whether a maximum is above its minimum is left to the API: its 400 names the parameter, and the search form shows that message beside the control.
- **Photos.** The API returns a photo as `/assets/images/<file>.jpg` with alt text and size. Object storage and uploads are not built, so those files are the ones bundled from `src/assets/images`. `src/lib/photos.ts` maps the file name to the bundled import, which keeps hashed URLs, responsive sizes and blur placeholders. A photo that is not bundled is loaded from the URL the API gave, unoptimised, at the API's width and height.
- **Logos are plain `<img>` elements**, not `next/image`: they come from the API, whose origin is set per environment at build time, so it cannot be listed in `images.remotePatterns` for every build. The address is `NEXT_PUBLIC_API_URL` plus the path the API gives (never the internal `API_URL`). Without a logo, or when it does not load, initials are shown (`LogoMark`).
- **Only verified advertisers have public listings**; the API hides the rest. The site says exactly that and no more: see "What we may say about verification" in `design/guidelines/content-voice.md`.
- **Role names come from the API.** Account roles with their groups and descriptions (`account_roles`), organisation kinds (`organisation_kinds`), the title of a membership (`role_label` in `GET /v1/me`), an agent's specialism and the wording of an application's status (`status_label`) are shown as sent. They are titles: see `design/guidelines/content-voice.md`, "Role names".
- **Not in the reference data**, so still labelled in code: the sort orders, advertiser types and "listed in the last N days" choices of the listing search (enums and a number of that endpoint) and the titles of platform administrator roles (an enum of the identity API). The main navigation and the landing page's marketing copy are written in the app.

## Onboarding and verification

A person who signs up with a role for real estate professionals, businesses or property owners (every role except Prospective Buyer and Prospective Tenant) has one application per role. The role gives no access until a platform administrator approves the application.

- **Applicant** (`/onboarding`, `/onboarding/<role>`): after confirming their email they land on the hub, which lists each application with its status and what is missing. The form for a role is built from `GET /v1/onboarding/requirements`: which details and documents the role has, and which are required, come from the API. Details are saved with "Save draft"; each document is uploaded on its own (PDF, JPEG or PNG, up to 10 MB); "Submit for review" sends it. The reviewer's reason is shown when changes are requested or the application is not approved, and a rejected applicant can apply again.
- **Administrator** (`/admin/verifications`, `/admin/verifications/<id>`): the review queue (status tabs with counts, role filter, search, pages) and the review page (applicant, private details, requirement checklist, documents, history) with Approve, Request changes and Reject. Only an administrator session sees them; the API authorises every call.
- **Documents are private.** They are read only through the API's authenticated file routes with the session cookie, and always download. The web app never stores or proxies them.
- **The session lives in the browser.** These screens read and write the API from Client Components with the session cookie. The server only supplies the public lists they need (requirements, cities, trades, verified agencies).
- **After an approval** the API creates the organisation or membership and, for roles that have one, a public directory profile with `verified: true`. The directory shows the Verified badge from that flag.

**How soon an approved profile appears.** Directory data is cached for one minute (`cacheLife("minutes")`, tag `directory`). A directory page is regenerated in the background by the first request that arrives after that minute, and that request is still served the previous copy. So the worst case is one minute plus one more page view; on a page nobody visits, the first visitor after the minute sees the old copy once. Inside the app, a page a visitor already opened can be reused by their browser for up to five minutes.

To remove the delay, set `REVALIDATE_SECRET` on the web server and have the API (or an operator) call:

```bash
curl -X POST https://<site>/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET" -H "Content-Type: application/json" -d '{"tags":["directory"]}'
```

The route accepts only the cache tags listed under "Data from the API", returns 404 when the secret is not set and 401 for a wrong one, and must only be called server to server: never put the secret in a browser. Nothing calls it yet; the API would need to after an approval.

## Maps

Listings can carry a pin (API 0.29.0): `location` on the listing page and every search card, `latitude`, `longitude` and `location_precision` in the listing editor. The maps are Leaflet 1.9.4 with raster tiles and no API key (`src/components/map`, `src/lib/map.ts`, specified in `design/components/README.md`, "Maps").

- **Which tiles:** `env.map` in `src/lib/env.ts` (`mapTiles` in `src/lib/map.ts`, checked by `npm test`). A tile URL always wins. Without one, OpenStreetMap's public tiles are used unless this is a production site: a production build (`NODE_ENV=production`) that is not a test site (`NEXT_PUBLIC_TEST_SITE`, or a `staging.` host) and not served from `localhost`. A production site with no tile URL shows no map anywhere. The values are compiled in at build time, like every `NEXT_PUBLIC_*` value.
- **Where:** a List / Map toggle on `/listings` (`view=map`, with "Search this area" writing `bbox`); a small map under the address of a listing; "Location on the map" in the listing editor; the proposed and public pin side by side in the admin listing review.
- **Approximate locations:** the API rounds an APPROXIMATE listing's public position to 2 decimals (about 1 km) and the site draws a circle for it, never a pin.
- **Headers:** Leaflet draws tiles as plain images and uses no frames, and the site's `Content-Security-Policy` sets only `frame-src`, so nothing needs allowing for the tile host. If an `img-src` policy is ever added, it must name the tile host.
- **Not done:** the API does not check that a pin lies inside the listing's country (a follow-up there), and a map search cannot cross the antimeridian.

## Builds and the API

`next build` prerenders pages, and CI builds with no API. Three rules follow: the build must succeed without the API, it must never store an error or an empty page that is then served as if it were real, and **public content must be in the HTML, visible without JavaScript**, whenever the build could read the API.

When the build starts, `next.config.ts` checks once whether the API answers (`GET /readyz` on `API_URL`, else `NEXT_PUBLIC_API_URL`) and compiles the answer into the server code as `RP_API_AT_BUILD`. `src/lib/api/server/load.ts` (`load()`, `apiAtBuild`) and `src/components/api-boundary.tsx` (`ApiBoundary`) read it, so the build and the server it produces always agree.

| Build | What is prerendered | At run time | Without JavaScript |
| --- | --- | --- | --- |
| **The API answers** | The landing page, directories, every profile (up to 200) and the newest 100 listings, with real data, as complete HTML. | Cached pages are refreshed in the background: listings and directory after a minute, reference data after an hour. The listing search, and listings and profiles that were not prerendered, are rendered by the server for each request (the data is cached) and sent as complete HTML. | Listings, search results, directories and profiles are all readable. Forms that post to the API (enquiries, sign-in) and the account menu need JavaScript. |
| **The API does not answer** (CI), or `BUILD_WITHOUT_API=1` | Only the page shells. Every part that needs the API is left as its loading placeholder; nothing from the API, and no error state, is stored. | Those parts are rendered on each request from the API (the data itself is still cached in memory for a minute or an hour) and streamed into the page. | Only the placeholders show: streamed content is revealed by a script. |

How the two modes work:

- **With the API**, the readers are `'use cache'` functions, so their output can be prerendered, and `ApiBoundary` renders its children with no `<Suspense>` around them. That matters: React moves the finished content of a `<Suspense>` boundary larger than about 500 bytes into a hidden element at the end of the document and reveals it with an inline script, even when the content was ready at build time. Without the boundary the content is ordinary HTML in its place.
- **Without the API**, `load()` waits for `connection()` before any API read. During prerendering that never resolves, so `ApiBoundary`, which is then a `<Suspense>`, has its fallback stored and its content rendered on each request instead.
- Pages whose content also reads the address (`/listings` reads `searchParams`; listing, directory and profile pages read `params`) export `instant = false`. With no boundary they have no static shell for an address that was not prerendered, so the server renders the whole page before answering. The cost is that such a navigation shows no skeleton while it waits; the gain is complete HTML.

Every public component that calls `load()` sits inside `ApiBoundary`. The signed-in screens (account, onboarding, inbox, admin) need JavaScript anyway and use a plain `<Suspense>`.

If the API stops answering part-way through a build that started with it, the build fails rather than storing a broken page.

To get complete, prerendered pages in production, build where the API is reachable (pass `API_URL` as a build argument). An image built without the API is correct, but slower on first paint of the data and dependent on JavaScript to show it.

At run time, a page that cannot reach the API shows an error state with a "Try again" link and is marked `noindex`. The next request tries again; nothing about the failure is cached. `src/app/error.tsx` catches any other rendering error.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output in `.next/standalone`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Checks the pure logic in `scripts/*.test.mjs`: the searchable select, the location lines, the nights of a short stay and logos (Node's test runner; needs Node 22.18 or later) |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run tokens` | Regenerate `design/tokens/tokens.css` and check colour contrast |

## Project structure

```
design/                 Design system: tokens, foundations, component specs, guidelines
src/app/                Routes (App Router)
  page.tsx              Home
  listings/             Search results (filters, pages) and listing detail
  directory/            "Professionals": the hub, a list per kind, and profiles (the directory)
  error.tsx             Fallback for an unexpected rendering error
  sitemap.ts            Built from GET /v1/sitemap
  (auth)/               Sign in, register, confirm email, password reset
  onboarding/           Applications for listing, managing and agency roles: hub and one form per role
  admin/verifications/  Review queue and review page for platform administrators
  admin/listings/       Listing review queue and review page (new listings and changes to public ones)
  api/revalidate/       Protected on-demand cache revalidation (off unless REVALIDATE_SECRET is set)
  account/              Profile, roles and memberships
  account/appointments/ The signed-in person's viewings and consultations
  agent/requests/       Request inbox for professional accounts
  agent/listings/       "Your listings": the listing manager, a new listing, the editor with photos,
                        and the availability calendar of a short stay
  agent/appointments/   Appointments received by a professional or their organisation
  legal/                Privacy Policy, Terms and Conditions, Refund Policy, EULA (static)
  faq/                  Frequently asked questions (static)
  design-system/        Live token and component reference (not indexed)
src/components/
  ui/                   Primitives: Button, Field, Input, SearchableSelect, Badge, Card, Container,
                        Alert, ErrorState, Pagination
  layout/               Header, menu for small screens, footer, logo
  landing/              Landing-page section heading, photo tiles and role groups
  api-boundary.tsx      Wrapper for public components that read the API
  listings/             Listing card, the advertiser (logo, name, Verified), media, search bar, location selects, stay dates, advanced search panel, hero search
  availability/         NightCalendar (the month grid) and the availability calendar of a short-stay listing
  directory/            Profile card, enquiry form
  requests/             Property request form
  auth/                 Auth provider, forms, account menu, RequireAuth
  onboarding/           Onboarding hub, form and document uploader
  admin/                Administrator gate, sign-in, landing, review queue and review detail
  agent/                Request inbox, "Your listings", the availability editor
  appointments/         Appointment card and the two appointment lists
src/lib/
  api/                  Browser clients for the Go API (session cookie), and types.ts
  api/server/           Server-side cached readers for listings, directory, reference data
  seo.ts                Search parameters, indexing rules, structured data (docs/seo.md)
  countries.ts          Which country names take "the" in a sentence
  places.ts             A location line from whatever a listing or profile names
  logos.ts, logo-rules.ts  Logo addresses, the initials shown without one, what an uploaded logo must be
  nights.ts             Nights of a short stay: dates, ranges, "today" in a time zone, the rules of a stay
  stay-calendar.ts      The public calendar as the listing page hands it to the browser
  legal.ts              Every business fact the legal pages state (docs/legal.md)
  faq.ts                The frequently asked questions, as data
  app-links.ts          App Store, Google Play and AppGallery addresses (placeholders until the apps are published)
  roles.ts              Groups the API's account roles under their headings
  search-options.ts     Option lists for the search forms, from reference data and facets
  searchable-select.ts  Matching, grouping and keyboard logic of the searchable select
  filter-chips.ts       The filters of a search as removable chips
  photos.ts             Maps API photo file names to the bundled images
  env.ts, format.ts     Public config and formatting helpers
```

## Conventions

- **Colours, radius, shadow and fonts come from tokens.** Tailwind's default palette is disabled; use semantic classes such as `bg-surface` and `text-muted`.
- **The site is white for everyone.** It does not follow the operating system's dark mode; the dark tokens apply only with `data-theme="dark"` on `<html>`. See `design/foundations/color.md`.
- **All business writes go to the Go API.** Customer enquiries are sent only to `POST /v1/property-requests`. Never post customer details to an agent or a third party from the browser.
- **The session is an HttpOnly cookie set by the API.** The web app never stores a token. `AuthProvider` loads the user from `GET /v1/me`; roles in the browser decide what to show, and the API authorises every request.
- **Money is a decimal string plus an ISO 4217 code**, formatted for display only.
- **A short stay is asked for, never booked.** Dates are nights (`YYYY-MM-DD`) in the listing's time zone, which is named wherever they are shown. The calendar is the host's own, a request to stay reserves nothing, an estimate is labelled as one, and no payment is taken. The only category the code knows by name is `short-stay` (`SHORT_STAY` in `src/lib/seo.ts`), because the dates, the calendar and the request to stay exist only there.
- **Public content is HTML first.** A public component that reads the API sits inside `ApiBoundary`, never a plain `<Suspense>`, and a public page that reads `params` or `searchParams` exports `instant = false` (see "Builds and the API"). Signed-in screens keep request-time data behind `<Suspense>`.
- **No lists in code.** A drop-down, filter or label for a value the API returns comes from the API's reference data. Add a row in the database, not an array in the app.
- **Every drop-down is a `SearchableSelect`** (`src/components/ui/searchable-select.tsx`): a native select in the HTML, searchable by typing once the page is interactive. Do not render a bare `<select>`.
- **"Professionals" is the user-facing name for the directory.** Visitors read "Professionals", "Find a property professional" and "your public profile"; the word "directory" is not shown to them. The code, the addresses (`/directory/<kind>/<slug>`), the cache tag and the API (`/v1/directory`, `directory_kinds`) keep the name, so links in emails, the mobile app and search engines keep working.
- **No default country in the wording.** The site lists property from any country. A heading, title or description names a country only when the visitor chose one (`?country=GB` gives "Property for sale in the United Kingdom"), or a region, city or suburb, which is then named. Country names come from the API; `src/lib/countries.ts` only knows which few take "the". There is no default currency either: every price shows its own currency code.
- **WCAG 2.2 AA** is required. See `design/guidelines/accessibility.md`.

## Legal pages

`/legal` holds the Privacy Policy, Terms and Conditions, Refund Policy and End User Licence Agreement. The wording is in `src/content/legal`; every business fact (operator, addresses, emails, governing law, refund numbers, dates and versions) is in `src/lib/legal.ts`.

**They are working documents written from what the product does. They are not legal advice and must be reviewed by a qualified lawyer before the live launch.** Several values in `src/lib/legal.ts` are assumptions marked `CONFIRM`. `docs/legal.md` lists them and what needs sign-off.

## Mobile app links

**Opening links in the app (BR-016).** `/.well-known/assetlinks.json` (Android) and `/.well-known/apple-app-site-association` (iOS) tell the phones which app may open links to `/listings/*`, `/directory/*`, `/apply/*`, `/sign/*`, `/invitations/*`, `/account/*`, `/agent/*`, `/verify-email` and `/reset-password`. They are built on each request from `ANDROID_APP_SHA256_FINGERPRINTS` and `APPLE_TEAM_ID` (see "Environment variables") and answer 404 until those are set, so nothing is claimed by default. Both hosts, `rightproperty365.com` and `www.rightproperty365.com`, must serve them over HTTPS with no redirect. Details are in `docs/seo.md` ("Mobile app link files").

The footer ("Get the app") and the FAQ link to the Apple App Store, Google Play and Huawei AppGallery. The three addresses are in `src/lib/app-links.ts`. **They are placeholders today**: each points at the store's home page and is flagged `placeholder: true`, and the site says the apps are being prepared for the stores. **At launch, set each `url` to the app's store page and `placeholder` to `false`.**

Each button shows the store's mark beside its words. The marks come from the [`simple-icons`](https://simpleicons.org) package (`siApple`, `siGoogleplay`, `siAppgallery`), which is licensed CC0-1.0; the logos themselves remain trade marks of Apple, Google and Huawei. They are drawn as inline SVG in the text colour, unaltered.

**Also at launch, replace the buttons with the stores' official badges.** The badges may only be shown for an app that is available in the store, and each company publishes the artwork and its rules: Apple at `developer.apple.com/app-store/marketing/guidelines/`, Google at `play.google.com/intl/en_us/badges/` and Huawei in its developer documentation for AppGallery Connect (`developer.huawei.com`, "AppGallery badge" guidelines). Download them from there; do not copy them from another site.

## Branches

| Branch | Purpose |
| --- | --- |
| `dev` | Integration branch. Every push is checked, built and deployed to **staging** (staging.rightproperty365.com). |
| `main` | Stable, reviewed code. Checked by CI; not deployed. |
| `production` | What is live. Every push is checked, built and deployed to **production** (rightproperty365.com). |

Flow: `feature/*` → `dev` → `main` → `production`.

## Deployment

`.github/workflows/publish-and-update-gitops.yml` runs CI, publishes `ghcr.io/adminweighty/rightproperty365-frontend:sha-<commit>` and updates the image tag in the GitOps repository (`adminweighty/weightygitops`), which Argo CD syncs. It needs the `GITOPS_TOKEN` secret and the GitHub environments `staging` and `production`. The container listens on port 3000.

## Docker

```bash
docker build -t rightproperty365-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com .
```

```bash
docker run -p 3000:3000 rightproperty365-web
```

`NEXT_PUBLIC_*` values are compiled into the client bundle, so build one image per environment or move them to runtime configuration before promoting a single image across environments.

The build reads the API if it can reach it (`--build-arg API_URL=...`, else `NEXT_PUBLIC_API_URL`) and prerenders pages with its data; otherwise pages read the API on each request. Pass `--build-arg BUILD_WITHOUT_API=1` to force the second. At run time set `API_URL` (`docker run -e API_URL=http://api.internal:8080`) if the server should reach the API on an internal address. See "Builds and the API".

## Current state

Built: design system, UI primitives, home page, listing search by country, region, city and suburb with advanced filters, facet counts and pages, listing detail, the directories and profiles (including Solicitors), short stays (search by dates and guests, the availability calendar, the request to stay), the property request and business enquiry forms, sitemap and structured data, and authentication: register, email confirmation, sign in and out, password reset, an account page showing roles, the request inbox, "Your listings" with the availability calendar and stay rules of a short stay, appointments (view, confirm, propose a new time, accept, cancel, complete), onboarding for professional, business and owner roles with document uploads, and the administrator review queue. All of it reads the Go API; the listings and profiles it shows are the backend's seed data.

Not built yet: multi-factor authentication, organisation invitations and agent onboarding, account deletion, creating and editing listings ("Your listings" is read-only and says so), bookings and payments for stays (a stay is requested, never booked), assigning an appointment to a colleague, the rest of the agent and admin portals (listing moderation, markets, invoices, users, audit), media uploads and object storage (photos are bundled files), YouTube embeds, analytics events, and automatic cache revalidation when the API changes (`POST /api/revalidate` exists; the API does not call it yet).
