/**
 * Words, formats and checks shared by the subscription pages (the
 * professional's own page and the administrators' pages). Pure functions with
 * no imports from the app.
 */

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export const PERIOD_LABELS: Record<string, string> = { QUARTERLY: "Quarterly", YEARLY: "Yearly" };
/** "3 months", "1 year": how long a paid period lasts. */
export const PERIOD_LENGTH: Record<string, string> = { QUARTERLY: "3 months", YEARLY: "1 year" };

export const periodLabel = (period: string) => PERIOD_LABELS[period] ?? period;

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  EXPIRED: { label: "Ended", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** The status as shown: an ACTIVE subscription that starts later is a paid renewal. */
export function subscriptionStatus(sub: { status: string; starts_at: string | null }, now = Date.now()) {
  if (sub.status === "ACTIVE" && sub.starts_at && Date.parse(sub.starts_at) > now) {
    return { label: "Paid, starts later", tone: "info" as Tone };
  }
  return SUBSCRIPTION_STATUS[sub.status] ?? { label: sub.status, tone: "neutral" as Tone };
}

export const SUBSCRIBER_KIND_LABELS: Record<string, string> = { INDIVIDUAL: "A person", ORGANISATION: "An organisation" };

export const FEATURE_LABELS: Record<string, string> = {
  MAX_ACTIVE_LISTINGS: "Active listings",
  MAX_FEATURED_LISTINGS: "Featured listings",
  MAX_TEAM_MEMBERS: "Team members",
};

/** "USD 30.00": an amount (a decimal string) with its currency code, always two decimals. */
export function formatAmount(amount: string, currency: string, locale = "en-GB"): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`.trim();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`.trim();
  }
}

/** A positive amount with at most two decimals, as the API takes it ("30", "30.5", "30.50"). */
export const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]{1,2})?$/;

/** The amount in cents, or null when it is not a valid amount. Exact: no floating point. */
export function toCents(amount: string): number | null {
  const text = amount.trim();
  if (!AMOUNT_PATTERN.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** "16 Nov 2026": a date without a time, in the viewer's time zone. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  // A date-only value ("2026-11-16") is a calendar day: never shift it by a time zone.
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const at = new Date(dayOnly ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", ...(dayOnly ? { timeZone: "UTC" } : {}) }).format(at);
}

/** Today as YYYY-MM-DD in the viewer's time zone (for date inputs). */
export function todayIso(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The API's field messages are fragments ("is required (…)", "must be a
 * date"). Shown under a field they read better with the field's name first.
 */
export function fieldText(label: string, message: string | undefined): string | undefined {
  if (!message) return undefined;
  return /^(is|must|cannot|can|the|a|an|at|each|one|codes)\b/i.test(message) ? `${label} ${message}.`.replace(/\.\.$/, ".") : message;
}

/** Plain words for the answers of the subscription and account routes, by error code. */
const messages: Record<string, string> = {
  PLAN_NOT_ELIGIBLE: "This plan is not offered to your approved roles.",
  NOT_ORGANISATION_OWNER: "Only the principal (owner) of the organisation can take a plan for it.",
  SUBSCRIPTION_PENDING_EXISTS: "There is already a request waiting for payment. Pay that invoice, or withdraw it first.",
  SUBSCRIPTION_ACTIVE_EXISTS: "There is already a subscription in force or paid for later. Renew it when renewal opens.",
  PLAN_NOT_AVAILABLE: "This plan is no longer offered.",
  PRICE_NOT_AVAILABLE: "This plan has no price in that currency for that period.",
  PLAN_NOT_FOUND: "We could not find that plan.",
  PLAN_RETIRED: "This plan was retired, so it cannot be changed.",
  RENEWAL_NOT_OPEN: "Renewal opens 30 days before the end of the current period.",
  SUBSCRIPTION_NOT_FOUND: "We could not find that subscription.",
  SUBSCRIPTION_STATE_CONFLICT: "The subscription has changed since this page loaded. It has been loaded again.",
  PAYMENT_AMOUNT_TOO_LOW: "The amount received must cover the invoice amount.",
  SELF_ACTION_FORBIDDEN: "You cannot do this to your own account.",
  ADMIN_ACCOUNT_PROTECTED: "Only a Super Administrator can act on an administrator's account.",
  USER_STATE_CONFLICT: "The account has changed since this page loaded. It has been loaded again.",
  USER_NOT_FOUND: "We could not find that account.",
  INVALID_PASSWORD: "That password is not right.",
  ADMIN_ACCOUNT_CANNOT_SELF_DELETE: "An administrator account cannot be deleted here. Ask a Super Administrator.",
  REFERENCE_ITEM_EXISTS: "A row with that code already exists. If it is inactive, reactivate it instead.",
  REFERENCE_SET_NOT_EXTENSIBLE: "Rows cannot be added to this set. You can relabel, reorder or deactivate them.",
  REFERENCE_MARKET_FORBIDDEN: "You can only change the rows of your own market.",
  REFERENCE_ITEM_NOT_FOUND: "That row could not be found. The list has been loaded again.",
  RATE_LIMITED: "That was a lot of changes at once. Please wait a minute and try again.",
};

/** The message to show for a failed action. SOLE_OWNER keeps the API's message: it names the organisations. */
export function actionMessage(failure: { code: string; message: string }): string {
  return messages[failure.code] ?? failure.message;
}
