// Checks the App Links and Universal Links files (BR-016): fingerprint and Team ID
// validation, the exact JSON the mobile app expects, and null (404) while a value
// is missing. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_LINK_PATHS,
  ASSOCIATION_CACHE_CONTROL,
  associationResponse,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  DEFAULT_APP_ID,
  parseFingerprints,
  parseTeamId,
} from "../src/lib/mobile-app-associations.ts";

// Made-up values in the right shape; not the real key or team.
const FP_A = Array.from({ length: 32 }, (_, i) => (i * 7 + 16).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_B = Array.from({ length: 32 }, () => "AB").join(":");

test("the app id is the one the mobile note names", () => {
  assert.equal(DEFAULT_APP_ID, "com.rightproperty365.rightproperty365");
});

test("valid fingerprints are upper-cased, trimmed and de-duplicated", () => {
  assert.deepEqual(parseFingerprints(FP_A), [FP_A]);
  assert.deepEqual(parseFingerprints(` ${FP_A.toLowerCase()} , ${FP_B},${FP_A} `), [FP_A, FP_B]);
});

test("missing or malformed fingerprints give null", () => {
  assert.equal(parseFingerprints(undefined), null);
  assert.equal(parseFingerprints(""), null);
  assert.equal(parseFingerprints("   "), null);
  assert.equal(parseFingerprints("SHA256_OF_THE_RELEASE_SIGNING_CERT"), null);
  assert.equal(parseFingerprints(FP_A.replaceAll(":", "")), null, "no colons");
  assert.equal(parseFingerprints(FP_A.slice(3)), null, "31 bytes");
  assert.equal(parseFingerprints(`${FP_A}:00`), null, "33 bytes");
  assert.equal(parseFingerprints(FP_A.replace(/^../, "GZ")), null, "not hex");
  assert.equal(parseFingerprints(Array(20).fill("AB").join(":")), null, "a SHA-1 fingerprint");
  assert.equal(parseFingerprints(`${FP_A},`), null, "an empty entry");
  assert.equal(parseFingerprints(`${FP_A},nope`), null, "one bad entry rejects the list");
});

test("a Team ID is 10 letters and digits", () => {
  assert.equal(parseTeamId("ABCDE12345"), "ABCDE12345");
  assert.equal(parseTeamId(" abcde12345 "), "ABCDE12345");
  assert.equal(parseTeamId(undefined), null);
  assert.equal(parseTeamId(""), null);
  assert.equal(parseTeamId("TEAMID"), null);
  assert.equal(parseTeamId("ABCDE1234"), null);
  assert.equal(parseTeamId("ABCDE123456"), null);
  assert.equal(parseTeamId("ABCDE-1234"), null);
  assert.equal(parseTeamId("ABCDE.1234"), null);
});

test("assetlinks.json is exactly the statement in the mobile note", () => {
  assert.deepEqual(buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: FP_A }), [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.rightproperty365.rightproperty365",
        sha256_cert_fingerprints: [FP_A],
      },
    },
  ]);
});

test("assetlinks.json takes several fingerprints and another package", () => {
  const [statement] = buildAssetLinks({
    ANDROID_APP_SHA256_FINGERPRINTS: `${FP_A},${FP_B}`,
    ANDROID_APP_PACKAGE: "com.example.app",
  });
  assert.equal(statement.target.package_name, "com.example.app");
  assert.deepEqual(statement.target.sha256_cert_fingerprints, [FP_A, FP_B]);
  const [fallback] = buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: FP_A, ANDROID_APP_PACKAGE: " " });
  assert.equal(fallback.target.package_name, DEFAULT_APP_ID);
});

test("assetlinks.json is null without a valid fingerprint or package", () => {
  assert.equal(buildAssetLinks({}), null);
  assert.equal(buildAssetLinks({ ANDROID_APP_PACKAGE: DEFAULT_APP_ID }), null);
  assert.equal(buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: "bad" }), null);
  assert.equal(buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: FP_A, ANDROID_APP_PACKAGE: "nodots" }), null);
  assert.equal(buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: FP_A, ANDROID_APP_PACKAGE: "com.1bad.app" }), null);
});

test("apple-app-site-association is exactly the document in the mobile note", () => {
  assert.deepEqual(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" }), {
    applinks: {
      details: [
        {
          appIDs: ["ABCDE12345.com.rightproperty365.rightproperty365"],
          components: [
            { "/": "/verify-email" },
            { "/": "/reset-password" },
            { "/": "/listings/*" },
            { "/": "/directory/*" },
            { "/": "/apply/*" },
            { "/": "/sign/*" },
            { "/": "/invitations/*" },
            { "/": "/account/*" },
            { "/": "/agent/*" },
            { "/": "/developments" },
            { "/": "/developments/*" },
          ],
        },
      ],
    },
  });
  assert.equal(APP_LINK_PATHS.length, 11);
});

test("the development showcase: the list and /developments/{market}/{slug}", () => {
  assert.ok(APP_LINK_PATHS.includes("/developments"));
  assert.ok(APP_LINK_PATHS.includes("/developments/*"));
  // Unset values still claim nothing.
  assert.equal(buildAppleAppSiteAssociation({}), null);
});

test("apple-app-site-association has no webcredentials or other sections", () => {
  const aasa = buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" });
  assert.deepEqual(Object.keys(aasa), ["applinks"]);
});

test("apple-app-site-association takes another bundle id", () => {
  const aasa = buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "abcde12345", IOS_BUNDLE_ID: "com.example.app" });
  assert.deepEqual(aasa.applinks.details[0].appIDs, ["ABCDE12345.com.example.app"]);
});

test("apple-app-site-association is null without a valid Team ID or bundle id", () => {
  assert.equal(buildAppleAppSiteAssociation({}), null);
  assert.equal(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "" }), null);
  assert.equal(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "TEAMID" }), null);
  assert.equal(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345", IOS_BUNDLE_ID: "nodots" }), null);
  assert.equal(buildAppleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345", IOS_BUNDLE_ID: "com.bad_id.app" }), null);
});

test("a built file is JSON with a short public cache", async () => {
  const response = associationResponse(buildAssetLinks({ ANDROID_APP_SHA256_FINGERPRINTS: FP_A }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), ASSOCIATION_CACHE_CONTROL);
  assert.equal(ASSOCIATION_CACHE_CONTROL, "public, max-age=3600");
  assert.equal((await response.json())[0].target.package_name, DEFAULT_APP_ID);
});

test("a missing file is an uncached 404 with no body", async () => {
  const response = associationResponse(null);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
});
