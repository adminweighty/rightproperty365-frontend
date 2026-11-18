/**
 * YouTube property tours (API 0.28.0). The API stores only a video id and a
 * start time and sends the addresses ready-made (`ListingVideo`); these are the
 * few rules the browser adds: the player's address after a press of play, the
 * signs that a video cannot be shown, and the start time in words.
 */

/** A YouTube video id, as the API checks it. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube's privacy policy, linked beside every player. */
export const YOUTUBE_PRIVACY_URL = "https://policies.google.com/privacy";

/** The IFrame API, loaded only after play is pressed. */
export const YOUTUBE_IFRAME_API = "https://www.youtube.com/iframe_api";

/** IFrame API `onError` codes for a video that is removed, private or not embeddable. */
export const UNAVAILABLE_ERRORS: readonly number[] = [100, 101, 150];

export const isYouTubeId = (id: unknown): id is string => typeof id === "string" && YOUTUBE_ID.test(id);

/**
 * The address of the player once the visitor has pressed play: the API's
 * `embed_url` with `autoplay=1` (allowed only because of that press). With
 * `origin`, also `enablejsapi=1&origin=…`, so the IFrame API can report a
 * video that cannot be played. Returns null for anything that is not a
 * youtube-nocookie embed address.
 */
export function playerSrc(embedUrl: string, origin?: string): string | null {
  let url: URL;
  try {
    url = new URL(embedUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "www.youtube-nocookie.com") return null;
  const id = url.pathname.match(/^\/embed\/([^/]+)$/)?.[1];
  if (!isYouTubeId(id)) return null;
  url.searchParams.set("autoplay", "1");
  if (origin) {
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", origin);
  }
  return url.toString();
}

/**
 * The watch address for "Watch on YouTube", starting where the player would.
 * Only a youtube.com address is returned as a link; anything else gives null.
 */
export function watchHref(watchUrl: string, startSeconds: number | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL(watchUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "www.youtube.com") return null;
  if (startSeconds && startSeconds > 0) url.searchParams.set("t", `${Math.floor(startSeconds)}s`);
  return url.toString();
}

/** The poster and the watch address for an id (the manage API sends only the id). */
export const thumbnailFor = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrlFor = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/**
 * True when a loaded thumbnail is YouTube's grey placeholder (120 by 90) rather
 * than the 480 by 360 `hqdefault` of a real video: a removed video answers
 * with it. An image that did not load at all (width 0) counts too.
 */
export function isPlaceholderThumbnail(width: number, height: number): boolean {
  return width === 0 || height === 0 || (width <= 120 && height <= 90);
}

/** A start time as a clock: 65 -> "1:05", 3723 -> "1:02:03". Null for none or 0. */
export function formatStart(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "Starts at 1:05" for the editor and the review, or null when it starts at the beginning. */
export function startText(seconds: number | null | undefined): string | null {
  const clock = formatStart(seconds);
  return clock ? `Starts at ${clock}` : null;
}
