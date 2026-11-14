import type { Metadata } from "next";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/listing-card";
import { SearchBar } from "@/components/listings/search-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { getCuratedListingPages } from "@/lib/api/server/curated";
import { searchListings, suggestListings } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { X } from "lucide-react";
import { activeFilterChips } from "@/lib/filter-chips";
import { buildSearchOptions } from "@/lib/search-options";
import { listingsCollectionJsonLd, listingsPath, parseListingsSearch } from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";

type Props = PageProps<"/listings">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers. That keeps the content
// in the HTML, visible without JavaScript.
export const instant = false;
type RawParams = Awaited<Props["searchParams"]>;

/** Reference data, the parsed search and its results. Every read is cached. */
async function readResults(params: RawParams) {
  const catalogue = await getCatalogue();
  const search = parseListingsSearch(params, catalogue);
  return { catalogue, search, result: await searchListings(search.query) };
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
 * deal + category, city, deal + city) are indexed with a canonical in fixed
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

  const { catalogue, search, result } = loaded.data;
  const page = result.status === "ok" ? result.page : undefined;
  const options = buildSearchOptions(catalogue.sets, page?.facets, search.filters, catalogue.markets);
  const currency = page?.facets.price?.currency ?? search.query.currency;
  // The line under the heading names a currency only when every result is in
  // it. An API that reports several currencies gets "each listing's currency".
  const currencies = (page?.facets as { currencies?: unknown } | undefined)?.currencies;
  const priceNote =
    Array.isArray(currencies) && currencies.length > 1
      ? "prices shown in each listing’s currency"
      : page?.facets.price?.currency
        ? `prices shown in ${page.facets.price.currency}`
        : undefined;
  // Without facets (the API refused the search) the price labels still name the currency.
  options.currency ??= currency;
  const chips = activeFilterChips(search.filters, catalogue, currency);
  const errors = result.status === "invalid" ? result.fields : {};
  const pastTheEnd = page !== undefined && page.items.length === 0 && page.total > 0;

  // Nothing matched a keyword: offer what the API suggests for it.
  const suggestions =
    page?.total === 0 && search.filters.q ? await suggestListings(search.filters.q).catch(() => []) : [];

  return (
    <>
      <h1 className="text-3xl md:text-4xl">{search.heading}</h1>
      {page && (
        <p className="mt-2 text-muted" role="status">
          {propertyCount(page.total)}
          {page.total_pages > 1 && ` · page ${page.page} of ${page.total_pages}`}
          {priceNote && ` · ${priceNote}`}
        </p>
      )}

      <SearchBar
        options={options}
        defaults={search.filters}
        advanced={search.advanced}
        errors={errors}
        className="mt-8"
      />

      {chips.length > 0 && (
        <nav aria-label="Filters in use" className="mt-6">
          <ul className="flex flex-wrap items-center gap-2">
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
                href={listingsPath({ sort: search.filters.sort })}
                className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary-ink hover:underline"
              >
                Clear all<span className="sr-only"> filters</span>
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {page && page.items.length > 0 && (
        <>
          <div className="mt-8">
            <ListingGrid listings={page.items} />
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
            {pastTheEnd ? `There is no page ${search.page} of these results` : "No properties match that search"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {pastTheEnd
              ? `This search has ${propertyCount(page.total)} on ${page.total_pages === 1 ? "1 page" : `${page.total_pages} pages`}.`
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
          <ButtonLink
            href={pastTheEnd ? listingsPath(search.filters) : "/listings"}
            variant="secondary"
            className="mt-6"
          >
            {pastTheEnd ? "Go to page 1" : "Clear filters"}
          </ButtonLink>
        </div>
      )}

      {result.status === "invalid" && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">That search could not be run</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {Object.keys(errors).length > 0
              ? "Some of the filters do not fit together. Each one is marked in the form above with what to change."
              : "One of the filters is not available any more. Clear the filters and search again."}
          </p>
          <ButtonLink href="/listings" variant="secondary" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}

      {search.curated && page && page.items.length > 0 && (
        <JsonLd data={listingsCollectionJsonLd(search, page.items, page.total, catalogue)} />
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
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {loaded.data.map((link) => (
          <li key={link.path}>
            <Link href={link.path} className="text-sm text-primary-ink hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
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
