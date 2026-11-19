/**
 * Pure helpers for the lead conversion page (`/agent/requests/funnel`, API
 * 0.38.0): the filters in the page address and the API query, durations and
 * shares in words, the funnel rows as shown, and sorting the breakdown
 * tables. Checked by `npm test` (scripts/lead-funnel.test.mjs). Nothing here
 * imports from `@/`.
 */

// ---- Filters ---------------------------------------------------------------------

export const FUNNEL_PERIODS = ["7d", "30d", "90d", "custom"] as const;
export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number];

export const FUNNEL_PERIOD_LABELS: Record<FunnelPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Choose dates",
};

const PERIOD_DAYS: Record<Exclude<FunnelPeriod, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export const DEFAULT_FUNNEL_PERIOD: FunnelPeriod = "30d";

/** The API's longest window, in days (both ends included). */
export const MAX_WINDOW_DAYS = 366;

/** The request types the API accepts, in its order. */
export const FUNNEL_REQUEST_TYPES = ["ENQUIRY", "PROPERTY_INFORMATION", "VIEWING_REQUEST", "CONSULTATION_REQUEST", "STAY_REQUEST"] as const;

/** The API's own labels for the request types, used when the reference data cannot be read. */
export const FUNNEL_REQUEST_TYPE_LABELS: Record<string, string> = {
  ENQUIRY: "Enquiry",
  PROPERTY_INFORMATION: "Property information",
  VIEWING_REQUEST: "Viewing request",
  CONSULTATION_REQUEST: "Consultation request",
  STAY_REQUEST: "Request to stay",
};

/** `org=me`: the direct seller's own report (`GET /v1/me/reports/lead-funnel`). */
export const SELLER_TARGET = "me";

export type FunnelFilters = {
  period: FunnelPeriod;
  /** Custom period only: UTC calendar days, both included. */
  from?: string;
  to?: string;
  /** The current assignee's user id (`agent_user_id`). */
  agent?: string;
  /** `listing_id`. */
  listing?: string;
  /** `request_type`. */
  type?: string;
  /** `market_code`, upper case. */
  market?: string;
  /** An organisation id, or `me` for the direct seller's report. */
  org?: string;
};

export type FunnelFilterErrors = { from?: string; to?: string };

type Params = { get(name: string): string | null };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARKET = /^[A-Z]{2}$/;

/** True for a real calendar day written YYYY-MM-DD. */
export function isCalendarDay(value: string | null | undefined): value is string {
  const match = DAY.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const isUuid = (value: string | null | undefined): value is string => UUID.test(value ?? "");

/** `day` moved by `days` (negative goes back). */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included (1 for the same day). */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Today as a UTC calendar day: the API's days are UTC days. */
export const utcToday = (now = new Date()) => now.toISOString().slice(0, 10);

/** Both days are needed, the first on or before the last, the last not after today, and at most 366 days. */
export function checkFunnelDates(from: string | undefined, to: string | undefined, today: string): FunnelFilterErrors {
  const errors: FunnelFilterErrors = {};
  if (!from) errors.from = "Enter the first day.";
  if (!to) errors.to = "Enter the last day.";
  if (from && to && from > to) errors.from = "The first day must be on or before the last day.";
  else if (from && to && daysInclusive(from, to) > MAX_WINDOW_DAYS) errors.to = `Choose at most ${MAX_WINDOW_DAYS} days.`;
  if (to && to > today) errors.to = "The last day cannot be after today.";
  return errors;
}

/**
 * The filters in a page address. Anything the API would refuse is dropped, so
 * the page still loads; chosen dates that do not make a window come back as
 * errors to show under the fields.
 */
export function parseFunnelFilters(params: Params, today: string): { filters: FunnelFilters; errors: FunnelFilterErrors } {
  const rawPeriod = params.get("period") ?? "";
  const period = (FUNNEL_PERIODS as readonly string[]).includes(rawPeriod) ? (rawPeriod as FunnelPeriod) : DEFAULT_FUNNEL_PERIOD;
  const filters: FunnelFilters = { period };
  let errors: FunnelFilterErrors = {};
  if (period === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    if (isCalendarDay(from)) filters.from = from;
    if (isCalendarDay(to)) filters.to = to;
    errors = checkFunnelDates(filters.from, filters.to, today);
  }
  const agent = params.get("agent");
  if (isUuid(agent)) filters.agent = agent.toLowerCase();
  const listing = params.get("listing");
  if (isUuid(listing)) filters.listing = listing.toLowerCase();
  const type = params.get("type") ?? "";
  if ((FUNNEL_REQUEST_TYPES as readonly string[]).includes(type)) filters.type = type;
  const market = (params.get("market") ?? "").trim().toUpperCase();
  if (MARKET.test(market)) filters.market = market;
  const org = params.get("org");
  if (org === SELLER_TARGET || isUuid(org)) filters.org = org === SELLER_TARGET ? org : org.toLowerCase();
  return { filters, errors };
}

/** True when the dates make a window the API accepts. */
export const hasValidWindow = (errors: FunnelFilterErrors) => !errors.from && !errors.to;

/** True when anything narrows the requests beyond the period and whose report it is. */
export const hasNarrowingFunnelFilters = (filters: FunnelFilters) => Boolean(filters.agent || filters.listing || filters.type || filters.market);

/** The page address's query for these filters: "" for the defaults, else "?period=7d&type=ENQUIRY…". */
export function funnelSearch(filters: FunnelFilters): string {
  const search = new URLSearchParams();
  if (filters.org) search.set("org", filters.org);
  if (filters.period !== DEFAULT_FUNNEL_PERIOD) search.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) search.set("from", filters.from);
    if (filters.to) search.set("to", filters.to);
  }
  if (filters.agent) search.set("agent", filters.agent);
  if (filters.listing) search.set("listing", filters.listing);
  if (filters.type) search.set("type", filters.type);
  if (filters.market) search.set("market", filters.market);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** The first and last UTC day of the period: a preset ends today and covers that many days. */
