import type { FacetCount } from "@/lib/api/types";
import { listingsHeading, listingsPath, type ListingFilters } from "@/lib/seo";
import { listListings } from "./listings";
import type { Catalogue } from "./reference";

export type CuratedPage = { path: string; label: string; count: number };

/**
 * The indexable result pages that have listings right now (docs/seo.md):
 * each deal, each category, deal + category, each city and deal + city.
 * Used for the sitemap and the "Popular searches" links. Counts come from the
 * search facets, so this costs one search plus one per deal type.
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
  const byDeal = await Promise.all(
    sets.deal_types.map(async ({ code }) => ({
      deal: code,
      page: await listListings({ deal: code, page_size: 1 }),
    })),
  );

  for (const { code } of sets.deal_types) add({ deal: code }, everything.facets.deal, code);
  for (const { code } of sets.property_categories) add({ category: code }, everything.facets.category, code);
  for (const { deal, page } of byDeal) {
    if (!page) continue;
    for (const { code } of sets.property_categories) add({ deal, category: code }, page.facets.category, code);
  }
  for (const { code } of sets.cities) add({ city: code }, everything.facets.city, code);
  for (const { deal, page } of byDeal) {
    if (!page) continue;
    for (const { code } of sets.cities) add({ deal, city: code }, page.facets.city, code);
  }
  return pages;
}
