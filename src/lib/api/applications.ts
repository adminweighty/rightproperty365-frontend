import { apiFetch, type ApiFailure, type ApiResult } from "@/lib/api/http";
import { env } from "@/lib/env";
import { readScanStatus, type ScanStatus } from "@/lib/file-scan";
import {
  listOf,
  normaliseSections,
  unwrap,
  type Answers,
  type FormDefinition,
  type FormStatus,
  type IntakeStatus,
} from "@/lib/questionnaires";

/*
 * Questionnaires and applications (API 0.32.0).
 *
 * - Forms: `/v1/agent/organisations/{orgId}/forms`, versioned; managed by the
 *   OWNER and MANAGER, read by an AGENT. Editing a PUBLISHED form makes a new
 *   DRAFT version (the PATCH answers with it).
 * - Intake: `/v1/me/listings/{id}/applications-intake`.
 * - Customer: `/v1/listings/{slug}/application-form` (public) and
 *   `/v1/me/applications`.
 * - Organisation: `/v1/agent/organisations/{orgId}/applications`.
 *
 * The answers follow the contract's "Response shapes" (wrapped `{ form }`,
 * `{ application }`, lists as `{ items }`, a flat intake object). Each is
 * still read through a normaliser that also takes a bare object and fills in
 * what is missing, so an older or newer API build never breaks a page.
 */

// ---- Types ---------------------------------------------------------------------------

export type FormVersionRef = { id: string; version: number; status: FormStatus; updated_at: string | null };

export type QuestionnaireForm = FormDefinition & {
  id: string;
  family_id: string;
  version: number;
  status: FormStatus;
  organisation_id: string | null;
  /** FR-018: sensitive-data warnings for this version ("government IDs should only be collected when necessary"). */
  warnings: string[];
  /** Whether the caller may change it; the dashboard role decides when the API does not say. */
  can_edit: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  retired_at: string | null;
  /** How many applications were submitted on this version (`submission_count`). */
  application_count: number | null;
  /** True once the version has submissions: it can never change. */
  locked: boolean;
};

export type ApplicationListing = { id: string | null; slug: string | null; title: string; reference: string | null };

export type ApplicationFile = {
  id: string;
  field: string;
  file_name: string;
  size_bytes: number | null;
  content_type: string | null;
  uploaded_at: string | null;
  /** Null when uploads are not scanned for malware (API 0.41.0). */
  scan_status?: ScanStatus | null;
};

export type ApplicationEvent = {
  /** SUBMITTED, STATUS_CHANGED, INFO_REQUESTED, WITHDRAWN… or the status reached. */
  event: string;
  status: string | null;
  status_label: string | null;
  message: string | null;
  actor: string | null;
  at: string;
};

export type ApplicationNote = { id: string; text: string; author: string | null; mine: boolean; at: string };

export type Applicant = { name: string; email: string | null; phone: string | null };

export type Application = {
  id: string;
  reference: string | null;
  status: string;
  status_label: string | null;
  listing: ApplicationListing | null;
  /** The exact version the application was made (or submitted) on. */
  form: QuestionnaireForm | null;
  form_id: string | null;
  form_version: number | null;
  answers: Answers;
  files: ApplicationFile[];
  timeline: ApplicationEvent[];
  /** The organisation's latest request for more information, when there is one. */
  info_request: { message: string; at: string | null } | null;
  /** The API's own flags, when it sends them; the status rules decide otherwise. */
  can_edit: boolean | null;
  can_submit: boolean | null;
  can_withdraw: boolean | null;
  /** True once retention or account deletion removed the answers and files. */
  erased: boolean;
  /** False when the listing is no longer public (its snapshot has no slug). */
  listing_available: boolean | null;
  /** Required, shown questions without an answer (DRAFT and MORE_INFO only). */
  missing_required: string[];
  /** Agent side only. */
  applicant: Applicant | null;
  notes: ApplicationNote[];
  allowed_transitions: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
};

export type ApplicationPage = {
  items: Application[];
  page: number;
  total: number | null;
  total_pages: number;
  status_counts: { status: string; label: string | null; count: number }[];
};

