import { apiFetch, apiFetchFile, type ApiFailure, type ApiResult } from "@/lib/api/http";
import { scanErrorMessage } from "@/lib/file-scan";
import { env } from "@/lib/env";
import {
  checklistBody,
  completeBody,
  findingsBody,
  normaliseInspection,
  normaliseInspectionOptions,
  normaliseInspectionPage,
  normaliseItemPhoto,
  type Checklist,
  type CompleteForm,
  type FindingLine,
  type Inspection,
  type InspectionOptions,
  type InspectionPage,
  type ItemPhoto,
} from "@/lib/inspections";

/*
 * Inspections (API 0.36.3, BR-019, FR-047), under the book
 * `/v1/agent/organisations/{id}/inspections`: move-in, routine and move-out
 * inspections of a property (a unit, a tenancy) at a scheduled time, a
 * checklist copied from a template (areas and items the team may add, rename
 * or remove: `PUT .../checklist`), per item a finding (OK, ATTENTION,
 * DAMAGED, NA) and a note (`PUT .../findings`, partial) and photos in
 * private storage. SCHEDULED -> IN_PROGRESS (start, or the first findings or
 * photo) -> COMPLETED, or CANCELLED; COMPLETED and CANCELLED are frozen
 * (`409 INSPECTION_CLOSED`). The report is a PDF. The tenant reads the
 * completed inspections of their tenancy under
 * `/v1/me/tenancies/{id}/inspections`.
 *
 * Every answer is read through a tolerant normaliser in `lib/inspections.ts`.
 */

const book = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}`;
const base = (orgId: string) => `${book(orgId)}/inspections`;
const one = (orgId: string, id: string) => `${base(orgId)}/${encodeURIComponent(id)}`;
const mine = (tenancyId: string) => `/v1/me/tenancies/${encodeURIComponent(tenancyId)}/inspections`;
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

/** Types, statuses, checklist templates, inspectors, photo rules, limits and write permission. */
export async function getInspectionOptions(orgId: string): Promise<ApiResult<InspectionOptions>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}/options`, { cache: "no-store" }), normaliseInspectionOptions);
}

/** `query` comes from `inspectionApiQuery`. */
export async function listInspections(orgId: string, query = ""): Promise<ApiResult<InspectionPage>> {
  return mapped(await apiFetch<unknown>(`${base(orgId)}${query}`, { cache: "no-store" }), (data) => normaliseInspectionPage(data));
}

export async function getInspection(orgId: string, id: string): Promise<ApiResult<Inspection>> {
  return required(await apiFetch<unknown>(one(orgId, id), { cache: "no-store" }), normaliseInspection);
}

/** The body comes from `inspectionBody` (the scheduled time already in UTC). Answers `201 {inspection}`, SCHEDULED. */
export const createInspection = (orgId: string, body: Record<string, unknown>) => apiFetch<unknown>(base(orgId), { method: "POST", body });

/**
 * Replaces the structure (areas and items, in order): an id keeps an area or
 * item (with its finding and photos), a null id adds one, one left out is
 * removed. Answers `{inspection}` with the new ids. A concurrent change is
 * `409 INSPECTION_CHANGED`.
 */
export async function saveChecklist(orgId: string, id: string, checklist: Checklist): Promise<ApiResult<Inspection | null>> {
  return mapped(await apiFetch<unknown>(`${one(orgId, id)}/checklist`, { method: "PUT", body: checklistBody(checklist) }), normaliseInspection);
}

/** Partial: only the items listed change (`changedFindings`). A SCHEDULED inspection becomes IN_PROGRESS. */
export async function saveFindings(orgId: string, id: string, lines: readonly FindingLine[]): Promise<ApiResult<Inspection | null>> {
  return mapped(await apiFetch<unknown>(`${one(orgId, id)}/findings`, { method: "PUT", body: findingsBody(lines) }), normaliseInspection);
}

/** SCHEDULED -> IN_PROGRESS. */
export async function startInspection(orgId: string, id: string): Promise<ApiResult<Inspection | null>> {
  return mapped(await apiFetch<unknown>(`${one(orgId, id)}/start`, { method: "POST" }), normaliseInspection);
}

