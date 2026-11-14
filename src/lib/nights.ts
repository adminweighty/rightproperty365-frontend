/**
 * Calendar nights of a short stay, as pure functions.
 *
 * A night is a calendar date written `YYYY-MM-DD`, in the time zone of the
 * listing's country, with no time of day. A stay from `check_in` to
 * `check_out` occupies the nights `check_in` .. `check_out - 1`: the day of
 * leaving is not a night of the stay. All arithmetic here is done on the
 * date itself (as UTC midnight), so it never depends on the zone of the
 * server or of the browser; only `todayIn` reads a clock.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/nights.test.mjs).
 */

/** The longest stay the API accepts, in nights. */
export const MAX_STAY_NIGHTS = 90;
/** The booking window: today and the 365 days after it. */
export const BOOKING_WINDOW_DAYS = 365;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);

/** True for a real calendar date written `YYYY-MM-DD` ("2026-02-30" is not one). */
export function isNight(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const time = toTime(value);
  return !Number.isNaN(time) && fromTime(time) === value;
}

export function addDays(date: string, days: number): string {
  return fromTime(toTime(date) + days * DAY_MS);
}

/** Nights from `from` to `to`: 3 for 17 to 20 November. Negative when `to` is earlier. */
export function nightsBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

/** Every night from `from` to `to`, inclusive. Empty when `to` is earlier. */
export function eachNight(from: string, to: string): string[] {
  const nights: string[] = [];
  for (let night = from; night <= to; night = addDays(night, 1)) nights.push(night);
  return nights;
}

/**
 * Today's date in an IANA time zone ("Africa/Harare"), which is the listing's
 * "today". A zone the runtime does not know falls back to UTC.
 */
export function todayIn(timezone: string, now: Date = new Date()): string {
  const read = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  try {
    return read(timezone);
  } catch {
    return read("UTC");
  }
}

/** The last night of the booking window that starts on `today`. */
export const windowEnd = (today: string) => addDays(today, BOOKING_WINDOW_DAYS);

// ---- Months ----------------------------------------------------------------

/** "2026-11" for a night in November 2026. */
export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, count: number): string {
  const [year, index] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Whole months from `from` to `to`: 2 for "2026-11" to "2027-01". */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/**
 * The weeks of a month, Monday first, each seven cells: a date, or null for
 * a cell before the 1st or after the last day.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const days = nightsBetween(first, `${addMonths(month, 1)}-01`);
  // getUTCDay: Sunday is 0. Monday first: Monday 0 .. Sunday 6.
  const lead = (new Date(toTime(first)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => addDays(first, index)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

// ---- Words -----------------------------------------------------------------

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });

/** "17 Nov 2026". With `weekday`: "Tuesday 17 November 2026". */
export function formatNight(date: string, style: "short" | "long" = "short"): string {
  if (!isNight(date)) return date;
  const text = formatter(
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  ).format(toTime(date));
  // en-GB puts a comma after the weekday; a label reads better without it.
  return text.replace(",", "");
}

/** "November 2026" for "2026-11". */
export function formatMonth(month: string): string {
  return formatter({ month: "long", year: "numeric" }).format(toTime(`${month}-01`));
}

/**
 * Two dates as one range, saying each part once: "17–20 Nov 2026",
 * "28 Nov – 2 Dec 2026", "30 Dec 2026 – 2 Jan 2027". One date when both are the same.
 */
export function formatRange(from: string, to: string): string {
  if (!isNight(from) || !isNight(to)) return [from, to].filter(Boolean).join(" – ");
  if (from === to) return formatNight(from);
  const [fromYear, fromMonth] = from.split("-");
  const [toYear, toMonth] = to.split("-");
  const day = (date: string) => String(Number(date.slice(8)));
  if (fromYear !== toYear) return `${formatNight(from)} – ${formatNight(to)}`;
  if (fromMonth !== toMonth) {
    return `${formatter({ day: "numeric", month: "short" }).format(toTime(from))} – ${formatNight(to)}`;
  }
  return `${day(from)}–${formatNight(to)}`;
}

export const nightCount = (count: number) => (count === 1 ? "1 night" : `${count} nights`);
export const guestCount = (count: number) => (count === 1 ? "1 guest" : `${count} guests`);

/** A stay in words: "17–20 Nov 2026 · 3 nights". */
export function formatStay(checkIn: string, checkOut: string): string {
  const range = formatRange(checkIn, checkOut);
  if (!isNight(checkIn) || !isNight(checkOut)) return range;
  const nights = nightsBetween(checkIn, checkOut);
  return nights > 0 ? `${range} · ${nightCount(nights)}` : range;
}

// ---- Ranges ----------------------------------------------------------------

export type NightRange = { from: string; to: string };

/** Sorted, distinct nights as inclusive runs: 1, 2, 3, 7 gives 1–3 and 7. */
export function toRanges(nights: Iterable<string>): NightRange[] {
  const sorted = [...new Set(nights)].sort();
  const ranges: NightRange[] = [];
  for (const night of sorted) {
    const last = ranges.at(-1);
    if (last && addDays(last.to, 1) === night) last.to = night;
    else ranges.push({ from: night, to: night });
  }
  return ranges;
}

/** Two picked days as a range, whichever was picked first. */
export function orderedRange(a: string, b: string): NightRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

// ---- A visitor's stay --------------------------------------------------------

export type StayRules = {
  /** The listing's today: the first night that can be asked for. */
  today: string;
  /** The last night of the booking window. */
  lastNight: string;
  /** The shortest stay, in nights. */
  minNights: number;
  /** Null when the listing does not say. */
  maxGuests: number | null;
  /** True for a night that cannot be stayed. */
  isTaken: (night: string) => boolean;
};

/** The first night of `check_in` .. `check_out - 1` that is not free, or null. */
export function firstTakenNight(checkIn: string, checkOut: string, isTaken: (night: string) => boolean): string | null {
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) if (isTaken(night)) return night;
  return null;
}

