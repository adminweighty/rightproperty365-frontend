/**
 * Times of a venue let by the hour (API 0.33.0), as pure functions: wall
 * clock times in the venue's IANA time zone, the UTC instants behind them,
 * the start times and durations a visitor can choose from an availability
 * answer, and the words that show them.
 *
 * Instants are milliseconds since the epoch (UTC). Wall times are "HH:MM" on
 * a date "YYYY-MM-DD" in the venue's zone. All slot arithmetic is done on
 * instants, so a day when the clocks change has as many real hours as it
 * really has, and a duration is always elapsed time.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/venue-time.test.mjs).
 */

const MINUTE = 60_000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^([01]\d|2[0-4]):([0-5]\d)(?::\d{2})?$/;

// ---- Wall clock and instants --------------------------------------------------

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partsFormat = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let format = partsFormat.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    partsFormat.set(timeZone, format);
  }
  return format;
}

const WEEKDAY_NUMBER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The wall clock of an instant in a zone. `weekday` is ISO: Monday 1 to Sunday 7. */
export function partsIn(instant: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAY_NUMBER[get("weekday")] ?? 0,
  };
}

/** How many minutes the zone's clock is ahead of UTC at an instant: 120 in Harare, 0 or 60 in London. */
export function offsetMinutes(instant: number, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((wall - Math.floor(instant / MINUTE) * MINUTE) / MINUTE);
}

/** True for a time "HH:MM" from 00:00 to 24:00. */
export function isClock(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CLOCK.exec(value);
  return Boolean(match) && (match![1] !== "24" || match![2] === "00");
}

