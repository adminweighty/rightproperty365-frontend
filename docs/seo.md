# SEO

How the public pages are prepared for search engines, and why. The code is in `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts` and the `generateMetadata` functions of the public routes. Change this document and the code together.

Sources: Google Search Central, schema.org and the Next.js 16 documentation bundled in `node_modules/next/dist/docs`, read on 13 November 2026. Reddit could not be read (it blocked every fetch), so nothing here rests on Reddit threads.

## What is indexed

| URL | Robots | Canonical | In sitemap |
| --- | --- | --- | --- |
| `/` | index | itself | yes |
| `/listings` | index | itself | yes |
| Curated result pages with results: `?deal=…`, `?category=…`, `?deal=…&category=…`, and one place alone or with a deal: `?country=…`, `?region=…`, `?city=…`, `?deal=…&country=…`, `?deal=…&region=…`, `?deal=…&city=…` | index | itself, parameters in the order `deal`, `category`, `country`, `region`, `city` | yes |
| Page 2 and later of `/listings` or a curated result page (`…&page=2`), with results | index | itself, with `page` last. Never page 1 | no |
| A curated page with no results, or a page number past the last page | noindex, follow | none | no |
| `/listings?q=…` (free-text search) | noindex, follow | none | no |
| Any other filter, alone or combined: `property_type`, `check_in`, `check_out`, `guests_min`, `suburb`, `min_price`, `max_price`, `currency`, `bedrooms_min`, `bedrooms_max`, `bathrooms_min`, `bathrooms_max`, `floor_area_min`, `floor_area_max`, `land_area_min`, `land_area_max`, `features`, `listed_within_days`, `advertiser_type`, `has_photos`, `reference`, `sort`; two places together (`country` with `region`, `region` with `city`); and a place together with `category` | noindex, follow | none | no |
| `/listings?location=<kind>:<code>` (the hero's Location select) and `advanced=1` | as the search they stand for | the plain address, without `location` or `advanced` | no |
| A search the API refuses (a city outside the chosen region, a maximum below its minimum) | noindex, follow | none | no |
| `/listings` with unknown parameters or invalid values | noindex, follow | none | no |
| `/listings/[slug]`, published | index, with `unavailable_after` set to the end of the 90-day publication | itself | yes |
| `/listings/[slug]`, no longer available (the API answers 410) | "This listing is no longer available" page: noindex, follow | none | no |
| `/listings/[slug]`, unknown (the API answers 404) | `notFound()`: noindex | none | no |
| `/directory` ("Find a property professional") and `/directory/[kind]` (every kind of professional the API lists). Visitors see "Professionals"; the addresses keep `directory` | index | itself | yes |
| `/directory/[kind]?country=…` or `?region=…` (a filtered list of professionals) | noindex, follow | none | no |
| `/directory/[kind]/[slug]` profile | index | itself | yes |
| `/faq` | index | itself | yes |
| `/legal`, `/legal/privacy-policy`, `/legal/terms-and-conditions`, `/legal/refund-policy`, `/legal/eula` | index | itself | yes, with the date the document last changed |
| Any public page while the API cannot be reached (error state) | noindex, follow | none | the sitemap answers 500 |
| Sign-in, register, password reset, account, appointments, agent inbox, "Your listings" and the availability editor, design system | noindex | none | no |

Rules behind the table:

- **Only curated result pages are indexed.** They are a small set that people search for by name: each deal, each category, deal with category, and each country, region and city alone or with a deal ("Property for sale in Matabeleland North"). A place page names one place: a region with a city, or a country with a region, says no more than the narrower one alone, so it is not indexed. The deals, categories, regions and cities come from the API's reference data, so the set grows only when an administrator adds one. The countries are the ones that have listings (`GET /v1/markets?has_listings=true`), and the regions are theirs: a country page exists while the country has a published listing. A search may name any country (`?country=FR`); without listings it is an empty result, which is never indexed. Free-text search can produce unlimited near-duplicate URLs, so it is never indexed.
- **Short stays are a category like the others.** `/listings?category=short-stay` is indexable, alone and with a deal. A stay search (dates or a number of guests) is not: it is different for every visitor and every day.
- **Every other filter is `noindex, follow`.** Property type, stay dates and guests, suburb, price, bedroom and bathroom ranges, floor and land area, features, how recently a listing was published, who advertises it, whether it has photos, its reference, and sort order multiply into thousands of thin or duplicate pages (a different sort order is the same content). They stay crawlable so the listings on them are found, but they carry no canonical and are not in the sitemap. This is deliberately conservative: with one or two listings per suburb today, suburb and property-type pages would be thin. Promote a filter to the curated set only when its pages have enough listings to stand on their own, and change `parseListingsSearch` and `getCuratedListingPages` together.
- **A code that is not in the reference data is an invalid value.** The page is `noindex`, the filter is ignored, and the API is never sent a code it would refuse.
- **Paginated pages are self-canonical.** `/listings?deal=rent&page=2` is its own canonical; it is never pointed at page 1, because it lists different properties. `page=1` is the same page as no `page`, so the canonical drops it. Pages 2 and later are indexable when their base page is, but stay out of the sitemap. Submitting the search form always starts again at page 1.
- **Private pages use a `noindex` meta tag and are not blocked in `robots.txt`.** A crawler that is blocked from a page never sees its `noindex`.
- **Empty parameters do not create duplicates.** With JavaScript the search forms leave empty fields out of the address. Without it they submit them (`?deal=rent&category=&q=`); the page ignores them, and the canonical drops them and fixes the parameter order.
- **Expired listings leave the index.** `unavailable_after` (the API's `expires_at`) tells Google when to drop the page, and the sitemap lists only published listings. A listing that was public and no longer is shows "This listing is no longer available" with `noindex`; a slug that never existed is not found. Neither is redirected to a category page.
- **An error state is never indexed and never cached.** When the API cannot be reached a page shows an error state with `noindex` and no canonical, and the next request tries again. The sitemap answers 500 rather than listing fewer pages.
- **Content is in the HTML.** When the build could read the API, listings, search results, directories and profiles are complete HTML in the response, in document order, with nothing left for a script to reveal (README, "Builds and the API"). A crawler that does not run JavaScript reads the same page as a browser. A build made without the API streams that content instead, so production images should be built with the API reachable.
- **The FAQ is static** and complete in the HTML: every answer is inside a native `<details>`, so it is readable without JavaScript and by crawlers. Each question has its own anchor (`/faq#cookies`). Google shows FAQ rich results only for a few kinds of site, so the `FAQPage` markup is there to describe the page, not to win a rich result.
- **The legal pages are static.** They read no API, so they are prerendered in every build and never show an error state. Their titles, descriptions, dates and addresses come from `src/lib/legal.ts`. The mobile apps link to them, so the addresses do not change.
- **Crawlers get metadata in `<head>`.** By default Next.js streams request-time metadata into `<body>` for browsers and for Googlebot, but Google honours `rel=canonical` only in `<head>`. `htmlLimitedBots` in `next.config.ts` lists crawler user agents (Next's default list plus Googlebot and generic crawler names) that receive complete `<head>` metadata instead. Browsers keep the faster streamed behaviour.

## Headings and titles name a place only when one is chosen

The site lists property from any country, so nothing assumes one. `listingsHeading` in `src/lib/seo.ts` builds the `h1`, the title, the description, the Open Graph title and the labels of the curated pages, and the same rule applies to the lists of professionals.

| Address | Heading and title |
| --- | --- |
| `/listings` | Property for sale and to rent |
| `/listings?deal=sale` | Property for sale |
| `/listings?category=residential` | Residential property |
| `/listings?category=short-stay` | Short stays |
| `/listings?deal=sale&country=GB` | Property for sale in the United Kingdom |
| `/listings?country=ZW` | Property in Zimbabwe |
| `/listings?region=harare` | Property in Harare |
| `/listings?deal=rent&city=harare` | Property to rent in Harare |
| `/listings?region=harare&country=ZW` | Property in Harare, Zimbabwe |
| `/directory/solicitors` | Solicitors |
| `/directory/solicitors?country=GB` | Solicitors in the United Kingdom |

- **No place chosen, no place named.** There is no default country. The root title is "RightProperty365 | Property for sale and to rent".
- **With a place, name the narrowest one chosen**: suburb and city, else region, else country. The country follows it when the visitor chose the country as well ("Harare, Zimbabwe").
- **Country names come from the API** (`GET /v1/countries`). `src/lib/countries.ts` holds only which names take "the" ("in the United Kingdom"), by ISO code.
- **A category label that is an adjective gets "property" after it** ("Residential property", "Commercial property"); one that is already a noun phrase stands alone ("Land", "Short stays"). The adjectives are the one list, by category code, in `listingsHeading`.
- The line under the results heading says "prices shown in USD" only when every result is in that currency, and "prices shown in each listing's currency" when the API reports several. A listing's own page and card always show its own currency code.
- A listing's title and description name the place it gives: suburb and city, or city and country where it has no suburb ("… to rent in Grand Baie, Mauritius"). A place typed by the lister is text only.

## Where the data comes from

Titles, headings, canonicals and structured data are built from what the API returns: listings and profiles, and the labels of deals, categories, cities and directories in its reference data. Nothing in `src/lib/seo.ts` names a deal, category or city. The sitemap is built from `GET /v1/sitemap` (published, unexpired listings and active profiles only) and its data is cached for no longer than an hour, so expired listings drop out.

## Metadata

- Root layout: `metadataBase` (from `NEXT_PUBLIC_SITE_URL`), a title template, default robots, Open Graph defaults.
- Metadata merges shallowly. A page that sets `openGraph` or `robots` replaces the parent's whole object, so pages repeat the fields they need. Search pages name `/opengraph-image` again for that reason.
- Listing pages: title is "*listing title* for sale/to rent in *suburb*, *city*"; the description leads with type, place and price (a short stay adds how many it sleeps and its shortest stay); the share image is the listing photo.
- Default share image: `src/app/opengraph-image.tsx`, drawn in the brand colours.

`NEXT_PUBLIC_SITE_URL` must be the real public origin in every deployed environment. Canonicals, the sitemap and structured data are built from it. Staging should also be kept out of search at the host level (basic auth or an `X-Robots-Tag: noindex` header).

## Structured data (JSON-LD)

| Page | Types |
| --- | --- |
| Home | `Organization`, `WebSite` (name and URL only) |
| Listing search, indexable pages only | `CollectionPage` with `BreadcrumbList` and an `ItemList` of the results |
| Listing detail | `RealEstateListing` with `BreadcrumbList`, the property as `mainEntity` and an `Offer` |
| List of professionals (`/directory/[kind]`) | `CollectionPage` with `BreadcrumbList` and an `ItemList` of the profiles |
| FAQ (`/faq`) | `FAQPage` with one `Question` per entry and its `acceptedAnswer` as plain text, from the same data as the page (`src/lib/faq.ts`) |
| Profile (`/directory/[kind]/[slug]`) | `ProfilePage` whose `mainEntity` is a `RealEstateAgent` (agency), `Person` (agent, with `worksFor`), `LegalService` (solicitor) or `Organization` (everyone else) |

- The property's `PostalAddress` has the suburb and city as `addressLocality` (whichever the listing names), the region or province as `addressRegion` when there is one, and the country code as `addressCountry`.
- The property is `House` or `Apartment` when the listing has a bedroom count (a home) and `Place` otherwise (commercial property and land), because `floorSize` and bedroom counts are only valid on accommodation types.
- The `Offer` sits on the listing, not the property. Rentals use a `UnitPriceSpecification` per month, short stays per night (`unitCode` `DAY`). The availability calendar is not marked up: it is the host's guide, not an offer of specific nights.
- Google has **no rich result for real-estate listings**. This markup helps machines understand the page; it will not add stars or prices to results. `BreadcrumbList` and `Organization` are supported Google features.
- Deliberately not used: `Product` for property, `FAQPage`, and `WebSite` `SearchAction` (Google retired the sitelinks search box in November 2024).
- The type of a profile's main entity is chosen by directory kind code in one map (`profileEntityType` in `src/lib/seo.ts`). A directory the API adds later is an `Organization` until it is given a type there. `LegalService` is a `LocalBusiness`, so a law firm carries its city as an address; a street address, phone number and email are never published (the enquiry-only rule).
- Not included yet: `geo` coordinates (listings have none).

## Internal links and images

- Listing search ends with "Popular searches": plain links to every curated result page that has listings, including country and region pages. Filter chips above the results are plain links too. The landing page links each city tile to its city page and each suburb chip to its (noindex, follow) suburb search.
- Result pages link to each other with ordinary page links (`Pagination`), so every listing is reachable by crawling.
- Listing detail has a full breadcrumb and "Similar properties", and links the agent and agency to their public profiles.
- Profiles list the agency's agents and every property they are marketing, so listings, agents and agencies all link to each other.
- Sponsored profiles are labelled "Sponsored" wherever they appear and are sorted first; the label is part of the page, not hidden from crawlers.
- Listing photos are real `<img>` elements through `next/image`, with the alt text the API returns and fixed aspect ratios (no layout shift).

## Known gaps

- **Unknown listings return HTTP 200 with `noindex`, not 404.** With Cache Components the response starts before the listing is looked up (still true now that the page has no `<Suspense>`: checked on 14 November 2026). Google treats this as a soft 404, which is acceptable; a real 404 needs a slug check in a proxy before the response starts.
- **A listing that is no longer available also returns HTTP 200 with `noindex`,** for the same reason. A 410 needs the same proxy check.
- **No image sitemap.** `GET /v1/sitemap` returns each listing's slug and `updated_at` but not its photo, so the sitemap no longer names a photo per listing. Google still finds the photos on the pages.
- **The sitemap is one file.** It holds every public listing and profile. Split it with `generateSitemaps` before it nears 50,000 URLs.
- **Suburb and property-type pages are not indexed** (see the rules above), and there is no `hreflang` for other countries.
- **Lists of professionals are not paginated.** A list page shows every profile (the API is read 48 at a time, up to 480). Add `Pagination` before a list grows past that.
- **Profiles** have no logos, photos, reviews or street addresses yet, so they cannot qualify for Google's local business features.
- **Not measured:** Core Web Vitals on a deployed site (targets: LCP 2.5s, INP 200ms, CLS 0.1), and validation in Google's Rich Results Test or Search Console.

## Checking a change

Start the API, build, start the production server, and fetch pages with a crawler user agent. For each public page confirm the title, description, robots, canonical and JSON-LD are present in `<head>` and match the table above, then check `/sitemap.xml` and `/robots.txt`. Cases worth fetching every time: a curated page (`?deal=rent&city=harare`), its page 2, a free-text search, a filtered search (`?suburb=…`), an unknown code (`?deal=x`), a page past the end, a published listing, a listing that is no longer available, and an unknown slug.
