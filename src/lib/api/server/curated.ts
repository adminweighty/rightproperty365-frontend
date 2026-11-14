import type { FacetCount } from "@/lib/api/types";
import { listingsHeading, listingsPath, type ListingFilters } from "@/lib/seo";
import { listListings } from "./listings";
import type { Catalogue } from "./reference";

export type CuratedPage = { path: string; label: string; count: number };

/**
 * The indexable result pages that have listings right now (docs/seo.md):
 * each deal, each category, deal + category, and each country, region and
 * city alone and with a deal.
 * Used for the sitemap and the "Popular searches" links. Counts come from the
 * search facets, so this costs two searches plus two per deal type. The API
 * counts regions only within a country, so region counts come from a search
 * of the active market.
 */
export async function getCuratedListingPages(catalogue: Catalogue): Promise<CuratedPage[]> {
  const everything = await listListings({ page_size: 1 });
  if (!everything) return [];

  const pages: CuratedPage[] = [];
  const add = (filters: ListingFilters, facet: FacetCount[], code: string) => {
    const count = facet.find((item) => item.code === code)?.count ?? 0;
    if (count > 0) {
      pages.push({ path: listingsPath(filters), label: listingsHeading(filters, catalogue), count });
    }
  };

  const { sets } = catalogue;
  const country = catalogue.market?.code;
  const [inMarket, byDeal] = await Promise.all([
    country ? listListings({ country, page_size: 1 }) : null,
    Promise.all(
      sets.deal_types.map(async ({ code }) => ({
        deal: code,
        page: await listListings({ deal: code, page_size: 1 }),
        inMarket: country ? await listListings({ deal: code, country, page_size: 1 }) : null,
      })),
    ),
  ]);

  for (const { code } of sets.deal_types) add({ deal: code }, everything.facets.deal, code);
  for (const { code } of sets.property_categories) add({ category: code }, everything.facets.category, code);
  for (const { deal, page } of byDeal) {
    if (!page) continue;
    for (const { code } of sets.property_categories) add({ deal, category: code }, page.facets.category, code);
  }
  // Places, widest first: countries (the markets), regions, cities.
  const regions = sets.regions ?? [];
  for (const { code } of catalogue.markets) add({ country: code }, everything.facets.country ?? [], code);
  for (const { code } of regions) add({ region: code }, inMarket?.facets.region ?? [], code);
  for (const { code } of sets.cities) add({ city: code }, everything.facets.city, code);
  for (const { deal, page, inMarket: dealInMarket } of byDeal) {
    if (!page) continue;
    for (const { code } of catalogue.markets) add({ deal, country: code }, page.facets.country ?? [], code);
    for (const { code } of regions) add({ deal, region: code }, dealInMarket?.facets.region ?? [], code);
    for (const { code } of sets.cities) add({ deal, city: code }, page.facets.city, code);
  }
  return pages;
}
