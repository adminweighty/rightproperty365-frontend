import { apiFetch, type ApiFailure, type ApiResult } from "@/lib/api/http";
import { env } from "@/lib/env";
import {
  normaliseOptions,
  normalisePhoto,
  normaliseProviders,
  normaliseRequest,
  normaliseRequestPage,
  type MaintenanceOptions,
  type MaintenancePage,
  type MaintenancePhoto,
  type MaintenanceRequest,
  statusBody,
  type ProviderRef,
} from "@/lib/maintenance";

/*
 * Maintenance requests (API 0.36.2, BR-019, FR-047), under the book
 * `/v1/agent/organisations/{id}/maintenance`: raised by the team or by the
 * tenant, moved through NEW → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED →
 * CLOSED (or CANCELLED) with every change on the timeline; assigning a
 * service provider sends them a business enquiry quoting the request's
 * reference; a cost writes an EXPENSE ledger entry (category maintenance)
 * linked to the property. Photos are images in private storage, read with
 * the session. The tenant raises and follows their own under
 * `/v1/me/tenancies/{id}/maintenance`, with no status controls.
 *
 * Every answer is read through a tolerant normaliser in `lib/maintenance.ts`,
 * and every change reads the request again rather than trusting the answer.
 */

const book = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}`;
const base = (orgId: string) => `${book(orgId)}/maintenance`;
const one = (orgId: string, id: string) => `${base(orgId)}/${encodeURIComponent(id)}`;
const mine = (tenancyId: string) => `/v1/me/tenancies/${encodeURIComponent(tenancyId)}/maintenance`;
const myOne = (tenancyId: string, id: string) => `${mine(tenancyId)}/${encodeURIComponent(id)}`;

const unexpected: ApiFailure = { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." };

function mapped<T>(result: ApiResult<unknown>, read: (data: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

function required<T>(result: ApiResult<unknown>, read: (data: unknown) => T | null): ApiResult<T> {
  if (!result.ok) return result;
  const data = read(result.data);
  return data === null ? { ok: false, failure: unexpected } : { ok: true, status: result.status, data };
}

// ---- The team's ----------------------------------------------------------------------------------------

/** The reference sets (categories, priorities), the statuses, currencies and write permission. */
export async function getMaintenanceOptions(orgId: string): Promise<ApiResult<MaintenanceOptions>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/options`, { cache: "no-store" }), normaliseOptions);
}

/** `query` comes from `maintenanceApiQuery`. */
export async function listRequests(orgId: string, query = ""): Promise<ApiResult<MaintenancePage>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}${query}`, { cache: "no-store" }), (data) => normaliseRequestPage(data));
}

export async function getRequest(orgId: string, id: string): Promise<ApiResult<MaintenanceRequest>> {
  return required(await apiFetch<unknown>(one(orgId, id), { cache: "no-store" }), normaliseRequest);
}

/** The body comes from `requestBody`. Photos are uploaded one by one afterwards (`uploadRequestPhoto`). */
export const createRequest = (orgId: string, body: Record<string, unknown>) => apiFetch<unknown>(base(orgId), { method: "POST", body });

/**
 * A status change with an optional note (the reason, required for a
 * cancellation). `409 MAINTENANCE_INVALID_TRANSITION` names the moves allowed
 * (`allowedFromConflict`). Answers `{request}`.
 */
export const changeStatus = (orgId: string, id: string, status: string, note = "") =>
  apiFetch<unknown>(`${one(orgId, id)}/status`, { method: "POST", body: statusBody(status, note) });

/** `internal`: a note for the team only, never shown to the tenant. Answers `{item}`. */
export const addComment = (orgId: string, id: string, text: string, internal = false) =>
  apiFetch<unknown>(`${one(orgId, id)}/comments`, { method: "POST", body: { text, internal } });

/**
 * Assigns a service provider from the directory (from NEW, TRIAGED or
 * ASSIGNED). The API sends them one business enquiry from the signed-in
 * manager, quoting the request's reference, category, priority and
 * property, plus `message`; never the title, description, photos or the
 * tenant's details. Idempotent. The body comes from `assignBody`. Answers
 * `{request, enquiry: {id, reference, replayed}}`.
 */
export const assignProvider = (orgId: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${one(orgId, id)}/assign`, { method: "POST", body });

