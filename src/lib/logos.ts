/**
 * Logos of advertisers and professionals, and the initials shown without one.
 *
 * Pure functions. The only import is the public configuration, so the tests
 * (scripts/logos.test.mjs) run the two that need none of it.
 */

const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

/**
 * The address a browser loads a logo from. The API gives a path relative to
 * its own origin (`/v1/directory/agencies/sample-estates/logo?v=…`), so the
 * PUBLIC address of the API goes in front, also when the page is rendered on
 * the server: it is the visitor's browser that fetches the file, never the
 * internal `API_URL`.
 */
export function logoUrl(logo: { url: string }, base: string = publicApiUrl): string {
  if (/^https?:\/\//.test(logo.url)) return logo.url;
  return `${base}${logo.url.startsWith("/") ? "" : "/"}${logo.url}`;
}

/** Up to two initials: "Sample Homes Bulawayo" is "SH", "Grace Mhlanga" is "GM", "and" is skipped. */
export function monogram(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => word !== "" && !["and", "&", "the", "of"].includes(word.toLowerCase()))
    .map((word) => [...word].find((character) => /[\p{L}\p{N}]/u.test(character)) ?? "")
    .join("");
  return [...letters].slice(0, 2).join("").toUpperCase() || "?";
}

/** Which of `count` colours a name gets: the same name always the same one. */
export function monogramTone(name: string, count: number): number {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2147483647;
  return count > 0 ? hash % count : 0;
}
