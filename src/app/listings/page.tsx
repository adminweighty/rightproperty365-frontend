import type { Metadata } from "next";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/listing-card";
import { VERIFIED_FAQ } from "@/components/listings/advertiser";
import { SearchBar } from "@/components/listings/search-bar";
import { Stagger } from "@/components/motion/stagger";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { getCuratedListingPages } from "@/lib/api/server/curated";
import { searchListings, suggestListings } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue } from "@/lib/api/server/reference";
import { X } from "lucide-react";
import { toLabels } from "@/lib/api/types";
import { activeFilterChips } from "@/lib/filter-chips";
import { buildSearchOptions } from "@/lib/search-options";
import { LISTINGS_PAGE_SIZE, listingsCollectionJsonLd, listingsPath, parseListingsSearch } from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";
import { ViewToggle } from "@/components/listings/view-toggle";
import { SaveSearchButton } from "@/components/saved-searches/save-search-button";
import { queryString } from "@/lib/api/server/client";
import { ResultsMap, type MapListing } from "@/components/map/maps";
import { Alert } from "@/components/ui/alert";
import type { Listing } from "@/lib/api/types";
import { env } from "@/lib/env";
import { formatMoney, pricePeriodLabel } from "@/lib/format";
import { mappableText } from "@/lib/map";
import { shortPlace } from "@/lib/places";

type Props = PageProps<"/listings">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers. That keeps the content
// in the HTML, visible without JavaScript.
export const instant = false;
type RawParams = Awaited<Props["searchParams"]>;

/** Reference data, the parsed search and its results. Every read is cached. */
async function readResults(params: RawParams) {
  const [catalogue, everyCountry] = await Promise.all([getCatalogue(), getAllCountries()]);
  // A search may name any country, so the address is read against all of
  // them; the form offers the ones that have listings.
  const context = { sets: catalogue.sets, countries: everyCountry };
  const search = parseListingsSearch(params, context);
  const country = everyCountry.find(({ code }) => code === search.filters.country);
  const [result, overview] = await Promise.all([
    searchListings(search.query),
    // The Map view also says how much of the whole search can be mapped: the
    // same search without the box, read as the list's first page (one cache entry).
    search.view === "map"
      ? searchListings({ ...search.query, bbox: undefined, has_location: undefined, page: 1, page_size: LISTINGS_PAGE_SIZE })
      : undefined,
  ]);
  return { catalogue, context, search, country, result, overview };
}

/** A result with a location, as the map shows it. Plain text, so the map's client code needs no formatting. */
function toMapListing(listing: Listing, periods: Record<string, string>): MapListing[] {
  if (!listing.location) return [];
  const price = formatMoney(listing.price);
  return [
    {
      id: listing.id,
      title: listing.title,
      href: `/listings/${listing.slug}`,
      price: listing.price_period ? `${price} ${pricePeriodLabel(listing.price_period, periods)}` : price,
      place: shortPlace(listing),
      location: listing.location,
    },
  ];
}

/** The address the visitor asked for, to offer again when loading fails. */
function requestedPath(params: RawParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item) query.append(key, item);
  }
  const text = query.toString();
  return text ? `/listings?${text}` : "/listings";
}

