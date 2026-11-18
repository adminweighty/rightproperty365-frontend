import { env } from "@/lib/env";
import { apiFetch, apiFetchFile, type ApiFailure, type ApiResult } from "@/lib/api/http";
import {
  normaliseAttachment,
  normaliseCashbook,
  normaliseCategories,
  normaliseCategoriesReport,
  normaliseEntryDetail,
  normaliseOptions,
  normaliseEntryPage,
  normaliseReceivables,
  normaliseStatement,
  type CashbookCurrency,
  type CategoriesCurrency,
  type EntryAttachment,
  type EntryPage,
  type LedgerCategory,
  type EntryDetail,
  type LedgerOptions,
  type ReceivablesCurrency,
  type StatementCurrency,
  type LinkedThing,
} from "@/lib/ledger";

/*
 * An organisation's own books (API 0.34.0, FR-026 to FR-029), under
 * `/v1/agent/organisations/{orgId}/ledger`. A cashbook, not double-entry.
 * Private to the organisation and separate from the platform's subscription
 * invoices. Entries are posted at once and never edited or deleted: a
 * mistake is reversed, or corrected (a reversal and a new entry, in one
 * transaction). Every total is per currency. Another organisation's book is
 * 404 `BOOK_NOT_FOUND`.
 *
 * The contract fixes the endpoints and request bodies. Every answer is read
 * through a tolerant normaliser in `lib/ledger.ts` (the entry itself or
 * `{entry}`, lists as `items` or `entries`, report blocks as `currencies`, a
 * list or a map), and every change reads the entry again rather than trusting
 * an answer's shape.
 */

const base = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}/ledger`;
const one = (orgId: string, id: string) => `${base(orgId)}/entries/${encodeURIComponent(id)}`;

const unexpected: ApiFailure = { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." };

function mapped<T>(result: ApiResult<unknown>, read: (data: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

function required<T>(result: ApiResult<unknown>, read: (data: unknown) => T | null): ApiResult<T> {
  if (!result.ok) return result;
  const data = read(result.data);
  return data === null ? { ok: false, failure: unexpected } : { ok: true, status: result.status, data };
}

/** `query` comes from `ledgerFiltersApiQuery`. */
export async function listEntries(orgId: string, query = ""): Promise<ApiResult<EntryPage>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/entries${query}`, { cache: "no-store" }), (data) => normaliseEntryPage(data));
}

/** `{entry, notes, attachments, related}`; the notes and attachments are put on the entry. */
export async function getEntry(orgId: string, id: string): Promise<ApiResult<EntryDetail>> {
  return required(await apiFetch<unknown>(one(orgId, id), { cache: "no-store" }), normaliseEntryDetail);
}

/** Everything the form’s SearchableSelects need: types with their fixed direction, currencies with minor units, categories, branches, permissions. */
export async function getLedgerOptions(orgId: string): Promise<ApiResult<LedgerOptions>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/options`, { cache: "no-store" }), normaliseOptions);
}

/** Posts at once. A TRANSFER answers with its OUT/IN pair; the raw answer is returned so the page can open the right one. */
export const createEntry = (orgId: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${base(orgId)}/entries`, { method: "POST", body });

/** A REVERSAL entry with the opposite sign; the original is marked `reversed_by`. Both stay visible. `{entry: the reversal, created, updated}`. */
export const reverseEntry = (orgId: string, id: string, reason: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/reverse`, { method: "POST", body: { reason } });

/** Reverses the original and posts the corrected entry, linked to both, in one transaction. */
export const correctEntry = (orgId: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${one(orgId, id)}/correct`, { method: "POST", body });

/** RECONCILED means the organisation marked it reconciled against its own statement. Audited. */
export const reconcileEntry = (orgId: string, id: string, reconciled: boolean, note?: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/reconcile`, { method: "POST", body: note ? { reconciled, note } : { reconciled } });

/** Append-only remarks. */
export const addEntryNote = (orgId: string, id: string, text: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/notes`, { method: "POST", body: { text } });

const uploadMessages: Record<number, string> = {
  413: "That file is larger than 10 MB.",
  415: "That file type is not accepted. Choose a PDF, JPEG, PNG or WebP file.",
  429: "Too many uploads at once. Please wait a minute and try again.",
};

/**
 * A multipart upload (`file`) of a PDF, JPEG, PNG or WebP of up to 10 MB,
 * with progress from 0 to 1. XMLHttpRequest, because `fetch` cannot report
 * how much of a body has been sent (as the application files do).
 */
