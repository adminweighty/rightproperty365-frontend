/**
 * The hourly booking settings of a venue (API 0.33.0, `/v1/me/listings/{id}/hourly`),
 * as pure functions: the API's settings read tolerantly into the editor's
 * form, the form checked the way the API checks it, and the body to `PUT`.
 *
 * Field errors are keyed by the API's own field paths (`min_minutes`,
 * `opening_hours[2].closes`, `fees[0].amount`), so the API's errors land in
 * the same places as these.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/venue-settings.test.mjs).
 */

export const INCREMENTS = [15, 30, 60];
export const FEE_KINDS = ["PERCENT", "FIXED", "PER_HOUR"];
export const MAX_BUFFER_MINUTES = 240;
export const DEFAULT_HORIZON_DAYS = 90;
export const MAX_HORIZON_DAYS = 365;
const POLICY_MAX = 2000;
const NOTE_MAX = 200;
const LABEL_MAX = 80;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** ISO weekday 1 (Monday) to 7 (Sunday). */
export const weekdayName = (weekday: number) => WEEKDAYS[weekday - 1] ?? `Day ${weekday}`;

export type OpeningRange = { weekday: number; opens: string; closes: string };
export type ExceptionForm = { date: string; closed: boolean; opens: string; closes: string; note: string };
export type FeeForm = { code: string; label: string; kind: string; amount: string; effective_from: string; effective_to: string };

/** The editor's form: text as typed, so a half-typed value is kept until it is checked. */
export type HourlyForm = {
  enabled: boolean;
  currency: string;
  rate_per_hour: string;
  increment_minutes: number;
  min_minutes: number;
  max_minutes: number;
  cleaning_buffer_minutes: number;
  capacity: string;
  deposit: string;
  opening_hours: OpeningRange[];
  exceptions: ExceptionForm[];
  fees: FeeForm[];
  cancellation_policy: string;
  free_cancellation_hours: string;
  lead_time_hours: string;
  horizon_days: string;
};

export type HourlyBody = {
  enabled: boolean;
  currency: string;
  rate_per_hour: string;
  increment_minutes: number;
  min_minutes: number;
  max_minutes: number;
  cleaning_buffer_minutes: number;
  capacity: number;
  deposit: string | null;
  opening_hours: OpeningRange[];
  exceptions: { date: string; closed: boolean; opens?: string; closes?: string; note?: string }[];
  fees: { code: string; label: string; kind: string; amount: string; effective_from: string; effective_to?: string }[];
  cancellation_policy: string;
  free_cancellation_hours: number;
  lead_time_hours: number;
  horizon_days: number;
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY = /^\d{1,9}(\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,4})?$/;
const WHOLE = /^\d{1,6}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,31}$/;

const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
export const isClockValue = (value: string) => CLOCK.test(value);
export function isDateValue(value: string): boolean {
  if (!DATE.test(value)) return false;
  const at = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(at) && new Date(at).toISOString().slice(0, 10) === value;
}

/** "2 h 30 min" for a select of lengths. */
export function minutesText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (minutes === 0) return "None";
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Lengths a booking may have with this increment: one increment up to 24 hours. */
export function lengthOptions(increment: number): number[] {
  const out: number[] = [];
  for (let minutes = increment; minutes <= 24 * 60; minutes += increment) out.push(minutes);
  return out;
}

/** Cleaning buffers: none, then every 15 minutes up to 4 hours. */
export function bufferOptions(): number[] {
  const out: number[] = [];
  for (let minutes = 0; minutes <= MAX_BUFFER_MINUTES; minutes += 15) out.push(minutes);
  return out;
}

/** Opening and closing times on the increment's grid, for the hours editor's selects. */
export function clockOptions(increment: number, { closing = false } = {}): string[] {
  const out: string[] = [];
  const step = INCREMENTS.includes(increment) ? increment : 30;
  for (let minutes = closing ? step : 0; minutes <= (closing ? 1440 : 1440 - step); minutes += step) {
    out.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return out;
}

// ---- Reading the API's settings --------------------------------------------------

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => (value && typeof value === "object" ? (value as Raw) : {});
const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
const int = (value: unknown, fallback: number) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : fallback;
};
const clock = (value: unknown) => str(value).slice(0, 5);

/** An empty form: switched off, 30-minute increments, Monday to Friday 09:00 to 17:00. */
export function blankForm(currency: string): HourlyForm {
  return {
    enabled: false,
    currency,
    rate_per_hour: "",
    increment_minutes: 30,
    min_minutes: 60,
    max_minutes: 480,
    cleaning_buffer_minutes: 0,
    capacity: "1",
    deposit: "",
    opening_hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "09:00", closes: "17:00" })),
    exceptions: [],
    fees: [],
    cancellation_policy: "",
    free_cancellation_hours: "48",
    lead_time_hours: "24",
    horizon_days: String(DEFAULT_HORIZON_DAYS),
  };
}

