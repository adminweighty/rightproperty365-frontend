/** Public runtime configuration. Only NEXT_PUBLIC_* values may be read here. */
export const env = {
  /** Base URL of the RightProperty365 Go API (no trailing slash). */
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
} as const;

/** Version of the privacy notice a customer consents to when sending a request. */
export const PRIVACY_NOTICE_VERSION = "2026-11-draft";