export type Intake = {
  form_id: string | null;
  form_version: number | null;
  /** The effective status: OPEN reads as CLOSED once `closes_at` passed or the form expired or was retired. */
  status: IntakeStatus;
  /** What was set. */
  stored_status: IntakeStatus;
  closes_at: string | null;
  closed_reason: string | null;
  form_name: string | null;
  /** False for a short stay. */
  eligible: boolean;
};

// ---- Normalisers ----------------------------------------------------------------------

type Raw = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};
const obj = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);

function warningsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : str(obj(item)?.message) ?? str(obj(item)?.text)))
    .filter((item): item is string => Boolean(item));
}

export function normaliseForm(payload: unknown): QuestionnaireForm | null {
  const raw = unwrap<Raw>(payload, "form");
  if (!raw || typeof raw.id !== "string") return null;
  const outer = obj(payload);
  return {
    id: raw.id,
    family_id: str(raw.family_id) ?? raw.id,
    version: num(raw.version) ?? 1,
    status: raw.status === "PUBLISHED" || raw.status === "RETIRED" ? raw.status : "DRAFT",
    organisation_id: str(raw.organisation_id),
    name: typeof raw.name === "string" ? raw.name : "",
    market_code: typeof raw.market_code === "string" ? raw.market_code : "",
    purpose: typeof raw.purpose === "string" ? raw.purpose : "",
    privacy_notice: typeof raw.privacy_notice === "string" ? raw.privacy_notice : "",
    retention_days: num(raw.retention_days),
    expires_at: str(raw.expires_at),
    sections: normaliseSections(raw.sections),
    // Warnings may sit beside the form in a wrapped answer, or on it.
    warnings: warningsOf(raw.warnings ?? outer?.warnings),
    can_edit: typeof raw.can_edit === "boolean" ? raw.can_edit : null,
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
    published_at: str(raw.published_at),
    retired_at: str(raw.retired_at),
    application_count: num(raw.submission_count ?? raw.application_count),
    locked: raw.locked === true,
  };
}

function normaliseListing(value: unknown, fallbackId: unknown): ApplicationListing | null {
  const raw = obj(value);
  if (!raw) return typeof fallbackId === "string" ? { id: fallbackId, slug: null, title: "", reference: null } : null;
  return {
    id: str(raw.id) ?? str(raw.listing_id) ?? (typeof fallbackId === "string" ? fallbackId : null),
    slug: str(raw.slug),
    title: typeof raw.title === "string" ? raw.title : "",
    reference: str(raw.reference),
  };
}

function normaliseFile(value: unknown): ApplicationFile | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.file_id);
  if (!id) return null;
  return {
    id,
    field: str(raw.field) ?? str(raw.field_key) ?? "",
    file_name: str(raw.file_name) ?? str(raw.name) ?? str(raw.filename) ?? "File",
    size_bytes: num(raw.size_bytes ?? raw.size),
    content_type: str(raw.content_type),
    uploaded_at: str(raw.uploaded_at) ?? str(raw.created_at),
    scan_status: readScanStatus(raw.scan_status),
  };
}

function normaliseEvent(value: unknown): ApplicationEvent | null {
  const raw = obj(value);
  if (!raw) return null;
  const at = str(raw.at) ?? str(raw.created_at) ?? str(raw.occurred_at);
  if (!at) return null;
  const actor = obj(raw.actor);
  return {
    event: str(raw.kind) ?? str(raw.event) ?? str(raw.action) ?? str(raw.type) ?? str(raw.status) ?? "",
    status: str(raw.status) ?? str(raw.to_status),
    status_label: str(raw.status_label) ?? str(raw.label),
    message: str(raw.message) ?? str(raw.note) ?? str(raw.text),
    actor: str(actor?.name) ?? str(raw.actor_name) ?? (typeof raw.actor === "string" ? raw.actor : null),
    at,
  };
}

function normaliseNote(value: unknown): ApplicationNote | null {
  const raw = obj(value);
  if (!raw) return null;
  const text = str(raw.text) ?? str(raw.body);
  if (!text) return null;
  const author = obj(raw.author);
  return {
    id: str(raw.id) ?? `${raw.created_at}`,
    text,
    author: str(author?.name) ?? str(raw.author_name),
    mine: raw.mine === true,
    at: str(raw.created_at) ?? str(raw.at) ?? "",
  };
}

