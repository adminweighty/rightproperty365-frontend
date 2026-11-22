/**
 * Personal time zone (API 0.62.0): the one place every time on the site is
 * formatted. Display only — nothing sent to the API is converted.
 *
 * The classes (contract-0.62-personal-time-zone.md):
 * - A, instants: shown in the viewer's zone, always with the zone named
 *   ("22 Nov 2026, 14:05 Harare time").                     → formatInstant
 * - B, place-bound times (appointments, viewings, venue bookings,
 *   inspections): the place's zone first, the viewer's alongside when it
 *   differs ("10:00 Harare time (09:00 your time)").          → formatPlaceTime
 * - C, calendar dates (YYYY-MM-DD): never shifted.          → formatCalendarDate
 *   Listing expiry and other "market days" given as an instant are shown as
 *   the day in the market zone.                                → formatMarketDay
 * - D, organisation figures: the market zone for everyone (pass the market
 *   zone to formatMarketDay / formatInstant).
 * "Today" and relative wording keep following the market zone (0.61.1).
 */

export type TimeZoneMode = "MARKET" | "DEVICE" | "ZONE";

/** `user.time_zone` of GET /v1/me, and the answer of /v1/me/time-zone. */
export type TimeZoneSetting = {
  mode: TimeZoneMode;
  zone: string | null;
  market_code: string;
  market_zone: string;
};

/** Zimbabwe's zone: the market time everything was shown in originally. */
export const HOME_MARKET_ZONE = "Africa/Harare";

const LOCALE = "en-GB";

/** True when Intl knows the zone (a bad name would throw RangeError). */
export function isKnownZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The device's own zone, or null when the browser does not say. */
export function deviceZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isKnownZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/**
 * A tolerant reader of `user.time_zone`: an older API (or anything odd) reads
 * as market time in the home market.
 */
export function readTimeZoneSetting(raw: unknown): TimeZoneSetting {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode: TimeZoneMode = v.mode === "DEVICE" || v.mode === "ZONE" ? v.mode : "MARKET";
  const zone = typeof v.zone === "string" && isKnownZone(v.zone) ? v.zone : null;
  const marketZone = typeof v.market_zone === "string" && isKnownZone(v.market_zone) ? v.market_zone : HOME_MARKET_ZONE;
  return {
    mode: mode === "ZONE" && !zone ? "MARKET" : mode,
    zone: mode === "ZONE" ? zone : null,
    market_code: typeof v.market_code === "string" && v.market_code ? v.market_code : "ZW",
    market_zone: marketZone,
  };
}

/** The viewer's display zone V: market, device (read now) or the named zone. */
export function viewerZone(setting: TimeZoneSetting | null | undefined, device: string | null = deviceZone()): string {
  const s = setting ?? null;
  const market = s && isKnownZone(s.market_zone) ? s.market_zone : HOME_MARKET_ZONE;
  if (s?.mode === "ZONE" && isKnownZone(s.zone)) return s.zone;
  if (s?.mode === "DEVICE" && isKnownZone(device)) return device;
  return market;
}

/** The PUT body of /v1/me/time-zone. */
export function timeZonePutBody(mode: TimeZoneMode, zone?: string | null): { mode: TimeZoneMode; zone?: string } {
  return mode === "ZONE" && zone ? { mode, zone } : { mode };
}

/* ------------------------------------------------------------- the zone's name */

const CITY_OVERRIDES: Record<string, string> = { UTC: "UTC", "Etc/UTC": "UTC", "Etc/GMT": "GMT", GMT: "GMT" };

/**
 * How a zone is named after a time: "Harare time", "New York time",
 * "Buenos Aires time", "UTC". An Etc/GMT±N zone is named by its offset.
 */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  if (CITY_OVERRIDES[zone]) return CITY_OVERRIDES[zone];
  if (zone.startsWith("Etc/")) return offsetLabel(zone, at);
  const city = zone.split("/").pop() ?? zone;
  return `${city.replaceAll("_", " ")} time`;
}

/** "UTC+02:00", "UTC−05:00", "UTC" at the given moment (DST included). */
export function offsetLabel(zone: string, at: Date = new Date()): string {
  const minutes = offsetMinutes(zone, at);
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** The zone's offset from UTC in minutes at the given moment. */
export function offsetMinutes(zone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUTC - (at.getTime() - at.getMilliseconds())) / 60000);
}

/* --------------------------------------------------------------------- formats */

const toDate = (value: string | Date): Date | null => {
  const at = value instanceof Date ? value : new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
};