/**
 * Freezes the inspection (IN_PROGRESS only) with the summary and the typed
 * sign-off names. An item without a finding is `409 INSPECTION_INCOMPLETE`
 * naming them (`incompleteFromConflict`). The tenants are notified.
 */
export async function completeInspection(orgId: string, id: string, form: CompleteForm): Promise<ApiResult<Inspection | null>> {
  return mapped(await apiFetch<unknown>(`${one(orgId, id)}/complete`, { method: "POST", body: completeBody(form) }), normaliseInspection);
}

/** SCHEDULED or IN_PROGRESS -> CANCELLED, with the reason (1-500). Audited. */
export async function cancelInspection(orgId: string, id: string, reason: string): Promise<ApiResult<Inspection | null>> {
  return mapped(await apiFetch<unknown>(`${one(orgId, id)}/cancel`, { method: "POST", body: { reason: reason.trim() } }), normaliseInspection);
}

/** The report, rendered by the API (the gofpdf stack of the leases); one not completed is marked "Draft" or "Cancelled". */
export const downloadInspectionReport = (orgId: string, id: string) => apiFetchFile(`${one(orgId, id)}/report.pdf`);

/** One photo of a saved item (at most 6 per item, 200 per inspection). A SCHEDULED inspection becomes IN_PROGRESS. */
export const uploadItemPhoto = (orgId: string, id: string, itemId: string, file: File, onProgress: (fraction: number) => void) =>
  uploadPhoto(`${one(orgId, id)}/items/${encodeURIComponent(itemId)}/photos`, file, onProgress);

export const deleteInspectionPhoto = (orgId: string, id: string, photoId: string) =>
  apiFetch<null>(`${one(orgId, id)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" });

// ---- The tenant's own -----------------------------------------------------------------------------------

/** The COMPLETED inspections of the tenant's tenancy, with their checklists, latest completed first, never paged. */
export async function listMyInspections(tenancyId: string): Promise<ApiResult<InspectionPage>> {
  return mapped(await apiFetch<unknown>(mine(tenancyId), { cache: "no-store" }), (data) => normaliseInspectionPage(data));
}

export async function getMyInspection(tenancyId: string, id: string): Promise<ApiResult<Inspection>> {
  return required(await apiFetch<unknown>(myOne(tenancyId, id), { cache: "no-store" }), normaliseInspection);
}

export const downloadMyInspectionReport = (tenancyId: string, id: string) => apiFetchFile(`${myOne(tenancyId, id)}/report.pdf`);

// ---- Photos ---------------------------------------------------------------------------------------------

/** A photo's address: the API's own route (relative), with the API's origin in front. It needs the session. */
export function inspectionPhotoSrc(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.apiUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

const uploadMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You cannot add photos to this inspection.",
  404: "This item is no longer on the checklist.",
  409: "No more photos can be added here, or the inspection can no longer be changed.",
  413: "That photo is larger than 10 MB.",
  415: "Only JPEG, PNG or WebP photos can be added.",
  429: "Too many uploads at once. Please wait a minute and try again.",
};

/**
 * One photo (multipart, one `file` part), reporting progress from 0 to 1.
 * XMLHttpRequest, because `fetch` cannot report how much of a body has been
 * sent (as the maintenance photos do).
 */
function uploadPhoto(path: string, file: File, onProgress: (fraction: number) => void): Promise<ApiResult<ItemPhoto | null>> {
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
        onProgress(1);
        resolve({ ok: true, status: request.status, data: normaliseItemPhoto(payload) });
        return;
      }
      const envelope = payload as { error?: { code?: string; message?: string; fields?: Record<string, string> }; trace_id?: string } | null;
      resolve({
        ok: false,
        failure: {
          code: envelope?.error?.code ?? `HTTP_${request.status}`,
          status: request.status,
          message:
            scanErrorMessage({ code: envelope?.error?.code ?? "", status: request.status }) ??
            envelope?.error?.fields?.file ?? envelope?.error?.message ?? uploadMessages[request.status] ?? "Something went wrong on our side. Please try again.",
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
