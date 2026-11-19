/**
 * Listing packages and quotas (FR-008, API 0.37.0): the words and formats
 * shared by the package card, the quota messages, the admin package pages
 * and the public pricing page. Pure functions with no imports, so `npm test`
 * (scripts/packages.test.mjs) runs them directly. Whether a listing may go
 * live is always the API's decision; nothing here enforces a quota.
 */

// ---- Prices ---------------------------------------------------------------------------------

const DECIMAL = /^\d+(\.\d+)?$/;

/** How many decimals a price in this currency has (ISO 4217 minor unit): JPY 0, USD 2, KWD 3. */
export function currencyDecimals(currency: string, minorUnit?: number | null): number {
  if (typeof minorUnit === "number" && Number.isInteger(minorUnit) && minorUnit >= 0 && minorUnit <= 4) return minorUnit;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions()
      .maximumFractionDigits;
    return typeof digits === "number" && digits >= 0 && digits <= 4 ? digits : 2;
  } catch {
    return 2;
  }
}

/**
 * "USD 1,250.00": the API's decimal string with its currency code, exactly
 * as given. The digits are only grouped, and padded to the currency's
 * decimals when the API sent fewer; no digit is ever rounded or invented, and
 * there is no floating point. Something that is not a decimal is shown as it
 * came.
 */
