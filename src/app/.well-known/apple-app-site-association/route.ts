import { connection } from "next/server";
import { associationResponse, buildAppleAppSiteAssociation } from "@/lib/mobile-app-associations";

/**
 * iOS Universal Links (BR-016): which app may open this site's links. Built
 * from APPLE_TEAM_ID and IOS_BUNDLE_ID, read on each request so a deployment
 * setting takes effect without a rebuild. 404 until the Team ID is set. See
 * src/lib/mobile-app-associations.ts.
 *
 * Only the /.well-known/ address is served: Apple's CDN, which fetches the
 * file for iOS 14 and later, does not look at the site root.
 */
export async function GET() {
  // Never prerender: the build has no Team ID, and a frozen 404 would outlive the setting.
  await connection();
  return associationResponse(buildAppleAppSiteAssociation(process.env));
}
