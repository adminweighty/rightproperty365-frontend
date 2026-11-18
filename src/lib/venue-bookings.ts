/**
 * Hourly bookings of a venue (API 0.33.0), as pure functions: a booking read
 * tolerantly from the API, its status in words, what the customer and the
 * host may do with it now, the free cancellation window, and the API's 409
 * reasons in plain words.
 *
 * The API decides every action. When it sends `can_*` flags (or an `actions`
 * list) those are used; otherwise they follow the contract's state machine.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/venue-bookings.test.mjs).
 */

export type VenueBookingStatus = "REQUESTED" | "CONFIRMED" | "RESCHEDULE_REQUESTED" | "DECLINED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export const VENUE_BOOKING_STATUSES: VenueBookingStatus[] = [
  "REQUESTED",
  "RESCHEDULE_REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "DECLINED",
  "CANCELLED",
];

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  RESCHEDULE_REQUESTED: "New time proposed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No show",
};

export const statusLabel = (status: string, apiLabel?: string | null) => apiLabel || STATUS_LABELS[status] || status;

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export function statusTone(status: string): Tone {
  if (status === "CONFIRMED") return "success";
  if (status === "REQUESTED") return "info";
  if (status === "RESCHEDULE_REQUESTED") return "warning";
  if (status === "DECLINED" || status === "CANCELLED" || status === "NO_SHOW") return "danger";
  return "neutral";
}

/** What each status means, for the person reading it. */
export function statusMeaning(status: string, viewer: "CUSTOMER" | "HOST"): string {
  const customer = viewer === "CUSTOMER";
  switch (status) {
    case "REQUESTED":
      return customer
        ? "Waiting for the host. The time is not held until the host confirms it."
        : "Waiting for your answer. The time is not held until you confirm it.";
    case "CONFIRMED":
      return customer ? "The host confirmed this time. Payment, if any, is arranged with the host." : "Confirmed. The time is held for this customer.";
    case "RESCHEDULE_REQUESTED":
      return "A new time was proposed and is waiting for an answer. The confirmed time stays until it is accepted.";
    case "DECLINED":
      return customer ? "The host could not take this booking." : "You declined this request.";
    case "CANCELLED":
      return "Cancelled. Nothing is held.";
    case "COMPLETED":
      return "The booking took place.";
    case "NO_SHOW":
      return "Recorded as a no show.";
    default:
      return "";
  }
}

/** `events[].action` in words. */
const EVENT_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  RESCHEDULE_REQUESTED: "Asked for a new time",
  PROPOSED: "Proposed a new time",
  ACCEPTED: "Accepted the new time",
  COMPLETED: "Completed",
  NO_SHOW: "Recorded as a no show",
};

export type BookingParty = "CUSTOMER" | "HOST" | "SYSTEM";

export type BookingEvent = { action: string; status: string; label: string; actor: string; actorName: string | null; reason: string | null; start: string | null; end: string | null; at: string };

export type BookingQuoteLine = { code: string; label: string; amount: string };

export type VenueBooking = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  listing: { id: string; slug: string; title: string; reference: string } | null;
  start: string;
  end: string;
  timeZone: string;
  currency: string | null;
  lines: BookingQuoteLine[];
  totalExcludingDeposit: string | null;
  deposit: string | null;
  attendees: number | null;
  message: string | null;
  cancellationPolicy: string | null;
  freeCancellationHours: number | null;
  /** From the API when it says; otherwise start minus the free hours. */
  freeCancellationUntil: string | null;
  proposed: { start: string; end: string; by: string | null; totalExcludingDeposit: string | null } | null;
  reason: string | null;
  /** Who cancelled, and whether it was inside the free window, once cancelled. */
  cancellation: { by: string | null; free: boolean | null; at: string | null } | null;
  customer: { name: string; email: string | null; phone: string | null } | null;
  createdAt: string | null;
  events: BookingEvent[];
  /** The API's flags, when it sends them: action -> allowed. */
  flags: Record<string, boolean>;
};

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => (value && typeof value === "object" ? (value as Raw) : {});
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const amount = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const raw = obj(value);
  return "amount" in raw ? amount(raw.amount) : null;
};
const int = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
};

const FLAG_KEYS = ["cancel", "accept", "confirm", "decline", "propose", "complete", "no_show", "reschedule"];

