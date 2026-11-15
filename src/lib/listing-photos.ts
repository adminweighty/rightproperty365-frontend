/**
 * Photos of a listing: the rules an advertiser's upload is checked against
 * before it is sent, the "7 of 20 photos" counter, reordering, and the
 * addresses the browser loads a photo from.
 *
 * Pure functions with no imports, so `npm test` (scripts/listing-photos.test.mjs)
 * runs them directly. The API stays the authority: it checks the bytes, the
 * size and the limit again and its message is what is shown.
 */

/** The owner's rule: "a maximum of 20 photos per property". The API sends it as `photo_limit`. */
export const PHOTO_LIMIT = 20;
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
/** The longer side must have at least this many pixels. */
export const PHOTO_MIN_LONG_SIDE = 800;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** For `<input type="file" accept>`. */
export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
/** A photo's description (alt text), at most. */
export const ALT_MAX = 250;

export type FileLike = { name: string; type: string; size: number };

const PHOTO_EXTENSION = /\.(jpe?g|png|webp)$/i;

/**
 * Why a file cannot be uploaded as a listing photo, in words, or null when
 * it may be sent. Some systems give no type for a file: its name decides then.
 */
export function photoFileProblem(file: FileLike): string | null {
  const known = file.type ? PHOTO_TYPES.includes(file.type) : PHOTO_EXTENSION.test(file.name);
  if (!known) return `${file.name} is not a JPEG, PNG or WebP photo. Choose a photo in one of those formats.`;
  if (file.size === 0) return `${file.name} is empty. Choose another photo.`;
  if (file.size > PHOTO_MAX_BYTES) return `${file.name} is larger than 15 MB. Choose a smaller photo.`;
  return null;
}

/** Why a photo of this size is too small, or null. Used when the browser could read its size. */
export function photoDimensionsProblem(name: string, width: number, height: number): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  return Math.max(width, height) < PHOTO_MIN_LONG_SIDE
    ? `${name} is too small. A photo must be at least ${PHOTO_MIN_LONG_SIDE} pixels on its longer side.`
    : null;
}

/** "A property can have up to 20 photos.", the API's words for the limit. */
export const photoLimitMessage = (limit: number = PHOTO_LIMIT) => `A property can have up to ${limit} photos.`;

/** The counter beside the photos, and whether another may be added. */
export function photoCounter(count: number, limit: number = PHOTO_LIMIT) {
  const remaining = Math.max(0, limit - count);
  return {
    text: `${count} of ${limit} ${limit === 1 ? "photo" : "photos"}`,
    remaining,
    full: remaining === 0,
  };
}

/**
 * Of the files chosen, those that still fit under the limit (in the order
 * chosen) and those that do not.
 */
export function splitByRoom<T>(files: readonly T[], count: number, limit: number = PHOTO_LIMIT): { take: T[]; over: T[] } {
  const room = Math.max(0, limit - count);
  return { take: files.slice(0, room), over: files.slice(room) };
}

/** A copy of `items` with the one at `from` moved to `to` (both clamped to the list). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(Math.max(to, 0), next.length - 1);
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** True when the order of the two lists differs (same items expected). */
export const orderChanged = (a: readonly string[], b: readonly string[]) =>
  a.length !== b.length || a.some((value, index) => value !== b[index]);

// ---- Addresses ----------------------------------------------------------------

/**
 * The address of an API photo for the browser. An uploaded photo is a path
 * relative to the API's origin (`/v1/listing-photos/<id>/large?v=…`), so the
 * PUBLIC API address goes in front. A bundled sample (`/assets/images/…`) and
 * an absolute address are left alone.
 */
export function apiPhotoUrl(url: string, base: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith("/assets/")) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type PhotoVariantLike = { width: number; height: number; url: string; size?: string };

/** "…/large?v=1 2048w, …/medium?v=1 1280w, …/small?v=1 640w", or undefined without variants. */
export function photoSrcSet(variants: readonly PhotoVariantLike[] | undefined, base: string): string | undefined {
  if (!variants || variants.length === 0) return undefined;
  return [...variants]
    .sort((a, b) => b.width - a.width)
    .map((variant) => `${apiPhotoUrl(variant.url, base)} ${variant.width}w`)
    .join(", ");
}

/**
 * The address of one stored size: the variant named `size`; without names
 * (a public photo's variants) the narrowest for "small", the widest for
 * "large", the middle one for "medium"; without variants the photo's `url`.
 */
export function photoVariantUrl(
  photo: { url: string; variants?: readonly PhotoVariantLike[] },
  size: "small" | "medium" | "large",
  base: string,
): string {
  const variants = photo.variants ?? [];
  const named = variants.find((variant) => variant.size === size);
  if (named) return apiPhotoUrl(named.url, base);
  if (variants.length === 0) return apiPhotoUrl(photo.url, base);
  const byWidth = [...variants].sort((a, b) => a.width - b.width);
  const pick = size === "small" ? byWidth[0] : size === "large" ? byWidth[byWidth.length - 1] : byWidth[Math.floor(byWidth.length / 2)];
  return apiPhotoUrl(pick.url, base);
}
