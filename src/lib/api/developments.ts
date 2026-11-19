import { apiFetch } from "@/lib/api/http";
import type { InboxBusinessEnquiry } from "@/lib/api/agent";
import { uploadPhotoFile } from "@/lib/api/manage-listings";
import type { DevelopmentStatusCode, ManagedDevelopment } from "@/lib/developments";

/**
 * Browser clients for development projects (API 0.44.0): the developer's side
 * under `/v1/agent/organisations/{id}/developments` and the review queue
 * under `/v1/admin/developments`. Every call carries the session cookie and
 * is `no-store`; the API decides who may do what and says so in `actions`.
 */

/** PATCH sends only what changes; null clears. Unknown keys are refused (400). */
export type DevelopmentFields = Partial<{
  name: string;
  slug: string;
  /** Create only. */
  market: string;
  status: DevelopmentStatusCode;
  completion_estimate: string | null;
  summary: string;
  description: string;
  city: string | null;
  suburb: string | null;
  city_name: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: "EXACT" | "APPROXIMATE";
  amenities: string[];
  investment_highlights: { label: string; value: string }[];
  youtube_url: string | null;
}>;

export type PhaseFields = Partial<{
  name: string;
  status: DevelopmentStatusCode;
  completion_estimate: string | null;
  position: number;
}>;

export type UnitTypeFields = Partial<{
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_min_m2: number | null;
  size_max_m2: number | null;
  price_on_request: boolean;
  /** Decimal strings, never numbers. */
  price_from: string | null;
  price_to: string | null;
  currency: string | null;
  units_total: number | null;
  units_available: number | null;
  position: number;
  /** Moves the unit type to another phase. */
  phase_id: string;
}>;

type Envelope = { development: ManagedDevelopment };

const base = (organisationId: string) => `/v1/agent/organisations/${encodeURIComponent(organisationId)}/developments`;
const one = (organisationId: string, id: string) => `${base(organisationId)}/${encodeURIComponent(id)}`;
const noStore = { cache: "no-store" as const };

export const listDevelopments = (organisationId: string) =>
  apiFetch<{ items: ManagedDevelopment[] }>(base(organisationId), noStore);

/** 409 `NO_DEVELOPER_PROFILE` when the organisation has no developer profile yet. */
export const createDevelopment = (organisationId: string, fields: DevelopmentFields) =>
  apiFetch<Envelope>(base(organisationId), { method: "POST", body: fields });

export const getDevelopment = (organisationId: string, id: string) => apiFetch<Envelope>(one(organisationId, id), noStore);

/** 409 `DEVELOPMENT_LOCKED` while waiting for review or published; 409 `DEVELOPMENT_SLUG_TAKEN`. */
export const updateDevelopment = (organisationId: string, id: string, fields: DevelopmentFields) =>
  apiFetch<Envelope>(one(organisationId, id), { method: "PATCH", body: fields });

/** 204. Not while waiting for review or published. */
export const deleteDevelopment = (organisationId: string, id: string) =>
  apiFetch<null>(one(organisationId, id), { method: "DELETE" });

/** DRAFT or REJECTED to PENDING_REVIEW; 422 `DEVELOPMENT_INCOMPLETE` names what is missing in `fields`. */
export const submitDevelopment = (organisationId: string, id: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/submit`, { method: "POST" });

/** PENDING_REVIEW or PUBLISHED back to DRAFT. */
export const withdrawDevelopment = (organisationId: string, id: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/withdraw`, { method: "POST" });

export const createPhase = (organisationId: string, id: string, fields: PhaseFields) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/phases`, { method: "POST", body: fields });

export const updatePhase = (organisationId: string, id: string, phaseId: string, fields: PhaseFields) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/phases/${encodeURIComponent(phaseId)}`, { method: "PATCH", body: fields });

/** Its unit types go too. */
export const deletePhase = (organisationId: string, id: string, phaseId: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/phases/${encodeURIComponent(phaseId)}`, { method: "DELETE" });

export const createUnitType = (organisationId: string, id: string, phaseId: string, fields: UnitTypeFields) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/phases/${encodeURIComponent(phaseId)}/unit-types`, {
    method: "POST",
    body: fields,
  });

export const updateUnitType = (organisationId: string, id: string, unitTypeId: string, fields: UnitTypeFields) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/unit-types/${encodeURIComponent(unitTypeId)}`, { method: "PATCH", body: fields });

export const deleteUnitType = (organisationId: string, id: string, unitTypeId: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/unit-types/${encodeURIComponent(unitTypeId)}`, { method: "DELETE" });

export const uploadDevelopmentPhoto = (organisationId: string, id: string, file: File, onProgress: (fraction: number) => void) =>
  uploadPhotoFile<Envelope>(`${one(organisationId, id)}/photos`, file, onProgress);

export const describeDevelopmentPhoto = (organisationId: string, id: string, photoId: string, alt: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/photos/${encodeURIComponent(photoId)}`, { method: "PATCH", body: { alt } });

export const orderDevelopmentPhotos = (organisationId: string, id: string, photoIds: string[]) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/photos/order`, { method: "PUT", body: { photo_ids: photoIds } });

export const deleteDevelopmentPhoto = (organisationId: string, id: string, photoId: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" });

/** Links a listing of the organisation (or changes its unit type). 409 `LISTING_ALREADY_LINKED`. */
export const linkListing = (organisationId: string, id: string, listingId: string, unitTypeId: string | null) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/listings/${encodeURIComponent(listingId)}`, {
    method: "PUT",
    body: { unit_type_id: unitTypeId },
  });

export const unlinkListing = (organisationId: string, id: string, listingId: string) =>
  apiFetch<Envelope>(`${one(organisationId, id)}/listings/${encodeURIComponent(listingId)}`, { method: "DELETE" });

/** OWNER and MANAGER only (403 for AGENT and STAFF): they include the customers' contact details. */
export const listDevelopmentEnquiries = (organisationId: string, id: string) =>
  apiFetch<{ items: InboxBusinessEnquiry[] }>(`${one(organisationId, id)}/enquiries`, noStore);

// ---- Review (admin session) ----------------------------------------------------

export type DevelopmentQueuePage = {
  items: ManagedDevelopment[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export const DEVELOPMENT_QUEUE_STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "DRAFT"] as const;

/** Oldest submission first. A MARKET_ADMIN sees only their own countries. */
export function listDevelopmentQueue(query: { status?: string; market?: string; page?: number }) {
  const params = new URLSearchParams({ page_size: "20" });
  if (query.status) params.set("status", query.status);
  if (query.market) params.set("market", query.market);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return apiFetch<DevelopmentQueuePage>(`/v1/admin/developments?${params}`, noStore);
}

const admin = (id: string) => `/v1/admin/developments/${encodeURIComponent(id)}`;

export const getAdminDevelopment = (id: string) => apiFetch<Envelope>(admin(id), noStore);

/** PENDING_REVIEW to PUBLISHED; its photos become public. 409 `DEVELOPMENT_STATE_CONFLICT`, 403 `SELF_REVIEW_FORBIDDEN`. */
export const approveDevelopment = (id: string) => apiFetch<Envelope>(`${admin(id)}/approve`, { method: "POST" });

/** The reason (1 to 1000 characters) is kept on the project and in the audit trail. */
export const rejectDevelopment = (id: string, reason: string) =>
  apiFetch<Envelope>(`${admin(id)}/reject`, { method: "POST", body: { reason } });
