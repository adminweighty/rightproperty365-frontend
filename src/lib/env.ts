import { legal } from "@/lib/legal";
import { mapTiles } from "@/lib/map";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * True on a test copy of the site (staging). Set NEXT_PUBLIC_TEST_SITE to "1"
 * or "0" at build time to decide explicitly; otherwise a site whose host
 * starts with "staging." is a test site. Production builds are never one
 * unless asked.
 */
function isTestSite(): boolean {
  const flag = process.env.NEXT_PUBLIC_TEST_SITE;
  if (flag === "1") return true;
  if (flag === "0") return false;
  try {
    return new URL(siteUrl).hostname.startsWith("staging.");
  } catch {
    return false;
  }
}

/** Public runtime configuration. Only NEXT_PUBLIC_* values may be read here. */
export const env = {
  /** Base URL of the RightProperty365 Go API (no trailing slash). */
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
  siteUrl,
  /** Shows the test-site banner and keeps the site out of search engines. */
  testSite: isTestSite(),
  /**
   * The map tiles (API 0.29.0), or null when no map is offered: then the
   * Map view, the listing page map and the editor map are left out and every
   * list works as before. NEXT_PUBLIC_MAP_TILE_URL and
   * NEXT_PUBLIC_MAP_ATTRIBUTION decide; without a tile URL, OpenStreetMap's
   * public tiles are used everywhere except a production site (src/lib/map.ts).
   */
  map: mapTiles({
    tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    nodeEnv: process.env.NODE_ENV,
    testSite: isTestSite(),
    siteUrl,
  }),
} as const;

/**
 * Version of the Privacy Policy (/legal/privacy-policy) that a person agrees
 * to when registering or sending a request. The API stores it with the
 * consent. It follows the policy's version in `src/lib/legal.ts`.
 */
export const PRIVACY_NOTICE_VERSION: string = legal.documents.privacyPolicy.version;