function answersOf(value: unknown): Answers {
  const raw = obj(value);
  if (!raw) return {};
  const answers: Answers = {};
  for (const [key, item] of Object.entries(raw)) {
    // An answer rendered by the API may be `{ value, label }`.
    const inner = obj(item);
    answers[key] = (inner && "value" in inner ? inner.value : item) as Answers[string];
  }
  return answers;
}

export function normaliseApplication(payload: unknown): Application | null {
  const raw = unwrap<Raw>(payload, "application");
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.application_id);
  if (!id) return null;
  const timeline = (Array.isArray(raw.timeline) ? raw.timeline : Array.isArray(raw.events) ? raw.events : [])
    .map(normaliseEvent)
    .filter((item): item is ApplicationEvent => item !== null);
  const infoRaw = obj(raw.info_request) ?? obj(raw.more_info);
  const lastAsk = [...timeline].reverse().find((entry) => (entry.status === "MORE_INFO" || entry.event === "INFO_REQUESTED") && entry.message);
  const info = infoRaw && str(infoRaw.message)
    ? { message: str(infoRaw.message) as string, at: str(infoRaw.requested_at) ?? str(infoRaw.at) ?? str(infoRaw.created_at) }
    : typeof raw.info_request === "string"
      ? { message: raw.info_request, at: null }
      : lastAsk
        ? { message: lastAsk.message as string, at: lastAsk.at }
        : null;
  const applicant = obj(raw.applicant) ?? obj(raw.customer);
  const form = normaliseForm(raw.form ?? raw.form_version_snapshot ?? null);
  return {
    id,
    reference: str(raw.reference),
    status: str(raw.status) ?? "DRAFT",
    status_label: str(raw.status_label),
    listing: normaliseListing(raw.listing ?? raw.listing_snapshot, raw.listing_id),
    form,
    form_id: str(raw.form_id) ?? form?.id ?? null,
    form_version: num(raw.form_version) ?? form?.version ?? null,
    answers: answersOf(raw.answers),
    files: (Array.isArray(raw.files) ? raw.files : []).map(normaliseFile).filter((item): item is ApplicationFile => item !== null),
    timeline,
    info_request: info,
    can_edit: typeof raw.can_edit === "boolean" ? raw.can_edit : null,
    can_submit: typeof raw.can_submit === "boolean" ? raw.can_submit : null,
    can_withdraw: typeof raw.can_withdraw === "boolean" ? raw.can_withdraw : null,
    erased: raw.erased === true,
    listing_available: typeof raw.listing_available === "boolean" ? raw.listing_available : null,
    missing_required: Array.isArray(raw.missing_required) ? raw.missing_required.filter((item): item is string => typeof item === "string") : [],
    applicant: applicant
      ? { name: str(applicant.name) ?? str(applicant.full_name) ?? "", email: str(applicant.email), phone: str(applicant.phone) }
      : null,
    notes: (Array.isArray(raw.notes) ? raw.notes : []).map(normaliseNote).filter((item): item is ApplicationNote => item !== null),
    allowed_transitions: Array.isArray(raw.allowed_transitions)
      ? raw.allowed_transitions.map((item) => (typeof item === "string" ? item : str(obj(item)?.status) ?? "")).filter(Boolean)
      : null,
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
    submitted_at: str(raw.submitted_at),
  };
}

function normalisePage(payload: unknown, page: number): ApplicationPage {
  const raw = obj(payload) ?? {};
  const items = listOf<unknown>(payload, "applications").map(normaliseApplication).filter((item): item is Application => item !== null);
  // `{ "SUBMITTED": 3, … }` (the contract) or a list of `{ status, label, count }`.
  const counts = Array.isArray(raw.status_counts)
    ? raw.status_counts
    : obj(raw.status_counts)
      ? Object.entries(raw.status_counts as Raw).map(([status, count]) => ({ status, count }))
      : [];
  return {
    items,
    page: num(raw.page) ?? page,
    total: num(raw.total),
    total_pages: Math.max(1, num(raw.total_pages) ?? 1),
    status_counts: counts
      .map((item) => obj(item))
      .filter((item): item is Raw => item !== null && typeof item.status === "string")
      .map((item) => ({ status: item.status as string, label: str(item.label), count: num(item.count) ?? 0 })),
  };
}

