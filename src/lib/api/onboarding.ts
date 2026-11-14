import type { OnboardingStatus } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";
import { env } from "@/lib/env";

/**
 * Client for onboarding: the step after sign-up in which a person who chose a
 * listing, managing or agency role gives their details and documents, and the
 * review of those applications by platform administrators.
 *
 * Every call carries the HttpOnly session cookie. Documents are private: a
 * file can only be read through the authenticated file routes below.
 */

export type { OnboardingStatus };

/** What an approval creates. */
export type OnboardingOutcome = "ORGANISATION" | "AGENCY_MEMBER" | "NONE";

/** One role's requirements, from GET /v1/onboarding/requirements. */
export type OnboardingRequirements = {
  role: string;
  label: string;
  outcome: OnboardingOutcome;
  organisation_kind: string | null;
  /** The public directory an approved applicant appears in; null when the role gets no profile. */
  directory_kind: string | null;
  /** The details that apply to the role, in form order. */
  fields: { name: string; required: boolean }[];
  documents: { code: string; label: string; description: string; required: boolean }[];
};

/** Every key is always present; a text field that is not set is null. */
export type OnboardingDetails = {
  business_name: string | null;
  tagline: string | null;
  description: string | null;
  city: string | null;
  areas: string[];
  services: string[];
  trade: string | null;
  registration_number: string | null;
  contact_phone: string | null;
  agency_slug: string | null;
  job_title: string | null;
  bio: string | null;
};

export type OnboardingDetailName = keyof OnboardingDetails;

/** Absent = unchanged; null or "" = cleared; a list replaces the stored list. */
export type OnboardingDetailsPatch = Partial<Record<OnboardingDetailName, string | string[] | null>>;

export type OnboardingDocument = {
  id: string;
  type: { code: string; label: string };
  file_name: string;
  content_type: "application/pdf" | "image/jpeg" | "image/png";
  size_bytes: number;
  uploaded_at: string;
};

export type OnboardingDecision = { reason: string | null; decided_at: string | null };
export type OnboardingProfileRef = { kind: string; slug: string };

/** An application as its owner sees it. */
export type OnboardingApplication = {
  id: string;
  role: string;
  role_label: string;
  status: OnboardingStatus;
  /** The API's wording for the status, when it sends one. */
  status_label?: string | null;
  details: OnboardingDetails;
  documents: OnboardingDocument[];
  /** Required details (names) and documents (codes) that are still missing. */
  missing: { fields: string[]; documents: string[] };
  can_submit: boolean;
  can_edit: boolean;
  can_reapply: boolean;
  decision: OnboardingDecision;
  /** The public profile an approval created; null otherwise. */
  profile: OnboardingProfileRef | null;
  submitted_at: string | null;
  updated_at: string;
};

/** The upload limits the API enforces, repeated here to check a file before sending it. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const rolePath = (role: string) => `/v1/me/onboarding/${encodeURIComponent(role)}`;

export const listMyApplications = () =>
  apiFetch<{ applications: OnboardingApplication[] }>("/v1/me/onboarding");

/** A partial save. On a rejected application it starts a new one for the role. */
export const saveApplication = (role: string, details: OnboardingDetailsPatch) =>
  apiFetch<{ application: OnboardingApplication }>(rolePath(role), { method: "PUT", body: details });

/** Multipart upload of one document. Uploading a type that is already attached replaces it. */
export function uploadDocument(role: string, type: string, file: File) {
  const form = new FormData();
  form.set("type", type);
  form.set("file", file);
  return apiFetch<{ document: OnboardingDocument }>(`${rolePath(role)}/documents`, {
    method: "POST",
    body: form,
  });
}

export const removeDocument = (role: string, documentId: string) =>
  apiFetch<null>(`${rolePath(role)}/documents/${documentId}`, { method: "DELETE" });

/** On failure, `fields` is keyed `details.<name>` and `documents.<CODE>`. */
export const submitApplication = (role: string) =>
  apiFetch<{ application: OnboardingApplication }>(`${rolePath(role)}/submit`, { method: "POST" });

/** The address of the applicant's own file. It downloads, and only with their session. */
export const documentUrl = (role: string, documentId: string) =>
  `${env.apiUrl}${rolePath(role)}/documents/${documentId}/file`;

