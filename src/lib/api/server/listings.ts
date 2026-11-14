import { cacheLife, cacheTag } from "next/cache";
import type {
  Listing,
  ListingPage,
  ListingQuery,
  ListingSuggestion,
  SitemapEntries,
} from "@/lib/api/types";
import { apiGet, queryString } from "./client";

/**
 * Listings change often (new, sold, expired after 90 days): revalidate every
 * minute. Arguments are part of the cache key, so each search is its own entry.
 */

export type ListingSearch =
  | { status: "ok"; page: ListingPage }
  /**
   * The API refused the search: a code retired after our reference data was
   * cached, a location that is not inside its parent (a city that is not in
   * the chosen region), or a maximum below its minimum. `fields` has the
   * API's message for each parameter it refused.
   */
  | { status: "invalid"; fields: Record<string, string> };

export async function searchListings(query: ListingQuery = {}): Promise<ListingSearch> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  const { status, data } = await apiGet<ListingPage | { error?: { fields?: Record<string, string> } }>(
    `/v1/listings${queryString(query)}`,
    [400],
  );
  if (status === 200) return { status: "ok", page: data as ListingPage };
  return { status: "invalid", fields: ("error" in data && data.error?.fields) || {} };
}

/** A search with fixed, known-good filters. Null if the API still refuses it. */
export async function listListings(query: ListingQuery = {}): Promise<ListingPage | null> {
  const result = await searchListings(query);
  return result.status === "ok" ? result.page : null;
}

export type ListingLookup =
  | { status: "found"; listing: Listing }
  /** Was public once and no longer is (expired, sold, let, paused). */
  | { status: "gone" }
  | { status: "missing" };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getListing(slug: string): Promise<ListingLookup> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `listing:${slug}`);
  // A slug the API would reject outright is simply not a listing.
  if (!SLUG.test(slug) || slug.length > 200) return { status: "missing" };
  const { status, data } = await apiGet<{ listing: Listing }>(`/v1/listings/${slug}`, [400, 404, 410]);
  if (status === 200) return { status: "found", listing: data.listing };
  return { status: status === 410 ? "gone" : "missing" };
}

export async function suggestListings(q: string): Promise<ListingSuggestion[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  const { status, data } = await apiGet<{ suggestions: ListingSuggestion[] }>(
    `/v1/listings/suggest${queryString({ q })}`,
    [400],
  );
  return status === 200 ? data.suggestions : [];
}

/** Slugs of every public listing and profile, for the sitemap and prerendering. */
export async function getSitemapEntries(): Promise<SitemapEntries> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings", "directory");
  const { data } = await apiGet<SitemapEntries>("/v1/sitemap");
  return data;
}