/**
 * Writes the cost and exactly one EXPENSE ledger entry (category
 * maintenance, linked to the property, USER_RECORDED_UNVERIFIED) in one
 * transaction; the body comes from `costBody`. Answers `{cost, request}`.
 * Undoing a cost is a reversal of its ledger entry.
 */
export const recordCost = (orgId: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${one(orgId, id)}/costs`, { method: "POST", body });

/** Verified service providers of the directory matching `q` (at most 25, sponsored first), each with the profile id `assignProvider` takes. */
export async function searchProviders(orgId: string, q: string): Promise<ApiResult<ProviderRef[]>> {
  const search = new URLSearchParams({ q: q.trim().slice(0, 100) });
  return mapped(await apiFetch<unknown>(`${base(orgId)}/providers?${search}`, { cache: "no-store" }), normaliseProviders);
}

export const uploadRequestPhoto = (orgId: string, id: string, file: File, onProgress: (fraction: number) => void) =>
  uploadPhoto(`${one(orgId, id)}/photos`, file, onProgress);

// ---- The tenant's own -----------------------------------------------------------------------------------

/** Categories, priorities and photo rules for the tenant's form. */
export async function getMyMaintenanceOptions(tenancyId: string): Promise<ApiResult<MaintenanceOptions>> {
  return mapped(await apiFetch<unknown>(`${mine(tenancyId)}/options`, { cache: "no-store" }), normaliseOptions);
}

/** Every request linked to the tenant's tenancy (whoever raised it), newest first, never paged. */
export async function listMyRequests(tenancyId: string): Promise<ApiResult<MaintenancePage>> {
  return mapped(await apiFetch<unknown>(mine(tenancyId), { cache: "no-store" }), (data) => normaliseRequestPage(data));
}

export async function getMyRequest(tenancyId: string, id: string): Promise<ApiResult<MaintenanceRequest>> {
  return required(await apiFetch<unknown>(myOne(tenancyId, id), { cache: "no-store" }), normaliseRequest);
}

/** `{category, priority, title, description}`; the tenancy says where. ACTIVE tenancies only (`409 TENANCY_INVALID_STATE`). */
export const createMyRequest = (tenancyId: string, body: Record<string, unknown>) => apiFetch<unknown>(mine(tenancyId), { method: "POST", body });

/** Open requests only (`409 MAINTENANCE_CLOSED`). */
export const addMyComment = (tenancyId: string, id: string, text: string) =>
  apiFetch<unknown>(`${myOne(tenancyId, id)}/comments`, { method: "POST", body: { text } });

export const uploadMyRequestPhoto = (tenancyId: string, id: string, file: File, onProgress: (fraction: number) => void) =>
  uploadPhoto(`${myOne(tenancyId, id)}/photos`, file, onProgress);

// ---- Photos ---------------------------------------------------------------------------------------------

/** A photo's address: the API's own route (relative), with the API's origin in front. It needs the session. */
export function photoSrc(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.apiUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

const uploadMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You cannot add photos to this request.",
  409: "This request can no longer be changed.",
  413: "That photo is larger than 10 MB.",
  415: "Only JPEG, PNG or WebP photos can be added.",
  429: "Too many uploads at once. Please wait a minute and try again.",
};

/**
 * One photo (multipart, one `file` part), reporting progress from 0 to 1.
 * XMLHttpRequest, because `fetch` cannot report how much of a body has been
 * sent (as the application files and ledger attachments do).
 */
function uploadPhoto(path: string, file: File, onProgress: (fraction: number) => void): Promise<ApiResult<MaintenancePhoto | null>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${env.apiUrl}${path}`);
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
        const raw = payload as { photo?: unknown } | null;
        onProgress(1);
        resolve({ ok: true, status: request.status, data: normalisePhoto(raw?.photo ?? raw) });
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
