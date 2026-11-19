import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * On-demand cache revalidation, for the API (or an operator) to call when
 * data changes, so a page does not wait for its cache lifetime to pass:
 *
 *   POST /api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 *   {"tags": ["directory"]}
 *
 * It is off (404) unless REVALIDATE_SECRET is set on the web server. The
 * secret is a server-side value: never send it to a browser. Only the cache
 * tags the readers in src/lib/api/server use are accepted. Nothing is read
 * or returned apart from the tags that were marked stale.
 */
const TAGS = new Set(["reference", "markets", "listings", "directory", "onboarding", "developments"]);
const PREFIXED = /^(listing|profile|development):[a-z0-9:-]{1,200}$/;

function authorised(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  if (!authorised(request, secret)) return Response.json({ error: "unauthorised" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const tags = (body as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 20) {
    return Response.json({ error: "tags must be a list of 1 to 20 cache tags" }, { status: 400 });
  }
  const unknown = tags.filter((tag) => typeof tag !== "string" || !(TAGS.has(tag) || PREFIXED.test(tag)));
  if (unknown.length > 0) return Response.json({ error: "unknown tag" }, { status: 400 });

  // expire: 0 means the next request reads the API again instead of serving the old copy.
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
