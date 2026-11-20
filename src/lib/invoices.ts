/**
 * Wording and small calculations of the renewal invoices (API 0.47.0) shared
 * by the finance screens and the payer's pages. Pure, so `npm test` checks it
 * (scripts/invoices.test.mjs).
 */

export type Tone = "info" | "primary" | "success" | "accent" | "neutral" | "warning" | "danger";

export const INVOICE_STATUS_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  ISSUED: "info",
  PART_PAID: "primary",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
  DISPUTED: "warning",
};

/** The finance tabs, what needs attention first. "All" has no status. */
export const INVOICE_TABS: { key: string; label: string; status?: string }[] = [
  { key: "open", label: "Unpaid", status: "ISSUED,PART_PAID,OVERDUE" },
  { key: "OVERDUE", label: "Overdue", status: "OVERDUE" },
  { key: "DRAFT", label: "Drafts", status: "DRAFT" },
  { key: "PAID", label: "Paid", status: "PAID" },
  { key: "DISPUTED", label: "Disputed", status: "DISPUTED" },
  { key: "VOID", label: "Void", status: "VOID" },
  { key: "all", label: "All" },
];

/** The last day of a service period whose end is exclusive ("2027-03-01" -> "2027-02-28"). */
export function lastDay(serviceTo: string): string {
  const at = new Date(`${serviceTo}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return serviceTo;
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}

/** A tax rate without trailing decimal zeros: "15.0000" -> "15", "12.5000" -> "12.5", "10" -> "10". */
export function rateText(rate: string): string {
  if (!rate.includes(".")) return rate;
  return rate.replace(/0+$/, "").replace(/\.$/, "");
}

/** The tax line's label: "VAT 15%", "VAT 15% (included)". */
export function taxLabel(tax: { name: string; rate: string; inclusive: boolean }): string {
  return `${tax.name} ${rateText(tax.rate)}%${tax.inclusive ? " (included)" : ""}`;
}

/** Offline payment methods an administrator records. */
export const OFFLINE_METHODS: { value: "BANK_TRANSFER" | "CASH" | "CARD_OFFLINE" | "OTHER"; label: string }[] = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD_OFFLINE", label: "Card (offline terminal)" },
  { value: "OTHER", label: "Other" },
];

const ACTION_LABELS: Record<string, string> = {
  edit: "Edit draft",
  issue: "Issue and email",
  discard: "Discard draft",
  record_payment: "Record a payment",
  resend: "Email again",
  credit_note: "Credit note",
  void: "Void",
  dispute: "Mark disputed",
  resolve_dispute: "Resolve dispute",
  reissue: "Reissue as a new draft",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const EVENT_WORDS: Record<string, string> = {
  CREATED: "Draft created",
  EDITED: "Draft edited",
  ISSUED: "Issued and emailed",
  RESENT: "Emailed again",
  PAYMENT_RECORDED: "Payment recorded",
  CREDIT_NOTE: "Credit note",
  OVERDUE: "Became overdue",
  VOIDED: "Voided",
  DISPUTED: "Marked disputed",
  DISPUTE_RESOLVED: "Dispute resolved",
  REISSUED: "Reissued",
  PAID: "Paid in full",
};

export function eventLabel(action: string): string {
  return EVENT_WORDS[action] ?? action;
}

/** The plain-language message for the API's invoice errors, or null for others. */
export function invoiceErrorText(code: string): string | null {
  switch (code) {
    case "INVOICE_OVERPAYMENT":
      return "That is more than what is due on this invoice.";
    case "INVOICE_HAS_PAYMENTS":
      return "This invoice has payments, so it cannot be voided. Issue a credit note instead.";
    case "INVOICE_RESEND_TOO_SOON":
      return "This invoice was emailed less than 10 minutes ago.";
    case "RENEWAL_EXISTS":
      return "This subscriber already has a renewal waiting for payment or paid. Cancel it first, or wait until it starts.";
    case "SUBSCRIPTION_NOT_INVOICEABLE":
      return "This subscription is not active and did not end in the last 90 days, so it cannot be renewed by an invoice.";
    case "PRICE_NOT_AVAILABLE":
      return "The plan has no price for this currency and period.";
    case "INVOICE_STATE_CONFLICT":
      return "The invoice changed in the meantime. Reload it and try again.";
    default:
      return null;
  }
}

/** The payer's one-line explanation of a status. */
export function payerStatusText(status: string, dueOn: string, formatDay: (iso: string) => string): string {
  switch (status) {
    case "ISSUED":
      return `Due on ${formatDay(dueOn)}.`;
    case "PART_PAID":
      return `Partly paid. The rest is due on ${formatDay(dueOn)}.`;
    case "OVERDUE":
      return `Overdue: it was due on ${formatDay(dueOn)}.`;
    case "PAID":
      return "Paid. Thank you.";
    case "VOID":
      return "Cancelled. Nothing is due on this invoice.";
    case "DISPUTED":
      return "Under review by our finance team.";
    default:
      return "";
  }
}

/** Today in the browser, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
