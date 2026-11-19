/**
 * The two files that let the mobile app open links to this site (BR-016):
 * Android App Links (`/.well-known/assetlinks.json`) and iOS Universal Links
 * (`/.well-known/apple-app-site-association`). The route handlers in
 * `src/app/.well-known/` serve what these builders return, and `npm test`
 * checks them (scripts/mobile-app-associations.test.mjs).
 *
 * The app's half is in the mobile repository (`AndroidManifest.xml` and
 * `Runner.entitlements`); the paths below must match the ones it claims.
 *
 * Two values come from the deployment environment and are never guessed:
 * the SHA-256 fingerprint of the Android signing certificate and the Apple
 * Team ID. While one is unset or invalid its builder returns null and the
 * route answers 404, so the site claims nothing for the app. A 404 is what
 * Google's and Apple's verifiers expect from a site that has no association;
 * an empty `[]` would be a valid statement list that grants nothing, which
 * hides a missing setting behind a 200.
 */

/** The app id on both stores, unless the environment names another. */
export const DEFAULT_APP_ID = "com.rightproperty365.rightproperty365";

/** The site paths the app claims, in the order of the mobile note. Exact paths, or a prefix ending in `/*`. */
export const APP_LINK_PATHS = [
  "/verify-email",
  "/reset-password",
  "/listings/*",
  "/directory/*",
  "/apply/*",
  "/sign/*",
  "/invitations/*",
  "/account/*",
  "/agent/*",
] as const;

/** A SHA-256 certificate fingerprint as keytool and Play Console print it: 32 bytes of hex, colon-separated. */
const FINGERPRINT = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;
/** A Java package name with at least two segments, as Android requires. */
const ANDROID_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
/** An Apple Developer Team ID: 10 letters and digits. */
const TEAM_ID = /^[A-Z0-9]{10}$/;
/** A reverse-DNS bundle identifier: letters, digits and hyphens, at least two segments. */
const BUNDLE_ID = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

/** Unset and blank values are the same thing. */
function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The fingerprints in a comma-separated list, upper-cased and without
 * duplicates, or null when the list is empty or any entry is not a SHA-256
 * fingerprint. One bad entry rejects the whole list, so a typo shows up as a
 * 404 and not as a half-working association.
 */
export function parseFingerprints(raw: string | undefined): string[] | null {
  const list = value(raw);
  if (!list) return null;
  const entries = list.split(",").map((entry) => entry.trim().toUpperCase());
  if (entries.some((entry) => !FINGERPRINT.test(entry))) return null;
  return [...new Set(entries)];
}

/** The Team ID upper-cased, or null when it is unset or not 10 letters and digits. */
export function parseTeamId(raw: string | undefined): string | null {
  const id = value(raw)?.toUpperCase();
  return id && TEAM_ID.test(id) ? id : null;
}

/** `process.env`, or the part of it the builder reads. */
export type AssetLinksEnv = {
  [name: string]: string | undefined;
  ANDROID_APP_SHA256_FINGERPRINTS?: string;
  ANDROID_APP_PACKAGE?: string;
};

export type AssetLinkStatement = {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
};

/** The `assetlinks.json` statement list, or null (404) without a valid fingerprint and package name. */
export function buildAssetLinks(env: AssetLinksEnv): AssetLinkStatement[] | null {
  const fingerprints = parseFingerprints(env.ANDROID_APP_SHA256_FINGERPRINTS);
  const packageName = value(env.ANDROID_APP_PACKAGE) ?? DEFAULT_APP_ID;
  if (!fingerprints || !ANDROID_PACKAGE.test(packageName)) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

/** `process.env`, or the part of it the builder reads. */
export type AppleAppSiteAssociationEnv = {
  [name: string]: string | undefined;
  APPLE_TEAM_ID?: string;
  IOS_BUNDLE_ID?: string;
};

export type AppleAppSiteAssociation = {
  applinks: { details: { appIDs: string[]; components: { "/": string }[] }[] };
};

/** The `apple-app-site-association` document, or null (404) without a valid Team ID and bundle id. */
export function buildAppleAppSiteAssociation(env: AppleAppSiteAssociationEnv): AppleAppSiteAssociation | null {
  const teamId = parseTeamId(env.APPLE_TEAM_ID);
  const bundleId = value(env.IOS_BUNDLE_ID) ?? DEFAULT_APP_ID;
  if (!teamId || !BUNDLE_ID.test(bundleId)) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${bundleId}`],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  };
}

/**
 * Both files are public and change only with a deployment setting, so a
 * short shared cache is enough. Google and Apple fetch them rarely (Apple
 * through its own CDN), and an hour keeps a corrected value from waiting long.
 */
export const ASSOCIATION_CACHE_CONTROL = "public, max-age=3600";

/** The response a route handler sends for a builder's result: the JSON, or an uncached 404. */
export function associationResponse(body: unknown): Response {
  if (body === null) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": ASSOCIATION_CACHE_CONTROL },
  });
}
