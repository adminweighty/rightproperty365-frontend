import type { Metadata } from "next";
import { ApiBoundary } from "@/components/api-boundary";
import { DevelopmentGrid } from "@/components/developments/development-card";
import { DevelopmentFiltersForm } from "@/components/developments/development-filters";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { searchDevelopments } from "@/lib/api/server/developments";
import { load } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue } from "@/lib/api/server/reference";
import type { SelectItem } from "@/components/ui/searchable-select";
import {
  DEVELOPMENT_STATUSES,
  developmentsCollectionJsonLd,
  developmentsHeading,
  developmentsPath,
  developmentsQuery,
  developmentStatusLabels,
  parseDevelopmentsSearch,
} from "@/lib/developments";
import { env } from "@/lib/env";
import { countryInSentence } from "@/lib/countries";

type Props = PageProps<"/developments">;
type RawParams = Awaited<Props["searchParams"]>;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so the server renders the whole page before it answers and
// the results are in the HTML, visible without JavaScript.
export const instant = false;

const DESCRIPTION =
  "New property developments and investment projects: estates, cluster homes and apartments from verified developers, with phases, unit types, prices and completion estimates.";

/** Reference data, the parsed search and its results. Every read is cached. */
async function readResults(params: RawParams) {
  const [catalogue, countries] = await Promise.all([getCatalogue(), getAllCountries()]);
  const search = parseDevelopmentsSearch(params, {
    markets: countries.map(({ code }) => code),
    cities: catalogue.sets.cities,
  });
  const result = await searchDevelopments(developmentsQuery(search));
  const market = countries.find(({ code }) => code === search.filters.market);
  const city = catalogue.sets.cities.find(({ code }) => code === search.filters.city);
  const heading = developmentsHeading(search.filters, {
    market: market ? countryInSentence(market.code, market.name) : undefined,
    city: city?.label,
  });
  return { catalogue, countries, search, result, heading };
}

/** The address the visitor asked for, to offer again when loading fails. */
function requestedPath(params: RawParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item) query.append(key, item);
  }
  const text = query.toString();
  return text ? `/developments?${text}` : "/developments";
}

/**
 * Indexing (docs/seo.md): the plain list, one country alone and one city
 * alone are indexed with their results, each page its own canonical. A
 * search with words, a status, two filters, an invalid value, no results or
 * a page past the end is `noindex, follow` with no canonical.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const loaded = await load(() => readResults(params));
  if (!loaded.ok) return { title: "New developments", robots: { index: false, follow: true } };
  const { search, result, heading } = loaded.data;
  const indexable = search.indexable && result.status === "ok" && result.page.items.length > 0;
  const title = search.page > 1 ? `${heading}, page ${search.page}` : heading;
  return {
    title,
    description: DESCRIPTION,
    alternates: indexable ? { canonical: search.path } : undefined,
    robots: indexable ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: true },
    openGraph: { type: "website", title, description: DESCRIPTION, url: search.path, images: ["/opengraph-image"] },
  };
}

const projectCount = (count: number) => (count === 1 ? "1 project" : `${count} projects`);

async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const loaded = await load(() => readResults(params));
  if (!loaded.ok) {
    return (
      <>
        <h1 className="text-3xl md:text-4xl">New developments</h1>
        <ErrorState title="We could not load the developments." retryHref={requestedPath(params)} className="mt-8" />
      </>
    );
  }

  const { catalogue, countries, search, result, heading } = loaded.data;
  const page = result.status === "ok" ? result.page : undefined;
  const pastTheEnd = page !== undefined && page.items.length === 0 && page.total > 0;
  const filtered = Object.values(search.filters).some(Boolean);

  const countryNames = new Map(countries.map(({ code, name }) => [code, name]));
  const markets: SelectItem[] = countries
    .map(({ code, name }) => ({ value: code, label: name, keywords: [code] }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
  // Cities by country; only the chosen country's when one is chosen.
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const city of catalogue.sets.cities) {
    if (!city.market_code || (search.filters.market && city.market_code !== search.filters.market)) continue;
    const group = groups.get(city.market_code) ?? [];
    group.push({ value: city.code, label: city.label });
    groups.set(city.market_code, group);
  }
  const cities: SelectItem[] = [...groups.entries()]
    .map(([code, options]) => ({ label: countryNames.get(code) ?? code, options }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
  const statuses = DEVELOPMENT_STATUSES.map((code) => ({ value: code, label: developmentStatusLabels[code] }));

  return (
    <>
      <div className="enter-rise">
        <h1 className="text-3xl md:text-4xl">{heading}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Projects from verified property developers. Prices, completion dates and investment figures are the
          developer&rsquo;s own; ask them through an enquiry on each project.
        </p>
        {page && (
          <p className="mt-2 text-sm text-muted" role="status">
            {projectCount(page.total)}
            {page.total_pages > 1 && ` · page ${page.page} of ${page.total_pages}`}
          </p>
        )}
      </div>

      <DevelopmentFiltersForm defaults={search.filters} markets={markets} cities={cities} statuses={statuses} className="mt-8" />

      {page && page.items.length > 0 && (
        <>
          <div key={requestedPath(params)} className="mt-8">
            <DevelopmentGrid developments={page.items} headingLevel="h2" />
          </div>
          <Pagination
            page={page.page}
            totalPages={page.total_pages}
            hrefFor={(value) => developmentsPath(search.filters, value)}
            label="Development results"
            className="mt-10"
          />
          {search.indexable && (
            <JsonLd
              data={developmentsCollectionJsonLd(search, heading, page, { site: env.siteUrl, api: env.apiUrl })}
            />
          )}
        </>
      )}

      {page && page.items.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-8 text-center md:p-10">
          <h2 className="text-2xl">
            {pastTheEnd
              ? `There is no page ${search.page} of these results`
              : filtered
                ? "No developments match that search"
                : "No developments are on show yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {pastTheEnd
              ? `This search has ${projectCount(page.total)} on ${page.total_pages === 1 ? "1 page" : `${page.total_pages} pages`}.`
              : filtered
                ? "Try another city or status, or clear the filters to see every project."
                : "Developers' projects appear here once our team has checked them. Browse the property listings in the meantime."}
          </p>
          {pastTheEnd ? (
            <ButtonLink href={developmentsPath(search.filters)} variant="secondary" className="mt-6">
              Go to page 1
            </ButtonLink>
          ) : filtered ? (
            <ButtonLink href="/developments" variant="secondary" className="mt-6">
              Clear filters
            </ButtonLink>
          ) : (
            <ButtonLink href="/listings" variant="secondary" className="mt-6">
              Browse listings
            </ButtonLink>
          )}
        </div>
      )}

      {result.status === "invalid" && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-8 text-center md:p-10">
          <h2 className="text-2xl">That search could not be run</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            One of the filters is not available any more. Clear the filters and search again.
          </p>
          <ButtonLink href="/developments" variant="secondary" className="mt-6">
            Clear filters
          </ButtonLink>
        </div>
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading developments">
      <div className="h-10 max-w-md rounded-md bg-sunken" />
      <div className="mt-10 h-36 rounded-xl bg-sunken lg:h-20" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 rounded-lg bg-sunken" />
        ))}
      </div>
    </div>
  );
}

export default function DevelopmentsPage({ searchParams }: Props) {
  return (
    <Container className="py-10 md:py-14">
      <ApiBoundary fallback={<ResultsFallback />}>
        <Results searchParams={searchParams} />
      </ApiBoundary>
    </Container>
  );
}
