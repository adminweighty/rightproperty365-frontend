import { connection } from "next/server";
import { associationResponse, buildAssetLinks } from "@/lib/mobile-app-associations";

/**
 * Android App Links (BR-016): which app may open this site's links. Built from
 * ANDROID_APP_SHA256_FINGERPRINTS and ANDROID_APP_PACKAGE, read on each request
 * so a deployment setting takes effect without a rebuild. 404 until the
 * fingerprint is set. See src/lib/mobile-app-associations.ts.
 */
export async function GET() {
  // Never prerender: the build has no fingerprint, and a frozen 404 would outlive the setting.
  await connection();
  return associationResponse(buildAssetLinks(process.env));
}
