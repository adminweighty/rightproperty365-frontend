import type { FacetCount } from "@/lib/api/types";
import { listingsHeading, listingsPath, type ListingFilters } from "@/lib/seo";
import { listListings } from "./listings";
import type { Catalogue } from "./reference";

export type CuratedPage = { path: string; label: string; count: number };

/** The API counts regions only within a country, so each country costs a search per deal. Stop somewhere. */
const COUNTRY_LIMIT = 24;

/**
 * The indexable result pages that have listings right now (docs/seo.md):
 * each deal, each category, deal + category, and each country, region and
 * city alone and with a deal.
 * Used for the sitemap and the "Popular searches" links. Counts come from the
 * search facets. Countries are the ones that have listings; region counts
 * come from a search of each of those countries, because the API counts
 * regions only within a country.
 */
export async function getCuratedListingPages(catalogue: Catalogue): Promise<CuratedPage[]> {
  const everything = await listListings({ page_size: 1 });
  if (!everything) return [];

  const pages: CuratedPage[] = [];
  const add = (filters: ListingFilters, facet: FacetCount[] | undefined, code: string) => {
    const count = facet?.find((item) => item.code === code)?.count ?? 0;
    if (count > 0) {
      pages.push({ path: listingsPath(filters), label: listingsHeading(filters, catalogue), count });
    }
  };

  const { sets } = catalogue;
  const countries = catalogue.countries.slice(0, COUNTRY_LIMIT).map(({ code }) => code);
  /** One search of everything and one per country, for a deal or for all deals. */
  const searches = async (deal?: string) => ({
    deal,
    all: deal ? await listListings({ deal, page_size: 1 }) : everything,
    byCountry: await Promise.all(
      countries.map(async (country) => ({ country, page: await listListings({ deal, country, page_size: 1 }) })),
    ),
  });
  const [anyDeal, ...byDeal] = await Promise.all([searches(), ...sets.deal_types.map(({ code }) => searches(code))]);

  for (const { code } of sets.deal_types) add({ deal: code }, everything.facets.deal, code);
  for (const { code } of sets.property_categories) add({ category: code }, everything.facets.category, code);
  for (const { deal, all } of byDeal) {
    for (const { code } of sets.property_categories) add({ deal, category: code }, all?.facets.category, code);
  }
  // Places, widest first: countries, their regions, cities.
  for (const { deal, all, byCountry } of [anyDeal, ...byDeal]) {
    if (!all) continue;
    for (const country of countries) add({ deal, country }, all.facets.country, country);
    for (const { country, page } of byCountry) {
      for (const region of sets.regions) {
        if (region.market_code === country) add({ deal, region: region.code }, page?.facets.region, region.code);
      }
    }
    for (const { code } of sets.cities) add({ deal, city: code }, all.facets.city, code);
  }
  return pages;
}
