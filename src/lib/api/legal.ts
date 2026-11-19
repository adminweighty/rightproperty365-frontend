import { apiFetch } from "@/lib/api/http";
import { legalFilterQuery, type LegalFilters, type LegalVersionInput, type LegalVersionStatus } from "@/lib/legal-versions";

/**
 * Per-market legal documents (API 0.43.0). The bodies held by the API are
 * DRAFT placeholders until the lawyers' text is published there: the site's
 * /legal pages keep showing the web's own text (src/content/legal).
 */

export type LegalDocument = {
  id: string;
  kind: string;
  title: string;
  market_code: string;
  lang: string;
  version: string;
  effective_from: string;
  status: LegalVersionStatus;
  /** Absent from the lists. Untrusted: shown as plain text, never as HTML. */
  body_markdown?: string;
  summary_of_changes: string | null;
  requires_reacceptance: boolean;
  /** True: show a visible DRAFT notice, the text is a placeholder or unreviewed. */
  draft_notice: boolean;
  published_at: string | null;
  retired_at: string | null;
};

export type AdminLegalVersion = LegalDocument & {
  created_by: { id: string | null; name: string };
  published_by: { id: string | null; name: string } | null;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentAnswer = {
  document: LegalDocument;
  requested_market: string;
  requested_lang: string;
  fallback_market: boolean;
  fallback_lang: boolean;
  preview: boolean;
};

/** The published version of a document, by its exact path (see `pendingDocumentPath`). 404 `LEGAL_DOCUMENT_NOT_FOUND`. */
export const getLegalDocumentAt = (path: string) => apiFetch<LegalDocumentAnswer>(path, { cache: "no-store" });

/** Records that the signed-in person accepted a published version. 201 new, 200 already accepted; 409 `LEGAL_VERSION_NOT_ACCEPTABLE`. */
export const acceptLegalVersion = (input: { kind: string; version: string; market_code: string }) =>
  apiFetch<{ acceptance: { kind: string; version: string; market_code: string | null; accepted_at: string; context: string | null } }>(
    "/v1/me/legal-acceptances",
    { method: "POST", body: input },
  );

// ---- Administration (SUPER_ADMIN, CONTENT_ADMIN, MARKET_ADMIN for its own market) ----

export const adminListLegalVersions = (filters: LegalFilters) =>
  apiFetch<{ versions: AdminLegalVersion[] }>(`/v1/admin/legal${legalFilterQuery(filters)}`, { cache: "no-store" });

export const adminGetLegalVersion = (id: string) =>
  apiFetch<{ version: AdminLegalVersion }>(`/v1/admin/legal/${encodeURIComponent(id)}`, { cache: "no-store" });

/** Creates a DRAFT. 409 `LEGAL_VERSION_EXISTS`; 403 `LEGAL_MARKET_FORBIDDEN`. */
export const adminCreateLegalVersion = (input: LegalVersionInput) =>
  apiFetch<{ version: AdminLegalVersion }>("/v1/admin/legal", { method: "POST", body: input });

/** Changes a DRAFT (not its kind, market or language). 409 `LEGAL_VERSION_IMMUTABLE` once published. */
export const adminUpdateLegalVersion = (id: string, input: Omit<LegalVersionInput, "kind" | "market_code" | "lang">) =>
  apiFetch<{ version: AdminLegalVersion }>(`/v1/admin/legal/${encodeURIComponent(id)}`, { method: "PATCH", body: input });

export const adminDeleteLegalVersion = (id: string) =>
  apiFetch<null>(`/v1/admin/legal/${encodeURIComponent(id)}`, { method: "DELETE" });

export const adminPublishLegalVersion = (id: string) =>
  apiFetch<{ version: AdminLegalVersion }>(`/v1/admin/legal/${encodeURIComponent(id)}/publish`, { method: "POST", body: {} });

export const adminRetireLegalVersion = (id: string) =>
  apiFetch<{ version: AdminLegalVersion }>(`/v1/admin/legal/${encodeURIComponent(id)}/retire`, { method: "POST", body: {} });
