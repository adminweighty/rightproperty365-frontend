import { apiFetch } from "@/lib/api/http";
import type { SubscriberKind, SubscriptionPeriod } from "@/lib/api/subscriptions";

/**
 * Renewal invoices (API 0.47.0, BR-015 / FR-037 to FR-040). Finance
 * administrators draft, issue and settle them under /v1/admin/invoices; the
 * payer reads their issued invoices under /v1/me/invoices.
 */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PART_PAID" | "PAID" | "OVERDUE" | "VOID" | "DISPUTED";

export type InvoiceLine = { id: string; description: string; quantity: number; unit_amount: string; amount: string };

export type InvoiceTax = { name: string; rate: string; inclusive: boolean; amount: string; is_sample: boolean };

export type Invoice = {
  id: string;
  /** Null while DRAFT. */
  number: string | null;
  status: InvoiceStatus;
  status_label: string;
  market_code: string;
  currency_code: string;
  payer: { kind: SubscriberKind; id: string; name: string };
  renews_subscription_id: string;
  /** The renewal subscription the invoice pays (set at issue). */
  subscription_id: string | null;
  plan_name: string;
  period: SubscriptionPeriod;
  /** YYYY-MM-DD. `service_to` is exclusive: the period ends the day before. */
  service_from: string;
  service_to: string;
  issue_on: string | null;
  due_on: string;
  terms: string;
  lines: InvoiceLine[];
  subtotal: string;
  tax: InvoiceTax | null;
  total: string;
  amount_paid: string;
  amount_credited: string;
  balance: string;
  void_reason: string | null;
  dispute_reason: string | null;
  replaces_invoice_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD_OFFLINE" | "GATEWAY" | "OTHER";

export type InvoicePayment = {
  id: string;
  receipt_number: string;
  amount: string;
  method: PaymentMethod;
  method_label: string;
  reference: string;
  received_on: string;
  created_at: string;
};

export type CreditNote = { id: string; invoice_id: string; number: string; amount: string; reason: string; created_at: string };

export type InvoiceAction =
  | "edit"
  | "issue"
  | "discard"
  | "record_payment"
  | "resend"
  | "credit_note"
  | "void"
  | "dispute"
  | "resolve_dispute"
  | "reissue";

export type AdminInvoice = Invoice & {
  created_by_name: string;
  send_count: number;
  last_sent_at: string | null;
  payments: InvoicePayment[];
  credit_notes: CreditNote[];
  events: { action: string; actor_type: "ADMIN" | "SYSTEM" | "GATEWAY"; actor_name: string; note: string; at: string }[];
  /** What the caller may do now (empty for read-only roles). */
  actions: InvoiceAction[];
};

export type MyInvoice = Invoice & {
  payments: InvoicePayment[];
  credit_notes: CreditNote[];
  /** The subscription page where it is paid, while payable and the caller may open it. */
  pay_url: string | null;
  /** A payment gateway is on and the invoice can be paid online. */
  pay_online: boolean;
  offline_instructions: string;
};

export type InvoicePage<T> = { items: T[]; page: number; page_size: number; total: number; total_pages: number };

export const INVOICES_PAGE_SIZE = 20;

export type InvoiceFilter = { status?: string; market?: string; q?: string; subscription?: string; page?: number };

function query(f: InvoiceFilter): string {
  const search = new URLSearchParams({ page: String(f.page ?? 1), page_size: String(INVOICES_PAGE_SIZE) });
  if (f.status) search.set("status", f.status);
  if (f.market) search.set("market", f.market);
  if (f.q) search.set("q", f.q);
  if (f.subscription) search.set("subscription", f.subscription);
  return search.toString();
}

export const adminListInvoices = (f: InvoiceFilter) =>
  apiFetch<InvoicePage<Invoice>>(`/v1/admin/invoices?${query(f)}`, { cache: "no-store" });

export const adminGetInvoice = (id: string) => apiFetch<{ invoice: AdminInvoice }>(`/v1/admin/invoices/${id}`, { cache: "no-store" });

export type DraftInput = {
  renews_subscription_id?: string;
  period?: SubscriptionPeriod;
  due_on?: string;
  terms?: string;
  lines?: { description: string; quantity: number; unit_amount: string }[];
};

export const adminCreateInvoice = (input: DraftInput) =>
  apiFetch<{ invoice: AdminInvoice }>("/v1/admin/invoices", { method: "POST", body: input });

export const adminUpdateInvoice = (id: string, input: DraftInput) =>
  apiFetch<{ invoice: AdminInvoice }>(`/v1/admin/invoices/${id}`, { method: "PATCH", body: input });

export const adminDiscardInvoice = (id: string) => apiFetch<null>(`/v1/admin/invoices/${id}`, { method: "DELETE" });

const post = (id: string, action: string, body?: unknown) =>
  apiFetch<{ invoice: AdminInvoice }>(`/v1/admin/invoices/${id}/${action}`, { method: "POST", body: body ?? {} });

export const adminIssueInvoice = (id: string) => post(id, "issue");
export const adminResendInvoice = (id: string) => post(id, "resend");
export const adminRecordInvoicePayment = (id: string, input: { amount: string; method: PaymentMethod; reference: string; received_on: string }) =>
  post(id, "payments", input);
export const adminCreditInvoice = (id: string, input: { amount: string; reason: string }) => post(id, "credit-notes", input);
export const adminVoidInvoice = (id: string, reason: string) => post(id, "void", { reason });
export const adminReissueInvoice = (id: string) => post(id, "reissue");
export const adminDisputeInvoice = (id: string, reason: string) => post(id, "dispute", { reason });
export const adminResolveInvoiceDispute = (id: string, reason: string) => post(id, "resolve-dispute", { reason });

export const listMyInvoices = (page = 1) =>
  apiFetch<InvoicePage<Invoice>>(`/v1/me/invoices?page=${page}&page_size=${INVOICES_PAGE_SIZE}`, { cache: "no-store" });

export const getMyInvoice = (id: string) => apiFetch<{ invoice: MyInvoice }>(`/v1/me/invoices/${id}`, { cache: "no-store" });
