/**
 * What the API accepts as a logo or profile photo, checked in the browser
 * before a file is sent so the answer is immediate. The API checks again, by
 * content, and also checks the picture's size in pixels (128 to 4096 on each
 * side), which is reported under the control when it refuses.
 *
 * Pure, with no imports: `npm test` runs it.
 */

/** The onboarding document type that is the logo: the only one shown publicly. */
export const LOGO_DOCUMENT = "LOGO";

export const LOGO_TYPES = ["image/png", "image/jpeg"];
export const LOGO_ACCEPT = LOGO_TYPES.join(",");
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_FORMATS_NOTE = "PNG or JPEG, up to 2 MB, between 128 and 4096 pixels on each side.";

/** What is wrong with a file chosen as a logo, in the words shown under the control. Null when nothing is. */
export function logoProblem(file: { name: string; size: number; type: string }): string | null {
  // Some systems give no type for a file; the API decides by content anyway.
  if (file.type && !LOGO_TYPES.includes(file.type)) {
    return `${file.name} is not a PNG or JPEG image. Choose a PNG or a JPEG.`;
  }
  if (file.size > LOGO_MAX_BYTES) {
    return `${file.name} is larger than 2 MB. Choose an image of 2 MB or less.`;
  }
  return null;
}
