/**
 * Tax rules per market (BR-001, API 0.43.0): the words, exact rate checks and
 * queries of the admin "Tax rules" pages. Pure functions with no imports, so
 * `npm test` (scripts/tax-rules.test.mjs) runs them directly.
 *
 * Nothing computes tax from these rules yet: they are stored and can be
 * looked up, and the site never shows them to customers.
 */

export const APPLIES_TO = ["SUBSCRIPTIONS", "VENUE_BOOKINGS", "LISTING_FEES"] as const;
export type AppliesTo = (typeof APPLIES_TO)[number];

export const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  SUBSCRIPTIONS: "Subscriptions",
  VENUE_BOOKINGS: "Venue bookings",
  LISTING_FEES: "Listing fees",
};

export const appliesToLabel = (code: string) => APPLIES_TO_LABELS[code as AppliesTo] ?? code;

export const TAX_RULE_STATUSES = ["ACTIVE", "RETIRED"] as const;

export const taxStatusLabel = (status: string) =>
  status === "ACTIVE" ? { label: "Active", tone: "success" as const } : status === "RETIRED" ? { label: "Retired", tone: "neutral" as const } : { label: status, tone: "neutral" as const };

// ---- Rates ----------------------------------------------------------------------------------

/** Digits, then at most four decimals. Never read through a float: the API keeps the rate as a decimal string. */
const RATE = /^(\d+)(?:\.(\d{1,4}))?$/;

/** Why a typed rate is not accepted, or null when it is a percent from 0 to 100 with at most 4 decimals. */
export function rateProblem(text: string): string | null {
  const value = text.trim();
  if (!value) return "Enter the rate as a percent, for example 15 or 12.5.";
  if (/^\d+\.\d{5,}$/.test(value)) return "Use at most 4 decimal places.";
  const match = RATE.exec(value);
  if (!match) return "Enter digits only, with a full stop for decimals: 15 or 12.5 (no % sign).";
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const decimals = match[2] ?? "";
  if (whole.length > 3 || Number(whole) > 100 || (whole === "100" && /[1-9]/.test(decimals))) {
    return "The rate must be from 0 to 100.";
  }
  return null;
}

/** The rate as the API takes it: the typed digits, without leading zeros ("015.50" is "15.50"). Call after `rateProblem`. */
export function normaliseRate(text: string): string {
  const match = RATE.exec(text.trim());
  if (!match) return text.trim();
  const whole = match[1].replace(/^0+(?=\d)/, "");
  return match[2] ? `${whole}.${match[2]}` : whole;
}

/** "15%", "12.5%": the API's digits exactly. */
export const formatRate = (rate: string) => `${rate}%`;

// ---- Dates (UTC days) -----------------------------------------------------------------------

/** "2026-01-01" for a date field, from an RFC 3339 time (its UTC day). "" when absent or unreadable. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toISOString().slice(0, 10);
}

/** "2026-01-01T00:00:00Z" (the start of that UTC day) from a date field. Null when it is not a real date. */
export function fromDateInput(value: string): string | null {
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const at = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== text ? null : `${text}T00:00:00Z`;
}

/** "1 Jan 2026". */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(at);
}

/** "From 1 Jan 2026" or "1 Jan 2026 to 31 Dec 2026" (the end is exclusive, so the last day shown is the day before). */
export function periodText(from: string, to: string | null): string {
  if (!to) return `From ${formatDay(from)}, open-ended`;
  const end = new Date(to);
  if (Number.isNaN(end.getTime())) return `${formatDay(from)} until ${to}`;
  const lastDay = new Date(end.getTime() - 1).toISOString();
  return `${formatDay(from)} to ${formatDay(lastDay)}`;
}

// ---- The form -------------------------------------------------------------------------------

export type TaxRuleDraft = {
  market: string;
  taxName: string;
  rate: string;
  appliesTo: string;
  inclusive: boolean;
  effectiveFrom: string;
  /** "" for open-ended. */
  effectiveTo: string;
  registrationLabel: string;
  notes: string;
  isSample: boolean;
};

export type TaxRuleInput = {
  market_code: string;
  tax_name: string;
  rate: string;
  applies_to: string;
  inclusive: boolean;
  effective_from: string;
  effective_to: string | null;
  registration_number_label: string;
  notes: string;
  is_sample: boolean;
};

export type TaxRuleErrors = Partial<Record<keyof TaxRuleInput, string>>;

/** The body for `POST`/`PATCH /v1/admin/tax-rules`, or the problems to fix first (keyed as the API's `fields`). */
export function validateTaxRule(draft: TaxRuleDraft): { input: TaxRuleInput; errors: TaxRuleErrors } {
  const errors: TaxRuleErrors = {};
  const market = draft.market.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) errors.market_code = "Choose the country.";
  const taxName = draft.taxName.trim();
  if (!taxName) errors.tax_name = "Enter the tax's name, for example VAT.";
  const rate = rateProblem(draft.rate);
  if (rate) errors.rate = rate;
  if (!APPLIES_TO.includes(draft.appliesTo as AppliesTo)) errors.applies_to = "Choose what the tax applies to.";
  const from = fromDateInput(draft.effectiveFrom);
  if (!from) errors.effective_from = "Enter the first day the rule applies.";
  let to: string | null = null;
  if (draft.effectiveTo.trim()) {
    to = fromDateInput(draft.effectiveTo);
    if (!to) errors.effective_to = "Enter a date, or leave it empty for no end.";
    else if (from && to <= from) errors.effective_to = "The end must be after the start.";
  }
  return {
    input: {
      market_code: market,
      tax_name: taxName,
      rate: rate ? draft.rate.trim() : normaliseRate(draft.rate),
      applies_to: draft.appliesTo,
      inclusive: draft.inclusive,
      effective_from: from ?? "",
      effective_to: to,
      registration_number_label: draft.registrationLabel.trim(),
      notes: draft.notes.trim(),
      is_sample: draft.isSample,
    },
    errors,
  };
}

// ---- Queries --------------------------------------------------------------------------------

export type TaxRuleFilters = { market?: string; applies_to?: string; status?: string };

/** The query of `GET /v1/admin/tax-rules`, leaving out empty filters. "" when there are none. */
export function taxRuleFilterQuery(filters: TaxRuleFilters): string {
  const query = new URLSearchParams();
  if (filters.market) query.set("market", filters.market.toUpperCase());
  if (filters.applies_to) query.set("applies_to", filters.applies_to.toUpperCase());
  if (filters.status) query.set("status", filters.status.toUpperCase());
  const text = query.toString();
  return text ? `?${text}` : "";
}

export type LookupQuestion = { market: string; appliesTo: string; /** A date field's value; "" for now. */ date: string };

/**
 * The query of `GET /v1/admin/tax-rules/lookup`, or what to fix. `at` is the
 * start of the chosen UTC day; without a date the API answers for now.
 */
export function lookupQuery(
  question: LookupQuestion,
): { ok: true; query: string } | { ok: false; errors: Partial<Record<"market" | "applies_to" | "at", string>> } {
  const errors: Partial<Record<"market" | "applies_to" | "at", string>> = {};
  const market = question.market.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) errors.market = "Choose the country.";
  if (!APPLIES_TO.includes(question.appliesTo as AppliesTo)) errors.applies_to = "Choose what the tax applies to.";
  let at: string | null = null;
  if (question.date.trim()) {
    at = fromDateInput(question.date);
    if (!at) errors.at = "Enter a date, or leave it empty for today.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const query = new URLSearchParams({ market, applies_to: question.appliesTo });
  if (at) query.set("at", at);
  return { ok: true, query: `?${query.toString()}` };
}
