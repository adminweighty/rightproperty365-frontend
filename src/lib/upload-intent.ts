/**
 * Upload intents (API 0.60.0, FR-010): the pure rules of the website's
 * photo upload, checked by `npm test` (scripts/upload-intent.test.mjs). The
 * browser side is `uploadListingPhoto` in `src/lib/api/manage-listings.ts`.
 *
 * The photo is hashed, an intent is asked for, the file is PUT (straight to
 * storage when the API offers it), completed, then attached to the listing.
 * When the intent route or the direct PUT is not available (an older API, a
 * storage bucket that does not allow the site's origin, a network error),
 * the photo is sent the classic way (multipart through the API). A file the
 * API rejected is never sent again another way.
 */

export type UploadIntentResponse = {
  intent: { id: string; status: string };
  upload: { method: string; url: string; headers: Record<string, string>; direct: boolean; expires_at: string };
};

type FailureLike = { status: number; code: string };

/** Whether a failed intent step should fall back to the multipart upload. */
export function fallBackAfter(step: "create" | "put" | "complete", failure: FailureLike): boolean {
  // Rejections, validation and limits are answers about the file or the person: say them.
  if (failure.code === "UPLOAD_REJECTED" || failure.code === "VALIDATION_FAILED" || failure.status === 413 || failure.status === 401) {
    return false;
  }
  if (failure.code === "SCANNER_UNAVAILABLE") return false;
  switch (step) {
    case "create":
      // No intent route (an older API) or too many waiting: the classic upload still works.
      return failure.status === 404 || failure.status === 405 || failure.status === 429 || failure.status === 0 || failure.status >= 500;
    case "put":
      // A direct PUT refused by storage (CORS, an expired URL) or the network.
      return true;
    case "complete":
      return failure.status === 409 || failure.status === 0 || failure.status >= 500;
  }
}

/** Lower-case hexadecimal of a digest. */
export function toHex(digest: ArrayBuffer | Uint8Array): string {
  const bytes = digest instanceof Uint8Array ? digest : new Uint8Array(digest);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** The content type the API accepts for a listing photo, or null to let the classic upload decide. */
export function photoContentType(type: string): string | null {
  const t = type.toLowerCase();
  return t === "image/jpeg" || t === "image/png" || t === "image/webp" ? t : null;
}