export function formatPrice(amount: string | null | undefined, currency: string, minorUnit?: number | null): string {
  const code = (currency || "").toUpperCase();
  if (amount === null || amount === undefined || amount.trim() === "") return `${code} —`.trim();
  const text = amount.trim();
  if (!DECIMAL.test(text)) return `${code} ${text}`.trim();
  const units = currencyDecimals(code || "USD", minorUnit);
  const [rawWhole, rawFraction = ""] = text.split(".");
  const whole = rawWhole.replace(/^0+(?=\d)/, "");
  const fraction = rawFraction.length >= units ? rawFraction : rawFraction.padEnd(units, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${code} ${grouped}${fraction ? `.${fraction}` : ""}`.trim();
}

/**
 * Why a typed price cannot be saved, or null: a positive decimal with at
 * most the currency's decimals, typed with a full stop.
 */
export function priceProblem(value: string, currency: string, minorUnit?: number | null): string | null {
  const text = value.replace(/\s+/g, "");
  if (!text) return "Enter the price, or leave every price of this term empty.";
  if (text.includes(",")) return "Enter the price without commas, with a full stop for the decimals, for example 1250.50.";
  if (text.startsWith("-")) return "Enter a price above zero.";
  if (!DECIMAL.test(text)) return "Enter the price in figures, for example 1250.50.";
  const units = currencyDecimals(currency || "USD", minorUnit);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > units) {
    return units === 0
      ? `${currency} has no decimal places. Enter a whole number.`
      : `${currency} prices have at most ${units} decimal place${units === 1 ? "" : "s"}.`;
  }
  if (whole.replace(/^0+/, "").length > 14) return "That price is too large.";
  if (/^0*$/.test(whole) && /^0*$/.test(fraction)) return "Enter a price above zero.";
  return null;
}

/** The price as sent to the API: spaces removed, leading zeros dropped ("0012.50" is "12.50"). Only for a price without a problem. */
export function normalisePrice(value: string): string {
  const [whole, fraction] = value.replace(/\s+/g, "").split(".");
  const trimmed = whole.replace(/^0+(?=\d)/, "") || "0";
  return fraction !== undefined && fraction !== "" ? `${trimmed}.${fraction}` : trimmed;
}

// ---- Billing terms -------------------------------------------------------------------------

/** The API's terms, in its order. */
export const BILLING_TERMS = [
  { code: "MONTHLY", label: "Monthly", months: 1 },
  { code: "QUARTERLY", label: "Quarterly", months: 3 },
  { code: "ANNUAL", label: "Annual", months: 12 },
] as const;

const PER: Record<string, string> = { MONTHLY: "a month", QUARTERLY: "every 3 months", ANNUAL: "a year" };

/** "MONTHLY" -> "Monthly"; the API's label wins; an unknown code in words. */
export function billingTermLabel(term: string, apiLabel?: string | null): string {
  if (apiLabel) return apiLabel;
  const known = BILLING_TERMS.find((item) => item.code === term);
  if (known) return known.label;
  const words = term.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "a month", "every 3 months", "a year"; from the months for a term this file does not know. */
export function billingTermPer(term: string, months?: number | null): string {
  if (PER[term]) return PER[term];
  if (typeof months === "number" && months > 0) return months === 1 ? "a month" : months === 12 ? "a year" : `every ${months} months`;
  return billingTermLabel(term).toLowerCase();
}

/** "USD 25.00 a month". */
export function priceWithTerm(price: { amount: string; currency: string; billing_term: string; minor_unit?: number | null }, months?: number | null): string {
  return `${formatPrice(price.amount, price.currency, price.minor_unit)} ${billingTermPer(price.billing_term, months)}`;
}

// ---- Usage ----------------------------------------------------------------------------------

const activeListings = (count: number) => (count === 1 ? "1 active listing" : `${count} active listings`);

/** "15 Jan 2027" for a timestamp, in UTC (the API's dates are UTC). */
export function formatUtcDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const at = new Date(dayOnly ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(at);
}

export type UsageLike = {
  basis: string;
  package: { name: string } | null;
  limit: number | null;
  used: number;
  grace_until?: string | null;
};

export type UsageMeter = {
  /** 0 to 100 for the bar; 0 when nothing limits the account. */
  percent: number;
  /** null when there is no limit. */
  remaining: number | null;
  /** "12 of 40 active listings used". */
  usedText: string;
  /** "28 left", "None left", "3 over the limit", "No limit". */
  remainingText: string;
  /** The whole meaning in one sentence, for the meter's accessible name. */
  accessibleText: string;
  /** What it means, in plain words; null when nothing needs saying. */
  explanation: string | null;
  tone: "success" | "warning" | "danger" | "neutral";
  state: "unlimited" | "ok" | "near" | "full" | "over";
};

/**
 * What the used/limit meter shows and says. Near is 80% or more of the
 * limit, full is at it, over is past it (the grace rule: listings already
 * live stay live, new ones wait).
 */
export function usageMeter(usage: UsageLike, audience: "advertiser" | "admin" = "advertiser"): UsageMeter {
  const used = Math.max(0, Math.floor(usage.used));
  const admin = audience === "admin";
  const name = usage.package?.name ? `the ${usage.package.name} package` : admin ? "their package" : "your package";
  const they = admin ? "They" : "You";
  const their = admin ? "they" : "you";
  if (usage.limit === null || usage.limit === undefined || usage.basis === "NONE") {
    return {
      percent: 0,
      remaining: null,
      usedText: `${activeListings(used)}, no limit`,
      remainingText: "No limit",
      accessibleText: `${activeListings(used)}. No listing limit applies in this country.`,
      explanation: "No listing limit applies in this country.",
      tone: "neutral",
      state: "unlimited",
    };
  }
  const limit = Math.max(0, Math.floor(usage.limit));
  const remaining = Math.max(0, limit - used);
  const percent = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const state: UsageMeter["state"] = used > limit ? "over" : used >= limit ? "full" : used / limit >= 0.8 ? "near" : "ok";
  const over = used - limit;
  const usedText = `${used} of ${limit} active listing${limit === 1 ? "" : "s"} used`;
  const remainingText = state === "over" ? `${over} over the limit` : remaining === 0 ? "None left" : `${remaining} left`;
  let explanation: string | null = null;
  if (state === "full") {
    explanation = `${they} are at the limit of ${name}. ${they} can still submit listings, but new ones can only go live when a live listing is archived or expires.`;
  } else if (state === "over") {
    const by = usage.grace_until ? ` If nothing changes, that will be by ${formatUtcDay(usage.grace_until)}.` : "";
    explanation = `${they} have more live listings than ${name} allows, because the limit was lowered or a package ended. The listings already live stay live until they expire or ${their} archive them. New listings can go live once fewer than ${limit} are live.${by}`;
  } else if (state === "near") {
    explanation = `${they} are close to the limit of ${name}.`;
  }
  return {
    percent,
    remaining,
    usedText,
    remainingText,
    accessibleText:
      state === "over"
        ? `${used} active listings on ${name}, which allows ${limit}: ${over} over the limit.`
        : `${usedText} on ${name}. ${remaining === 0 ? "None" : remaining} left.`,
    explanation,
    tone: state === "over" || state === "full" ? "danger" : state === "near" ? "warning" : "success",
    state,
  };
}

/** Words for where a market's package comes from. */
export function usageBasisText(basis: string): string {
  switch (basis) {
    case "ASSIGNED":
      return "Assigned to you";
    case "DEFAULT":
      return "The standard package in this country";
    default:
      return "No package";
  }
}

// ---- The quota error ------------------------------------------------------------------------

export const QUOTA_REACHED = "LISTING_QUOTA_REACHED";

export type QuotaDetails = { used: number | null; limit: number | null; packageName: string | null; marketCode: string | null; accountName: string | null };

/** The figures of a 409 LISTING_QUOTA_REACHED (`error.details`), read with care: anything missing is null. */
export function quotaDetails(body: unknown): QuotaDetails {
  const error = (body as { error?: { details?: Record<string, unknown> } } | null)?.error;
  const details = (error?.details ?? {}) as Record<string, unknown>;
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const pkg = details.package as { name?: unknown } | undefined;
  const account = details.account as { name?: unknown } | undefined;
  return {
    used: number(details.used),
    limit: number(details.limit),
    packageName: typeof pkg?.name === "string" ? pkg.name : null,
    marketCode: typeof details.market_code === "string" ? details.market_code : null,
    accountName: typeof account?.name === "string" ? account.name : null,
  };
}

/**
 * For the advertiser: "You have used 20 of 20 published listings on the
 * Starter package. Archive (unpublish) one of them, or ask us about a bigger
 * package." There is no pause action in the API, so the way to free a slot
 * is to archive a live listing.
 */
export function quotaReachedMessage(details: Partial<Pick<QuotaDetails, "used" | "limit" | "packageName">> = {}): string {
  const { used, limit, packageName } = details;
  const name = packageName?.trim() ? `the ${packageName.trim()} package` : "your package";
  const tail = "Archive (unpublish) one of your live listings, or ask us about a bigger package.";
  if (typeof used === "number" && typeof limit === "number") {
    return `You have used ${used} of ${limit} published listing${limit === 1 ? "" : "s"} on ${name}. ${tail}`;
  }
  return `You have used every published listing on ${name}. ${tail}`;
}

/** For a reviewer whose approval was refused. */
export function quotaReachedReviewerMessage(details: Partial<QuotaDetails> = {}): string {
  const { used, limit, packageName, accountName } = details;
  const who = accountName?.trim() || "The advertiser";
  const name = packageName?.trim() ? `the ${packageName.trim()} package` : "their package";
  const figures =
    typeof used === "number" && typeof limit === "number"
      ? `has used ${used} of ${limit} published listing${limit === 1 ? "" : "s"}`
      : "has used every published listing";
  return `${who} ${figures} on ${name}, so this listing cannot be approved now. It stays waiting for review. It can be approved when one of their live listings is archived or expires, or when their package changes.`;
}

// ---- Admin ----------------------------------------------------------------------------------

/** A package code as the API takes it: upper case, a letter first, 2 to 32 characters. */
export const PACKAGE_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;

/** Plain words for the package routes' answers, by error code. */
const messages: Record<string, string> = {
  PACKAGE_CODE_TAKEN: "Another package in this country already has that code.",
  PACKAGE_IN_USE: "This package has been assigned to an account, so it cannot be deleted. Deactivate it instead.",
  PACKAGE_IS_DEFAULT: "This is the country's default package. Make another package the default first.",
  PACKAGE_INACTIVE: "This package is not active, so it cannot be assigned.",
  PACKAGE_MARKET_FORBIDDEN: "You can only manage packages of your own countries.",
  PACKAGE_NOT_FOUND: "We could not find that package.",
  PACKAGE_ASSIGNMENT_NOT_FOUND: "There is no current or scheduled package to end in that country.",
  PACKAGE_ACCOUNT_NOT_FOUND: "We could not find that listing account.",
  ORGANISATION_NOT_FOUND: "We could not find that organisation.",
  USER_NOT_FOUND: "We could not find that account.",
  MARKET_NOT_FOUND: "We could not find that country.",
};

export function packageMessage(failure: { code: string; message: string }): string {
  return messages[failure.code] ?? failure.message;
}

export const ASSIGNMENT_STATUS: Record<string, { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  CURRENT: { label: "Current", tone: "success" },
  SCHEDULED: { label: "Starts later", tone: "info" },
  ENDED: { label: "Ended", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "warning" },
};

/** "19 Nov 2026 to 18 Nov 2027", "From 19 Nov 2026, open-ended". */
export function assignmentDates(startsOn: string, endsOn: string | null): string {
  return endsOn ? `${formatUtcDay(startsOn)} to ${formatUtcDay(endsOn)}` : `From ${formatUtcDay(startsOn)}, open-ended`;
}

/** Today as YYYY-MM-DD in UTC (the API compares assignment dates with the UTC date). */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Why the assignment dates cannot be saved, or null. */
export function assignmentDatesProblem(startsOn: string, endsOn: string, today = todayUtc()): { field: "starts_on" | "ends_on"; message: string } | null {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (startsOn && !day.test(startsOn)) return { field: "starts_on", message: "Enter the start date as a date." };
  if (startsOn && startsOn < today) return { field: "starts_on", message: "The start date cannot be in the past." };
  if (endsOn && !day.test(endsOn)) return { field: "ends_on", message: "Enter the end date as a date." };
  if (endsOn && endsOn < (startsOn || today)) return { field: "ends_on", message: "The end date must be on or after the start date." };
  return null;
}

/** The pricing page of a country. */
export const pricingPath = (country: string) => `/pricing/${country.toLowerCase()}`;
