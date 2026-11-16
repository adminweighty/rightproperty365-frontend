import { apiFetch, apiFetchBytes } from "@/lib/api/http";
import type { Stamp } from "@/lib/api/stamps";

/*
 * Agreements (API 0.24.0), modelled on Adobe Acrobat Sign: a PDF sent to
 * recipients who sign, approve or get a copy. The sender's side (Manage, the
 * send flow, the detail), signing by link (public), the signed-in person's
 * documents to sign and saved signature, and the public verification.
 */

export type AgreementStatus = "DRAFT" | "OUT_FOR_SIGNATURE" | "COMPLETED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type AgreementView = "WAITING_FOR_YOU" | "WAITING_FOR_OTHERS" | "COMPLETED" | "DRAFTS";
export type RecipientRole = "SIGNER" | "APPROVER" | "CC";
export type RecipientStatus = "WAITING" | "ACTIVE" | "SIGNED" | "APPROVED" | "DECLINED" | "CC";
export type ReminderFrequency = "NONE" | "DAILY" | "EVERY_3_DAYS" | "WEEKLY";
/** STAMP (API 0.26.0): a generated company stamp, SIGNER recipients only. */
export type FieldType = "SIGNATURE" | "INITIALS" | "STAMP" | "DATE_SIGNED" | "NAME" | "TEXT" | "CHECKBOX";

/** A page's size in PDF points (1/72 inch), unrotated. */
export type PageSize = { width: number; height: number };

export type AgreementDocument = {
  sha256: string;
  size_bytes: number;
  file_name: string;
  pages?: PageSize[];
};

/** A field on the document: position and size in PDF points from the page's top-left corner. */
export type AgreementField = {
  id: string;
  recipient_id: string;
  type: FieldType | string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: string | null;
  /** A TEXT value, or "true"/"false" for a CHECKBOX, once filled. */
  value: string | null;
};

export type AgreementRecipient = {
  id: string;
  order: number;
  role: RecipientRole;
  name: string;
  email: string;
  /** How a generated document names them: "Tenant 1". */
  label: string | null;
  status: RecipientStatus;
  activated_at: string | null;
  first_viewed_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  verification: "EMAIL_CODE" | "DEMO_CODE" | null;
};

export type Agreement = {
  id: string;
  /** RPA-2026-000123 */
  reference: string;
  name: string;
  message: string | null;
  status: AgreementStatus;
  source: "UPLOAD" | "LEASE";
  lease_id: string | null;
  sender: { user_id: string; name: string; email: string };
  organisation: { id: string; name: string } | null;
  expires_at: string;
  reminder_frequency: ReminderFrequency;
  document: AgreementDocument | null;
  final_document: AgreementDocument | null;
  recipients: AgreementRecipient[];
  fields: AgreementField[];
  waiting_for_you: boolean;
  can_edit: boolean;
  can_send: boolean;
  can_cancel: boolean;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  cancel_reason: string | null;
};

export type AgreementPage = { items: Agreement[]; page: number; page_size: number; total: number; total_pages: number };

export type AgreementEvent = {
  id: string;
  action: string;
  actor_type: "USER" | "RECIPIENT" | "SYSTEM";
  actor_user_id: string | null;
  actor_name: string;
  recipient_id: string | null;
  ip: string | null;
  user_agent: string | null;
  detail: Record<string, unknown>;
  at: string;
};

export type RecipientInput = {
  /** PATCH only: keeps an existing recipient and their fields. */
  id?: string;
  name: string;
  email: string;
  role: RecipientRole;
  /** 1-20. The same order acts in parallel. */
  order: number;
};

export type AgreementInput = {
  name?: string;
  message?: string;
  expires_at?: string;
  reminder_frequency?: ReminderFrequency;
  recipients?: RecipientInput[];
  /** Create only; required when the caller manages listings for several organisations. */
  organisation_id?: string;
};

export type FieldInput = {
  recipient_id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
  label?: string;
};

type Envelope = { agreement: Agreement };

const mine = (id: string) => `/v1/me/agreements/${encodeURIComponent(id)}`;

export function listAgreements(query: { view?: AgreementView; status?: AgreementStatus; page?: number }) {
  const params = new URLSearchParams();
  if (query.view) params.set("view", query.view);
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", "20");
  return apiFetch<AgreementPage>(`/v1/me/agreements?${params}`, { cache: "no-store" });
}