// ---- Review by platform administrators (admin-scope session) ---------------

export type OnboardingAgencyRef = { slug: string; name: string };

export type OnboardingAdminItem = {
  id: string;
  role: string;
  role_label: string;
  status: OnboardingStatus;
  /** The API's wording for the status, when it sends one. */
  status_label?: string | null;
  applicant: { name: string; email: string };
  business_name: string | null;
  /** The agency the applicant wants to join; null for other roles. */
  agency: OnboardingAgencyRef | null;
  submitted_at: string | null;
  updated_at: string;
  document_count: number;
};

export type OnboardingAdminPage = {
  items: OnboardingAdminItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  /** Applications per status within the same role and search. */
  counts: Record<OnboardingStatus, number>;
};

export type OnboardingHistoryEntry = {
  from: OnboardingStatus;
  to: OnboardingStatus;
  /** Empty if that account no longer exists. */
  actor_name: string;
  reason: string | null;
  at: string;
};

/** The full application for an administrator, including the private details. */
export type OnboardingAdminApplication = {
  id: string;
  role: string;
  role_label: string;
  status: OnboardingStatus;
  /** The API's wording for the status, when it sends one. */
  status_label?: string | null;
  outcome: OnboardingOutcome;
  market_code: string | null;
  applicant: { id: string; name: string; email: string; email_verified: boolean; created_at: string };
  details: OnboardingDetails;
  agency: OnboardingAgencyRef | null;
  documents: OnboardingDocument[];
  requirements: {
    fields: { name: string; required: boolean; provided: boolean }[];
    documents: { code: string; label: string; description: string; required: boolean; provided: boolean }[];
  };
  history: OnboardingHistoryEntry[];
  decision: OnboardingDecision;
  profile: OnboardingProfileRef | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingApproval = {
  application: OnboardingAdminApplication;
  created: {
    organisation_id: string | null;
    profile: OnboardingProfileRef | null;
    membership_role: string | null;
  };
};

export type ReviewQueueQuery = { status?: string; role?: string; q?: string; page?: number; page_size?: number };

export function listApplications(query: ReviewQueueQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return apiFetch<OnboardingAdminPage>(`/v1/admin/onboarding${text ? `?${text}` : ""}`);
}

export const getApplication = (id: string) =>
  apiFetch<{ application: OnboardingAdminApplication }>(`/v1/admin/onboarding/${encodeURIComponent(id)}`);

export const approveApplication = (id: string, note?: string) =>
  apiFetch<OnboardingApproval>(`/v1/admin/onboarding/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: note ? { note } : {},
  });

export const rejectApplication = (id: string, reason: string) =>
  apiFetch<{ application: OnboardingAdminApplication }>(
    `/v1/admin/onboarding/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: { reason } },
  );

export const requestChanges = (id: string, reason: string) =>
  apiFetch<{ application: OnboardingAdminApplication }>(
    `/v1/admin/onboarding/${encodeURIComponent(id)}/request-changes`,
    { method: "POST", body: { reason } },
  );

/** The address of an applicant's file for a reviewer. Every access is audited by the API. */
export const adminDocumentUrl = (id: string, documentId: string) =>
  `${env.apiUrl}/v1/admin/onboarding/${encodeURIComponent(id)}/documents/${documentId}/file`;

// ---- Shared display helpers -------------------------------------------------

/**
 * The application statuses are a fixed enum of the API, not a reference set,
 * so their wording lives here. "Approved" is the only one that means verified.
 */
export const onboardingStatusLabels: Record<OnboardingStatus, string> = {
  DRAFT: "Not submitted",
  SUBMITTED: "Submitted for review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Not approved",
};

/** The API's own wording for a status when it sends one, otherwise ours. */
export const onboardingStatusLabel = (item: { status: OnboardingStatus; status_label?: string | null }) =>
  item.status_label || onboardingStatusLabels[item.status];

export const onboardingStatusTones: Record<OnboardingStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** `SERVICE_PROVIDER` <-> `service-provider`, for the address of a role's form. */
export const roleToSlug = (role: string) => role.toLowerCase().replaceAll("_", "-");
export const slugToRole = (slug: string) => slug.toUpperCase().replaceAll("-", "_");

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