/** The calendar day of an instant in a zone, as YYYY-MM-DD. */
export function dayIn(value: string | Date, zone: string): string | null {
  const at = toDate(value);
  if (!at) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export type InstantStyle = "datetime" | "date" | "time";

/**
 * Class A. "22 Nov 2026, 14:05 Harare time" in the viewer's zone V. `style`
 * "date" gives "22 Nov 2026 (Harare time)" — the day an instant fell on in V,
 * with the zone named because the day itself depends on it; "time" gives
 * "14:05 Harare time". `label: false` leaves the zone out where a column
 * header already names it.
 */
export function formatInstant(
  value: string | Date,
  zone: string,
  { style = "datetime", label = true }: { style?: InstantStyle; label?: boolean } = {},
): string {
  const at = toDate(value);
  if (!at) return typeof value === "string" ? value : "";
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { timeZone: zone, day: "numeric", month: "short", year: "numeric" }
      : style === "time"
        ? { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
        : { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  const text = new Intl.DateTimeFormat(LOCALE, options).format(at);
  if (!label) return text;
  return style === "date" ? `${text} (${zoneLabel(zone, at)})` : `${text} ${zoneLabel(zone, at)}`;
}

/**
 * Class B. "Mon 23 Nov 2026, 10:00 Harare time", then " (09:00 your time)"
 * when the viewer's zone differs at that moment — with the viewer's date too
 * when it is another day there. `date: false` leaves the date out
 * ("10:00 Harare time (09:00 your time)").
 */
export function formatPlaceTime(
  value: string | Date,
  placeZone: string,
  viewer: string,
  { date = true }: { date?: boolean } = {},
): string {
  const at = toDate(value);
  if (!at) return typeof value === "string" ? value : "";
  const place = isKnownZone(placeZone) ? placeZone : "UTC";
  const clock = (zone: string) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const day = (zone: string) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(at);
  const head = `${date ? `${day(place)}, ` : ""}${clock(place)} ${zoneLabel(place, at)}`;
  if (!isKnownZone(viewer) || offsetMinutes(viewer, at) === offsetMinutes(place, at)) return head;
  const otherDay = dayIn(at, viewer) !== dayIn(at, place);
  return `${head} (${otherDay ? `${day(viewer)}, ` : ""}${clock(viewer)} your time)`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Class C. A YYYY-MM-DD day, never shifted: "30 Nov 2026" ("30 November 2026"
 * with `long`). Anything else is returned as given.
 */
export function formatCalendarDate(day: string, { long = false }: { long?: boolean } = {}): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.slice(0, 10));
  if (!m) return day;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return day;
  return `${Number(m[3])} ${(long ? MONTHS_LONG : MONTHS)[month - 1]} ${m[1]}`;
}

/**
 * Classes C and D for an instant: the day it is in the MARKET zone, as a
 * calendar date with no zone ("30 Nov 2026"). For listing expiry and other
 * market days, and for organisation figures.
 */
export function formatMarketDay(value: string | Date, marketZone: string, { long = false }: { long?: boolean } = {}): string {
  const day = dayIn(value, isKnownZone(marketZone) ? marketZone : HOME_MARKET_ZONE);
  return day ? formatCalendarDate(day, { long }) : typeof value === "string" ? value : "";
}

/* ---------------------------------------------------------------- the picker */

/** Every zone the browser knows, sorted, with UTC first (a short list when Intl has none). */
export function supportedZones(): string[] {
  let zones: string[] = [];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    zones = supported ? supported("timeZone") : [];
  } catch {
    zones = [];
  }
  if (zones.length === 0) {
    zones = [HOME_MARKET_ZONE, "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "America/New_York", "Asia/Dubai",
      "Australia/Sydney", "Europe/London", "Indian/Mauritius"];
  }
  return ["UTC", ...[...new Set(zones)].filter((z) => z !== "UTC").sort()];
}

/** One option of the picker: "Harare time (UTC+02:00) — Africa/Harare". */
export function zoneOptionLabel(zone: string, at: Date = new Date()): string {
  const name = zoneLabel(zone, at);
  const offset = offsetLabel(zone, at);
  return name === offset || name === "UTC" ? `${name} — ${zone}` : `${name} (${offset}) — ${zone}`;
}

/** Whether a picker option matches what the person typed (city, region or offset). */
export function zoneMatches(zone: string, query: string, at: Date = new Date()): boolean {
  const q = query.trim().toLowerCase().replaceAll(" ", "_");
  if (!q) return true;
  return zone.toLowerCase().includes(q) || zoneOptionLabel(zone, at).toLowerCase().replaceAll(" ", "_").includes(q);
}