/**
 * Indexing policy (docs/seo.md): the curated result pages (deal, category,
 * deal + category, and a country, region or city alone or with a deal) are indexed with a canonical in fixed
 * parameter order, and each of their pages is its own canonical. Free-text
 * searches, every other filter, unknown parameters, empty results and
 * failures are noindex,follow with no canonical.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const loaded = await load(() => readResults(params));
  if (!loaded.ok) return { title: "Listings", robots: { index: false, follow: true } };

  const { search, result } = loaded.data;
  const indexable = search.curated && result.status === "ok" && result.page.items.length > 0;

  return {
    title: search.title,
    description: search.description,
    alternates: indexable ? { canonical: search.canonicalPath } : undefined,
    robots: indexable
      ? { index: true, follow: true, "max-image-preview": "large" }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: search.title,
      description: search.description,
      url: search.canonicalPath,
      // Setting `openGraph` here drops the root share image, so name it again.
      images: ["/opengraph-image"],
    },
  };
}

const propertyCount = (count: number) => (count === 1 ? "1 property" : `${count} properties`);

// searchParams is request-time data, so this is rendered for each request.
// It sits in an ApiBoundary, not a <Suspense>: see `instant` above.
async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const loaded = await load(() => readResults(params));

  if (!loaded.ok) {
    return (
      <>
        <h1 className="text-3xl md:text-4xl">Listings</h1>
        <ErrorState title="We could not load the listings." retryHref={requestedPath(params)} className="mt-8" />
      </>
    );
  }

  const { catalogue, context, search, country, result, overview } = loaded.data;
  const mapView = search.view === "map";
  const periods = toLabels(catalogue.sets.price_periods);
  const overviewPage = overview?.status === "ok" ? overview.page : undefined;
  const mappable = overviewPage ? mappableText(overviewPage.mappable_total, overviewPage.total) : null;
  // In the Map view, a search with results of which none has a location.
  const noneMapped = mapView && !search.filters.bbox && (overviewPage?.total ?? 0) > 0;
  const page = result.status === "ok" ? result.page : undefined;
  const options = buildSearchOptions(catalogue.sets, page?.facets, search.filters, catalogue.countries, country);
  // The line under the heading names a currency only when every result is in
  // it. Results in several currencies get "each listing's currency", also when
  // a currency was chosen for the price filter (that does not narrow the results).
  // An API build that does not list the currencies has one: that of its price facet.
  // A price filter leaves only listings priced in its currency.
  const priced = search.filters.min_price !== undefined || search.filters.max_price !== undefined;
  const inCurrencies =
    priced && options.currency
      ? [options.currency]
      : (page?.facets.currencies?.map(({ code }) => code) ??
        [page?.facets.price?.currency].filter((code) => code !== undefined));
  const priceNote =
    !page || page.total === 0 || inCurrencies.length === 0
      ? undefined
      : inCurrencies.length === 1
        ? `prices shown in ${inCurrencies[0]}`
        : "prices shown in each listing’s currency";
  const chips = activeFilterChips(search.filters, context, options.currency);
  const errors = result.status === "invalid" ? result.fields : {};
  const pastTheEnd = page !== undefined && page.items.length === 0 && page.total > 0;

  // Nothing matched a keyword: offer what the API suggests for it.
  const suggestions =
    page?.total === 0 && search.filters.q ? await suggestListings(search.filters.q).catch(() => []) : [];

  return (
    <>
      {/* The heading rises into place as the page paints: a transform in CSS, so it is never hidden. */}
      <div className="enter-rise">
      <h1 className="text-3xl md:text-4xl">{search.heading}</h1>
      {/* A country's notice, set by the administrators (API 0.56.0). */}
      {country?.notice && <p className="mt-2 rounded-md bg-info-soft px-3 py-2 text-sm text-ink">{country.notice}</p>}
      {page && (
        <p className="mt-2 text-muted" role="status">
          {propertyCount(page.total)}
          {mapView && (search.filters.bbox ? " in this map area" : " on the map")}
          {page.total_pages > 1 && ` · page ${page.page} of ${page.total_pages}`}
          {priceNote && ` · ${priceNote}`}
        </p>
      )}

      {page && page.total > 0 && (
        <p className="mt-1 text-sm text-muted">
          All listings are from verified agents, agencies and owners.{" "}
          <Link href={VERIFIED_FAQ} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
            What Verified means
          </Link>
        </p>
      )}
      </div>

      <SearchBar
        options={options}
        defaults={search.filters}
        advanced={search.advanced}
        errors={errors}
        className="mt-8"
      />

      {chips.length > 0 && (
        <nav aria-label="Filters in use" className="mt-6">
          <Stagger as="ul" stagger={0.03} className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <Link
                  href={chip.href}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface pl-4 pr-3 text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
                >
                  <span className="sr-only">Remove filter: </span>
                  {chip.label}
                  <X className="size-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={listingsPath({ sort: search.filters.sort, view: search.filters.view })}
                className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary-ink hover:underline"
              >
                Clear all<span className="sr-only"> filters</span>
              </Link>
            </li>
          </Stagger>
        </nav>
      )}

      {result.status === "ok" && (
        <SaveSearchButton
          heading={search.heading}
          query={queryString({ ...search.query, page: undefined, page_size: undefined, sort: undefined, bbox: undefined, has_location: undefined }).replace(/^\?/, "")}
          className="mt-6"
        />
      )}

      {env.map && result.status === "ok" && (
        <ViewToggle
          view={search.view}
          listHref={listingsPath({ ...search.filters, view: undefined })}
          mapHref={listingsPath({ ...search.filters, view: "map" })}
          className="mt-6"
        />
      )}

      {mapView && page && (
        <section aria-labelledby="map-heading" className="mt-6">
          <h2 id="map-heading" className="sr-only">
            Map of the results
          </h2>
          {mappable && <p className="mb-3 text-sm text-muted">{mappable}</p>}
          <ResultsMap
            listings={page.items.flatMap((listing) => toMapListing(listing, periods))}
            bbox={search.filters.bbox ?? null}
            searchBase={listingsPath({ ...search.filters, bbox: undefined })}
          />
        </section>
      )}

      {page && page.items.length > 0 && (
        <>
          {/* The map is never the only way to a listing: everything on it is listed here too. */}
          {mapView && (
            <h2 className="mt-8 text-2xl">{search.filters.bbox ? "Properties in this area" : "Properties on the map"}</h2>
          )}
          {/* A new key for a new search, so its cards come in again after a client-side navigation. */}
          <div key={requestedPath(params)} className={mapView ? "mt-4" : "mt-8"}>
            <ListingGrid
              listings={page.items}
              periods={periods}
              // The stay of the search travels to each short stay, to start its request form.
              stay={{ check_in: search.filters.check_in, check_out: search.filters.check_out, guests: search.filters.guests_min }}
              // Impressions are counted with their place in the whole result list, not just this page.
              placement="search"
              rankOffset={(page.page - 1) * page.page_size}
            />
          </div>
          <Pagination
            page={page.page}
            totalPages={page.total_pages}
            hrefFor={(value) => listingsPath(search.filters, value)}
            label="Listing results"
            className="mt-10"
          />
        </>
      )}

      {page && page.items.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">
            {pastTheEnd
              ? `There is no page ${search.page} of these results`
              : mapView && search.filters.bbox
                ? "No properties in this area"
                : noneMapped
                  ? "None of these properties is on the map yet"
                  : "No properties match that search"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {pastTheEnd
              ? `This search has ${propertyCount(page.total)} on ${page.total_pages === 1 ? "1 page" : `${page.total_pages} pages`}.`
              : mapView && search.filters.bbox
                ? "Move the map or zoom out and search this area again, or search the whole map."
                : noneMapped
                  ? `This search has ${propertyCount(overviewPage?.total ?? 0)}, but none has been placed on the map by its advertiser. The list shows them all.`
                  : "Try a nearby suburb, a different category, or clear the filters to see everything."}
          </p>
          {suggestions.length > 0 && (
            <ul className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.type}-${suggestion.value}`}>
                  <Link
                    href={
                      suggestion.type === "listing"
                        ? `/listings/${suggestion.value}`
                        : // The suggestion's type is the name of the filter it sets.
                          listingsPath({ [suggestion.type]: suggestion.value })
                    }
                    className="flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
                  >
                    {suggestion.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {pastTheEnd ? (
            <ButtonLink href={listingsPath(search.filters)} variant="secondary" className="mt-6">
              Go to page 1
            </ButtonLink>
          ) : mapView && search.filters.bbox ? (
            <ButtonLink href={listingsPath({ ...search.filters, bbox: undefined })} variant="secondary" className="mt-6">
              Search the whole map
            </ButtonLink>
          ) : noneMapped ? (
            <ButtonLink href={listingsPath({ ...search.filters, view: undefined })} variant="secondary" className="mt-6">
              Show them as a list
            </ButtonLink>
          ) : (
            <ButtonLink href={mapView ? listingsPath({ view: "map" }) : "/listings"} variant="secondary" className="mt-6">
              Clear filters
            </ButtonLink>
          )}
        </div>
      )}

      {result.status === "invalid" && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">That search could not be run</h2>
          {errors.bbox && (
            <Alert tone="warning" title="The map area could not be searched" className="mx-auto mt-4 max-w-md text-left">
              {errors.bbox}
            </Alert>
          )}
          <p className="mx-auto mt-2 max-w-md text-muted">
            {Object.keys(errors).length > 0
              ? "Some of the filters need a change. Each one is marked in the form above with what to do."
              : "One of the filters is not available any more. Clear the filters and search again."}
          </p>
          <ButtonLink href="/listings" variant="secondary" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}

      {search.curated && page && page.items.length > 0 && (
        <JsonLd data={listingsCollectionJsonLd(search, page.items, page.total, context)} />
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading listings">
      <div className="h-10 max-w-md rounded-md bg-sunken" />
      <div className="mt-12 h-[16rem] rounded-xl bg-sunken" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 rounded-lg bg-sunken" />
        ))}
      </div>
    </div>
  );
}

/** Plain links to every indexed result page that has listings: crawl paths and shortcuts. */
async function PopularSearches() {
  const loaded = await load(async () => getCuratedListingPages(await getCatalogue()));
  // The links are a convenience under the results; without the API there is nothing to list.
  if (!loaded.ok || loaded.data.length === 0) return null;

  return (
    <nav aria-labelledby="popular-searches" className="mt-16 border-t border-line pt-10">
      <h2 id="popular-searches" className="text-xl">
        Popular searches
      </h2>
      <Stagger as="ul" stagger={0.02} className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {loaded.data.map((link) => (
          <li key={link.path}>
            <Link href={link.path} className="text-sm text-primary-ink hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </Stagger>
    </nav>
  );
}

export default function ListingsPage({ searchParams }: Props) {
  return (
    <Container className="py-10 md:py-14">
      <ApiBoundary fallback={<ResultsFallback />}>
        <Results searchParams={searchParams} />
      </ApiBoundary>
      <ApiBoundary fallback={null}>
        <PopularSearches />
      </ApiBoundary>
    </Container>
  );
}