export function uploadEntryAttachment(
  orgId: string,
  id: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<EntryAttachment | null>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${env.apiUrl}${one(orgId, id)}/attachments`);
    request.withCredentials = true;
    request.responseType = "text";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onerror = () =>
      resolve({ ok: false, failure: { code: "NETWORK_ERROR", status: 0, message: "We could not reach RightProperty365. Check your connection and try again." } });
    request.onload = () => {
      let payload: unknown = null;
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        payload = null;
      }
      if (request.status >= 200 && request.status < 300) {
        const raw = payload as { attachment?: unknown } | null;
        onProgress(1);
        resolve({ ok: true, status: request.status, data: normaliseAttachment(raw?.attachment ?? raw) });
        return;
      }
      const envelope = payload as { error?: { code?: string; message?: string; fields?: Record<string, string> }; trace_id?: string } | null;
      resolve({
        ok: false,
        failure: {
          code: envelope?.error?.code ?? `HTTP_${request.status}`,
          status: request.status,
          message: envelope?.error?.fields?.file ?? envelope?.error?.message ?? uploadMessages[request.status] ?? "Something went wrong on our side. Please try again.",
          fields: envelope?.error?.fields,
          traceId: envelope?.trace_id,
          body: payload ?? undefined,
        },
      });
    };
    const body = new FormData();
    body.append("file", file, file.name);
    request.send(body);
  });
}

/** Through the API only, audited. */
export const downloadEntryAttachment = (orgId: string, id: string, attachmentId: string) =>
  apiFetchFile(`${one(orgId, id)}/attachments/${encodeURIComponent(attachmentId)}`);

// ---- Categories -------------------------------------------------------------------------------

export async function listCategories(orgId: string): Promise<ApiResult<LedgerCategory[]>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/categories`, { cache: "no-store" }), normaliseCategories);
}

/** The code is made by the API from the label. `kind` IN, OUT or ANY. */
export const createCategory = (orgId: string, input: { label: string; kind: "IN" | "OUT" | "ANY" }) =>
  apiFetch<unknown>(`${base(orgId)}/categories`, { method: "POST", body: input });

/** Rename, deactivate or activate again. A category in use is never deleted. */
export const updateCategory = (orgId: string, code: string, patch: { label?: string; active?: boolean }) =>
  apiFetch<unknown>(`${base(orgId)}/categories/${encodeURIComponent(code)}`, { method: "PATCH", body: patch });

// ---- Reports, each per currency -----------------------------------------------------------------

const reportQuery = (values: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
};

export type ReportSpan = { from?: string; to?: string };

export async function getCashbook(orgId: string, span: ReportSpan & { currency?: string; byMethod?: boolean }): Promise<ApiResult<CashbookCurrency[]>> {
  const query = reportQuery({ from: span.from, to: span.to, currency: span.currency, by: span.byMethod ? "method" : undefined });
  return mapped(await apiFetch<unknown>(`${base(orgId)}/reports/cashbook${query}`, { cache: "no-store" }), normaliseCashbook);
}

export async function getCategoriesReport(orgId: string, span: ReportSpan & { currency?: string }): Promise<ApiResult<CategoriesCurrency[]>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/reports/categories${reportQuery({ ...span })}`, { cache: "no-store" }), normaliseCategoriesReport);
}

export async function getStatement(
  orgId: string,
  contactId: string,
  span: ReportSpan,
): Promise<ApiResult<{ contact: LinkedThing | null; currencies: StatementCurrency[] }>> {
  const query = reportQuery({ contact_id: contactId, ...span });
  return mapped(await apiFetch<unknown>(`${base(orgId)}/reports/statement${query}`, { cache: "no-store" }), normaliseStatement);
}

/** `side` RECEIVABLE (owed to you, the default) or PAYABLE (owed by you); `as_of` defaults to today. */
export async function getReceivables(
  orgId: string,
  options: { side?: "RECEIVABLE" | "PAYABLE"; asOf?: string; currency?: string } = {},
): Promise<ApiResult<ReceivablesCurrency[]>> {
  const query = reportQuery({ side: options.side, as_of: options.asOf, currency: options.currency });
  return mapped(await apiFetch<unknown>(`${base(orgId)}/reports/receivables${query}`, { cache: "no-store" }), normaliseReceivables);
}

export type ExportReport = "cashbook" | "entries" | "categories" | "statement";

/** OWNER and MANAGER only, audited. A CSV with `Content-Disposition`. */
export const exportReport = (orgId: string, report: ExportReport, values: Record<string, string | undefined> = {}) =>
  apiFetchFile(`${base(orgId)}/reports/export.csv${reportQuery({ report, ...values })}`);
