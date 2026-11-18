import { apiFetch } from "@/lib/api/http";
import type { Coded, CountryRef, Money, Photo, Place, PricePeriod, PublicAvailability } from "@/lib/api/types";
import type { AvailabilityStatus } from "@/lib/nights";

/**
 * Browser clients for the availability calendar of a short stay.
 *
 * Dates are calendar nights (`YYYY-MM-DD`) in the time zone of the listing's
 * country. The public calendar says only available or not; the lister's adds
 * the private reason and note. Nothing here reserves or books anything.
 */

/** The public calendar for a span of nights (at most 366), read again after a refused request. */
export const getPublicAvailability = (slug: string, from: string, to: string) =>
  apiFetch<PublicAvailability>(`/v1/listings/${encodeURIComponent(slug)}/availability?from=${from}&to=${to}`);

// ---- The lister's side -------------------------------------------------------

/** One of the caller's listings, as a summary (`GET /v1/me/listings`). */
export type MyListing = {
  id: string;
  slug: string;
  reference: string;
  title: string;
  category: Coded;
  property_type: Coded;
  /** `PUBLISHED`, `EXPIRED`, `DRAFT`, `PAUSED`, `SOLD`, `LET` or `CLOSED`. */
  status: string;
  price: Money;
  price_period: PricePeriod | null;
  city: Place;
  country: CountryRef;
  /** Short stays only. */
  max_guests: number | null;
  min_nights: number | null;
  /** Short stays only; null when the calendar was never changed. */
  availability_updated_at: string | null;
  photo: Photo | null;
  /** API 0.26.1: the caller may edit it (and draft a lease for it). An agent sees colleagues' listings read-only. */
  can_edit?: boolean;
};

export type MyListingPage = {
  items: MyListing[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

/** Private to the lister. `BLOCKED`: the owner's choice. `BOOKED`: taken. */
export type AvailabilityReason = "BLOCKED" | "BOOKED";

export type ListerDay = { date: string; available: boolean; reason: AvailabilityReason | null; note: string | null };

export type ListerRange = {
  /** Not stable across changes. */
  id: string;
  first_night: string;
  /** Inclusive. */
  last_night: string;
  reason: AvailabilityReason;
  note: string | null;
  updated_at: string;
};

/** The calendar as the lister sees it, with the private reasons and notes. */
export type ListerAvailability = {
  listing: { id: string; slug: string; title: string; reference: string };
  timezone: string;
  /** The booking window: today .. today + 365 days. Changes must lie inside it. */
  window: { from: string; to: string };
  min_nights: number;
  max_guests: number | null;
  from: string;
  to: string;
  days: ListerDay[];
  /** Every stored range of unavailable nights, sorted by first night. */
  ranges: ListerRange[];
  availability_updated_at: string | null;
};

export type AvailabilityChange = { from: string; to: string; status: AvailabilityStatus; note?: string | null };

/** 403 when the caller manages no listings at all. */
export const listMyListings = (page = 1) =>
  apiFetch<MyListingPage>(`/v1/me/listings?page=${page}&page_size=48`);

/**
 * The lister’s calendar. Without a span the API returns today and the next 90
 * days; every stored range and the booking window come with any span.
 */
export const getMyAvailability = (listingId: string, span?: { from: string; to: string }) =>
  apiFetch<ListerAvailability>(
    `/v1/me/listings/${encodeURIComponent(listingId)}/availability${span ? `?from=${span.from}&to=${span.to}` : ""}`,
  );

/** Applies the changes in order, all or none. Field errors are named `changes[i].from` and so on. */
export const changeMyAvailability = (listingId: string, changes: AvailabilityChange[]) =>
  apiFetch<ListerAvailability>(`/v1/me/listings/${encodeURIComponent(listingId)}/availability`, {
    method: "PUT",
    body: { changes },
  });

export const setStayRules = (listingId: string, rules: { min_nights?: number; max_guests?: number }) =>
  apiFetch<{ listing: MyListing }>(`/v1/me/listings/${encodeURIComponent(listingId)}/stay-rules`, {
    method: "PATCH",
    body: rules,
  });