/** A booking as the API sends it (`{booking: …}` or the booking itself). Null without an id. */
export function normaliseBooking(value: unknown): VenueBooking | null {
  const outer = obj(value);
  const raw = outer.booking && typeof outer.booking === "object" ? obj(outer.booking) : outer;
  const id = text(raw.id);
  if (!id) return null;
  const quote = obj(raw.quote);
  const listing = obj(raw.listing ?? raw.venue);
  const policy = raw.cancellation_policy;
  const policyRaw = obj(policy);
  const proposedRaw = obj(raw.proposal ?? raw.proposed ?? raw.proposed_time);
  const cancellationRaw = obj(raw.cancellation);
  const proposedStart = text(proposedRaw.start ?? raw.proposed_start ?? raw.proposed_start_utc);
  const proposedEnd = text(proposedRaw.end ?? raw.proposed_end ?? raw.proposed_end_utc);
  const customerRaw = obj(raw.customer ?? raw.contact);
  const status = String(raw.status ?? "");
  const flags: Record<string, boolean> = {};
  for (const key of FLAG_KEYS) {
    const flag = raw[`can_${key}`];
    if (typeof flag === "boolean") flags[key] = flag;
  }
  if (Array.isArray(raw.actions)) {
    for (const key of FLAG_KEYS) flags[key] = raw.actions.map((item) => String(item).toLowerCase().replace("-", "_")).includes(key);
  }
  const lines = (Array.isArray(quote.lines) ? quote.lines : Array.isArray(raw.lines) ? raw.lines : [])
    .map((item) => {
      const line = obj(item);
      const value = amount(line.amount);
      return value === null ? null : { code: String(line.code ?? ""), label: String(line.label ?? line.code ?? ""), amount: value };
    })
    .filter((item): item is BookingQuoteLine => item !== null);
  const events = (Array.isArray(raw.events) ? raw.events : Array.isArray(raw.timeline) ? raw.timeline : [])
    .map((item) => {
      const event = obj(item);
      const to = String(event.to_status ?? event.to ?? event.status ?? "");
      const action = String(event.action ?? to);
      return {
        action,
        status: to,
        label: EVENT_LABELS[action] ?? statusLabel(to, text(event.to_label ?? event.status_label)),
        actor: String(event.actor ?? ""),
        actorName: text(event.actor_name),
        reason: text(event.reason ?? event.note),
        start: text(event.start),
        end: text(event.end),
        at: String(event.at ?? event.created_at ?? ""),
      };
    })
    .filter((event) => event.at !== "");
  return {
    id,
    reference: String(raw.reference ?? ""),
    status,
    statusLabel: statusLabel(status, text(raw.status_label)),
    listing: Object.keys(listing).length
      ? {
          id: String(listing.id ?? raw.listing_id ?? ""),
          slug: String(listing.slug ?? ""),
          title: String(listing.title ?? "Venue"),
          reference: String(listing.reference ?? ""),
        }
      : null,
    start: String(raw.start ?? raw.start_utc ?? quote.start ?? ""),
    end: String(raw.end ?? raw.end_utc ?? quote.end ?? ""),
    timeZone: String(raw.time_zone ?? raw.timezone ?? quote.time_zone ?? "UTC"),
    currency: text(raw.currency ?? quote.currency),
    lines,
    totalExcludingDeposit: amount(raw.total_excluding_deposit ?? quote.total_excluding_deposit ?? raw.total ?? quote.subtotal),
    deposit: amount(raw.deposit ?? quote.deposit),
    attendees: int(raw.attendees),
    message: text(raw.message),
    cancellationPolicy: typeof policy === "string" ? text(policy) : text(policyRaw.text ?? policyRaw.description),
    freeCancellationHours: int(raw.free_cancellation_hours ?? policyRaw.free_cancellation_hours),
    freeCancellationUntil: text(raw.free_cancellation_until ?? policyRaw.free_until ?? policyRaw.free_cancellation_until),
    proposed:
      proposedStart && proposedEnd
        ? {
            start: proposedStart,
            end: proposedEnd,
            by: text(proposedRaw.proposed_by ?? proposedRaw.by ?? raw.proposed_by),
            totalExcludingDeposit: amount(proposedRaw.total_excluding_deposit ?? obj(proposedRaw.quote).total_excluding_deposit),
          }
        : null,
    reason: text(cancellationRaw.reason ?? raw.decline_reason ?? raw.cancel_reason ?? raw.reason),
    cancellation: Object.keys(cancellationRaw).length
      ? { by: text(cancellationRaw.by), free: typeof cancellationRaw.free === "boolean" ? cancellationRaw.free : null, at: text(cancellationRaw.at) }
      : null,
    customer: Object.keys(customerRaw).length
      ? { name: String(customerRaw.name ?? "Customer"), email: text(customerRaw.email), phone: text(customerRaw.phone) }
      : null,
    createdAt: text(raw.created_at ?? raw.requested_at),
    events,
    flags,
  };
}

/** A list answer: `{items}`, `{data}`, `{bookings}` or an array. */
export function normaliseBookings(value: unknown): VenueBooking[] {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : Array.isArray(raw.items) ? raw.items : Array.isArray(raw.data) ? raw.data : Array.isArray(raw.bookings) ? raw.bookings : [];
  return list.map(normaliseBooking).filter((item): item is VenueBooking => item !== null);
}

const at = (iso: string) => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
};

/** Whether a host's proposal waits for the customer (else the customer asked for the new time). */
const proposedByHost = (booking: VenueBooking) => {
  const by = (booking.proposed?.by ?? "").toUpperCase();
  return by === "" ? true : by !== "CUSTOMER";
};

