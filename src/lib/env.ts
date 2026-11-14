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
} as const;

/** Version of the privacy notice a customer consents to when sending a request. */
export const PRIVACY_NOTICE_VERSION = "2026-11-draft";