export function normaliseIntake(payload: unknown): Intake {
  const raw = unwrap<Raw>(payload, "intake") ?? {};
  const read = (value: unknown): IntakeStatus => (value === "OPEN" || value === "PAUSED" || value === "CLOSED" ? value : "NONE");
  const status = read(raw.status);
  return {
    form_id: str(raw.form_id),
    form_version: num(raw.form_version),
    status,
    stored_status: raw.stored_status === undefined ? status : read(raw.stored_status),
    closes_at: str(raw.closes_at),
    closed_reason: str(raw.closed_reason),
    form_name: str(raw.form_name),
    eligible: raw.eligible !== false,
  };
}

/** A failed answer as it is, a good one through the normaliser; a shape that cannot be read is a failure. */
function mapped<T>(result: ApiResult<unknown>, read: (payload: unknown) => T | null): ApiResult<T> {
  if (!result.ok) return result;
  const data = read(result.data);
  if (data === null) {
    return { ok: false, failure: { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." } };
  }
  return { ok: true, status: result.status, data };
}

// ---- Forms -------------------------------------------------------------------------------

const forms = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}/forms`;

export type FormInput = Partial<FormDefinition>;

export async function listForms(orgId: string, query: { status?: FormStatus; market?: string; family_id?: string } = {}): Promise<ApiResult<QuestionnaireForm[]>> {
  const search = new URLSearchParams();
  if (query.status) search.set("status", query.status);
  if (query.market) search.set("market", query.market);
  if (query.family_id) search.set("family_id", query.family_id);
  const result = await apiFetch<unknown>(`${forms(orgId)}${search.toString() ? `?${search}` : ""}`, { cache: "no-store" });
  return mapped(result, (payload) => listOf<unknown>(payload, "forms").map(normaliseForm).filter((item): item is QuestionnaireForm => item !== null));
}

export const getForm = async (orgId: string, id: string) =>
  mapped(await apiFetch<unknown>(`${forms(orgId)}/${encodeURIComponent(id)}`, { cache: "no-store" }), normaliseForm);

export const createForm = async (orgId: string, input: FormInput) =>
  mapped(await apiFetch<unknown>(forms(orgId), { method: "POST", body: input }), normaliseForm);

/** A DRAFT is changed; a PUBLISHED form answers with its new DRAFT version. */
export const updateForm = async (orgId: string, id: string, input: FormInput) =>
  mapped(await apiFetch<unknown>(`${forms(orgId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: input }), normaliseForm);

export const publishForm = async (orgId: string, id: string) =>
  mapped(await apiFetch<unknown>(`${forms(orgId)}/${encodeURIComponent(id)}/publish`, { method: "POST" }), normaliseForm);

export const retireForm = async (orgId: string, id: string) =>
  mapped(await apiFetch<unknown>(`${forms(orgId)}/${encodeURIComponent(id)}/retire`, { method: "POST" }), normaliseForm);

// ---- Listing intake -------------------------------------------------------------------------

const intake = (listingId: string) => `/v1/me/listings/${encodeURIComponent(listingId)}/applications-intake`;

export const getIntake = async (listingId: string) =>
  mapped(await apiFetch<unknown>(intake(listingId), { cache: "no-store" }), normaliseIntake);

/** 400 for a short stay or a form that is not a PUBLISHED form of the listing's organisation and market. */
export const saveIntake = async (listingId: string, body: { form_id: string | null; status: IntakeStatus; closes_at?: string | null }) =>
  mapped(await apiFetch<unknown>(intake(listingId), { method: "PUT", body }), normaliseIntake);

// ---- Customer -------------------------------------------------------------------------------

export type PublicApplicationForm = {
  form: QuestionnaireForm;
  listing: ApplicationListing | null;
  /** The intake as the listing says it, when the answer has it. */
  applications: { open: boolean; closes_at: string | null; status: string | null; closed_reason: string | null } | null;
};