export const createAgreement = (input: AgreementInput) =>
  apiFetch<Envelope>("/v1/me/agreements", { method: "POST", body: input });

export const getAgreement = (id: string) => apiFetch<Envelope>(mine(id), { cache: "no-store" });

/** The keys sent replace the saved values; `recipients` replaces the list (send `id` to keep one). */
export const patchAgreement = (id: string, input: AgreementInput) =>
  apiFetch<Envelope>(mine(id), { method: "PATCH", body: input });

export const deleteAgreement = (id: string) => apiFetch<null>(mine(id), { method: "DELETE" });

/** A PDF of at most 20 MB and 50 pages. A new PDF drops the fields placed on the previous one. */
export function uploadAgreementDocument(id: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<Envelope>(`${mine(id)}/document`, { method: "PUT", body });
}

/** Replaces every field. Every SIGNER needs at least one SIGNATURE field, or nothing is stored. */
export const putAgreementFields = (id: string, fields: FieldInput[]) =>
  apiFetch<Envelope>(`${mine(id)}/fields`, { method: "PUT", body: { fields } });

/** The original PDF, or the completed one once everybody finished. */
export const getAgreementPdf = (id: string) => apiFetchBytes(`${mine(id)}/pdf`);

export const sendAgreement = (id: string) => apiFetch<Envelope>(`${mine(id)}/send`, { method: "POST" });

export const cancelAgreement = (id: string, reason?: string) =>
  apiFetch<Envelope>(`${mine(id)}/cancel`, { method: "POST", body: reason ? { reason } : {} });

export const replaceRecipient = (id: string, recipientId: string, input: { email: string; name?: string }) =>
  apiFetch<Envelope>(`${mine(id)}/recipients/${encodeURIComponent(recipientId)}/replace`, { method: "POST", body: input });

export const remindRecipient = (id: string, recipientId: string) =>
  apiFetch<Envelope>(`${mine(id)}/recipients/${encodeURIComponent(recipientId)}/remind`, { method: "POST" });

export const listAgreementEvents = (id: string) =>
  apiFetch<{ items: AgreementEvent[] }>(`${mine(id)}/events`, { cache: "no-store" });

/** SUPER_ADMIN and SUPPORT, read-only. */
export function adminListAgreements(query: { status?: AgreementStatus; page?: number }) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", "20");
  return apiFetch<AgreementPage>(`/v1/admin/agreements?${params}`, { cache: "no-store" });
}

/* ------------------------------------------------------------------------ */
/* The signed-in person as a recipient                                       */
/* ------------------------------------------------------------------------ */

export type SigningRequest = {
  agreement_id: string;
  recipient_id: string;
  reference: string;
  name: string;
  agreement_status: AgreementStatus | string;
  role: RecipientRole | string;
  recipient_status: RecipientStatus | string;
  sender_name: string;
  sent_at: string | null;
  expires_at: string;
  completed_at: string | null;
  /** It waits for this person now. */
  can_sign: boolean;
};

export const listSigningRequests = () =>
  apiFetch<{ items: SigningRequest[] }>("/v1/me/signing-requests", { cache: "no-store" });

/** A fresh token for `/sign/{token}`: while it is their turn, or read-only for 90 days after it ended. */
export const createSigningLink = (recipientId: string) =>
  apiFetch<{ token: string; expires_at: string }>(`/v1/me/signing-requests/${encodeURIComponent(recipientId)}/link`, {
    method: "POST",
  });

export type SignatureFontKey = "FLOWING" | "BOLD" | "CLASSIC";
export type SignatureFont = { key: SignatureFontKey | string; label: string };

/**
 * An adopted signature or initials. TYPED: `text` (at most 120 characters)
 * and `font`. DRAWN: a PNG of at most 200 KB. UPLOADED: a PNG or JPEG of at
 * most 500 KB. Images 20 x 10 to 2000 x 1000 pixels; a data-URL prefix is accepted.
 */
export type AdoptedSignature =
  | { kind: "TYPED"; text: string; font: string }
  | { kind: "DRAWN" | "UPLOADED"; image_base64: string };

export type SavedAdopted = {
  kind: "TYPED" | "DRAWN" | "UPLOADED";
  text: string | null;
  font: string | null;
  image_base64: string | null;
};

