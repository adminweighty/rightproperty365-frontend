import type { ReminderFrequency } from "@/lib/api/agreements";
import { apiFetch, apiFetchBytes } from "@/lib/api/http";

/*
 * Leases (API 0.24.0): the template library administrators keep, and the
 * leases people who manage listings draft from an approved template and send
 * for signing (an agreement whose fields are placed automatically).
 *
 * API 0.26.0: templates belong to organisations, which design and publish
 * their own; the administrators' library becomes the sample templates anyone
 * can copy. No legal review is needed anywhere.
 */

export type LeaseKind = "RESIDENTIAL" | "COMMERCIAL";
/** APPROVED is shown as "Published" for an organisation's template. */
export type LeaseTemplateStatus = "DRAFT" | "APPROVED" | "RETIRED";
export type LeaseTemplateSource = "SAMPLE" | "ORGANISATION";
export type LeaseStatus = "DRAFT" | "SENT_FOR_SIGNING" | "SIGNED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type RentPeriod = "MONTHLY" | "WEEKLY" | "ANNUALLY";

/** A placeholder a template may use as `{{name}}`. */
export type LeaseVariable = { name: string; description: string; example: string };
export type LeaseSection = { heading: string; text: string };
export type LeaseClause = { code: string; title: string; text: string };

export type LegalReview = { reviewer_name: string; organisation: string; reviewed_on: string; note?: string };

