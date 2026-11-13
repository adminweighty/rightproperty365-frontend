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

Open http://localhost:3000. To submit a property request from a listing page, start the backend API on http://localhost:8080 as well.

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
  listings/             Search results and listing detail
  design-system/        Live token and component reference (not indexed)
src/components/
  ui/                   Primitives: Button, Field, Input, Select, Badge, Card, Container
  layout/               Header, footer, logo
  listings/             Listing card, media, search bar
  requests/             Property request form
src/lib/
  api/                  Typed clients for the Go API
  data/                 SAMPLE listings and market config, until the API serves them
  env.ts, format.ts     Public config and formatting helpers
```

## Conventions

- **Colours, radius, shadow and fonts come from tokens.** Tailwind's default palette is disabled; use semantic classes such as `bg-surface` and `text-muted`.
- **All business writes go to the Go API.** Customer enquiries are sent only to `POST /v1/property-requests`. Never post customer details to an agent or a third party from the browser.
- **Money is a decimal string plus an ISO 4217 code**, formatted for display only.
- **Request-time data sits behind `<Suspense>`** (`params`, `searchParams`, cookies) so every route keeps a static shell.
- **WCAG 2.2 AA** is required. See `design/guidelines/accessibility.md`.

## Branches

| Branch | Purpose |
| --- | --- |
| `dev` | Integration branch. Feature branches merge here first. |
| `main` | Reviewed, release-ready code. Deploys to staging. |
| `production` | What is live. Updated only by promoting `main`. |

Flow: `feature/*` → `dev` → `main` → `production`.

## Docker

```bash
docker build -t rightproperty365-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com .
```

```bash
docker run -p 3000:3000 rightproperty365-web
```

`NEXT_PUBLIC_*` values are compiled into the client bundle, so build one image per environment or move them to runtime configuration before promoting a single image across environments.

## Current state

Built: design system, UI primitives, home page, listing search and detail pages (sample data), and the property request form wired to the API contract.

Not built yet: authentication, real listing data, agent and admin portals, maps, media uploads, YouTube embeds, analytics events, sitemap and structured data.