/**
 * The settings the API sends, as the form: the settings themselves or under
 * `settings` / `hourly`; `cancellation_policy` as text with
 * `free_cancellation_hours` beside it, or as `{text, free_cancellation_hours}`.
 * Null when the listing has no settings yet (the API sent nothing to read).
 */
export function formFromSettings(value: unknown, fallbackCurrency: string): HourlyForm | null {
  const outer = obj(value);
  const raw = obj(outer.settings ?? outer.hourly ?? outer);
  if (Object.keys(raw).length === 0 || (raw.rate_per_hour === undefined && raw.enabled === undefined)) return null;
  const blank = blankForm(fallbackCurrency);
  const policy = raw.cancellation_policy;
  const policyText = typeof policy === "string" ? policy : str(obj(policy).text ?? obj(policy).description);
  const freeHours = raw.free_cancellation_hours ?? obj(policy).free_cancellation_hours;
  const increment = int(raw.increment_minutes, blank.increment_minutes);
  const amount = (input: unknown) => (input && typeof input === "object" ? str(obj(input).amount) : str(input));
  return {
    enabled: raw.enabled === true,
    currency: str(raw.currency ?? obj(raw.rate).currency, fallbackCurrency) || fallbackCurrency,
    rate_per_hour: amount(raw.rate_per_hour ?? raw.rate),
    increment_minutes: INCREMENTS.includes(increment) ? increment : blank.increment_minutes,
    min_minutes: int(raw.min_minutes, blank.min_minutes),
    max_minutes: int(raw.max_minutes, blank.max_minutes),
    cleaning_buffer_minutes: int(raw.cleaning_buffer_minutes, 0),
    capacity: str(raw.capacity, "1"),
    deposit: raw.deposit === null || raw.deposit === undefined ? "" : amount(raw.deposit),
    opening_hours: (Array.isArray(raw.opening_hours) ? raw.opening_hours : []).map((item) => {
      const range = obj(item);
      return { weekday: int(range.weekday, 1), opens: clock(range.opens), closes: clock(range.closes) };
    }),
    exceptions: (Array.isArray(raw.exceptions) ? raw.exceptions : []).map((item) => {
      const entry = obj(item);
      return {
        date: str(entry.date).slice(0, 10),
        closed: entry.closed === true,
        opens: clock(entry.opens),
        closes: clock(entry.closes),
        note: str(entry.note),
      };
    }),
    fees: (Array.isArray(raw.fees) ? raw.fees : []).map((item) => {
      const fee = obj(item);
      return {
        code: str(fee.code),
        label: str(fee.label),
        kind: str(fee.kind, "FIXED"),
        amount: amount(fee.amount),
        effective_from: str(fee.effective_from).slice(0, 10),
        effective_to: str(fee.effective_to).slice(0, 10),
      };
    }),
    cancellation_policy: policyText,
    free_cancellation_hours: str(freeHours, blank.free_cancellation_hours),
    lead_time_hours: str(raw.lead_time_hours, blank.lead_time_hours),
    horizon_days: str(raw.horizon_days, blank.horizon_days),
  };
}

// ---- Checking ---------------------------------------------------------------------

/**
 * The opening hours checked: each range a real time, closing after opening,
 * on the increment's grid, and not overlapping another range of its day.
 * Errors are keyed by the range's index in the list.
 */
export function openingHoursErrors(ranges: OpeningRange[], increment?: number): Record<number, string> {
  const errors: Record<number, string> = {};
  ranges.forEach((range, index) => {
    if (!(range.weekday >= 1 && range.weekday <= 7)) {
      errors[index] = "Choose the day.";
    } else if (!isClockValue(range.opens) || range.opens === "24:00") {
      errors[index] = "Choose when it opens.";
    } else if (!isClockValue(range.closes)) {
      errors[index] = "Choose when it closes.";
    } else if (minutesOf(range.closes) <= minutesOf(range.opens)) {
      errors[index] = `It must close after it opens at ${range.opens}.`;
    } else if (increment && (minutesOf(range.opens) % increment !== 0 || minutesOf(range.closes) % increment !== 0)) {
      errors[index] = `Use times on the ${increment}-minute grid, such as 08:00 or 08:${String(increment % 60).padStart(2, "0")}.`;
    }
  });
  // Only ranges that are right on their own are compared with each other.
  const whole = new Set(ranges.map((_, index) => index).filter((index) => !errors[index]));
  ranges.forEach((range, index) => {
    if (!whole.has(index)) return;
    const clash = ranges.findIndex(
      (other, otherIndex) =>
        otherIndex !== index &&
        whole.has(otherIndex) &&
        other.weekday === range.weekday &&
        minutesOf(other.opens) < minutesOf(range.closes) &&
        minutesOf(range.opens) < minutesOf(other.closes),
    );
    if (clash !== -1) {
      errors[index] = `It overlaps ${ranges[clash].opens} to ${ranges[clash].closes} on ${weekdayName(range.weekday)}.`;
    }
  });
  return errors;
}