export type LeaseTemplate = {
  id: string;
  /** Groups the versions of one template. */
  family_id: string;
  version: number;
  market_code: string;
  /** API 0.26.0: null for a sample. */
  organisation_id: string | null;
  source: LeaseTemplateSource;
  /** True when the caller may manage it. */
  can_edit: boolean;
  name: string;
  lease_kind: LeaseKind;
  description: string | null;
  sections: LeaseSection[];
  optional_clauses: LeaseClause[];
  status: LeaseTemplateStatus;
  legal_review: LegalReview | null;
  created_by_name: string;
  approved_at: string | null;
  approved_by_name: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaseTemplateInput = {
  market_code?: string;
  name?: string;
  lease_kind?: LeaseKind;
  description?: string;
  sections?: LeaseSection[];
  optional_clauses?: LeaseClause[];
};

export type LeaseTemplateList = { items: LeaseTemplate[]; variables: LeaseVariable[] };

export type LeaseActor = { type: "USER" | "SYSTEM" | "RECIPIENT"; user_id: string | null; name: string };

export type LeaseTemplateEvent = {
  id: string;
  action: "CREATED" | "EDITED" | "NEW_VERSION" | "APPROVED" | "PUBLISHED" | "RETIRED" | string;
  actor: LeaseActor;
  detail: Record<string, unknown> | null;
  at: string;
};

export type LeaseParty = { name: string; email: string; phone?: string };
export type LeasePartyView = { role: "LANDLORD" | "TENANT"; name: string; email: string; phone: string | null };

export type LeaseInput = {
  template_id?: string;
  /** Create only. */
  listing_id?: string;
  /** Create only, without a listing. */
  organisation_id?: string;
  property_address?: string;
  landlords?: LeaseParty[];
  tenants?: LeaseParty[];
  start_date?: string;
  end_date?: string;
  periodic?: boolean;
  /** A decimal string above 0, at most two decimals. */
  rent_amount?: string;
  rent_currency?: string;
  rent_period?: RentPeriod;
  /** 1-31, or 1-7 (Monday-Sunday) for WEEKLY. */
  payment_day?: number;
  deposit_amount?: string;
  notice_period_days?: number;
  optional_clauses?: string[];
  special_conditions?: string;
  /** API 0.26.0: a STAMP field for each landlord next to their signature block. Default false. */
  landlord_stamp?: boolean;
};

export type LeaseDocument = {
  kind: "DRAFT" | "SIGNING" | "FINAL";
  sha256: string;
  size_bytes: number;
  template_version: number;
  generated_at: string;
};

export type Lease = {
  id: string;
  /** RPL-2026-000123 */
  reference: string;
  status: LeaseStatus;
  template: { id: string; name: string; version: number; market_code: string; lease_kind: string };
  organisation: { id: string; name: string } | null;
  listing: { id: string; reference: string; title: string } | null;
  created_by: { user_id: string; name: string };
  property_address: string;
  landlords: LeasePartyView[];
  tenants: LeasePartyView[];
  start_date: string;
  end_date: string | null;
  periodic: boolean;
  rent_amount: string;
  rent_currency: string;
  rent_period: RentPeriod;
  payment_day: number;
  deposit_amount: string | null;
  notice_period_days: number;
  optional_clauses: string[];
  special_conditions: string | null;
  /** API 0.26.0. Optional for older API builds. */
  landlord_stamp?: boolean;
  /** The PDF `GET .../pdf` returns now. */
  document: LeaseDocument | null;
  /** The frozen copy sent for signing. */
  signing_copy: LeaseDocument | null;
  agreement_id: string | null;
  can_edit: boolean;
  can_send: boolean;
  can_cancel: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type LeasePage = { items: Lease[]; page: number; page_size: number; total: number; total_pages: number };

export type LeaseEvent = { id: string; action: string; actor: LeaseActor; detail: Record<string, unknown>; at: string };

type TemplateEnvelope = { template: LeaseTemplate; new_version?: boolean };
type Envelope = { lease: Lease };

/* Administrators: SUPER_ADMIN and CONTENT_ADMIN for templates, SUPER_ADMIN and SUPPORT for leases. */

const adminTemplate = (id: string) => `/v1/admin/lease-templates/${encodeURIComponent(id)}`;

export function adminListLeaseTemplates(query: { market?: string; status?: LeaseTemplateStatus } = {}) {
  const params = new URLSearchParams();
  if (query.market) params.set("market", query.market);
  if (query.status) params.set("status", query.status);
  const text = params.toString();
  return apiFetch<LeaseTemplateList>(`/v1/admin/lease-templates${text ? `?${text}` : ""}`, { cache: "no-store" });
}

export const adminCreateLeaseTemplate = (input: LeaseTemplateInput) =>
  apiFetch<TemplateEnvelope>("/v1/admin/lease-templates", { method: "POST", body: input });

export const adminGetLeaseTemplate = (id: string) =>
  apiFetch<{ template: LeaseTemplate; events: LeaseTemplateEvent[]; variables: LeaseVariable[] }>(adminTemplate(id), {
    cache: "no-store",
  });

/** A DRAFT changes in place (200); an APPROVED one gets its next version as a DRAFT (201, `new_version`). */
export const adminEditLeaseTemplate = (id: string, input: LeaseTemplateInput) =>
  apiFetch<TemplateEnvelope>(adminTemplate(id), { method: "PATCH", body: input });

/** The legal review is optional (API 0.26.0). */
export const adminApproveLeaseTemplate = (id: string, review?: LegalReview) =>
  apiFetch<TemplateEnvelope>(`${adminTemplate(id)}/approve`, { method: "POST", body: review ? { legal_review: review } : {} });

export const adminRetireLeaseTemplate = (id: string) =>
  apiFetch<TemplateEnvelope>(`${adminTemplate(id)}/retire`, { method: "POST" });

export function adminListLeases(query: { status?: LeaseStatus; page?: number }) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", "20");
  return apiFetch<LeasePage>(`/v1/admin/leases?${params}`, { cache: "no-store" });
}

/* People who manage listings. */

/**
 * Only APPROVED templates, of `market` when given: every sample, and the
 * published templates of the caller's organisations (only that one's with
 * `organisationId`).
 */
export function listOfferedLeaseTemplates(market?: string, organisationId?: string) {
  const params = new URLSearchParams();
  if (market) params.set("market", market);
  if (organisationId) params.set("organisation_id", organisationId);
  const text = params.toString();
  return apiFetch<LeaseTemplateList>(`/v1/me/lease-templates${text ? `?${text}` : ""}`, { cache: "no-store" });
}

/* An organisation's own templates (API 0.26.0). OWNER or MANAGER manage them; members who draft leases read them. */

const orgTemplates = (orgId: string) => `/v1/me/organisations/${encodeURIComponent(orgId)}/lease-templates`;
const orgTemplate = (orgId: string, id: string) => `${orgTemplates(orgId)}/${encodeURIComponent(id)}`;

/** Every version, like the admin list. */
export function listOrgLeaseTemplates(orgId: string, query: { market?: string; status?: LeaseTemplateStatus } = {}) {
  const params = new URLSearchParams();
  if (query.market) params.set("market", query.market);
  if (query.status) params.set("status", query.status);
  const text = params.toString();
  return apiFetch<LeaseTemplateList>(`${orgTemplates(orgId)}${text ? `?${text}` : ""}`, { cache: "no-store" });
}

/** A new DRAFT, version 1 of a new family: written from scratch, or a copy of a sample (or of this organisation's template). */
export const createOrgLeaseTemplate = (orgId: string, input: LeaseTemplateInput | { copy_from_template_id: string; name?: string }) =>
  apiFetch<TemplateEnvelope>(orgTemplates(orgId), { method: "POST", body: input });

export const getOrgLeaseTemplate = (orgId: string, id: string) =>
  apiFetch<{ template: LeaseTemplate; variables?: LeaseVariable[] }>(orgTemplate(orgId, id), { cache: "no-store" });

/** A DRAFT changes in place (200); a published one gets its next version as a DRAFT (201, `new_version`). */
export const editOrgLeaseTemplate = (orgId: string, id: string, input: LeaseTemplateInput) =>
  apiFetch<TemplateEnvelope>(orgTemplate(orgId, id), { method: "PATCH", body: input });

/** DRAFT to APPROVED ("Published"); the family's other published version is retired. */
export const publishOrgLeaseTemplate = (orgId: string, id: string) =>
  apiFetch<TemplateEnvelope>(`${orgTemplate(orgId, id)}/publish`, { method: "POST" });

export const retireOrgLeaseTemplate = (orgId: string, id: string) =>
  apiFetch<TemplateEnvelope>(`${orgTemplate(orgId, id)}/retire`, { method: "POST" });

export const listOrgLeaseTemplateEvents = (orgId: string, id: string) =>
  apiFetch<{ items: LeaseTemplateEvent[] }>(`${orgTemplate(orgId, id)}/events`, { cache: "no-store" });

const mine = (id: string) => `/v1/me/leases/${encodeURIComponent(id)}`;

export function listLeases(query: { status?: LeaseStatus; page?: number }) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", "20");
  return apiFetch<LeasePage>(`/v1/me/leases?${params}`, { cache: "no-store" });
}

