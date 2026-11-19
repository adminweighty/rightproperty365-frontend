import type { MetadataRoute } from "next";
import { getCuratedListingPages } from "@/lib/api/server/curated";
import { getDirectoryKinds } from "@/lib/api/server/directory";
import { getSitemapEntries } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";
import { getPricingMarkets } from "@/lib/api/server/packages";
import { getCatalogue } from "@/lib/api/server/reference";
import { LEGAL_INDEX_PATH, legalDocuments } from "@/lib/legal";
import { pricingPath } from "@/lib/packages";
import { absoluteUrl, listingPath, profilePath } from "@/lib/seo";

/**
 * Only indexable URLs: home, the curated result pages that have listings
 * (docs/seo.md), the directories, every public listing and profile from
 * GET /v1/sitemap, which returns only published, unexpired listings, the FAQ, the
 * listing package pages of countries that have packages, how
 * listing figures are counted and the legal pages.
 * Free-text and filtered searches, result pages 2 and later and private pages
 * are left out. `priority` and `changefreq` are omitted because Google
 * ignores them.
 *
 * The readers cache their data for no longer than an hour (`cacheLife`), so
 * the sitemap is regenerated at least hourly and expired listings drop out.
 * If the API cannot be reached the sitemap fails with a 500, which crawlers
 * retry, rather than serving a sitemap with pages missing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const loaded = await load(async () => {
    const [catalogue, entries, kinds, pricing] = await Promise.all([
      getCatalogue(),
      getSitemapEntries(),
      getDirectoryKinds(),
      getPricingMarkets(),
    ]);
    return { entries, kinds, pricing, curated: await getCuratedListingPages(catalogue) };
  });
  if (!loaded.ok) throw new Error("The sitemap could not be built: the API is not available.");

  const { entries, kinds, pricing, curated } = loaded.data;
  const newest = entries.listings
    .map((listing) => listing.updated_at)
    .sort()
    .at(-1);

  return [
    { url: absoluteUrl("/"), lastModified: newest },
    { url: absoluteUrl("/listings"), lastModified: newest },
    ...curated.map((page) => ({ url: absoluteUrl(page.path) })),
    { url: absoluteUrl("/directory") },
    ...kinds.map((kind) => ({ url: absoluteUrl(`/directory/${kind.code}`) })),
    ...entries.profiles.map((profile) => ({
      url: absoluteUrl(profilePath(profile)),
      lastModified: profile.updated_at,
    })),
    ...entries.listings.map((listing) => ({
      url: absoluteUrl(listingPath(listing)),
      lastModified: listing.updated_at,
    })),
    { url: absoluteUrl("/faq") },
    // The pricing pages exist only for countries with active packages (docs/seo.md).
    ...(pricing.length > 0
      ? [{ url: absoluteUrl("/pricing") }, ...pricing.map(({ market }) => ({ url: absoluteUrl(pricingPath(market.code)) }))]
      : []),
    { url: absoluteUrl("/analytics-definitions") },
    { url: absoluteUrl("/verify") },
    { url: absoluteUrl(LEGAL_INDEX_PATH) },
    ...legalDocuments.map((document) => ({
      url: absoluteUrl(document.path),
      lastModified: document.effectiveDate,
    })),
  ];
}