export type CustomerAction = "accept" | "cancel";
export type HostAction = "confirm" | "decline" | "propose" | "complete" | "no_show" | "cancel";

const allowed = (booking: VenueBooking, key: string, fallback: boolean) => (key in booking.flags ? booking.flags[key] : fallback);

/** What the customer may do now: accept a host's proposed time; cancel until the start. */
export function customerActions(booking: VenueBooking, now: number = Date.now()): CustomerAction[] {
  const start = at(booking.start);
  const before = start === null || now < start;
  const active = booking.status === "REQUESTED" || booking.status === "CONFIRMED" || booking.status === "RESCHEDULE_REQUESTED";
  const out: CustomerAction[] = [];
  if (allowed(booking, "accept", booking.status === "RESCHEDULE_REQUESTED" && booking.proposed !== null && proposedByHost(booking))) out.push("accept");
  if (allowed(booking, "cancel", active && before)) out.push("cancel");
  return out;
}

/**
 * What the host may do now, from the state machine: REQUESTED can be
 * confirmed, declined or cancelled; CONFIRMED can get a new time or be
 * cancelled, and after it ends be completed or recorded as a no show; a new
 * time the customer asked for can be confirmed, and any can be cancelled.
 */
export function hostActions(booking: VenueBooking, now: number = Date.now()): HostAction[] {
  const end = at(booking.end);
  const ended = end !== null && now >= end;
  const s = booking.status;
  const out: HostAction[] = [];
  if (allowed(booking, "confirm", s === "REQUESTED" || (s === "RESCHEDULE_REQUESTED" && !proposedByHost(booking)))) out.push("confirm");
  if (allowed(booking, "decline", s === "REQUESTED")) out.push("decline");
  if (allowed(booking, "propose", s === "CONFIRMED" && !ended)) out.push("propose");
  if (allowed(booking, "complete", s === "CONFIRMED" && ended)) out.push("complete");
  if (allowed(booking, "no_show", s === "CONFIRMED" && ended)) out.push("no_show");
  if (allowed(booking, "cancel", (s === "REQUESTED" || s === "CONFIRMED" || s === "RESCHEDULE_REQUESTED") && !ended)) out.push("cancel");
  return out;
}

export type CancellationWindow = {
  /** Cancelling now is inside the free window. Null when the policy names no free window. */
  free: boolean | null;
  /** The last instant of the free window. */
  freeUntil: number | null;
};

/** Whether cancelling now is free: until `free_cancellation_hours` before the start (or the API's own `free_cancellation_until`). */
export function cancellationWindow(booking: Pick<VenueBooking, "start" | "freeCancellationHours" | "freeCancellationUntil">, now: number = Date.now()): CancellationWindow {
  const until =
    (booking.freeCancellationUntil ? at(booking.freeCancellationUntil) : null) ??
    (booking.freeCancellationHours !== null && at(booking.start) !== null ? at(booking.start)! - booking.freeCancellationHours * 3_600_000 : null);
  if (until === null) return { free: null, freeUntil: null };
  return { free: now <= until, freeUntil: until };
}

// ---- Refusals ------------------------------------------------------------------

const SLOT_REASONS: Record<string, string> = {
  CLOSED: "The venue is closed at that time.",
  OUTSIDE_OPENING_HOURS: "That time is outside the venue’s opening hours.",
  TAKEN: "That time is already booked.",
  BOOKED: "That time is already booked.",
  CAPACITY: "That time is already booked.",
  BUFFER: "That time is too close to another booking: the venue needs time to be cleaned in between.",
  CLEANING_BUFFER: "That time is too close to another booking: the venue needs time to be cleaned in between.",
  LEAD_TIME: "That start is too soon: the host needs more notice.",
  TOO_SOON: "That start is too soon: the host needs more notice.",
  OUTSIDE_HORIZON: "That date is further ahead than the host takes bookings.",
  HORIZON: "That date is further ahead than the host takes bookings.",
  IN_PAST: "That time has already passed.",
  PAST: "That time has already passed.",
};

/** The `reason` of a 409, wherever the API put it: `error.reason`, `error.details.reason`, `error.fields.reason` or `reason`. */
export function refusalReason(body: unknown, fields?: Record<string, string>): string | null {
  const raw = obj(body);
  const error = obj(raw.error);
  const value = error.reason ?? obj(error.details).reason ?? obj(error.fields).reason ?? fields?.reason ?? raw.reason;
  return typeof value === "string" && value !== "" ? value : null;
}

/** A 409 `SLOT_UNAVAILABLE` in plain words, with the API's message when its reason is not one we know. */
export function slotUnavailableText(reason: string | null, message?: string): string {
  const known = reason ? SLOT_REASONS[reason.toUpperCase()] : undefined;
  if (known) return `${known} Choose another time.`;
  return message ? `${message} Choose another time.` : "That time can no longer be booked. Choose another time.";
}

export const SLOT_TAKEN_TEXT = "Another booking for this time was confirmed first. Propose another time to this customer, or decline the request.";