export type SavedSignature = {
  signature: SavedAdopted | null;
  initials: SavedAdopted | null;
  /** API 0.26.0: the saved stamp. Optional for older API builds. */
  stamp?: Stamp | null;
  signature_fonts: SignatureFont[];
};

export const getMySignature = () => apiFetch<SavedSignature>("/v1/me/signature", { cache: "no-store" });

/**
 * A missing signature or initials is cleared, so send both to keep both. The
 * stamp is the other way round: omit it to keep it, send null to clear it.
 */
export const putMySignature = (input: { signature?: AdoptedSignature; initials?: AdoptedSignature; stamp?: Stamp | null }) =>
  apiFetch<SavedSignature>("/v1/me/signature", { method: "PUT", body: input });

/** A saved signature in the shape a submit or a save sends it; null when it cannot be used. */
export function fromSaved(saved: SavedAdopted | null): AdoptedSignature | null {
  if (!saved) return null;
  if (saved.kind === "TYPED") return saved.text ? { kind: "TYPED", text: saved.text, font: saved.font ?? "FLOWING" } : null;
  return saved.image_base64 ? { kind: saved.kind, image_base64: saved.image_base64 } : null;
}

/* ------------------------------------------------------------------------ */
/* Signing by link (no session)                                              */
/* ------------------------------------------------------------------------ */

export type SigningView = {
  agreement: {
    reference: string;
    name: string;
    message: string | null;
    status: AgreementStatus | string;
    sender_name: string;
    organisation_name: string | null;
    expires_at: string;
    document_sha256: string;
    final_sha256: string | null;
    pages: PageSize[];
    completed_at: string | null;
  };
  recipient: {
    id: string;
    name: string;
    role: RecipientRole | string;
    label: string | null;
    status: RecipientStatus | string;
    email_masked: string;
    completed_at: string | null;
  };
  /** This recipient's fields with the values filled so far (others' too, read-only, if the API sends them). */
  fields: AgreementField[];
  other_recipients: { name: string; role: string; order: number; status: string }[];
  can_act: boolean;
  read_only: boolean;
  code_length: number;
  consent_text: string;
  statement: string;
  signature_fonts: SignatureFont[];
  link_expires_at: string;
  /** API 0.26.0: the signed-in signer's saved stamp, when they have STAMP fields. */
  saved_stamp?: Stamp | null;
};

export type SubmitInput = {
  code: string;
  consent: true;
  field_values?: { field_id: string; value: string }[];
  signature?: AdoptedSignature;
  initials?: AdoptedSignature;
  /** Required when the recipient has a required STAMP field. */
  stamp?: Stamp;
};

const signing = (token: string) => `/v1/signing/${encodeURIComponent(token)}`;

export const getSigning = (token: string) => apiFetch<{ signing: SigningView }>(signing(token), { cache: "no-store" });

export const getSigningPdf = (token: string) => apiFetchBytes(`${signing(token)}/pdf`);

export const sendSigningCode = (token: string) =>
  apiFetch<{ sent_to: string; expires_at: string; code_length: number }>(`${signing(token)}/code`, { method: "POST" });

export const submitSigning = (token: string, input: SubmitInput) =>
  apiFetch<{ recipient_status: "SIGNED" | "APPROVED"; agreement_status: string; completed_at: string | null }>(
    `${signing(token)}/submit`,
    { method: "POST", body: input },
  );

export const declineSigning = (token: string, reason: string) =>
  apiFetch<{ signing: SigningView }>(`${signing(token)}/decline`, { method: "POST", body: { reason } });

/* ------------------------------------------------------------------------ */
/* Verification (public)                                                     */
/* ------------------------------------------------------------------------ */

export type Verification = {
  /** POST only. */
  match?: boolean;
  /** POST only, when it matches. */
  document?: "FINAL" | "ORIGINAL";
  reference: string;
  status: string;
  completed_at: string | null;
  original_sha256: string;
  final_sha256: string;
  signatures: number;
  statement: string;
};

export const verifyReference = (reference: string) =>
  apiFetch<Verification>(`/v1/verify/${encodeURIComponent(reference)}`, { cache: "no-store" });

export function verifyFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<Verification>("/v1/verify", { method: "POST", body });
}