/** Public: the published version attached to the listing. 404 when there is none. */
export async function getApplicationForm(slug: string): Promise<ApiResult<PublicApplicationForm>> {
  const result = await apiFetch<unknown>(`/v1/listings/${encodeURIComponent(slug)}/application-form`, { cache: "no-store" });
  return mapped(result, (payload) => {
    const form = normaliseForm(payload);
    if (!form) return null;
    const raw = obj(payload) ?? {};
    const intakeRaw = obj(raw.applications) ?? obj(raw.intake);
    return {
      form,
      listing: normaliseListing(raw.listing, raw.listing_id),
      applications: intakeRaw
        ? { open: intakeRaw.open === true || intakeRaw.status === "OPEN", closes_at: str(intakeRaw.closes_at), status: str(intakeRaw.status), closed_reason: str(intakeRaw.closed_reason) }
        : null,
    };
  });
}

/** The public listing, read in the browser for its id and whether it takes applications. */
export type ApplyListing = {
  id: string;
  slug: string;
  title: string;
  reference: string | null;
  applications: { open: boolean; closes_at: string | null; form_name: string | null } | null;
};

export async function getPublicListingForApply(slug: string): Promise<ApiResult<ApplyListing>> {
  const result = await apiFetch<unknown>(`/v1/listings/${encodeURIComponent(slug)}`, { cache: "no-store" });
  return mapped(result, (payload) => {
    const raw = unwrap<Raw>(payload, "listing");
    if (!raw || typeof raw.id !== "string") return null;
    const apps = obj(raw.applications);
    return {
      id: raw.id,
      slug: str(raw.slug) ?? slug,
      title: typeof raw.title === "string" ? raw.title : "",
      reference: str(raw.reference),
      applications: apps ? { open: apps.open === true, closes_at: str(apps.closes_at), form_name: str(apps.form_name) } : null,
    };
  });
}

const mine = "/v1/me/applications";

export async function listOwnApplications(query: { status?: string; page?: number; pageSize?: number } = {}): Promise<ApiResult<ApplicationPage>> {
  const page = query.page ?? 1;
  const search = new URLSearchParams({ page: String(page), page_size: String(query.pageSize ?? 20) });
  if (query.status) search.set("status", query.status);
  const result = await apiFetch<unknown>(`${mine}?${search}`, { cache: "no-store" });
  return mapped(result, (payload) => normalisePage(payload, page));
}

export const getOwnApplication = async (id: string) =>
  mapped(await apiFetch<unknown>(`${mine}/${encodeURIComponent(id)}`, { cache: "no-store" }), normaliseApplication);

/** A DRAFT, or the existing one for this listing and form version. 409 `APPLICATIONS_CLOSED` when intake is not OPEN. */
export const startApplication = async (listingId: string) =>
  mapped(await apiFetch<unknown>(mine, { method: "POST", body: { listing_id: listingId } }), normaliseApplication);

/** Autosave in DRAFT or MORE_INFO. Each answer is checked; missing required ones are allowed until submit. */
export const saveApplicationAnswers = async (id: string, answers: Answers) =>
  mapped(await apiFetch<unknown>(`${mine}/${encodeURIComponent(id)}`, { method: "PATCH", body: { answers } }), normaliseApplication);

/** 409 `APPLICATIONS_CLOSED` when intake closed meanwhile; field errors for required or invalid answers. */
export const sendApplication = async (id: string) =>
  mapped(await apiFetch<unknown>(`${mine}/${encodeURIComponent(id)}/submit`, { method: "POST" }), normaliseApplication);

export const withdrawApplication = async (id: string) =>
  mapped(await apiFetch<unknown>(`${mine}/${encodeURIComponent(id)}/withdraw`, { method: "POST" }), normaliseApplication);

