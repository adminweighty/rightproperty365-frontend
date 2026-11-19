import { apiFetch, apiFetchFile, type ApiResult } from "@/lib/api/http";
import {
  normaliseArrears,
  normaliseDueList,
  normaliseReceipts,
  normaliseStatement,
  statementQuery,
  type ArrearsBlock,
  type DueList,
  type Receipt,
  type StatementBlock,
  type StatementFormat,
} from "@/lib/rent";

/*
 * A tenancy's rent (API 0.36.1, BR-019, FR-047), under the book
 * `/v1/agent/organisations/{id}`: the schedule of dues generated on
 * activation, receipts (each writes a RENT_RECEIVED ledger entry, recorded by
 * the team and not verified), waivers, the tenant statement per currency
 * (JSON, CSV, PDF) and the arrears ageing per currency. Corrections go
 * through the ledger: reversing a receipt's entry undoes its allocations
 * (`reverseEntry` in `lib/api/ledger.ts`). The tenant reads their own dues,
 * receipts and statement under `/v1/me/tenancies/{id}`, read-only.
 *
 * Every answer is read through a tolerant normaliser in `lib/rent.ts`, and
 * every change reads the schedule and receipts again rather than trusting
 * the answer's shape.
 */

const book = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}`;
const tenancy = (orgId: string, id: string) => `${book(orgId)}/tenancies/${encodeURIComponent(id)}`;
const mine = (id: string) => `/v1/me/tenancies/${encodeURIComponent(id)}`;

function mapped<T>(result: ApiResult<unknown>, read: (data: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

export type Span = { from?: string; to?: string };

// ---- The team's ----------------------------------------------------------------------------------------

/** The schedule, oldest due date first, with its summary (one currency, the rent's) and its rule. */
export async function listDues(orgId: string, id: string): Promise<ApiResult<DueList>> {
  return mapped(await apiFetch<unknown>(`${tenancy(orgId, id)}/dues`, { cache: "no-store" }), normaliseDueList);
}

/** Receipts, newest received first, each with its ledger entry and allocations. */
export async function listReceipts(orgId: string, id: string): Promise<ApiResult<Receipt[]>> {
  return mapped(await apiFetch<unknown>(`${tenancy(orgId, id)}/receipts`, { cache: "no-store" }), normaliseReceipts);
}

/**
 * The body comes from `receiptBody`: the rent's currency; no `allocations`
 * means oldest first. Writes the ledger entry in the same transaction.
 */
export const recordReceipt = (orgId: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${tenancy(orgId, id)}/receipts`, { method: "POST", body });

/** Audited `RENT_DUE_WAIVED`. `409 RENT_DUE_NOT_WAIVABLE` when PAID or WAIVED. */
export const waiveDue = (orgId: string, dueId: string, reason: string) =>
  apiFetch<unknown>(`${book(orgId)}/dues/${encodeURIComponent(dueId)}/waive`, { method: "POST", body: { reason } });

export async function getStatement(orgId: string, id: string, span: Span): Promise<ApiResult<StatementBlock[]>> {
  return mapped(await apiFetch<unknown>(`${tenancy(orgId, id)}/statement${statementQuery(span)}`, { cache: "no-store" }), normaliseStatement);
}

export const downloadStatement = (orgId: string, id: string, span: Span, format: Exclude<StatementFormat, "json">) =>
  apiFetchFile(`${tenancy(orgId, id)}/statement${statementQuery(span, format)}`);

/** Ageing per currency (0-30, 31-60, 61-90, 90+) by tenancy, most overdue first; `as_of` defaults to today. */
export async function getArrears(orgId: string, minorUnits?: (currency: string) => number): Promise<ApiResult<ArrearsBlock[]>> {
  return mapped(await apiFetch<unknown>(`${book(orgId)}/arrears`, { cache: "no-store" }), (data) => normaliseArrears(data, minorUnits));
}

// ---- The tenant's own (read-only) ------------------------------------------------------------------------

export async function listMyDues(id: string): Promise<ApiResult<DueList>> {
  return mapped(await apiFetch<unknown>(`${mine(id)}/dues`, { cache: "no-store" }), normaliseDueList);
}

export async function listMyReceipts(id: string): Promise<ApiResult<Receipt[]>> {
  return mapped(await apiFetch<unknown>(`${mine(id)}/receipts`, { cache: "no-store" }), normaliseReceipts);
}

export async function getMyStatement(id: string, span: Span): Promise<ApiResult<StatementBlock[]>> {
  return mapped(await apiFetch<unknown>(`${mine(id)}/statement${statementQuery(span)}`, { cache: "no-store" }), normaliseStatement);
}

export const downloadMyStatement = (id: string, span: Span, format: Exclude<StatementFormat, "json">) =>
  apiFetchFile(`${mine(id)}/statement${statementQuery(span, format)}`);
