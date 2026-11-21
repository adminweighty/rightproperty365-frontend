/**
 * Appointment availability (API 0.51.0, FR-020..022): the professional's
 * bookable hours form, consultation service wording, and how offered slots
 * are shown. Self-contained (no imports) so `npm test` runs it directly.
 */

export type OpeningRange = { weekday: number; opens: string; closes: string };
export type AvailabilityException = { date: string; closed: boolean; opens?: string | null; closes?: string | null; note?: string | null };

/** GET/PUT /v1/me/appointment-settings. */
export type AppointmentSettings = {
  enabled: boolean;
  timezone: string;
  working_hours: OpeningRange[];
  exceptions: AvailabilityException[];
  slot_minutes: number;
  buffer_minutes: number;
  lead_time_hours: number;
  horizon_days: number;
  max_per_day: number;
  updated_at?: string | null;
};

export type ConsultationChannel = "IN_PERSON" | "VIDEO" | "PHONE";

export type ConsultationService = {
  id: string;
  name: string;
  duration_minutes: number;
  channel: ConsultationChannel;
  location: string | null;
  notes: string | null;
  active?: boolean;
};

export type SlotDay = { date: string; slots: { start_utc: string; end_utc: string }[] };

/** GET /v1/appointments/slots. */
export type SlotAnswer = {
  configured: boolean;
  timezone: string;
  slot_minutes: number | null;
  services: ConsultationService[];
  days: SlotDay[];
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SLOT_LENGTHS = [15, 30, 45, 60, 90, 120];
export const BUFFERS = [0, 5, 10, 15, 30, 45, 60];
export const LEAD_TIMES = [0, 1, 2, 4, 12, 24, 48, 72, 168];
export const HORIZONS = [7, 14, 30, 60, 90, 180];
export const SERVICE_LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240];
export const CHANNELS: { value: ConsultationChannel; label: string }[] = [
  { value: "IN_PERSON", label: "In person" },
  { value: "VIDEO", label: "Video call" },
  { value: "PHONE", label: "Phone call" },
];

export function channelLabel(channel: string): string {
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

/** "30 minutes", "1 hour", "1 hour 30 minutes". */
export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 0 ? "" : h === 1 ? "1 hour" : `${h} hours`;
  const mins = m === 0 ? "" : m === 1 ? "1 minute" : `${m} minutes`;
  return [hours, mins].filter(Boolean).join(" ") || "0 minutes";
}

/** "No notice", "2 hours", "1 day", "1 week". */
export function leadTimeText(hours: number): string {
  if (hours === 0) return "No notice";
  if (hours === 168) return "1 week";
  if (hours % 24 === 0) return hours === 24 ? "1 day" : `${hours / 24} days`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** Times on a 15-minute grid for the hours editor ("00:00" .. "23:45", closing also "24:00"). */
export function clockOptions(closing = false): string[] {
  const out: string[] = [];
  for (let m = closing ? 15 : 0; m <= (closing ? 1440 : 1425); m += 15) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Per-range problems before sending: closing after opening, no overlap on one day. */
export function hoursErrors(ranges: OpeningRange[]): Record<number, string> {
  const errors: Record<number, string> = {};
  ranges.forEach((r, i) => {
    if (minutesOf(r.closes) <= minutesOf(r.opens)) errors[i] = `It must end after it starts at ${r.opens}.`;
  });
  ranges.forEach((r, i) => {
    if (errors[i]) return;
    const clash = ranges.findIndex(
      (o, j) => j !== i && !errors[j] && o.weekday === r.weekday && minutesOf(o.opens) < minutesOf(r.closes) && minutesOf(r.opens) < minutesOf(o.closes),
    );
    if (clash !== -1) errors[i] = `It overlaps ${ranges[clash].opens} to ${ranges[clash].closes} on ${WEEKDAYS[r.weekday - 1]}.`;
  });
  return errors;
}

/** "Monday to Friday 09:00 to 17:00" style lines, one per open day. */
export function hoursSummary(ranges: OpeningRange[]): string[] {
  const out: string[] = [];
  for (let d = 1; d <= 7; d += 1) {
    const day = ranges.filter((r) => r.weekday === d).sort((a, b) => a.opens.localeCompare(b.opens));
    if (day.length) out.push(`${WEEKDAYS[d - 1]} ${day.map((r) => `${r.opens} to ${r.closes}`).join(", ")}`);
  }
  return out;
}

/** The settings to send: exceptions without hours for closed days, empty notes dropped. */
export function settingsBody(s: AppointmentSettings): Omit<AppointmentSettings, "updated_at"> {
  return {
    enabled: s.enabled,
    timezone: s.timezone,
    working_hours: [...s.working_hours].sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens)),
    exceptions: s.exceptions.map((e) => ({
      date: e.date,
      closed: e.closed,
      ...(e.closed ? {} : { opens: e.opens ?? null, closes: e.closes ?? null }),
      ...(e.note && e.note.trim() ? { note: e.note.trim() } : {}),
    })),
    slot_minutes: s.slot_minutes,
    buffer_minutes: s.buffer_minutes,
    lead_time_hours: s.lead_time_hours,
    horizon_days: s.horizon_days,
    max_per_day: s.max_per_day,
  };
}

// ---- Showing slots ----------------------------------------------------------

/** "10:30" in the zone. */
export function slotTime(utc: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(utc));
}

/** "Mon 2 Nov" for a local date "2026-11-02". */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Central Africa Time" (falls back to the IANA name). */
export function zoneName(timezone: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, timeZoneName: "long" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return part && !/^GMT[+-]/.test(part) ? part : timezone;
  } catch {
    return timezone;
  }
}

/** The day after a local date, for "later dates". */
export function nextDate(date: string, days = 1): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The first day that has a free slot, else the first day. */
export function firstOpenDay(days: SlotDay[]): string | null {
  return (days.find((d) => d.slots.length > 0) ?? days[0])?.date ?? null;
}

/** The wording of an availability API error code. */
export function availabilityErrorText(code: string | undefined): string | null {
  switch (code) {
    case "TOO_MANY_SERVICES":
      return "You already offer 20 active services. Archive one before adding another.";
    case "SERVICE_NOT_FOUND":
      return "This service no longer exists. Reload the page.";
    case "RATE_LIMITED":
      return "Too many changes in a short time. Wait a minute and try again.";
    default:
      return null;
  }
}