export function funnelWindow(filters: FunnelFilters, today: string): { from: string; to: string } | null {
  if (filters.period === "custom") return filters.from && filters.to ? { from: filters.from, to: filters.to } : null;
  return { from: addDays(today, -(PERIOD_DAYS[filters.period] - 1)), to: today };
}

/**
 * The API query (`?from=…&to=…&agent_user_id=…`), or null while chosen dates
 * are incomplete. `csv` asks for the breakdown tables as a file.
 */
export function funnelApiQuery(filters: FunnelFilters, today: string, format?: "csv"): string | null {
  const window = funnelWindow(filters, today);
  if (!window) return null;
  const search = new URLSearchParams({ from: window.from, to: window.to });
  if (filters.agent && filters.org !== SELLER_TARGET) search.set("agent_user_id", filters.agent);
  if (filters.listing) search.set("listing_id", filters.listing);
  if (filters.type) search.set("request_type", filters.type);
  if (filters.market) search.set("market_code", filters.market);
  if (format) search.set("format", format);
  return `?${search}`;
}

// ---- Numbers in words ------------------------------------------------------------

const counts = new Intl.NumberFormat("en-GB");
export const formatFunnelCount = (value: number | null | undefined) => counts.format(Math.round(value || 0));

/**
 * A duration in minutes as people say it: "Under 1 min", "45 min", "3 h 5 min",
 * "2 days", "2.5 days". Null (nothing to measure) stays null.
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return null;
  const whole = Math.round(minutes);
  if (whole < 1) return "Under 1 min";
  if (whole < 60) return `${whole} min`;
  if (whole < 1440) {
    const hours = Math.floor(whole / 60);
    const rest = whole % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.round((whole / 1440) * 10) / 10;
  return days === 1 ? "1 day" : `${Number.isInteger(days) ? days.toFixed(0) : days.toFixed(1)} days`;
}

/** A duration in days (time to conversion), in the same words. */
export const formatDays = (days: number | null | undefined): string | null =>
  days === null || days === undefined || !Number.isFinite(days) ? null : formatDuration(days * 1440);

