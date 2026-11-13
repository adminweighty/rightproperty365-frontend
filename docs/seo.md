# SEO

How the public pages are prepared for search engines, and why. The code is in `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` and the `generateMetadata` functions of the public routes. Change this document and the code together.

Sources: Google Search Central, schema.org and the Next.js 16 documentation bundled in `node_modules/next/dist/docs`, read on 13 November 2026. Reddit could not be read (it blocked every fetch), so nothing here rests on Reddit threads.

## What is indexed

| URL | Robots | Canonical | In sitemap |
| --- | --- | --- | --- |
| `/` | index | itself | yes |
| `/listings` | index | itself | yes |
| `/listings?deal=…`, `?category=…`, `?deal=…&category=…` with results | index | itself, parameters in the order `deal`, `category` | yes |
| The same with no results | noindex, follow | none | no |
| `/listings?q=…` (free-text search) | noindex, follow | none | no |
| `/listings` with unknown parameters or invalid values | noindex, follow | none | no |
| `/listings/[slug]`, published | index, with `unavailable_after` set to the end of the 90-day publication | itself | yes, with its photo |
| `/directory`, `/directory/[kind]` (agencies, agents, developers, property managers, hosts, service providers) | index | itself | yes |
| `/directory/[kind]/[slug]` profile | index | itself | yes |
| `/listings/[slug]`, unknown or expired | `notFound()`: noindex | none | no |
| Sign-in, register, password reset, account, agent inbox, design system | noindex | none | no |

Rules behind the table:

- **Only curated result pages are indexed.** Deal and category combinations are a small, fixed set of useful pages. Free-text search can produce unlimited near-duplicate URLs, so it is never indexed.
- **Private pages use a `noindex` meta tag and are not blocked in `robots.txt`.** A crawler that is blocked from a page never sees its `noindex`.
- **Empty parameters do not create duplicates.** The search forms submit empty fields (`?deal=rent&category=&q=`); the canonical drops them and fixes the parameter order.
- **Expired listings leave the index.** `unavailable_after` tells Google when to drop the page, the sitemap lists only published listings, and an expired listing is not found. Expired listings are never redirected to a category page.
- **Crawlers get metadata in `<head>`.** By default Next.js streams request-time metadata into `<body>` for browsers and for Googlebot, but Google honours `rel=canonical` only in `<head>`. `htmlLimitedBots` in `next.config.ts` lists crawler user agents (Next's default list plus Googlebot and generic crawler names) that receive complete `<head>` metadata instead. Browsers keep the faster streamed behaviour.

## Metadata

- Root layout: `metadataBase` (from `NEXT_PUBLIC_SITE_URL`), a title template, default robots, Open Graph defaults.
- Metadata merges shallowly. A page that sets `openGraph` or `robots` replaces the parent's whole object, so pages repeat the fields they need. Search pages name `/opengraph-image` again for that reason.
- Listing pages: title is "*listing title* for sale/to rent in *suburb*, *city*"; the description leads with type, place and price; the share image is the listing photo.
- Default share image: `src/app/opengraph-image.tsx`, drawn in the brand colours.

`NEXT_PUBLIC_SITE_URL` must be the real public origin in every deployed environment. Canonicals, the sitemap and structured data are built from it. Staging should also be kept out of search at the host level (basic auth or an `X-Robots-Tag: noindex` header).

## Structured data (JSON-LD)

| Page | Types |
| --- | --- |
| Home | `Organization`, `WebSite` (name and URL only) |
| Listing search, indexable pages only | `CollectionPage` with `BreadcrumbList` and an `ItemList` of the results |
| Listing detail | `RealEstateListing` with `BreadcrumbList`, the property as `mainEntity` and an `Offer` |
| Directory list | `CollectionPage` with `BreadcrumbList` and an `ItemList` of the profiles |
| Directory profile | `ProfilePage` whose `mainEntity` is a `RealEstateAgent` (agency), `Person` (agent, with `worksFor`) or `Organization` (everyone else) |

- The property is `House` or `Apartment` for homes and `Place` for commercial property and land, because `floorSize` and bedroom counts are only valid on accommodation types.
- The `Offer` sits on the listing, not the property. Rentals use a `UnitPriceSpecification` per month.
- Google has **no rich result for real-estate listings**. This markup helps machines understand the page; it will not add stars or prices to results. `BreadcrumbList` and `Organization` are supported Google features.
- Deliberately not used: `Product` for property, `FAQPage`, and `WebSite` `SearchAction` (Google retired the sitelinks search box in November 2024).
- Not included yet: `geo` coordinates (listings have none) and agency pages with `RealEstateAgent`.

## Internal links and images

- Listing search ends with "Popular searches": plain links to every indexed result page.
- Listing detail has a full breadcrumb and "Similar properties", and links the agent and agency to their directory profiles.
- Directory profiles list the agency's agents and every property they are marketing, so listings, agents and agencies all link to each other.
- Sponsored directory profiles are labelled "Sponsored" wherever they appear and are sorted first; the label is part of the page, not hidden from crawlers.
- Listing photos are real `<img>` elements through `next/image`, with descriptive alt text, fixed aspect ratios (no layout shift) and an entry in the image sitemap.

## Known gaps

- **Unknown listings return HTTP 200 with `noindex`, not 404.** With Cache Components the page shell is sent before the listing is looked up. Google treats this as a soft 404, which is acceptable; a real 404 needs a slug check in a proxy before the response starts.
- **The sitemap and expiry are static while listings are sample data.** When listings come from the API, list only published, unexpired listings and revalidate the sitemap at least hourly.
- **No pagination yet.** When added: each page gets its own URL (`?page=2`) with a self-referencing canonical, never a canonical to page 1, and stays out of the sitemap.
- **Not built:** location landing pages (city and suburb) and `hreflang` for other markets.
- **Directory profiles are sample data** with no logos, photos, reviews or street addresses yet, so they cannot qualify for Google's local business features.
- **Not measured:** Core Web Vitals on a deployed site (targets: LCP 2.5s, INP 200ms, CLS 0.1), and validation in Google's Rich Results Test or Search Console.

## Checking a change

Build, start the production server, and fetch pages with a crawler user agent. For each public page confirm the title, description, robots, canonical and JSON-LD are present in `<head>` and match the table above, then check `/sitemap.xml` and `/robots.txt`.
