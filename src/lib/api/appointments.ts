import { apiFetch } from "@/lib/api/http";

/**
 * Client for the appointment endpoints of the Go API (viewings and
 * consultations). Called from the browser with the session cookie. What a
 * person may do with an appointment comes from the API's `can_*` flags; the
 * API re-checks every action.
 */

export type AppointmentStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "RESCHEDULE_REQUESTED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";
export type AppointmentParty = "CUSTOMER" | "PROFESSIONAL";

export type AppointmentTimelineEntry = {
  event: string;
  from: AppointmentStatus | null;
  to: AppointmentStatus;
  to_label: string;
  actor: AppointmentParty | "SYSTEM";
  note: string | null;
  start_utc: string | null;
  at: string;
};

/** What both parties see. Never the professional's phone number or email address. */
export type Appointment = {
  id: string;
  reference: string;
  /** VIEWING or CONSULTATION. */
  type: string;
  status: AppointmentStatus;
  /** The API's wording for `status`; show this. */
  status_label: string;
  start_utc: string;
  end_utc: string;
  /** The market's IANA time zone: times are shown in it, and it is named. */
  timezone: string;
  duration_minutes: number;
  /** Set while a new time is waiting for the other party. */
  proposed_start_utc: string | null;
  proposed_by: AppointmentParty | null;
  listing: { slug: string; title: string; reference: string } | null;
  /** The professional's public profile. Null for a private owner. */
  with: { kind: string; slug: string; name: string } | null;
  location_note: string | null;
  note: string | null;
  property_request_reference: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  /** Only on a single appointment, never on list items. */
  timeline?: AppointmentTimelineEntry[];
};

export type CustomerAppointment = Appointment & {
  can_cancel: boolean;
  can_reschedule: boolean;
  can_accept: boolean;
};

export type ReceivedAppointment = Appointment & {
  assigned_to: { user_id: string; name: string } | null;
  /** The customer's contact details: shown only in the professional's list. */
  contact: { name: string; email: string | null; phone: string | null };
  preferred_contact_method: string | null;
  can_confirm: boolean;
  can_reschedule: boolean;
  can_cancel: boolean;
  can_complete: boolean;
  can_no_show: boolean;
  /** Assignment is not built on the web: there is no endpoint that lists an organisation's members. */
  can_assign: boolean;
};

export type InboxSummary = {
  property_requests: { new: number };
  business_enquiries: { new: number };
  appointments: { requested: number; reschedule_requested: number; upcoming_confirmed: number };
};

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
};

// ---- The customer's own appointments ----------------------------------------

export const listMyAppointments = (when: "upcoming" | "past") =>
  apiFetch<{ items: CustomerAppointment[] }>(`/v1/me/appointments${query({ when })}`);

export const getMyAppointment = (id: string) =>
  apiFetch<{ appointment: CustomerAppointment }>(`/v1/me/appointments/${id}`);

export const cancelMyAppointment = (id: string, reason: string) =>
  apiFetch<{ appointment: CustomerAppointment }>(`/v1/me/appointments/${id}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });

export const rescheduleMyAppointment = (id: string, startUtc: string) =>
  apiFetch<{ appointment: CustomerAppointment }>(`/v1/me/appointments/${id}/reschedule`, {
    method: "POST",
    body: { start_utc: startUtc },
  });

export const acceptMyAppointment = (id: string) =>
  apiFetch<{ appointment: CustomerAppointment }>(`/v1/me/appointments/${id}/accept`, { method: "POST" });

// ---- Appointments received by a professional -----------------------------------

export type ReceivedFilters = { status?: string; type?: string; from?: string; to?: string };

export const listReceivedAppointments = (filters: ReceivedFilters = {}) =>
  apiFetch<{ items: ReceivedAppointment[] }>(`/v1/inbox/appointments${query(filters)}`);

export const getReceivedAppointment = (id: string) =>
  apiFetch<{ appointment: ReceivedAppointment }>(`/v1/inbox/appointments/${id}`);

/** `confirm` with no body confirms the requested time, or the customer's proposed time. */
export type ReceivedAction = "confirm" | "reschedule" | "cancel" | "complete" | "no-show";

export const actOnReceivedAppointment = (id: string, action: ReceivedAction, body?: Record<string, string>) =>
  apiFetch<{ appointment: ReceivedAppointment }>(`/v1/inbox/appointments/${id}/${action}`, {
    method: "POST",
    body,
  });

export const getInboxSummary = () => apiFetch<InboxSummary>("/v1/inbox/summary");

// ---- Times --------------------------------------------------------------------

/** "Mon 16 November 2026, 10:00 (Africa/Harare time)": always in the appointment's zone, with the zone named. */
export function formatInZone(utc: string, timezone: string): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utc));
  return `${text} (${timezone} time)`;
}

/**
 * The UTC instant of a wall-clock time ("2026-11-20T10:00", as a
 * datetime-local input gives it) in an IANA time zone. Null if it is not a time.
 */
export function zonedTimeToUtc(local: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // How far the zone's clock is ahead of UTC at a given instant.
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant;
  };
  // Two passes settle the offset on either side of a clock change.
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first)).toISOString();
}
