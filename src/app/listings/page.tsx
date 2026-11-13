import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listings/listing-card";
import { SearchBar } from "@/components/listings/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { findListings, type ListingFilters } from "@/lib/data/listings";

export const metadata: Metadata = {
  title: "Property listings",
  description: "Browse property for sale and to rent across Zimbabwe.",
};

type SearchParams = PageProps<"/listings">["searchParams"];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// searchParams is request-time data, so everything that reads it sits behind
// Suspense and the rest of the page stays in the static shell.
async function Results({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters: ListingFilters = {
    deal: first(params.deal),
    category: first(params.category),
    q: first(params.q),
  };
  const results = findListings(filters);

  return (
    <>
      <SearchBar defaults={filters} className="shadow-xs" />
      <p className="mt-8 text-sm text-muted" role="status">
        {results.length === 1 ? "1 property" : `${results.length} properties`} found
      </p>
      {results.length > 0 ? (
        <div className="mt-4">
          <ListingGrid listings={results} />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">No properties match that search</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Try a nearby suburb, a different category, or clear the filters to see everything.
          </p>
          <ButtonLink href="/listings" variant="secondary" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading listings">
      <div className="h-[4.25rem] rounded-xl bg-sunken" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 rounded-lg bg-sunken" />
        ))}
      </div>
    </div>
  );
}

export default function ListingsPage({ searchParams }: PageProps<"/listings">) {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="text-4xl">Property listings</h1>
      <p className="mt-2 text-muted">Zimbabwe · prices shown in USD</p>
      <div className="mt-8">
        <Suspense fallback={<ResultsFallback />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}
