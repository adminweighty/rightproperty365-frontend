/**
 * "Add to calendar" downloads (API 0.39.0, FR-021): which signed-in `.ics`
 * route serves an appointment or an hourly booking, and when the link is
 * shown. Pure, so `scripts/calendar.test.mjs` can check it without a browser.
 *
 * The API serves a file in every status (TENTATIVE or CANCELLED when not
 * agreed), but the page offers it only for a confirmed time still to come:
 * a pending proposal or a cancelled booking is not something to put in a
 * calendar.
 */

/** Whose list the item is in decides the route; each mirrors the JSON route that reads the same item. */
export type CalendarSource =
  | { kind: "my-appointment"; id: string }
  | { kind: "inbox-appointment"; id: string }
  | { kind: "my-venue-booking"; id: string }
  | { kind: "hosted-venue-booking"; scope: { kind: "organisation"; orgId: string } | { kind: "owner" }; id: string };

const part = (value: string) => encodeURIComponent(value);

/** The API path (no origin) of the `.ics` download. */
export function calendarPath(source: CalendarSource): string {
  switch (source.kind) {
    case "my-appointment":
      return `/v1/me/appointments/${part(source.id)}/calendar.ics`;
    case "inbox-appointment":
      return `/v1/inbox/appointments/${part(source.id)}/calendar.ics`;
    case "my-venue-booking":
      return `/v1/me/venue-bookings/${part(source.id)}/calendar.ics`;
    case "hosted-venue-booking":
      return source.scope.kind === "organisation"
        ? `/v1/agent/organisations/${part(source.scope.orgId)}/venue-bookings/${part(source.id)}/calendar.ics`
        : `/v1/me/hosted-venue-bookings/${part(source.id)}/calendar.ics`;
  }
}

/**
 * Show the link only for a CONFIRMED item that has not ended yet. A time
 * that cannot be read hides it; so does any other status (requested, a new
 * time waiting for an answer, declined, cancelled, completed, no-show).
 */
export function showCalendarLink(item: { status: string; start: string | null; end: string | null }, now: number): boolean {
  if (item.status.toUpperCase() !== "CONFIRMED") return false;
  const start = Date.parse(item.start ?? "");
  const end = Date.parse(item.end ?? "");
  if (Number.isNaN(start)) return false;
  return (Number.isNaN(end) ? start : end) > now;
}

/** The file name when the API sends no Content-Disposition (it names the same). */
export function calendarFileName(kind: "appointment" | "venue-booking", reference: string): string {
  const safe = reference.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${kind}${safe ? `-${safe}` : ""}.ics`;
}

export const CALENDAR_NOTE = "Opens in Google Calendar, Apple Calendar or Outlook; if the time changes we email an update.";
