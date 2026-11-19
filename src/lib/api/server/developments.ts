import { cacheLife, cacheTag } from "next/cache";
import type { Development, DevelopmentPage } from "@/lib/developments";
import { apiGet, queryString } from "./client";

/**
 * The public showcase of development projects (API 0.44.0). The API caches
 * these answers for 30 seconds; here they are cached for minutes, like the
 * listing catalogue, and tagged `developments` for on-demand revalidation.
 */

export type DevelopmentQuery = {
  market?: string;
  city?: string;
  status?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export type DevelopmentSearch =
  | { status: "ok"; page: DevelopmentPage }
  /** The API refused a filter (a city code retired after the reference data was cached). */
  | { status: "invalid"; fields: Record<string, string> };

export async function searchDevelopments(query: DevelopmentQuery = {}): Promise<DevelopmentSearch> {
  "use cache";
  cacheLife("minutes");
  cacheTag("developments");
  const { status, data } = await apiGet<DevelopmentPage | { error?: { fields?: Record<string, string> } }>(
    `/v1/developments${queryString(query)}`,
    [400],
  );
  if (status === 200) return { status: "ok", page: data as DevelopmentPage };
  return { status: "invalid", fields: ("error" in data && data.error?.fields) || {} };
}

const MARKET = /^[a-z]{2}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A public project, or null when it is not public (the API answers 404 `DEVELOPMENT_NOT_FOUND`). */
export async function getDevelopment(market: string, slug: string): Promise<Development | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("developments", `development:${market.toLowerCase()}:${slug}`);
  if (!MARKET.test(market) || !SLUG.test(slug) || slug.length > 80) return null;
  const { status, data } = await apiGet<{ development: Development }>(
    `/v1/developments/${market.toLowerCase()}/${slug}`,
    [400, 404],
  );
  return status === 200 ? data.development : null;
}