/** The ranges of each day in order, Monday first: how the editor lists them. */
export function sortedRanges(ranges: OpeningRange[]): OpeningRange[] {
  return [...ranges].sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens));
}

/** "Monday 08:00 to 12:00, 13:00 to 17:00" for each open day; closed days are left out. */
export function openingHoursSummary(ranges: OpeningRange[]): string[] {
  const out: string[] = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const day = sortedRanges(ranges.filter((range) => range.weekday === weekday));
    if (day.length > 0) out.push(`${weekdayName(weekday)} ${day.map((range) => `${range.opens} to ${range.closes}`).join(", ")}`);
  }
  return out;
}

export type Checked = { errors: Record<string, string>; body: HourlyBody | null };

/**
 * The whole form checked as the API checks it, with its body when nothing is
 * wrong. `currencies` are the market's: the currency must be one of them.
 * A form that is switched off is checked too, so it can be switched on later.
 */
export function checkHourlyForm(form: HourlyForm, currencies: string[]): Checked {
  const errors: Record<string, string> = {};
  const increment = form.increment_minutes;
  if (!currencies.includes(form.currency)) errors.currency = "Choose one of the currencies of the listing’s country.";
  if (!MONEY.test(form.rate_per_hour.trim())) errors.rate_per_hour = "Enter the rate per hour as a number, such as 50 or 50.00.";
  else if (Number(form.rate_per_hour) <= 0) errors.rate_per_hour = "The rate per hour must be more than 0.";
  if (!INCREMENTS.includes(increment)) errors.increment_minutes = "Choose 15, 30 or 60 minutes.";
  if (form.min_minutes % increment !== 0 || form.min_minutes <= 0) errors.min_minutes = `Choose a multiple of ${increment} minutes.`;
  if (form.max_minutes % increment !== 0 || form.max_minutes <= 0) errors.max_minutes = `Choose a multiple of ${increment} minutes.`;
  else if (form.max_minutes < form.min_minutes) errors.max_minutes = "The longest booking cannot be shorter than the shortest.";
  if (!(form.cleaning_buffer_minutes >= 0 && form.cleaning_buffer_minutes <= MAX_BUFFER_MINUTES)) {
    errors.cleaning_buffer_minutes = "Choose from none to 4 hours.";
  }
  if (!WHOLE.test(form.capacity.trim()) || Number(form.capacity) < 1) errors.capacity = "Enter a whole number, 1 or more.";
  if (form.deposit.trim() !== "" && !MONEY.test(form.deposit.trim())) errors.deposit = "Enter the deposit as a number, or leave it empty.";

  const hours = openingHoursErrors(form.opening_hours, increment);
  for (const [index, message] of Object.entries(hours)) errors[`opening_hours[${index}]`] = message;
  if (form.enabled && form.opening_hours.length === 0) errors.opening_hours = "Add the hours it is open before taking bookings.";

  const seen = new Map<string, number>();
  form.exceptions.forEach((entry, index) => {
    const key = `exceptions[${index}]`;
    if (!isDateValue(entry.date)) errors[`${key}.date`] = "Choose the date.";
    else if (seen.has(entry.date)) errors[`${key}.date`] = "This date already has its own hours.";
    else seen.set(entry.date, index);
    if (!entry.closed) {
      if (!isClockValue(entry.opens) || entry.opens === "24:00") errors[`${key}.opens`] = "Choose when it opens, or mark the day closed.";
      else if (!isClockValue(entry.closes)) errors[`${key}.closes`] = "Choose when it closes.";
      else if (minutesOf(entry.closes) <= minutesOf(entry.opens)) errors[`${key}.closes`] = "It must close after it opens.";
    }
    if (entry.note.length > NOTE_MAX) errors[`${key}.note`] = `Keep the note to ${NOTE_MAX} characters.`;
  });

  form.fees.forEach((fee, index) => {
    const key = `fees[${index}]`;
    const code = fee.code.trim().toUpperCase();
    if (!CODE.test(code)) errors[`${key}.code`] = "Use capital letters, digits and _, such as TAX or CLEANING.";
    if (fee.label.trim() === "") errors[`${key}.label`] = "Name the charge as customers will read it.";
    else if (fee.label.length > LABEL_MAX) errors[`${key}.label`] = `Keep the name to ${LABEL_MAX} characters.`;
    if (!FEE_KINDS.includes(fee.kind)) errors[`${key}.kind`] = "Choose how it is charged.";
    const amount = fee.amount.trim();
    if (fee.kind === "PERCENT") {
      if (!PERCENT.test(amount) || Number(amount) <= 0 || Number(amount) > 100) errors[`${key}.amount`] = "Enter a percentage above 0, up to 100.";
    } else if (!MONEY.test(amount) || Number(amount) <= 0) {
      errors[`${key}.amount`] = "Enter an amount above 0.";
    }
    if (!isDateValue(fee.effective_from)) errors[`${key}.effective_from`] = "Choose the first day it applies.";
    if (fee.effective_to !== "") {
      if (!isDateValue(fee.effective_to)) errors[`${key}.effective_to`] = "Choose the last day, or leave it empty.";
      else if (isDateValue(fee.effective_from) && fee.effective_to < fee.effective_from) {
        errors[`${key}.effective_to`] = "The last day cannot be before the first.";
      }
    }
  });
  // Two charges with one code and overlapping dates would both apply.
  form.fees.forEach((fee, index) => {
    const key = `fees[${index}].effective_from`;
    if (errors[key] || errors[`fees[${index}].code`]) return;
    const end = fee.effective_to || "9999-12-31";
    const clash = form.fees.findIndex(
      (other, otherIndex) =>
        otherIndex < index &&
        other.code.trim().toUpperCase() === fee.code.trim().toUpperCase() &&
        isDateValue(other.effective_from) &&
        other.effective_from <= end &&
        fee.effective_from <= (other.effective_to || "9999-12-31"),
    );
    if (clash !== -1) errors[key] = `Its dates overlap the other ${fee.code.trim().toUpperCase()} charge.`;
  });

  if (form.cancellation_policy.length > POLICY_MAX) errors.cancellation_policy = `Keep the policy to ${POLICY_MAX} characters.`;
  else if (form.enabled && form.cancellation_policy.trim() === "") errors.cancellation_policy = "Say what happens when a customer cancels.";
  if (!WHOLE.test(form.free_cancellation_hours.trim())) errors.free_cancellation_hours = "Enter a whole number of hours, 0 or more.";
  if (!WHOLE.test(form.lead_time_hours.trim())) errors.lead_time_hours = "Enter a whole number of hours, 0 or more.";
  const horizon = Number(form.horizon_days);
  if (!WHOLE.test(form.horizon_days.trim()) || horizon < 1 || horizon > MAX_HORIZON_DAYS) {
    errors.horizon_days = `Enter a number of days from 1 to ${MAX_HORIZON_DAYS}.`;
  }

  if (Object.keys(errors).length > 0) return { errors, body: null };
  return {
    errors,
    body: {
      enabled: form.enabled,
      currency: form.currency,
      rate_per_hour: form.rate_per_hour.trim(),
      increment_minutes: increment,
      min_minutes: form.min_minutes,
      max_minutes: form.max_minutes,
      cleaning_buffer_minutes: form.cleaning_buffer_minutes,
      capacity: Number(form.capacity),
      deposit: form.deposit.trim() === "" ? null : form.deposit.trim(),
      // In the form's order, so the API's field errors (opening_hours[2]) name the same rows.
      opening_hours: form.opening_hours.map(({ weekday, opens, closes }) => ({ weekday, opens, closes })),
      exceptions: form.exceptions.map((entry) => ({
          date: entry.date,
          closed: entry.closed,
          ...(entry.closed ? {} : { opens: entry.opens, closes: entry.closes }),
          ...(entry.note.trim() ? { note: entry.note.trim() } : {}),
        })),
      fees: form.fees.map((fee) => ({
        code: fee.code.trim().toUpperCase(),
        label: fee.label.trim(),
        kind: fee.kind,
        amount: fee.amount.trim(),
        effective_from: fee.effective_from,
        ...(fee.effective_to ? { effective_to: fee.effective_to } : {}),
      })),
      cancellation_policy: form.cancellation_policy.trim(),
      free_cancellation_hours: Number(form.free_cancellation_hours),
      lead_time_hours: Number(form.lead_time_hours),
      horizon_days: horizon,
    },
  };
}

/**
 * The key an API field error belongs under in the form: `opening_hours[2].closes`
 * is shown on the range (`opening_hours[2]`); `cancellation_policy.text` on the
 * policy. Other keys are already the form's.
 */
export function formKeyOf(path: string): string {
  const range = /^opening_hours\[(\d+)\]/.exec(path);
  if (range) return `opening_hours[${range[1]}]`;
  if (path.startsWith("cancellation_policy.")) {
    return path.endsWith("free_cancellation_hours") ? "free_cancellation_hours" : "cancellation_policy";
  }
  return path.replace(/\.(\d+)\./g, "[$1].").replace(/^(\w+)\.(\d+)$/, "$1[$2]");
}
