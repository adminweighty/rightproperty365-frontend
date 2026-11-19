/**
 * The rules of online payment of subscription invoices (API 0.42.0, BR-015,
 * FR-037 to FR-040) that are not the API's, as pure functions: when the
 * "Pay online" button shows, the words for a payment's status, what the
 * return page says while it waits for the provider, and the amount an
 * administrator may still refund, in exact decimal arithmetic.
 *
 * Two rules are absolute here:
 * - only the provider's signed webhook activates a subscription. Nothing in
 *   the web app does, and the return page's address (`result=returned`) never
 *   means "paid": only the API's payment status and subscription status do.
 * - money is a decimal string ("30.00"); it is never turned into a float.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests
 * (scripts/online-payment.test.mjs). That is also why it has its own small
 * decimal helpers instead of importing those of src/lib/ledger.ts.
 */

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

// ---- Exact decimals ----------------------------------------------------------------------

const DECIMAL = /^-?\d+(\.\d+)?$/;
/** The API sends two decimals; four leaves room for an older or a stricter answer. */
const SCALE = 4;

function toScaled(amount: string | null | undefined): bigint | null {
  const text = (amount ?? "").trim();
  if (!DECIMAL.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  if (fraction.length > SCALE) return null;
  const value = BigInt(whole + fraction.padEnd(SCALE, "0"));
  return negative ? -value : value;
}

/** A scaled value as a decimal string with two decimals ("30.00"); extra digits that are not zero are kept. */
function fromScaled(value: bigint): string {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(SCALE + 1, "0");
  let fraction = digits.slice(-SCALE);
  while (fraction.length > 2 && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  return `${negative ? "-" : ""}${digits.slice(0, -SCALE)}.${fraction}`;
}

/** `a - b - c ...` exactly, or null when one of them is not a decimal. */
export function subtractDecimals(from: string, ...amounts: readonly string[]): string | null {
  let total = toScaled(from);
  if (total === null) return null;
  for (const amount of amounts) {
    const scaled = toScaled(amount);
    if (scaled === null) return null;
    total -= scaled;
  }
  return fromScaled(total);
}

/** -1, 0 or 1; null when one is not a decimal. */
export function compareDecimals(a: string, b: string): number | null {
  const x = toScaled(a);
  const y = toScaled(b);
  if (x === null || y === null) return null;
  return x === y ? 0 : x < y ? -1 : 1;
}

/** "USD 30.00": the API's digits, padded to two decimals, never rounded through a float. */
export function moneyText(amount: string | null | undefined, currency: string | null | undefined): string {
  const scaled = toScaled(amount);
  const code = currency ?? "";
  if (scaled === null) return `${code} ${amount ?? ""}`.trim();
  const text = fromScaled(scaled);
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${code} ${grouped}.${fraction}`.trim();
}

// ---- When "Pay online" shows ---------------------------------------------------------------

/**
 * Exactly when the API says so (`online_payment_available`), and only while
 * the subscription waits for payment. With `PAYMENT_GATEWAY=none` the flag is
 * false (or absent from an older API), so nothing changes.
 */
export function canPayOnline(subscription: { status?: string | null; online_payment_available?: boolean | null } | null | undefined): boolean {
  return Boolean(subscription && subscription.status === "PENDING_PAYMENT" && subscription.online_payment_available === true);
}

/** Only http(s) addresses are followed: the browser is sent there as a full page. */
export function safeHostedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// ---- Payment statuses ----------------------------------------------------------------------

export const PAYMENT_STATUSES = ["OPEN", "SUCCEEDED", "FAILED", "EXPIRED", "REVIEW", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const STATUS_WORDS: Record<string, { label: string; adminLabel: string; tone: Tone; text: string }> = {
  OPEN: {
    label: "Waiting for the payment provider",
    adminLabel: "Open",
    tone: "info",
    text: "Waiting for the payment provider to confirm the payment.",
  },
  SUCCEEDED: { label: "Paid", adminLabel: "Paid", tone: "success", text: "Paid." },
  FAILED: { label: "Did not go through", adminLabel: "Failed", tone: "danger", text: "The payment did not go through. You can try again." },
  EXPIRED: { label: "Link expired", adminLabel: "Expired", tone: "neutral", text: "This payment link expired. Start a new one." },
  REVIEW: {
    label: "Being checked",
    adminLabel: "Needs review",
    tone: "warning",
    text: "We received a payment we need to check. Our finance team will contact you.",
  },
  PARTIALLY_REFUNDED: { label: "Partly refunded", adminLabel: "Partly refunded", tone: "info", text: "Part of this payment was refunded." },
  REFUNDED: { label: "Refunded", adminLabel: "Refunded", tone: "neutral", text: "Refunded in full." },
};

type StatusPayment = { status: string; refunded_amount?: string | null; currency_code?: string | null };

/** The subscriber's badge: "Paid", "Partly refunded (USD 10.00)", … An unknown status is never shown as paid. */
export function paymentStatusLabel(payment: StatusPayment, audience: "subscriber" | "admin" = "subscriber"): { label: string; tone: Tone } {
  const words = STATUS_WORDS[payment.status];
  if (!words) return { label: payment.status ? wordsFromCode(payment.status) : "Unknown", tone: "neutral" };
  const label = audience === "admin" ? words.adminLabel : words.label;
  if (payment.status === "PARTIALLY_REFUNDED" && payment.refunded_amount) {
    return { label: `${label} (${moneyText(payment.refunded_amount, payment.currency_code)})`, tone: words.tone };
  }
  return { label, tone: words.tone };
}

/** The sentence under a payment for the subscriber. */
export function paymentStatusText(payment: StatusPayment): string {
  if (payment.status === "PARTIALLY_REFUNDED" && payment.refunded_amount) {
    return `${moneyText(payment.refunded_amount, payment.currency_code)} of this payment was refunded.`;
  }
  return STATUS_WORDS[payment.status]?.text ?? "We do not know the state of this payment yet.";
}

export const paymentStatusOptions = () => PAYMENT_STATUSES.map((value) => ({ value, label: STATUS_WORDS[value].adminLabel }));

export const PROVIDER_LABELS: Record<string, string> = { fake: "Test gateway (fake)" };
export const providerLabel = (provider: string | null | undefined) => (provider ? (PROVIDER_LABELS[provider] ?? provider) : "");

function wordsFromCode(code: string): string {
  const words = code.toLowerCase().split(/[_\s-]+/).filter(Boolean).join(" ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : code;
}

// ---- The return page -------------------------------------------------------------------------

/** How often the return page asks again, and for how long at most. */
export const RETURN_POLL_INTERVAL_MS = 2500;
export const RETURN_POLL_LIMIT_MS = 120_000;

export type ReturnState =
  /** The subscription is ACTIVE: "Payment received — your subscription is active". */
  | "paid"
  /** OPEN, or SUCCEEDED but the subscription not yet ACTIVE: "Still confirming…". */
  | "confirming"
  /** Still confirming after the time limit: the page stops asking and says it may take longer. */
  | "slow"
  /** FAILED or EXPIRED: "Payment failed or cancelled — try again". */
  | "failed"
  /** The person left the provider's page ("Cancel and return") and the payment is still OPEN. */
  | "cancelled"
  /** REVIEW: money arrived but did not match; finance checks it. Not activated. */
  | "review"
  /** The payment was refunded since. */
  | "refunded"
  /** No payment of this subscription to show. */
  | "missing";

type ReturnPayment = { id: string; status: string; created_at?: string | null };
type ReturnSubscription = { status: string };

/**
 * The payment the page is about: the one the address names when the API
 * lists it (the address only picks among the API's own payments), otherwise
 * the newest. Never one the API did not return.
 */
export function pickPayment<T extends ReturnPayment>(payments: readonly T[], paymentId?: string | null): T | null {
  if (payments.length === 0) return null;
  const named = paymentId ? payments.find((payment) => payment.id === paymentId) : undefined;
  if (named) return named;
  // The API lists newest first; sort anyway so the fallback does not depend on it.
  return [...payments].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))[0] ?? payments[0];
}

/**
 * What the return page shows, from the API's answers only. `left` is true
 * when the address says `result=cancelled`: it changes the words for an OPEN
 * payment (the person left the provider's page) but never makes anything paid
 * or failed. `elapsedMs` is how long the page has been asking.
 */
export function returnState(input: {
  subscription: ReturnSubscription | null;
  payment: ReturnPayment | null;
  left?: boolean;
  elapsedMs: number;
}): ReturnState {
  const { subscription, payment, left = false, elapsedMs } = input;
  const timedOut = elapsedMs >= RETURN_POLL_LIMIT_MS;
  if (payment?.status === "REVIEW") return "review";
  if (payment?.status === "REFUNDED") return "refunded";
  // ACTIVE is the API's word that the subscription is paid (by this payment, or by a transfer an administrator recorded).
  if (subscription?.status === "ACTIVE") return "paid";
  if (!payment) return "missing";
  switch (payment.status) {
    case "FAILED":
    case "EXPIRED":
      return "failed";
    case "SUCCEEDED":
    case "PARTIALLY_REFUNDED":
      // Paid at the provider, but the subscription the page read is not ACTIVE (yet).
      return timedOut ? "slow" : "confirming";
    case "OPEN":
      if (left) return "cancelled";
      return timedOut ? "slow" : "confirming";
    default:
      return timedOut ? "slow" : "confirming";
  }
}

/** Whether the page asks again: only while the outcome can still change, and within the time limit. */
export function shouldPoll(state: ReturnState, elapsedMs: number): boolean {
  if (elapsedMs >= RETURN_POLL_LIMIT_MS) return false;
  // A cancelled visit is still watched: the payment may yet be confirmed (a webhook already on its way).
  return state === "confirming" || state === "cancelled";
}

export const RETURN_WORDS: Record<ReturnState, { title: string; text: string; tone: "success" | "info" | "warning" | "danger" }> = {
  paid: { title: "Payment received — your subscription is active", text: "Thank you. Your payment is confirmed.", tone: "success" },
  confirming: {
    title: "Still confirming…",
    text: "We are waiting for the payment provider to confirm the payment. This may take a moment. You can stay on this page: it updates by itself.",
    tone: "info",
  },
  slow: {
    title: "Still confirming…",
    text: "The payment provider has not confirmed the payment yet. This can take longer. Do not pay again: your subscription activates as soon as the confirmation arrives, and we email you.",
    tone: "warning",
  },
  failed: { title: "Payment failed or cancelled — try again", text: "No subscription was activated. You can start a new payment, or pay by bank transfer.", tone: "danger" },
  cancelled: {
    title: "Payment failed or cancelled — try again",
    text: "You left the payment page before the payment was confirmed. You can continue to the payment, or pay by bank transfer.",
    tone: "warning",
  },
  review: {
    title: "We received a payment we need to check",
    text: "It did not match the invoice, so the subscription was not activated. Our finance team will contact you. Do not pay again.",
    tone: "warning",
  },
  refunded: { title: "This payment was refunded", text: "See your subscription page for the details.", tone: "info" },
  missing: { title: "We could not find this payment", text: "Open your subscription page to see the invoice and its payments.", tone: "warning" },
};

// ---- Refunds (administrators) ---------------------------------------------------------------------

type RefundablePayment = {
  status: string;
  amount: string;
  currency_code: string;
  refunded_amount?: string | null;
  paid_amount?: string | null;
  paid_currency_code?: string | null;
  created_at?: string | null;
  refunds?: readonly { amount: string; status: string }[] | null;
};

/** The statuses money was taken in. A REVIEW payment can be refunded too (the subscription is left alone). */
const REFUNDABLE = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REVIEW"];

/**
 * What may still be refunded of one payment, exactly: what was paid minus
 * what was refunded and what is waiting for the provider (PENDING refunds).
 * Null when nothing can be refunded. `refunded_amount` is taken to count
 * returned money only; the API checks the limit again in any case.
 */
export function refundableAmount(payment: RefundablePayment): { amount: string; currency: string } | null {
  if (!REFUNDABLE.includes(payment.status)) return null;
  const paid = payment.paid_amount ?? payment.amount;
  const pending = (payment.refunds ?? []).filter((refund) => refund.status === "PENDING").map((refund) => refund.amount);
  const left = subtractDecimals(paid, payment.refunded_amount || "0", ...pending);
  if (left === null || compareDecimals(left, "0") !== 1) return null;
  return { amount: left, currency: payment.paid_currency_code ?? payment.currency_code };
}

/**
 * The payment a refund of the subscription applies to: a paid one first
 * (newest), then one under review. The refund route names the subscription,
 * not the payment, so this is what the form shows and limits to.
 */
export function refundTarget<T extends RefundablePayment>(payments: readonly T[]): (T & { refundable: { amount: string; currency: string } }) | null {
  const ordered = [...payments].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  for (const group of [["SUCCEEDED", "PARTIALLY_REFUNDED"], ["REVIEW"]]) {
    for (const payment of ordered) {
      if (!group.includes(payment.status)) continue;
      const refundable = refundableAmount(payment);
      if (refundable) return { ...payment, refundable };
    }
  }
  return null;
}

/** Why a refund amount cannot be sent, in words, or null. Positive, two decimals at most, no more than what is left. */
export function refundAmountProblem(value: string, max: string, currency: string): string | null {
  const text = value.replace(/\s+/g, "");
  if (!text) return "Enter the amount to refund.";
  if (text.includes(",")) return "Enter the amount without commas, with a full stop for the decimals, for example 30.00.";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "Enter an amount with at most two decimals, for example 30.00.";
  if (compareDecimals(text, "0") !== 1) return "Enter an amount above zero.";
  const over = compareDecimals(text, max);
  if (over === null) return "Enter an amount with at most two decimals, for example 30.00.";
  if (over === 1) return `The most that can be refunded is ${moneyText(max, currency)}.`;
  return null;
}

/** The amount as sent: "030.5" -> "30.50". Only for an amount without a problem. */
export function normaliseRefundAmount(value: string): string {
  const [whole, fraction = ""] = value.replace(/\s+/g, "").split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`;
}

/** Whether this refund would return everything left (which cancels the subscription unless the payment is under review). */
export const isFullRefund = (amount: string, max: string) => compareDecimals(normaliseRefundAmount(amount), max) === 0;

export const REFUND_REASON_MIN = 3;
export const REFUND_REASON_MAX = 1000;

export function refundReasonProblem(value: string): string | null {
  const text = value.trim();
  if (text.length < REFUND_REASON_MIN) return `Write a reason of at least ${REFUND_REASON_MIN} characters.`;
  if (text.length > REFUND_REASON_MAX) return `Use ${REFUND_REASON_MAX} characters or fewer.`;
  return null;
}

/** Plain words for the payment routes' answers, by error code. */
const messages: Record<string, string> = {
  ONLINE_PAYMENT_NOT_OFFERED: "Online payment is not offered at the moment. Pay by bank transfer, quoting the invoice number.",
  CHECKOUT_IN_PROGRESS: "A payment for this invoice is being prepared. Please try again in a moment.",
  PAYMENT_PROVIDER_ERROR: "The payment provider could not be reached. Nothing was charged. Please try again later.",
  SUBSCRIPTION_STATE_CONFLICT: "This invoice is no longer waiting for payment. The page has been loaded again.",
  SUBSCRIPTION_NOT_FOUND: "We could not find that subscription.",
  NO_GATEWAY_PAYMENT: "There is no paid online payment for this subscription. Refund a bank transfer outside the platform: cancel with a refund due.",
  REFUND_EXCEEDS_PAYMENT: "That is more than what is left to refund. The payments have been loaded again.",
};

export const paymentMessage = (failure: { code: string; message: string }) => messages[failure.code] ?? failure.message;
