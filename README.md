# RightProperty365 web

The Next.js web application for RightProperty365, a multi-country property marketplace launching in Zimbabwe. This repository also holds the [design system](design/README.md).

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

## Data from the API

Everything the site lists comes from the Go API (`api/openapi.yaml` in the backend repository). The backend's seed is the only source of sample data; this repository holds none.

| On the site | API |
| --- | --- |
| Every drop-down, filter option and label: deal types, property categories and types, cities, suburbs, listing features, request types, contact methods, sign-up roles and their groups, directories, service trades | `GET /v1/reference` |
| Markets in the header and footer; the active market's name and currency | `GET /v1/markets` |
| Listing search, its facet counts and pages; the landing page rows, city and suburb tiles and counts | `GET /v1/listings` |
| Listing detail; "no longer available" for a 410 | `GET /v1/listings/{slug}` |
| Suggestions when a keyword search finds nothing | `GET /v1/listings/suggest` |
| Directories with counts, directory lists, profiles | `GET /v1/directory`, `/v1/directory/{kind}`, `/v1/directory/{kind}/{slug}` |
| Sitemap; which listings and profiles are prerendered | `GET /v1/sitemap` |

How it is wired:

- **`src/lib/api/server/`** holds the server-side readers. Each is a `'use cache'` function with a lifetime and a tag: reference data and markets for an hour (`reference`, `markets`), listings and the directory for a minute (`listings`, `listing:<slug>`, `directory`, `profile:<kind>:<slug>`). A reader throws when the API fails, so a failure is never cached. Pages call them through `load()`, which turns a failure into an error state.
- **Server Components fetch; Client Components receive props.** Forms such as the search bars, the sign-up role picker, the property request form and the request inbox get their option lists and labels from the page that renders them. Nothing fetches reference data in the browser.
- **Results that depend on `searchParams`** (the listing search) are read inside `<Suspense>` with the parsed filters passed as arguments, so each search is its own cache entry.
- **Codes are checked against the reference data** before they are sent to the API, which answers 400 for a code it does not know.
- **Photos.** The API returns a photo as `/assets/images/<file>.jpg` with alt text and size. Object storage and uploads are not built, so those files are the ones bundled from `src/assets/images`. `src/lib/photos.ts` maps the file name to the bundled import, which keeps hashed URLs, responsive sizes and blur placeholders. A photo that is not bundled is loaded from the URL the API gave, unoptimised, at the API's width and height.
- **Not in the reference data**, so still labelled in code: the four sort orders of the listing search (an enum of that endpoint), and the labels of platform roles, organisation roles and organisation kinds on the account and admin pages (enums of the identity API). The main navigation and the landing page's marketing copy are written in the app.

## Builds and the API

`next build` prerenders pages, and CI builds with no API. Two rules follow: the build must succeed without the API, and it must never store an error or an empty page that is then served as if it were real.

When the build starts, each build worker checks once whether the API answers (`GET /readyz` on `API_URL`, else `NEXT_PUBLIC_API_URL`). This is in `src/lib/api/server/load.ts`.

| Build | What is prerendered | At run time |
| --- | --- | --- |
| **The API answers** | The landing page, directories, every profile (up to 200) and the newest 100 listings, with real data. Other listings and profiles are rendered on their first visit and then cached. | Cached pages are refreshed in the background: listings and directory after a minute, reference data after an hour. |
| **The API does not answer** (CI), or `BUILD_WITHOUT_API=1` | Only the page shells. Every part that needs the API is left as its loading placeholder; nothing from the API, and no error state, is stored. | Those parts are rendered on each request from the API (the data itself is still cached in memory for a minute or an hour). |

The second mode works by waiting for `connection()` before any API read while building. During prerendering that never resolves, so Next.js stores the `<Suspense>` fallback and renders the component on each request instead. This is why every component that calls `load()` sits inside `<Suspense>`.

If the API stops answering part-way through a build that started with it, the build fails rather than storing a broken page.

An image built without the API is correct but slower on first paint of the data. To get prerendered pages in production, build where the API is reachable (pass `API_URL` as a build argument) or accept request-time rendering.

At run time, a page that cannot reach the API shows an error state with a "Try again" link and is marked `noindex`. The next request tries again; nothing about the failure is cached. `src/app/error.tsx` catches any other rendering error.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output in `.next/standalone`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run tokens` | Regenerate `design/tokens/tokens.css` and check colour contrast |

## Project structure

```
design/                 Design system: tokens, foundations, component specs, guidelines
src/app/                Routes (App Router)
  page.tsx              Home
  listings/             Search results (filters, pages) and listing detail
  directory/            Directories, directory lists and profiles
  error.tsx             Fallback for an unexpected rendering error
  sitemap.ts            Built from GET /v1/sitemap
  (auth)/               Sign in, register, confirm email, password reset
  account/              Profile, roles and memberships
  agent/requests/       Request inbox for professional accounts
  design-system/        Live token and component reference (not indexed)
src/components/
  ui/                   Primitives: Button, Field, Input, Select, Badge, Card, Container,
                        Alert, ErrorState, Pagination
  layout/               Header, footer, logo, market details
  listings/             Listing card, media, search bar, filter panel, hero search
  directory/            Profile card, enquiry form
  requests/             Property request form
  auth/                 Auth provider, forms, account menu, RequireAuth
  agent/                Request inbox
src/lib/
  api/                  Browser clients for the Go API (session cookie), and types.ts
  api/server/           Server-side cached readers for listings, directory, reference data
  seo.ts                Search parameters, indexing rules, structured data (docs/seo.md)
  search-options.ts     Option lists for the search forms, from reference data and facets
  photos.ts             Maps API photo file names to the bundled images
  env.ts, format.ts     Public config and formatting helpers
```

## Conventions

- **Colours, radius, shadow and fonts come from tokens.** Tailwind's default palette is disabled; use semantic classes such as `bg-surface` and `text-muted`.
- **All business writes go to the Go API.** Customer enquiries are sent only to `POST /v1/property-requests`. Never post customer details to an agent or a third party from the browser.
- **The session is an HttpOnly cookie set by the API.** The web app never stores a token. `AuthProvider` loads the user from `GET /v1/me`; roles in the browser decide what to show, and the API authorises every request.
- **Money is a decimal string plus an ISO 4217 code**, formatted for display only.
- **Request-time data sits behind `<Suspense>`** (`params`, `searchParams`, cookies) so every route keeps a static shell. So does every component that reads the API (see "Builds and the API").
- **No lists in code.** A drop-down, filter or label for a value the API returns comes from the API's reference data. Add a row in the database, not an array in the app.
- **WCAG 2.2 AA** is required. See `design/guidelines/accessibility.md`.

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

Built: design system, UI primitives, home page, listing search with filters, facet counts and pages, listing detail, the directories and profiles, the property request and business enquiry forms, sitemap and structured data, and authentication: register, email confirmation, sign in and out, password reset, an account page showing roles, and the request inbox. All of it reads the Go API; the listings and profiles it shows are the backend's seed data.

Not built yet: multi-factor authentication, organisation invitations and agent onboarding, account deletion, creating and editing listings, agent and admin portals, maps, media uploads and object storage (photos are bundled files), YouTube embeds, analytics events, and on-demand cache revalidation when the API changes (the cache tags are in place; nothing calls `revalidateTag` yet).
