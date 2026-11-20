/**
 * Listing expiry (API 0.45.0): the words and states the listing manager and
 * editor show for a listing's 90-day publication period.
 *
 * The API sends `expiry` on the managed listing and on every row of the
 * owner's list: `{ expires_at, days_left, state, relist_no }`, or null for a
 * listing that was never published. Its `state` and `days_left` win; for an
 * older API build without `expiry`, `deriveExpiry` works the same values out
 * from `expires_at` with the same rule (whole days, rounded up).
 *
 * Pure functions with no imports, so `npm test` (scripts/listing-expiry.test.mjs)
 * runs them directly.
 */

export type ListingExpiryState = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

export type ListingExpiry = {
  expires_at: string;
  /** Whole days left, rounded up; 0 once expired. */
  days_left: number;
  state: ListingExpiryState;
  /** The current publication cycle: 1 for the first publication. */
  relist_no: number;
};

/** Days left at or under which a listing is `EXPIRING_SOON`. */
export const EXPIRING_SOON_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The expiry the API would send, worked out from `expires_at`: for an API
 * build that sends `expires_at` but no `expiry`. Null without a date.
 */
export function deriveExpiry(expiresAt: string | null | undefined, now: number, relistNo = 1): ListingExpiry | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  const left = at - now;
  if (left <= 0) return { expires_at: expiresAt, days_left: 0, state: "EXPIRED", relist_no: relistNo };
  const days = Math.ceil(left / DAY_MS);
  return {
    expires_at: expiresAt,
    days_left: days,
    state: days <= EXPIRING_SOON_DAYS ? "EXPIRING_SOON" : "ACTIVE",
    relist_no: relistNo,
  };
}

/**
 * The listing's expiry: the API's `expiry` when the field is there (also when
 * it is null), else derived from `expires_at` for a listing that was published.
 */
export function expiryOf(
  listing: { expiry?: ListingExpiry | null; expires_at?: string | null; published_at?: string | null },
  now: number,
): ListingExpiry | null {
  if (listing.expiry !== undefined) return listing.expiry;
  if (!listing.published_at) return null;
  return deriveExpiry(listing.expires_at, now);
}

/** "4 Dec 2026", in the viewer's time zone unless one is given (as the other screens do). */
export function formatExpiryDate(iso: string, timeZone?: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(at);
}

/** "Expires tomorrow", "Expires in 6 days"; "Expires today" if the API ever sends 0 days before expiry. */
export function expiresInText(daysLeft: number): string {
  if (daysLeft <= 0) return "Expires today";
  if (daysLeft === 1) return "Expires tomorrow";
  return `Expires in ${daysLeft} days`;
}

export type ExpiryView = {
  /** The status treats the listing as expired (stored `EXPIRED`, or published but past its date). */
  expired: boolean;
  /** A relist of a listing that was published before, waiting for review. */
  relistInReview: boolean;
  /** "Expires 4 Dec 2026" or "Expired on 4 Dec 2026"; null when there is nothing to say. */
  line: string | null;
  /** The warning badge for `EXPIRING_SOON`, or the info badge "Relist sent for review". */
  badge: { text: string; tone: "warning" | "info" } | null;
  /** The editor's callout for an expired listing. */
  callout: string | null;
};

/**
 * What a row or the editor header shows about the listing's period, for its
 * status and expiry. Only published, expired and relisted-in-review listings
 * say anything; a draft, an archived listing and so on show nothing.
 */
export function expiryView(status: string, expiry: ListingExpiry | null, timeZone?: string): ExpiryView {
  const none: ExpiryView = { expired: false, relistInReview: false, line: null, badge: null, callout: null };
  if (status === "PENDING_REVIEW" && expiry) {
    return { ...none, relistInReview: true, badge: { text: "Relist sent for review", tone: "info" } };
  }
  const expired = status === "EXPIRED" || (status === "PUBLISHED" && expiry?.state === "EXPIRED");
  if (expired) {
    if (!expiry) return { ...none, expired: true };
    const date = formatExpiryDate(expiry.expires_at, timeZone);
    return {
      ...none,
      expired: true,
      line: `Expired on ${date}`,
      callout: `This listing expired on ${date} and is hidden from search. Relist it to send it for review; once approved it is live for another 90 days.`,
    };
  }
  if (status !== "PUBLISHED" || !expiry) return none;
  return {
    ...none,
    line: `Expires ${formatExpiryDate(expiry.expires_at, timeZone)}`,
    badge: expiry.state === "EXPIRING_SOON" ? { text: expiresInText(expiry.days_left), tone: "warning" } : null,
  };
}