/** "0.8333" (or a number) as a fraction 0..1; null when it is missing or not a number. */
export function shareValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** "0.8333" -> "83.3%", "1.0000" -> "100%", "0.0000" -> "0%". Null stays null. */
export function formatShare(value: string | number | null | undefined): string | null {
  const share = shareValue(value);
  if (share === null) return null;
  const percent = Math.round(share * 1000) / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

// ---- The funnel ------------------------------------------------------------------

export type FunnelStepInput = {
  step: string;
  label: string;
  reached: number;
  conversion_from_previous: string | null;
  conversion_from_received: string | null;
  current: number;
};

export type FunnelRow = {
  key: string;
  label: string;
  reached: number;
  /** In this stage now. */
  current: number;
  /** "83.3%", or null for the first step and when the step before reached none. */
  fromPrevious: string | null;
  /** "66.7%", or null when nothing was received. */
  fromReceived: string | null;
  /** Requests that stopped at the step before (never reached this one); null for the first step. */
  lost: number | null;
  /** The bar's width, 0 to 1, against the requests received. */
  width: number;
  /** One line in words: "16 reached · 80% of assigned · 66.7% of received". */
  summary: string;
};

/**
 * A count over a count as a percentage with one decimal, rounded once from the exact
 * counts (the API's 4-place rate rounded again could be off by 0.1: 4 of 21 is 19.0%,
 * not 19.1%). Null when the denominator is 0.
 */
export function formatRatio(part: number, whole: number): string | null {
  if (!whole || whole <= 0 || !Number.isFinite(part)) return null;
  const tenths = Math.round((part * 1000) / whole);
  const percent = tenths / 10;
  return `${tenths % 10 === 0 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

/** The API's steps as shown: the rates in words, the bar widths and what was lost between steps. */
export function funnelRows(steps: FunnelStepInput[], received: number): FunnelRow[] {
  const top = Math.max(0, received || 0, ...steps.map((step) => step.reached || 0));
  return steps.map((step, index) => {
    const reached = Math.max(0, step.reached || 0);
    const previous = index > 0 ? steps[index - 1] : null;
    // Rates from the exact counts; the API's rate strings only when a count is missing.
    const fromPrevious = previous
      ? formatRatio(reached, Math.max(0, previous.reached || 0)) ?? (previous.reached ? formatShare(step.conversion_from_previous) : null)
      : null;
    const fromReceived = received ? formatRatio(reached, received) : formatShare(step.conversion_from_received);
    const parts = [`${formatFunnelCount(reached)} reached`];
    if (previous && fromPrevious) parts.push(`${fromPrevious} of ${previous.label.toLowerCase()}`);
    // The second step's "previous" is received already: say it once.
    if (index > 1 && fromReceived) parts.push(`${fromReceived} of received`);
    return {
      key: step.step,
      label: step.label,
      reached,
      current: Math.max(0, step.current || 0),
      fromPrevious,
      fromReceived,
      lost: previous ? Math.max(0, (previous.reached || 0) - reached) : null,
      width: top > 0 ? reached / top : 0,
      summary: parts.join(" · "),
    };
  });
}

/** One sentence for the chart: from how many received to how many converted. */
export function funnelSentence(rows: FunnelRow[], received: number): string {
  if (!received) return "No requests were received in this period.";
  const last = rows[rows.length - 1];
  const word = received === 1 ? "request" : "requests";
  if (!last) return `${formatFunnelCount(received)} ${word} received.`;
  return `${formatFunnelCount(received)} ${word} received; ${formatFunnelCount(last.reached)} reached ${last.label.toLowerCase()}${last.fromReceived ? ` (${last.fromReceived})` : ""}.`;
}

// ---- Breakdown tables ------------------------------------------------------------

export type SortDirection = "asc" | "desc";

/**
 * Rows sorted by one column. Numbers and 4-place rate strings sort as numbers,
 * text by name; empty values (null) always go last, whichever the direction.
 * Ties keep the API's order.
 */
export function sortRows<T>(rows: T[], value: (row: T) => string | number | null | undefined, direction: SortDirection): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === undefined || a.value === "";
      const bEmpty = b.value === null || b.value === undefined || b.value === "";
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const aNumber = typeof a.value === "number" ? a.value : null;
      const bNumber = typeof b.value === "number" ? b.value : null;
      const order =
        aNumber !== null && bNumber !== null
          ? aNumber - bNumber
          : String(a.value).localeCompare(String(b.value), "en-GB", { sensitivity: "base", numeric: true });
      return order === 0 ? a.index - b.index : order * sign;
    })
    .map((item) => item.row);
}

/** The file name the API's Content-Disposition gives, else the contract's pattern. */
export const funnelCsvName = (from: string, to: string) => `lead-funnel-${from}-to-${to}.csv`;
