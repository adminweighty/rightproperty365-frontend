import { cacheLife, cacheTag } from "next/cache";
import type {
  DirectoryKindCount,
  DirectoryKindInfo,
  DirectoryPage,
  DirectoryProfile,
  DirectoryProfileDetail,
} from "@/lib/api/types";
import { apiGet, queryString } from "./client";

const PAGE_SIZE = 48;
/** A directory list shows every profile; stop at 480 rather than loop without end. */
const MAX_PAGES = 10;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getDirectoryKinds(): Promise<DirectoryKindCount[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("directory");
  const { data } = await apiGet<{ kinds: DirectoryKindCount[] }>("/v1/directory");
  return data.kinds;
}

export type DirectoryFilters = { q?: string; country?: string; region?: string; city?: string; trade?: string };

async function getDirectoryPage(
  kind: string,
  filters: DirectoryFilters,
  page: number,
): Promise<DirectoryPage | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("directory");
  if (!SLUG.test(kind)) return null;
  const { status, data } = await apiGet<DirectoryPage>(
    `/v1/directory/${kind}${queryString({ ...filters, page, page_size: PAGE_SIZE })}`,
    [400, 404],
  );
  return status === 200 ? data : null;
}

export type DirectoryList = { kind: DirectoryKindInfo; profiles: DirectoryProfile[]; total: number };

/**
 * Every profile of one kind, sponsored first then by name (the API's order).
 * Null when the kind does not exist.
 */
export async function getDirectoryList(
  kind: string,
  filters: DirectoryFilters = {},
): Promise<DirectoryList | null> {
  const first = await getDirectoryPage(kind, filters, 1);
  if (!first) return null;
  const profiles = [...first.items];
  for (let page = 2; page <= Math.min(first.total_pages, MAX_PAGES); page += 1) {
    const next = await getDirectoryPage(kind, filters, page);
    if (next) profiles.push(...next.items);
  }
  return { kind: first.kind, profiles, total: first.total };
}

export async function getDirectoryProfile(
  kind: string,
  slug: string,
): Promise<DirectoryProfileDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("directory", `profile:${kind}:${slug}`);
  if (!SLUG.test(kind) || !SLUG.test(slug) || slug.length > 80) return null;
  const { status, data } = await apiGet<{ profile: DirectoryProfileDetail }>(
    `/v1/directory/${kind}/${slug}`,
    [400, 404],
  );
  return status === 200 ? data.profile : null;
}