/** Whether a stay may start on this night: inside the window and free. */
export function canCheckIn(night: string, rules: Pick<StayRules, "today" | "lastNight" | "isTaken">): boolean {
  return night >= rules.today && night <= rules.lastNight && !rules.isTaken(night);
}

/**
 * Whether a stay that starts on `checkIn` may end on `day`. The day of leaving
 * may itself be taken (someone else arrives); every night before it must be free.
 */
export function canCheckOut(
  checkIn: string,
  day: string,
  rules: Pick<StayRules, "lastNight" | "isTaken">,
): boolean {
  const nights = nightsBetween(checkIn, day);
  if (nights < 1 || nights > MAX_STAY_NIGHTS) return false;
  if (addDays(day, -1) > rules.lastNight) return false;
  return firstTakenNight(checkIn, day, rules.isTaken) === null;
}

export type StaySelection = { checkIn: string | null; checkOut: string | null };

/**
 * What picking a day in the calendar does. The first pick is the first
 * night; the second, a later day the stay can end on, is the day of leaving.
 * Any other pick starts again from that night, when a stay can start there.
 */
export function pickStayDay(selection: StaySelection, day: string, rules: StayRules): StaySelection {
  if (selection.checkIn && !selection.checkOut && canCheckOut(selection.checkIn, day, rules)) {
    return { checkIn: selection.checkIn, checkOut: day };
  }
  if (canCheckIn(day, rules)) return { checkIn: day, checkOut: null };
  return selection;
}

export type StayProblems = { check_in?: string; check_out?: string; guests?: string };

/**
 * What is wrong with a stay before it is sent, in the words shown under each
 * control. A convenience: the API checks the same rules and has the last word.
 */
export function stayProblems(
  stay: { checkIn: string; checkOut: string; guests: string | number },
  rules: StayRules,
): StayProblems {
  const problems: StayProblems = {};
  const { checkIn, checkOut } = stay;
  if (!isNight(checkIn)) problems.check_in = "Choose the first night of your stay.";
  else if (checkIn < rules.today) problems.check_in = "The first night cannot be in the past.";
  else if (checkIn > rules.lastNight) problems.check_in = `Stays can be asked for up to ${formatNight(rules.lastNight)}.`;

  if (!isNight(checkOut)) problems.check_out = "Choose the day you leave.";
  else if (isNight(checkIn)) {
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) problems.check_out = "The day you leave must be after the first night.";
    else if (nights > MAX_STAY_NIGHTS) problems.check_out = `A stay can be at most ${MAX_STAY_NIGHTS} nights.`;
    else if (nights < rules.minNights) problems.check_out = `The shortest stay here is ${nightCount(rules.minNights)}.`;
    else if (addDays(checkOut, -1) > rules.lastNight) {
      problems.check_out = `Stays can be asked for up to ${formatNight(rules.lastNight)}.`;
    } else if (!problems.check_in) {
      const taken = firstTakenNight(checkIn, checkOut, rules.isTaken);
      if (taken) problems.check_in = `The night of ${formatNight(taken)} is not available. Choose other dates.`;
    }
  }

  const guests = Number(stay.guests);
  if (!Number.isInteger(guests) || guests < 1) problems.guests = "Say how many guests will stay.";
  else if (rules.maxGuests !== null && guests > rules.maxGuests) {
    problems.guests = `This place sleeps at most ${rules.maxGuests}.`;
  }
  return problems;
}

/** Nights times the nightly price, as a decimal string with two places. Null when it cannot be worked out. */
export function stayEstimate(nightly: string, nights: number): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(nightly) || !Number.isInteger(nights) || nights < 1) return null;
  // In whole cents, so no fraction is lost to floating point.
  const [whole, fraction = ""] = nightly.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const total = cents * BigInt(nights);
  return `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, "0")}`;
}

// ---- The lister's changes ------------------------------------------------------

export type AvailabilityStatus = "AVAILABLE" | "BLOCKED" | "BOOKED";

/**
 * The control of the availability form that an API field error belongs to:
 * `changes[0].to` is the "to" control. With several changes in one request,
 * the index says which.
 */
export function changeFieldOf(path: string): { index: number; field: string } | null {
  const match = /^changes\[(\d+)\]\.([a-z_]+)$/.exec(path);
  return match ? { index: Number(match[1]), field: match[2] } : null;
}
