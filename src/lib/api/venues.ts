import { apiFetch, type ApiResult } from "@/lib/api/http";
import { normaliseBooking, normaliseBookings, type VenueBooking } from "@/lib/venue-bookings";
import { normaliseQuote, type VenueQuote } from "@/lib/venue-quote";
import { formFromSettings, type HourlyBody, type HourlyForm } from "@/lib/venue-settings";
import { normaliseAvailability, type VenueAvailability } from "@/lib/venue-time";
import { PRIVACY_NOTICE_VERSION } from "@/lib/env";

/**
 * Browser clients for venues let by the hour (API 0.33.0): the lister's
 * settings, the public availability and quotes, the customer's booking
 * requests and the host's list. Called with the session cookie. Answers are
 * read through the normalisers in `lib/venue-*.ts`, which follow the
 * contract's "Response shapes" and tolerate older or partial answers.
 *
 * Enquiry mode only (decision D-04): nothing here takes or implies a payment.
 */

/** An answer read through a normaliser; one it cannot read is a failure, not a crash. */
async function read<T>(result: Promise<ApiResult<unknown>>, normalise: (value: unknown) => T | null): Promise<ApiResult<T>> {
  const answer = await result;
  if (!answer.ok) return answer;
  const data = normalise(answer.data);
  if (data === null) {
    return {
      ok: false,
      failure: { code: "UNREADABLE_ANSWER", status: 502, message: "We could not read the answer from RightProperty365. Please try again." },
    };
  }
  return { ok: true, status: answer.status, data };
}

const id = (value: string) => encodeURIComponent(value);

// ---- The lister's settings -----------------------------------------------------

export type HourlySettings = {
  /** The listing's property type can be let by the hour. */
  eligible: boolean;
  /** Saved at least once. */
  configured: boolean;
  timeZone: string | null;
  /** The market's currencies: the rate must be in one of them. */
  currencies: string[];
  form: HourlyForm;
  updatedAt: string | null;
};

function settingsOf(fallbackCurrency: string) {
  return (value: unknown): HourlySettings | null => {
    const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const currencies = Array.isArray(raw.currencies) ? raw.currencies.filter((code): code is string => typeof code === "string") : [];
    const currency = typeof raw.currency === "string" && raw.currency ? raw.currency : (currencies[0] ?? fallbackCurrency);
    const form = formFromSettings(raw, currency);
    if (!form) return null;
    return {
      eligible: raw.eligible !== false,
      configured: raw.configured === true,
      timeZone: typeof raw.time_zone === "string" ? raw.time_zone : null,
      currencies: currencies.length > 0 ? currencies : [currency].filter(Boolean),
      form,
      updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
    };
  };
}

export const getHourlySettings = (listingId: string, fallbackCurrency: string) =>
  read(apiFetch<unknown>(`/v1/me/listings/${id(listingId)}/hourly`, { cache: "no-store" }), settingsOf(fallbackCurrency));

/** A full replace. 400 `LISTING_NOT_ELIGIBLE` for a type that cannot be let by the hour. */
export const saveHourlySettings = (listingId: string, body: HourlyBody, fallbackCurrency: string) =>
  read(apiFetch<unknown>(`/v1/me/listings/${id(listingId)}/hourly`, { method: "PUT", body }), settingsOf(fallbackCurrency));

// ---- Public: availability and quotes ----------------------------------------------

/** At most 62 days. 404 `VENUE_NOT_FOUND` when the listing is not public or hourly booking is off. */
export const getVenueAvailability = (listingId: string, from: string, to: string) =>
  read<VenueAvailability>(
    apiFetch<unknown>(`/v1/venues/${id(listingId)}/availability?from=${from}&to=${to}`, { cache: "no-store" }),
    normaliseAvailability,
  );

/** 409 `SLOT_UNAVAILABLE` with `details.reason`; 400 for a misaligned or wrong-length slot. */
export const createVenueQuote = (listingId: string, start: string, end: string) =>
  read<VenueQuote>(apiFetch<unknown>(`/v1/venues/${id(listingId)}/quotes`, { method: "POST", body: { start, end } }), normaliseQuote);

// ---- The customer's bookings --------------------------------------------------------

export type BookingPage = { items: VenueBooking[]; page: number; totalPages: number; total: number };

const pageOf = (value: unknown): BookingPage => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const items = normaliseBookings(value);
  const number = (key: string, fallback: number) => (typeof raw[key] === "number" ? (raw[key] as number) : fallback);
  return { items, page: number("page", 1), totalPages: number("total_pages", 1), total: number("total", items.length) };
};

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

/** Idempotent per quote: sending the same quote again answers with the same booking. */
export const requestVenueBooking = (input: { quoteId: string; message?: string; attendees?: number; accepted: boolean }) =>
  read(
    apiFetch<unknown>("/v1/me/venue-bookings", {
      method: "POST",
      body: {
        quote_id: input.quoteId,
        ...(input.message ? { message: input.message } : {}),
        ...(input.attendees ? { attendees: input.attendees } : {}),
        consent: { privacy_version: PRIVACY_NOTICE_VERSION, accepted: input.accepted },
      },
    }),
    normaliseBooking,
  );

export const listMyVenueBookings = (filters: { status?: string; page?: number } = {}) =>
  read(apiFetch<unknown>(`/v1/me/venue-bookings${query({ ...filters, page_size: 50 })}`, { cache: "no-store" }), pageOf);

export const getMyVenueBooking = (bookingId: string) =>
  read(apiFetch<unknown>(`/v1/me/venue-bookings/${id(bookingId)}`, { cache: "no-store" }), normaliseBooking);

export const cancelMyVenueBooking = (bookingId: string, reason: string) =>
  read(
    apiFetch<unknown>(`/v1/me/venue-bookings/${id(bookingId)}/cancel`, { method: "POST", body: reason ? { reason } : {} }),
    normaliseBooking,
  );

export const acceptMyVenueBooking = (bookingId: string) =>
  read(apiFetch<unknown>(`/v1/me/venue-bookings/${id(bookingId)}/accept`, { method: "POST" }), normaliseBooking);

// ---- The host's bookings -------------------------------------------------------------

/** An organisation's bookings, or a direct owner's own (`/v1/me/hosted-venue-bookings`). */
export type HostScope = { kind: "organisation"; orgId: string } | { kind: "owner" };

const hostBase = (scope: HostScope) =>
  scope.kind === "organisation" ? `/v1/agent/organisations/${id(scope.orgId)}/venue-bookings` : "/v1/me/hosted-venue-bookings";

export type HostFilters = { listing_id?: string; status?: string; from?: string; to?: string; page?: number };

export const listHostedVenueBookings = (scope: HostScope, filters: HostFilters = {}) =>
  read(apiFetch<unknown>(`${hostBase(scope)}${query({ ...filters, page_size: 100 })}`, { cache: "no-store" }), pageOf);

export const getHostedVenueBooking = (scope: HostScope, bookingId: string) =>
  read(apiFetch<unknown>(`${hostBase(scope)}/${id(bookingId)}`, { cache: "no-store" }), normaliseBooking);

export type HostActionName = "confirm" | "decline" | "propose" | "complete" | "no-show" | "cancel";

/** decline and cancel need `{reason}`; propose needs `{quote_id}`; the others no body. 409 `SLOT_TAKEN` on a lost confirm. */
export const actOnHostedVenueBooking = (scope: HostScope, bookingId: string, action: HostActionName, body?: Record<string, string>) =>
  read(apiFetch<unknown>(`${hostBase(scope)}/${id(bookingId)}/${action}`, { method: "POST", body }), normaliseBooking);
