import { apiFetch } from "@/lib/api/http";
import type { Coded, CountryRef, Money, Photo, Place, PricePeriod } from "@/lib/api/types";

/**
 * Properties the signed-in person saved (new in API 0.27.0). Any
 * customer-scope session may save, whatever its roles; an administrator
 * session gets 403 and a signed-out visitor 401.
 *
 * Read only in the browser, with the session cookie, and never cached: the
 * public listing pages and search results stay the same for everyone, and
 * the hearts on them are filled in on the client (`SavedListingsProvider`).
 */

export type UnavailableReason = "EXPIRED" | "LET" | "SOLD" | "WITHDRAWN";

export type SavedListing = {
  listing_id: string;
  saved_at: string;
  /** True while the listing is public. */
  available: boolean;
  /** Null while `available`. */
  unavailable_reason: UnavailableReason | null;
  /** The API's words for `unavailable_reason` ("Listing expired", "Let", "Sold", "No longer listed"); show this. */
  unavailable_label: string | null;
  /**
   * Current data while available. Otherwise the snapshot taken when it was
   * last seen public, with `slug` null: an unavailable listing is never linked.
   */
  listing: {
    slug: string | null;
    reference: string;
    title: string;
    category: Coded;
    price: Money;
    price_period: PricePeriod | null;
    city: Place;
    country: CountryRef;
    photo: Photo | null;
  };
};

export type SavedListingPage = {
  items: SavedListing[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type SaveResult = {
  saved: true;
  /** The first time it was saved; a second save does not move it. */
  saved_at: string;
  /** False when it was already saved. */
  created: boolean;
};

/** Every saved listing id that is still public, at most 1000. For the hearts on cards. */
export const listSavedListingIds = () =>
  apiFetch<{ ids: string[] }>("/v1/me/saved-listings/ids", { cache: "no-store" });

/** Newest saved first. */
export const listSavedListings = ({ page, pageSize = 24 }: { page: number; pageSize?: number }) => {
  const search = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return apiFetch<SavedListingPage>(`/v1/me/saved-listings?${search}`, { cache: "no-store" });
};

/** Idempotent. 404 `LISTING_NOT_FOUND` when the listing is not public now. */
export const saveListing = (listingId: string) =>
  apiFetch<SaveResult>(`/v1/me/saved-listings/${encodeURIComponent(listingId)}`, { method: "PUT", cache: "no-store" });

/** Idempotent (204), also for a listing that is no longer public. */
export const unsaveListing = (listingId: string) =>
  apiFetch<null>(`/v1/me/saved-listings/${encodeURIComponent(listingId)}`, { method: "DELETE", cache: "no-store" });
