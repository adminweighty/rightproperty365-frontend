import { apiFetch, type ApiFailure, type ApiResult } from "@/lib/api/http";
import {
  normaliseProperty,
  normalisePropertyPage,
  normaliseTenancy,
  normaliseTenancyPage,
  type Paged,
  type Property,
  type Tenancy,
  type TenancyPage,
} from "@/lib/tenancies";

/*
 * Properties, units and tenancies (API 0.36.0, BR-019, FR-047), under
 * `/v1/agent/organisations/{orgId}/properties` and `…/tenancies`, keyed by
 * the book (an organisation id, or a direct owner's user id). Another
 * organisation's record is a 404. Tenants read their own tenancies at
 * `/v1/me/tenancies`, read-only, matched by their verified email.
 *
 * The contract fixes the endpoints and request bodies. Every answer is read
 * through a tolerant normaliser in `lib/tenancies.ts` (the record itself or
 * `{property}` / `{tenancy}`, lists as `items` or named), and every change
 * reads the record again rather than trusting the answer's shape.
 */

const book = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}`;
const properties = (orgId: string) => `${book(orgId)}/properties`;
const property = (orgId: string, id: string) => `${properties(orgId)}/${encodeURIComponent(id)}`;
const tenancies = (orgId: string) => `${book(orgId)}/tenancies`;
const tenancy = (orgId: string, id: string) => `${tenancies(orgId)}/${encodeURIComponent(id)}`;

const unexpected: ApiFailure = { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." };

function mapped<T>(result: ApiResult<unknown>, read: (data: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

function required<T>(result: ApiResult<unknown>, read: (data: unknown) => T | null): ApiResult<T> {
  if (!result.ok) return result;
  const data = read(result.data);
  return data === null ? { ok: false, failure: unexpected } : { ok: true, status: result.status, data };
}

// ---- Properties and units ------------------------------------------------------------------------

/** `query` comes from `propertyApiQuery`. */
export async function listProperties(orgId: string, query = ""): Promise<ApiResult<Paged<Property>>> {
  return mapped(await apiFetch<unknown>(`${properties(orgId)}${query}`, { cache: "no-store" }), (data) => normalisePropertyPage(data));
}

export async function getProperty(orgId: string, id: string): Promise<ApiResult<Property>> {
  return required(await apiFetch<unknown>(property(orgId, id), { cache: "no-store" }), normaliseProperty);
}

/** The body comes from `propertyBody`. The answer is the property, or only its id. */
export const createProperty = (orgId: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(properties(orgId), { method: "POST", body });

/** Details from `propertyPatch` (`units` in a PATCH is a 400: they have their own routes). */
export const updateProperty = (orgId: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(property(orgId, id), { method: "PATCH", body });

/** 409 `PROPERTY_IN_USE` while a DRAFT or ACTIVE tenancy uses it. The property is archived, not erased. */
export const deleteProperty = (orgId: string, id: string) => apiFetch<null>(property(orgId, id), { method: "DELETE" });

const unit = (orgId: string, id: string, unitId: string) => `${property(orgId, id)}/units/${encodeURIComponent(unitId)}`;

/** Each answers `{property}`; the page reads the property again either way. */
export const addUnit = (orgId: string, id: string, label: string) =>
  apiFetch<unknown>(`${property(orgId, id)}/units`, { method: "POST", body: { label } });

export const renameUnit = (orgId: string, id: string, unitId: string, label: string) =>
  apiFetch<unknown>(unit(orgId, id, unitId), { method: "PATCH", body: { label } });

/** 409 `UNIT_IN_USE` while a DRAFT or ACTIVE tenancy uses it. */
export const removeUnit = (orgId: string, id: string, unitId: string) => apiFetch<unknown>(unit(orgId, id, unitId), { method: "DELETE" });

// ---- Tenancies -------------------------------------------------------------------------------------

/** `query` comes from `tenancyApiQuery`. */
export async function listTenancies(orgId: string, query = ""): Promise<ApiResult<TenancyPage>> {
  return mapped(await apiFetch<unknown>(`${tenancies(orgId)}${query}`, { cache: "no-store" }), (data) => normaliseTenancyPage(data));
}

export async function getTenancy(orgId: string, id: string): Promise<ApiResult<Tenancy>> {
  return required(await apiFetch<unknown>(tenancy(orgId, id), { cache: "no-store" }), normaliseTenancy);
}

/** The body comes from `tenancyBody`. A new tenancy is a DRAFT. */
export const createTenancy = (orgId: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(tenancies(orgId), { method: "POST", body });

export const activateTenancy = (orgId: string, id: string) =>
  apiFetch<unknown>(`${tenancy(orgId, id)}/activate`, { method: "POST" });

/**
 * Ends an active tenancy on a date, with the reason. It becomes TERMINATED
 * when it ends before an agreed `end_date`, otherwise ENDED; `ended_on` is
 * the date given and `end_date` stays the agreed one.
 */
export const endTenancy = (orgId: string, id: string, input: { end_date: string; reason: string }) =>
  apiFetch<unknown>(`${tenancy(orgId, id)}/end`, { method: "POST", body: input });

/** DRAFT only (409 `TENANCY_INVALID_STATE` otherwise). */
export const deleteTenancy = (orgId: string, id: string) => apiFetch<null>(tenancy(orgId, id), { method: "DELETE" });

// ---- The tenant's own (read-only) -------------------------------------------------------------------

/**
 * `{items}`, newest start date first, not paged. DRAFT tenancies are never
 * shown; an unverified account gets none.
 */
export async function listMyTenancies(): Promise<ApiResult<TenancyPage>> {
  return mapped(await apiFetch<unknown>("/v1/me/tenancies", { cache: "no-store" }), (data) => normaliseTenancyPage(data));
}

export async function getMyTenancy(id: string): Promise<ApiResult<Tenancy>> {
  return required(await apiFetch<unknown>(`/v1/me/tenancies/${encodeURIComponent(id)}`, { cache: "no-store" }), normaliseTenancy);
}
