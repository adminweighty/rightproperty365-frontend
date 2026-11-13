import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listings/listing-card";
import { SearchBar } from "@/components/listings/search-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { findListings } from "@/lib/data/listings";
import {
  curatedFacets,
  facetHeading,
  listingsCollectionJsonLd,
  listingsPath,
  parseListingsFacet,
} from "@/lib/seo";

type Props = PageProps<"/listings">;

/**
 * Indexing policy (docs/seo.md): the deal/category result pages are indexed
 * with a canonical in fixed parameter order. Free-text searches, unknown
 * parameters and empty result pages are noindex,follow with no canonical.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const facet = parseListingsFacet(await searchParams);
  const indexable = facet.curated && findListings(facet).length > 0;

  return {
    title: facet.heading,
    description: facet.description,
    alternates: indexable ? { canonical: facet.canonicalPath } : undefined,
    robots: indexable
      ? { index: true, follow: true, "max-image-preview": "large" }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: facet.heading,
      description: facet.description,
      url: facet.canonicalPath,
      // Setting `openGraph` here drops the root share image, so name it again.
      images: ["/opengraph-image"],
    },
  };
}

// searchParams is request-time data, so everything that reads it sits behind
// Suspense and the rest of the page stays in the static shell.
async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const facet = parseListingsFacet(await searchParams);
  const results = findListings(facet);

  return (
    <>
      <h1 className="text-3xl md:text-4xl">{facet.heading}</h1>
      <p className="mt-2 text-muted" role="status">
        {results.length === 1 ? "1 property" : `${results.length} properties`} · prices shown in USD
      </p>

      <SearchBar defaults={facet} className="mt-8 shadow-xs" />

      {results.length > 0 ? (
        <div className="mt-8">
          <ListingGrid listings={results} />
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">No properties match that search</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Try a nearby suburb, a different category, or clear the filters to see everything.
          </p>
          <ButtonLink href="/listings" variant="secondary" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}

      {facet.curated && results.length > 0 && (
        <JsonLd data={listingsCollectionJsonLd(facet, results)} />
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading listings">
      <div className="h-10 max-w-md rounded-md bg-sunken" />
      <div className="mt-12 h-[4.25rem] rounded-xl bg-sunken" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 rounded-lg bg-sunken" />
        ))}
      </div>
    </div>
  );
}

/** Plain links to every result page that has listings: crawl paths and shortcuts. */
function PopularSearches() {
  const links = curatedFacets()
    .filter((facet) => (facet.deal || facet.category) && findListings(facet).length > 0)
    .map((facet) => ({
      href: listingsPath(facet.deal, facet.category),
      label: facetHeading(facet.deal, facet.category),
    }));

  return (
    <nav aria-labelledby="popular-searches" className="mt-16 border-t border-line pt-10">
      <h2 id="popular-searches" className="text-xl">
        Popular searches
      </h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-primary-ink hover:underline">
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
      <Suspense fallback={<ResultsFallback />}>
        <Results searchParams={searchParams} />
      </Suspense>
      <PopularSearches />
    </Container>
  );
}
