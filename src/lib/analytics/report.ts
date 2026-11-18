/**
 * Pure helpers for the analytics pages (API 0.30.0): the period in the
 * address, the chart's scale and bars, the text summary that stands beside
 * the chart, rates and the funnel. Checked by `npm test`
 * (scripts/analytics-report.test.mjs). Nothing here imports from `@/`.
 */

export const PERIODS = ["24h", "7d", "30d", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Choose dates",
};

export const DEFAULT_PERIOD: Period = "30d";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodChoice = { period: Period; from?: string; to?: string };

/** Problems with chosen dates, in the words shown under the fields. */
export type PeriodErrors = { from?: string; to?: string };

/**
 * The period in the address (`?period=7d`, `?period=custom&from=…&to=…`).
 * An unknown period is the default; custom dates are checked against
 * `today` (the viewer's local day, YYYY-MM-DD).
 */
export function parsePeriod(
  params: { period?: string | null; from?: string | null; to?: string | null },
  today: string,
): { choice: PeriodChoice; errors: PeriodErrors } {
  const period = (PERIODS as readonly string[]).includes(params.period ?? "") ? (params.period as Period) : DEFAULT_PERIOD;
  if (period !== "custom") return { choice: { period }, errors: {} };
  const from = DAY.test(params.from ?? "") ? params.from! : undefined;
  const to = DAY.test(params.to ?? "") ? params.to! : undefined;
  return { choice: { period, from, to }, errors: checkDates(from, to, today) };
}

/** Both days are needed, the first on or before the last, and the last not after today. */
export function checkDates(from: string | undefined, to: string | undefined, today: string): PeriodErrors {
  const errors: PeriodErrors = {};
  if (!from) errors.from = "Enter the first day.";
  if (!to) errors.to = "Enter the last day.";
  if (from && to && from > to) errors.from = "The first day must be on or before the last day.";
  if (to && to > today) errors.to = "The last day cannot be after today.";
  return errors;
}

/** The query the API and the page address take: `?period=30d` or `?period=custom&from=…&to=…`. */
export function periodQuery({ period, from, to }: PeriodChoice, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ period });
  if (period === "custom") {
    if (from) query.set("from", from);
    if (to) query.set("to", to);
  }
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  return `?${query}`;
}

// ---- Numbers -------------------------------------------------------------------

const counts = new Intl.NumberFormat("en-GB");
export const formatCount = (value: number) => counts.format(Math.round(value || 0));

/** `part / whole`, or null when there is nothing to divide by. */
export const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

