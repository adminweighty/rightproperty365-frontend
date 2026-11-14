import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Whether the API answers when `next build` starts (README, "Builds and the
 * API"). The answer is compiled into the server code as RP_API_AT_BUILD, so
 * the build and the server it produces always agree on it:
 *
 *   "1"  pages are prerendered with API data and need no <Suspense> around it
 *   "0"  API-backed parts are left as loading placeholders in the build and
 *        rendered on each request (CI, or BUILD_WITHOUT_API=1)
 *
 * Outside a production build (next dev) it is "1": the API is expected to run.
 */
async function apiAnswersAtBuild(phase: string): Promise<boolean> {
  if (phase !== PHASE_PRODUCTION_BUILD) return true;
  if (process.env.BUILD_WITHOUT_API === "1") return false;
  // The same address the server-side readers use (src/lib/api/server/client.ts).
  const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/readyz`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig = async (phase: string): Promise<NextConfig> => ({
  env: { RP_API_AT_BUILD: (await apiAnswersAtBuild(phase)) ? "1" : "0" },
  // Self-contained server bundle for the Docker image (FR-049).
  output: "standalone",
  poweredByHeader: false,
  // Crawlers get <title>, canonical and robots in the initial <head>. By
  // default Next.js streams request-time metadata into <body> for browsers and
  // for Googlebot; Google only honours rel=canonical in <head>, and the search
  // pages rely on canonical and noindex being read correctly (docs/seo.md).
  // This is Next's default list plus Googlebot and generic crawler names.
  // Browsers keep streaming metadata and the prerendered shell.
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|bot\b|crawler|spider/i,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
});

export default nextConfig;