/** Removes a file from its question; answers with the application. */
export const deleteApplicationFile = async (applicationId: string, fileId: string) =>
  mapped(await apiFetch<unknown>(`${mine}/${encodeURIComponent(applicationId)}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" }), normaliseApplication);

/** Why intake is closed, from a 409 `APPLICATIONS_CLOSED` (`error.details.reason`). */
export function closedReasonOf(failure: ApiFailure): string | null {
  const details = obj(obj(obj(failure.body)?.error)?.details);
  return str(details?.reason);
}

/** The applicant's own file. It opens only with their session. */
export const ownFileUrl = (applicationId: string, fileId: string) =>
  `${env.apiUrl}${mine}/${encodeURIComponent(applicationId)}/files/${encodeURIComponent(fileId)}`;

const uploadMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You cannot add files to this application.",
  409: "This application can no longer be changed.",
  413: "That file is larger than 10 MB.",
  415: "That file type is not accepted.",
  429: "Too many uploads at once. Please wait a minute and try again.",
};

/**
 * Uploads one file for a question (multipart, one `file` part), reporting
 * progress from 0 to 1. `fetch` cannot report how much of a body has been
 * sent, so this uses XMLHttpRequest, as the listing photos do.
 */
export function uploadApplicationFile(
  applicationId: string,
  field: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<{ file_id: string; file: ApplicationFile | null }>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${env.apiUrl}${mine}/${encodeURIComponent(applicationId)}/files?field=${encodeURIComponent(field)}`);
    request.withCredentials = true;
    request.responseType = "text";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onerror = () =>
      resolve({
        ok: false,
        failure: { code: "NETWORK_ERROR", status: 0, message: "We could not reach RightProperty365. Check your connection and try again." },
      });
    request.onload = () => {
      let payload: unknown = null;
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        payload = null;
      }
      if (request.status >= 200 && request.status < 300) {
        const raw = obj(payload) ?? {};
        const described = normaliseFile(raw.file ?? raw);
        const id = str(raw.file_id) ?? described?.id ?? null;
        onProgress(1);
        resolve(
          id
            ? { ok: true, status: request.status, data: { file_id: id, file: described } }
            : { ok: false, failure: { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." } },
        );
        return;
      }
      const envelope = payload as { error?: { code?: string; message?: string; fields?: Record<string, string> }; trace_id?: string } | null;
      const failure: ApiFailure = {
        code: envelope?.error?.code ?? `HTTP_${request.status}`,
        status: request.status,
        message: envelope?.error?.fields?.file ?? envelope?.error?.message ?? uploadMessages[request.status] ?? "Something went wrong on our side. Please try again.",
        fields: envelope?.error?.fields,
        traceId: envelope?.trace_id,
        body: payload ?? undefined,
      };
      resolve({ ok: false, failure });
    };
    const body = new FormData();
    body.append("file", file, file.name);
    request.send(body);
  });
}

// ---- The receiving organisation --------------------------------------------------------------

const received = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}/applications`;

export type ReceivedFilters = { status?: string; listing?: string; q?: string; page: number };

export async function listReceivedApplications(orgId: string, filters: ReceivedFilters): Promise<ApiResult<ApplicationPage>> {
  const search = new URLSearchParams({ page: String(filters.page), page_size: "20" });
  if (filters.status) search.set("status", filters.status);
  if (filters.listing) search.set("listing_id", filters.listing);
  if (filters.q) search.set("q", filters.q);
  const result = await apiFetch<unknown>(`${received(orgId)}?${search}`, { cache: "no-store" });
  return mapped(result, (payload) => normalisePage(payload, filters.page));
}

/** Each read of the answers is recorded (`APPLICATION_VIEWED`). */
export const getReceivedApplication = async (orgId: string, id: string) =>
  mapped(await apiFetch<unknown>(`${received(orgId)}/${encodeURIComponent(id)}`, { cache: "no-store" }), normaliseApplication);

/** 409 `INVALID_APPLICATION_TRANSITION` when the move is not allowed from where it is now. */
export const setApplicationStatus = async (orgId: string, id: string, status: string, note?: string) =>
  mapped(
    await apiFetch<unknown>(`${received(orgId)}/${encodeURIComponent(id)}/status`, { method: "POST", body: note ? { status, note } : { status } }),
    normaliseApplication,
  );

export const requestApplicationInfo = async (orgId: string, id: string, message: string) =>
  mapped(await apiFetch<unknown>(`${received(orgId)}/${encodeURIComponent(id)}/request-info`, { method: "POST", body: { message } }), normaliseApplication);

/** Internal: never shown to the applicant. The answer may be the note or the application; the caller reads again. */
export const addApplicationNote = (orgId: string, id: string, text: string) =>
  apiFetch<unknown>(`${received(orgId)}/${encodeURIComponent(id)}/notes`, { method: "POST", body: { text } });

/** A file of a received application. Each download is recorded (`APPLICATION_FILE_VIEWED`). */
export const receivedFileUrl = (orgId: string, applicationId: string, fileId: string) =>
  `${env.apiUrl}${received(orgId)}/${encodeURIComponent(applicationId)}/files/${encodeURIComponent(fileId)}`;