/** "4.2%"; whole numbers lose the decimal ("50%"). Null when there is no rate. */
export function formatRate(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const percent = Math.round(value * 1000) / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

// ---- The chart -------------------------------------------------------------------

/**
 * A rounded top for the value axis and its gridlines: 1, 2 or 5 times a power
 * of ten per step, whole numbers only (these are counts), about `tickCount`
 * steps. Zero data still gets an axis from 0 to `tickCount`.
 */
export function niceScale(maxValue: number, tickCount = 4): { max: number; step: number; ticks: number[] } {
  const target = Math.max(1, tickCount);
  const raw = Math.max(0, maxValue) / target;
  let step = 1;
  if (raw > 1) {
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  }
  const max = maxValue > 0 ? step * Math.ceil(maxValue / step) : step * target;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
  return { max, step, ticks };
}

export type Bar = { x: number; y: number; width: number; height: number };

/**
 * Columns for `values` in a plot `width` by `height`, with `gap` between
 * columns. Columns grow from the baseline (y = height). A value above zero
 * is never drawn less than 2 high, so it is never mistaken for zero.
 */
export function columnLayout(values: number[], { width, height, max, gap = 2 }: { width: number; height: number; max: number; gap?: number }): Bar[] {
  if (values.length === 0 || width <= 0 || height <= 0) return [];
  const slot = width / values.length;
  const barWidth = Math.max(1, slot - Math.min(gap, slot / 2));
  return values.map((value, index) => {
    const clean = Math.max(0, value || 0);
    const scaled = max > 0 ? (clean / max) * height : 0;
    const barHeight = clean > 0 ? Math.max(2, Math.min(height, scaled)) : 0;
    return { x: index * slot + (slot - barWidth) / 2, y: height - barHeight, width: barWidth, height: barHeight };
  });
}

/** The y position of a gridline for `value`. */
export const yFor = (value: number, max: number, height: number) => (max > 0 ? height - (value / max) * height : height);

/** Every calendar day from `from` to `to` (YYYY-MM-DD, both included). At most 400 days. */
export function daysBetween(from: string, to: string): string[] {
  if (!DAY.test(from) || !DAY.test(to) || from > to) return [];
  const days: string[] = [];
  const at = new Date(`${from}T12:00:00Z`);
  while (days.length < 400) {
    const day = at.toISOString().slice(0, 10);
    if (day > to) break;
    days.push(day);
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return days;
}

/**
 * The API's daily rows, with a zero row for any day of the period it left
 * out, in date order. Without `from` and `to`, the rows as they are, sorted.
 */
export function fillDays<T extends { date: string }>(rows: T[], from: string | undefined, to: string | undefined, empty: (date: string) => T): T[] {
  const byDay = new Map(rows.map((row) => [row.date, row]));
  if (!from || !to) return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const days = daysBetween(from, to);
  if (days.length === 0) return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return days.map((day) => byDay.get(day) ?? empty(day));
}

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "12 Nov" for a calendar day. */
export const dayShort = (day: string) => (DAY.test(day) ? shortDay.format(new Date(`${day}T12:00:00Z`)) : day);
/** "12 November 2026" for a calendar day. */
export const dayLong = (day: string) => (DAY.test(day) ? longDay.format(new Date(`${day}T12:00:00Z`)) : day);

/**
 * One sentence that says what the chart shows, for everyone and in place of
 * the picture for screen readers: the total, the days and the busiest day.
 */
export function seriesSummary(days: { date: string; value: number }[], noun: { one: string; many: string }): string {
  if (days.length === 0) return `No ${noun.many} in this period.`;
  const total = days.reduce((sum, day) => sum + Math.max(0, day.value || 0), 0);
  const span = days.length === 1 ? `on ${dayLong(days[0].date)}` : `from ${dayLong(days[0].date)} to ${dayLong(days[days.length - 1].date)}`;
  if (total === 0) return `No ${noun.many} ${span}.`;
  const busiest = days.reduce((best, day) => (day.value > best.value ? day : best), days[0]);
  const word = (n: number) => (n === 1 ? noun.one : noun.many);
  const lead = `${formatCount(total)} ${word(total)} ${span}.`;
  return days.length === 1 ? lead : `${lead} Busiest day: ${dayLong(busiest.date)}, with ${formatCount(busiest.value)} ${word(busiest.value)}.`;
}

// ---- Funnel and breakdowns -------------------------------------------------------

export type FunnelStep = { key: string; label: string; value: number; /** Of the step before; null for the first, or when the step before is 0. */ fromPrevious: number | null; /** Width of the bar, 0 to 1, against the first step. */ share: number };

/** Impressions, then views, contact clicks and enquiries, each with its rate from the step before. */
export function funnel(totals: { impressions: number; views: number; contact_clicks: number; enquiries: number }): FunnelStep[] {
  const steps = [
    { key: "impressions", label: "Seen in lists", value: totals.impressions },
    { key: "views", label: "Listing views", value: totals.views },
    { key: "contact_clicks", label: "Contact clicks", value: totals.contact_clicks },
    { key: "enquiries", label: "Enquiries", value: totals.enquiries },
  ].map((step) => ({ ...step, value: Math.max(0, step.value || 0) }));
  const top = Math.max(...steps.map((step) => step.value), 0);
  return steps.map((step, index) => ({
    ...step,
    fromPrevious: index === 0 ? null : rate(step.value, steps[index - 1].value),
    share: top > 0 ? step.value / top : 0,
  }));
}

/** Rows of a breakdown (sources, devices), largest first, each with its share of the total. */
export function breakdown(rows: { key: string; count: number }[], labels: Record<string, string>): { key: string; label: string; count: number; share: number }[] {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.count || 0), 0);
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({ key: row.key, label: labels[row.key] ?? row.key, count: row.count, share: total > 0 ? row.count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en-GB"));
}

export const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct or unknown",
  search_engine: "Search engines",
  social: "Social media",
  internal: "From RightProperty365",
  email: "Email",
  other: "Other websites",
  server: "Recorded by our servers",
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile: "Phones",
  tablet: "Tablets",
  desktop: "Computers",
  unknown: "Unknown",
};