/** Minutes after midnight of "HH:MM" ("24:00" is 1440). NaN when it is not a time. */
export function clockMinutes(value: string): number {
  if (!isClock(value)) return Number.NaN;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/** "HH:MM" of minutes after midnight (0 to 1440). */
export function clockText(minutes: number): string {
  const whole = Math.max(0, Math.min(1440, Math.round(minutes)));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The instant of a wall clock time on a date in a zone. "24:00" is midnight
 * at the end of the day. A time skipped when the clocks go forward lands just
 * after the gap; a time that happens twice when they go back is the first.
 * Null when the date or time is not one.
 */
export function wallToUtc(date: string, time: string, timeZone: string): number | null {
  const match = DATE.exec(date);
  if (!match || !isClock(time)) return null;
  const minutes = clockMinutes(time);
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + minutes * MINUTE;
  if (Number.isNaN(wall)) return null;
  // The offsets a day either side: a clock change in between gives two.
  const before = offsetMinutes(wall - 86_400_000, timeZone);
  const after = offsetMinutes(wall + 86_400_000, timeZone);
  const candidates = [...new Set([before, offsetMinutes(wall, timeZone), after])]
    .map((offset) => wall - offset * MINUTE)
    .filter((instant) => partsMatch(instant, wall, timeZone))
    .sort((a, b) => a - b);
  // Of two readings of an ambiguous time, the earlier; in a gap, the offset from before it.
  return candidates[0] ?? wall - before * MINUTE;
}

function partsMatch(instant: number, wall: number, timeZone: string): boolean {
  const p = partsIn(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) === wall;
}

/** The venue's date "YYYY-MM-DD" of an instant. */
export function localDateOf(instant: number, timeZone: string): string {
  const p = partsIn(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:MM" on the venue's clock. */
export function clockOf(instant: number, timeZone: string): string {
  const p = partsIn(instant, timeZone);
  return clockText(p.hour * 60 + p.minute);
}

/**
 * An instant from what the API may send for a time: an ISO instant with a
 * zone ("2026-11-20T08:00:00Z", "+02:00"), a local date-time without one
 * ("2026-11-20T10:00", read in the venue's zone), or a clock time "10:00" on
 * `date`. Null for anything else.
 */
export function readInstant(value: unknown, timeZone: string, date?: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value === "") return null;
  if (isClock(value)) return date ? wallToUtc(date, value.slice(0, 5), timeZone) : null;
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (local) return wallToUtc(local[1], local[2], timeZone);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const at = Date.parse(value);
    return Number.isNaN(at) ? null : at;
  }
  return null;
}

// ---- Words ----------------------------------------------------------------------

/** "2 h", "2 h 30 min", "45 min". */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "Friday 20 November 2026" on the venue's calendar. */
export function dayText(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(new Date(instant))
    // en-GB puts a comma after the weekday; a label reads better without it (as `formatNight`).
    .replace(",", "");
}

/** "Friday 20 November 2026" of a date "YYYY-MM-DD", with no zone involved. */
export function dateText(date: string): string {
  const at = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(at) ? date : dayText(at, "UTC");
}

/** "Africa/Harare time": the zone as two parties can both read it. */
export const zoneText = (timeZone: string) => `${timeZone} time`;

/**
 * "Friday 20 November 2026, 10:00 to 12:00" in a zone; when the end is on
 * another day, "Friday 20 November 2026, 22:00 to Saturday 21 November 2026, 01:00".
 */
export function spanText(start: number, end: number, timeZone: string): string {
  const startDay = localDateOf(start, timeZone);
  const endDay = localDateOf(end, timeZone);
  // A span that ends at midnight belongs to the day it started.
  const endsAtMidnight = clockOf(end, timeZone) === "00:00" && end - start <= 86_400_000 && endDay > startDay;
  const head = `${dayText(start, timeZone)}, ${clockOf(start, timeZone)} to `;
  if (startDay === endDay) return `${head}${clockOf(end, timeZone)}`;
  if (endsAtMidnight) return `${head}24:00`;
  return `${head}${dayText(end, timeZone)}, ${clockOf(end, timeZone)}`;
}

/** The span in the venue's zone with the zone named: "Friday 20 November 2026, 10:00 to 12:00 (Africa/Harare time)". */
export const venueSpanText = (start: number, end: number, timeZone: string) =>
  `${spanText(start, end, timeZone)} (${zoneText(timeZone)})`;

/**
 * The same span on the visitor's own clock, when it reads differently from
 * the venue's at the start or the end: "08:00 to 10:00 your time
 * (Europe/London)", with the day when that differs too. Null when the two
 * clocks agree, or the visitor's zone is unknown.
 */
export function visitorTimeNote(start: number, end: number, venueZone: string, visitorZone: string | null | undefined): string | null {
  if (!visitorZone || visitorZone === venueZone) return null;
  try {
    if (offsetMinutes(start, venueZone) === offsetMinutes(start, visitorZone) && offsetMinutes(end, venueZone) === offsetMinutes(end, visitorZone)) {
      return null;
    }
  } catch {
    return null;
  }
  const sameDay = localDateOf(start, venueZone) === localDateOf(start, visitorZone);
  const text = sameDay
    ? `${clockOf(start, visitorZone)} to ${clockOf(end, visitorZone)}${localDateOf(end, visitorZone) !== localDateOf(start, visitorZone) ? ` (${dayText(end, visitorZone)})` : ""}`
    : spanText(start, end, visitorZone);
  return `${text} your time (${visitorZone})`;
}

/** The browser's own zone, or null where it cannot say. */
export function visitorZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// ---- Availability ---------------------------------------------------------------

export type Span = { start: number; end: number };

/** One date of the venue's availability: when it is open and what is taken (buffers included). */
export type VenueDay = { date: string; open: Span[]; booked: Span[]; note: string | null };

export type VenueAvailability = {
  timeZone: string;
  incrementMinutes: number;
  /** When the answer says; otherwise the quote checks them. */
  minMinutes: number | null;
  maxMinutes: number | null;
  bufferMinutes: number;
  capacity: number;
  /** The earliest start the lead time allows (`bookable_from`), and the end of the horizon. */
  earliestStart: number | null;
  latestEnd: number | null;
  /** What the listing shows before a time is chosen. Money is the API's exact string. */
  currency: string | null;
  ratePerHour: string | null;
  deposit: string | null;
  cancellationPolicy: string | null;
  freeCancellationHours: number | null;
  notice: string | null;
  days: VenueDay[];
};

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => (value && typeof value === "object" ? (value as Raw) : {});
const num = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** The first of `keys` that `raw` has, read as an instant. */
function instantOf(raw: Raw, keys: string[], timeZone: string, date: string): number | null {
  for (const key of keys) {
    const at = readInstant(raw[key], timeZone, date);
    if (at !== null) return at;
  }
  return null;
}

/**
 * A range the API sends: `{start, end}` as clock times, local date-times or
 * instants, and maybe the instants beside them (`start_utc`, `start_at`,
 * `utc: {start, end}`). The instants win when both are there. A range whose
 * end is not after its start, read as clock times, ends the next day.
 */
export function readSpan(value: unknown, timeZone: string, date: string): Span | null {
  const raw = obj(value);
  const utc = obj(raw.utc);
  const local = obj(raw.local);
  const start =
    instantOf(raw, ["start_utc", "utc_start", "start_at", "starts_at", "start_instant"], timeZone, date) ??
    instantOf(utc, ["start"], timeZone, date) ??
    instantOf(raw, ["start", "opens", "from", "local_start"], timeZone, date) ??
    instantOf(local, ["start"], timeZone, date);
  let end =
    instantOf(raw, ["end_utc", "utc_end", "end_at", "ends_at", "end_instant"], timeZone, date) ??
    instantOf(utc, ["end"], timeZone, date) ??
    instantOf(raw, ["end", "closes", "to", "local_end"], timeZone, date) ??
    instantOf(local, ["end"], timeZone, date);
  if (start === null || end === null) return null;
  if (end <= start && isClock(raw.end ?? raw.closes)) {
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    end = readInstant(raw.end ?? raw.closes, timeZone, next);
    if (end === null || end <= start) return null;
  }
  return end > start ? { start, end } : null;
}

const spans = (value: unknown, timeZone: string, date: string): Span[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => readSpan(item, timeZone, date))
    .filter((item): item is Span => item !== null)
    .sort((a, b) => a.start - b.start);

/**
 * `GET /v1/venues/{id}/availability`, read tolerantly: `time_zone` (or
 * `timezone`), `increment_minutes` and `days: [{date, open_ranges, booked}]`,
 * plus the rules when the answer carries them. Null when it has no zone.
 */
export function normaliseAvailability(value: unknown): VenueAvailability | null {
  const raw = obj(value);
  const root = raw.availability && typeof raw.availability === "object" ? obj(raw.availability) : raw;
  const rules = obj(root.rules ?? root.settings);
  const pick = (key: string) => num(root[key]) ?? num(rules[key]);
  const timeZone = String(root.time_zone ?? root.timezone ?? rules.time_zone ?? "");
  if (!timeZone) return null;
  try {
    partsIn(0, timeZone);
  } catch {
    return null;
  }
  const increment = pick("increment_minutes") ?? 30;
  const days = (Array.isArray(root.days) ? root.days : [])
    .map((item): VenueDay | null => {
      const day = obj(item);
      const date = String(day.date ?? "");
      if (!DATE.test(date)) return null;
      return {
        date,
        note: typeof day.note === "string" && day.note !== "" ? day.note : null,
        open: day.closed === true ? [] : spans(day.open_ranges ?? day.open ?? day.opening_hours, timeZone, date),
        booked: spans(day.booked ?? day.booked_ranges ?? day.taken, timeZone, date),
      };
    })
    .filter((item): item is VenueDay => item !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const earliest = readInstant(root.bookable_from ?? root.earliest_start ?? rules.earliest_start, timeZone);
  const latest = readInstant(root.bookable_until, timeZone);
  const text = (key: string) => (typeof root[key] === "string" && root[key] !== "" ? (root[key] as string) : null);
  const policy = obj(root.cancellation_policy);
  return {
    timeZone,
    incrementMinutes: increment > 0 ? increment : 30,
    minMinutes: pick("min_minutes"),
    maxMinutes: pick("max_minutes"),
    bufferMinutes: Math.max(0, pick("cleaning_buffer_minutes") ?? 0),
    capacity: Math.max(1, pick("capacity") ?? 1),
    earliestStart: earliest,
    latestEnd: latest,
    currency: text("currency"),
    ratePerHour: text("rate_per_hour"),
    deposit: text("deposit"),
    cancellationPolicy: text("cancellation_policy") ?? (typeof policy.text === "string" && policy.text !== "" ? policy.text : null),
    freeCancellationHours: pick("free_cancellation_hours") ?? num(policy.free_cancellation_hours),
    notice: text("notice"),
    days,
  };
}

export type SlotRules = {
  incrementMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  bufferMinutes?: number;
  capacity?: number;
  /** No start before this instant (now plus the lead time). */
  earliestStart?: number | null;
};

/**
 * The rules for building choices: the answer's own, else one increment up to
 * a whole day. The API's `booked` ranges are already widened by the cleaning
 * buffers and are only where the capacity is full, so a slot is free when it
 * overlaps none of them: no buffer and a capacity of one here.
 */
export function rulesOf(availability: VenueAvailability, now?: number): SlotRules {
  const increment = availability.incrementMinutes;
  const min = availability.minMinutes ?? increment;
  return {
    incrementMinutes: increment,
    minMinutes: Math.max(increment, min),
    maxMinutes: Math.max(min, availability.maxMinutes ?? 24 * 60),
    bufferMinutes: 0,
    capacity: 1,
    earliestStart: Math.max(availability.earliestStart ?? -Infinity, now ?? -Infinity),
  };
}

/** Whether `[start, end)` plus the cleaning buffer after it leaves room: fewer than `capacity` taken ranges overlap. */
function isFree(day: VenueDay, start: number, end: number, rules: SlotRules): boolean {
  const until = end + (rules.bufferMinutes ?? 0) * MINUTE;
  const overlapping = day.booked.filter((taken) => taken.start < until && taken.end > start).length;
  return overlapping < Math.max(1, rules.capacity ?? 1);
}

/**
 * The instants a booking can start on a day: every increment from the start
 * of each open range, where the shortest booking fits before the range closes,
 * is free with its buffer, and is not before the earliest start.
 */
export function startTimes(day: VenueDay, rules: SlotRules): number[] {
  const step = rules.incrementMinutes * MINUTE;
  const shortest = rules.minMinutes * MINUTE;
  if (step <= 0) return [];
  const out: number[] = [];
  for (const range of day.open) {
    for (let start = range.start; start + shortest <= range.end; start += step) {
      if (rules.earliestStart !== undefined && rules.earliestStart !== null && start < rules.earliestStart) continue;
      if (isFree(day, start, start + shortest, rules)) out.push(start);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** The lengths, in minutes, a booking starting at `start` can have: from the shortest to the longest that fits and is free. */
export function durationsFrom(day: VenueDay, start: number, rules: SlotRules): number[] {
  const range = day.open.find((item) => item.start <= start && start < item.end);
  if (!range) return [];
  const out: number[] = [];
  const first = Math.ceil(rules.minMinutes / rules.incrementMinutes) * rules.incrementMinutes;
  for (let minutes = first; minutes <= rules.maxMinutes; minutes += rules.incrementMinutes) {
    const end = start + minutes * MINUTE;
    if (end > range.end) break;
    // Longer only takes more, so the first clash ends the list.
    if (!isFree(day, start, end, rules)) break;
    out.push(minutes);
  }
  return out;
}

/** The dates that have at least one start time: the ones a visitor can pick. */
export function openDates(days: VenueDay[], rules: SlotRules): string[] {
  return days.filter((day) => startTimes(day, rules).length > 0).map((day) => day.date);
}

export type TimeChoice = { value: string; label: string };

/** "UTC+02:00", "UTC-07:00", "UTC+00:00". */
export function offsetText(instant: number, timeZone: string): string {
  const offset = offsetMinutes(instant, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * Start times as choices: the value is the ISO instant, the label the venue's
 * clock ("10:00"). A clock time that happens twice (the clocks went back) says
 * which: "01:00 (UTC+01:00)" and "01:00 (UTC+00:00)".
 */
export function startChoices(day: VenueDay, rules: SlotRules, timeZone: string): TimeChoice[] {
  const starts = startTimes(day, rules);
  const clocks = starts.map((start) => clockOf(start, timeZone));
  return starts.map((start, index) => ({
    value: new Date(start).toISOString(),
    label: clocks.indexOf(clocks[index]) !== clocks.lastIndexOf(clocks[index]) ? `${clocks[index]} (${offsetText(start, timeZone)})` : clocks[index],
  }));
}

/** Durations as choices: "2 h 30 min, until 12:30". */
export function durationChoices(day: VenueDay, start: number, rules: SlotRules, timeZone: string): TimeChoice[] {
  return durationsFrom(day, start, rules).map((minutes) => ({
    value: String(minutes),
    label: `${durationText(minutes)}, until ${clockOf(start + minutes * MINUTE, timeZone)}`,
  }));
}

/** "YYYY-MM-DD" today in a zone. */
export function todayInZone(timeZone: string, now: number = Date.now()): string {
  return localDateOf(now, timeZone);
}

/** A date plus some days, as "YYYY-MM-DD". */
export function addDaysTo(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