/** Every mandatory field is checked on every save. */
export const createLease = (input: LeaseInput) => apiFetch<Envelope>("/v1/me/leases", { method: "POST", body: input });

export const getLease = (id: string) => apiFetch<Envelope>(mine(id), { cache: "no-store" });

/** The keys sent replace the saved values; the draft PDF is rendered again. */
export const patchLease = (id: string, input: LeaseInput) => apiFetch<Envelope>(mine(id), { method: "PATCH", body: input });

export const deleteLease = (id: string) => apiFetch<null>(mine(id), { method: "DELETE" });

/** The draft (watermarked), the signing copy or the signed PDF. */
export const getLeasePdf = (id: string) => apiFetchBytes(`${mine(id)}/pdf`);

export const cancelLease = (id: string, reason?: string) =>
  apiFetch<Envelope>(`${mine(id)}/cancel`, { method: "POST", body: reason ? { reason } : {} });

export const listLeaseEvents = (id: string) => apiFetch<{ items: LeaseEvent[] }>(`${mine(id)}/events`, { cache: "no-store" });

/** Freezes the lease and sends it as an agreement, every party a SIGNER of order 1. */
export const sendLease = (
  id: string,
  input: { message?: string; expires_at?: string; reminder_frequency?: ReminderFrequency },
) => apiFetch<Envelope>(`${mine(id)}/send`, { method: "POST", body: input });
