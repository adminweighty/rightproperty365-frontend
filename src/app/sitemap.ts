import type { MetadataRoute } from "next";
import { directoryKinds, profilePath, profiles } from "@/lib/data/directory";
import { findListings, listings } from "@/lib/data/listings";
import { absoluteUrl, curatedFacets, listingPath, listingsPath } from "@/lib/seo";

/**
 * Only indexable URLs: home, the curated deal/category result pages that have
 * results, and published listings with their photo. Free-text searches and
 * private pages are left out. `priority` and `changefreq` are omitted because
 * Google ignores them.
 *
 * When listings come from the API this must list only PUBLISHED, unexpired
 * listings and be revalidated at least hourly so expired ones drop out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const newest = (items: typeof listings) =>
    items.map((listing) => listing.publishedAt).sort().at(-1);

  const facetPages = curatedFacets()
    .map((facet) => ({ facet, results: findListings(facet) }))
    .filter(({ results }) => results.length > 0)
    .map(({ facet, results }) => ({
      url: absoluteUrl(listingsPath(facet.deal, facet.category)),
      lastModified: newest(results),
    }));

  return [
    { url: absoluteUrl("/"), lastModified: newest(listings) },
    ...facetPages,
    { url: absoluteUrl("/directory") },
    ...directoryKinds.map((kind) => ({ url: absoluteUrl(`/directory/${kind}`) })),
    ...profiles.map((profile) => ({ url: absoluteUrl(profilePath(profile)) })),
    ...listings.map((listing) => ({
      url: absoluteUrl(listingPath(listing)),
      lastModified: listing.publishedAt,
      images: [absoluteUrl(listing.image.src.src)],
    })),
  ];
}
