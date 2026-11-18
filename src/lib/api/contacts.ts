import { apiFetch, apiFetchFile } from "@/lib/api/http";
import type { ContactStage } from "@/lib/contacts";

/*
 * The agent contact book (API 0.31.0, BR-004 / FR-014): an organisation's
 * private, shared book of buyers, tenants, landlords and owners, under
 * `/v1/agent/organisations/{orgId}/contacts`. Read by every member of the
 * organisation; written by OWNER, MANAGER and AGENT; imported and exported by
 * OWNER and MANAGER. Another organisation's contact is always 404
 * `CONTACT_NOT_FOUND`. The customer never sees any of it.
 *
 * The contract fixes the endpoints and request bodies; the shapes of the
 * answers below are read defensively (optional fields), and every change
 * reads the contact again rather than trusting an answer's shape.
 */

export type { ContactStage } from "@/lib/contacts";

export type ContactPerson = { user_id: string; name: string };

/** Stored as `{granted, granted_at, source, recorded_by}`. */
export type MarketingPermission = {
  granted: boolean;
  granted_at: string | null;
  source: string | null;
  recorded_by?: ContactPerson | string | null;
};

/** One contact as the list shows it. */
export type ContactSummary = {
  id: string;
  name: string;
  /** A code of the `contact_types` reference set. */
  type: string;
  type_label?: string | null;
  stage: ContactStage | string;
  stage_label?: string | null;
  emails: string[];
  phones: string[];
  tags: string[];
  /** The relationship owner: a field, not a visibility rule. */
  owner?: ContactPerson | null;
  owner_user_id?: string | null;
  /** A code of the `contact_sources` reference set. */
  source?: string | null;
  source_label?: string | null;
  marketing?: MarketingPermission | null;
  last_contact_at?: string | null;
  created_at: string;
  updated_at?: string;
  /** A reminder that is not done is due. */
  has_reminder_due?: boolean;
  next_reminder_at?: string | null;
};

export type ContactNote = {
  id: string;
  text: string;
  author?: ContactPerson | null;
  author_name?: string | null;
  created_at: string;
};

export type ContactReminder = {
  id: string;
  due_at: string;
  text: string;
  done: boolean;
  done_at?: string | null;
  created_by?: ContactPerson | null;
  created_at?: string;
};

export type ContactListing = { listing_id: string; title?: string | null; reference?: string | null; slug?: string | null };

/** Something the contact is linked to: a property request, business enquiry, appointment… */
export type ContactLink = { kind: string; id: string; label?: string | null; reference?: string | null };

/** One contact in full. */
export type Contact = ContactSummary & {
  notes?: ContactNote[];
  reminders?: ContactReminder[];
  listings?: ContactListing[];
  links?: ContactLink[];
  /** Set on a tombstone left by a merge: the contact it went into. */
  merged_into?: string | null;
  created_by?: ContactPerson | null;
};

export type ContactStageCount = { stage: ContactStage | string; label?: string | null; count: number };

export type ContactPage = {
  items: ContactSummary[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  /** Every stage with its count under every filter except `stage`, when the API sends it. */
  /** API 0.31: a map of stage → count. A list of ContactStageCount is also accepted. */
  stage_counts?: Record<string, number> | ContactStageCount[];
};

/**
 * One entry of the timeline, newest first: a note, a stage or owner change, a
 * reminder, or a linked property request, business enquiry or appointment.
 */
export type ContactTimelineEntry = {
  id?: string;
  /** NOTE_ADDED, STAGE_CHANGED, OWNER_CHANGED, REMINDER_ADDED, REMINDER_DONE, PROPERTY_REQUEST, BUSINESS_ENQUIRY, APPOINTMENT, MERGED… */
  kind: string;
  /** The API's words for the entry, when it sends them. */
  label?: string | null;
  text?: string | null;
  at: string;
  actor?: ContactPerson | null;
  actor_name?: string | null;
  from_stage?: string | null;
  to_stage?: string | null;
  from_owner?: ContactPerson | null;
  to_owner?: ContactPerson | null;
  due_at?: string | null;
  /** For a linked item: what it is and its id, to link to its page. */
  ref?: { kind: string; id: string; reference?: string | null; label?: string | null } | null;
};

export type DueReminder = ContactReminder & { contact: { id: string; name: string } };

export type ImportRowStatus = "CREATE" | "DUPLICATE" | "ERROR";

export type ImportRow = {
  /** The row number in the file, the header being row 1. */
  row: number;
  status: ImportRowStatus | string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** DUPLICATE: the contact it matches. */
  duplicate_of?: string | null;
  duplicate_of_name?: string | null;
  /** ERROR: what is wrong, per column or as sentences. */
  errors?: Record<string, string> | string[] | null;
  message?: string | null;
};

export type ImportReport = {
  dry_run?: boolean;
  rows?: ImportRow[];
  summary?: { total?: number; create?: number; duplicate?: number; error?: number; created?: number; skipped?: number };
  created?: number;
  skipped?: number;
  errors?: number;
};

export type ContactInput = {
  name: string;
  emails: string[];
  phones: string[];
  type: string;
  tags: string[];
  owner_user_id?: string;
  source?: string;
  stage?: string;
  marketing_permission?: { granted: boolean; source: string };
  notes?: string;
};

/** Every key optional for PATCH. */
export type ContactPatch = Partial<Omit<ContactInput, "notes" | "owner_user_id" | "stage">>;

const base = (orgId: string) => `/v1/agent/organisations/${encodeURIComponent(orgId)}/contacts`;
const one = (orgId: string, id: string) => `${base(orgId)}/${encodeURIComponent(id)}`;

/** `query` comes from `contactFiltersApiQuery`. */
export const listContacts = (orgId: string, query = "") =>
  apiFetch<ContactPage>(`${base(orgId)}${query}`, { cache: "no-store" });

/** 409 `CONTACT_DUPLICATE` with `{duplicates: [ids]}` unless `allowDuplicate`. */
export const createContact = (orgId: string, input: ContactInput, allowDuplicate = false) =>
  apiFetch<{ contact: Contact }>(`${base(orgId)}${allowDuplicate ? "?allow_duplicate=true" : ""}`, {
    method: "POST",
    body: input,
  });

export const getContact = (orgId: string, id: string) =>
  apiFetch<{ contact: Contact }>(one(orgId, id), { cache: "no-store" });

export const updateContact = (orgId: string, id: string, patch: ContactPatch) =>
  apiFetch<{ contact: Contact }>(one(orgId, id), { method: "PATCH", body: patch });

/** A soft delete. */
export const deleteContact = (orgId: string, id: string) => apiFetch<null>(one(orgId, id), { method: "DELETE" });

/** Append-only: correcting a note means a new note. */
export const addContactNote = (orgId: string, id: string, text: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/notes`, { method: "POST", body: { text } });

export const addContactReminder = (orgId: string, id: string, input: { due_at: string; text: string }) =>
  apiFetch<unknown>(`${one(orgId, id)}/reminders`, { method: "POST", body: input });

export const setContactReminderDone = (orgId: string, id: string, reminderId: string, done: boolean) =>
  apiFetch<unknown>(`${one(orgId, id)}/reminders/${encodeURIComponent(reminderId)}`, { method: "PATCH", body: { done } });

/** Any stage may move to any other; each move is appended to the activity log. */
export const moveContactStage = (orgId: string, id: string, stage: string, note?: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/stage`, { method: "POST", body: note ? { stage, note } : { stage } });

/** OWNER and MANAGER, or the current owner. Logged. */
export const setContactOwner = (orgId: string, id: string, userId: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/owner`, { method: "POST", body: { user_id: userId } });

/** Listings of this organisation only. */
export const linkContactListing = (orgId: string, id: string, listingId: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/listings`, { method: "POST", body: { listing_id: listingId } });

export const unlinkContactListing = (orgId: string, id: string, listingId: string) =>
  apiFetch<unknown>(`${one(orgId, id)}/listings/${encodeURIComponent(listingId)}`, { method: "DELETE" });

export const getContactTimeline = (orgId: string, id: string) =>
  apiFetch<{ items: ContactTimelineEntry[] }>(`${one(orgId, id)}/timeline`, { cache: "no-store" });

/** Moves everything onto `keep`; the others stay as tombstones pointing at it. Logged. */
export const mergeContacts = (orgId: string, keepId: string, mergeIds: string[]) =>
  apiFetch<unknown>(`${base(orgId)}/merge`, { method: "POST", body: { keep_id: keepId, merge_ids: mergeIds } });

/**
 * A multipart CSV (`file`), at most 5,000 rows. `dryRun`: the preview and a
 * report per row; the real run creates only the rows that were valid in it
 * and never overwrites. OWNER and MANAGER only.
 */
export function importContacts(orgId: string, file: File, dryRun: boolean) {
  const body = new FormData();
  body.append("file", file, file.name);
  return apiFetch<ImportReport>(`${base(orgId)}/import${dryRun ? "?dry_run=true" : ""}`, { method: "POST", body });
}

/** OWNER and MANAGER only, audited. A CSV with `Content-Disposition`. */
export const exportContacts = (orgId: string) => apiFetchFile(`${base(orgId)}/export.csv`);

/**
 * Creates a contact from a property request, business enquiry or appointment
 * the caller can see, or links it to the matching existing contact. Returns
 * the contact.
 */
export const contactFromRequest = (orgId: string, requestId: string) =>
  apiFetch<{ contact: Contact }>(`${base(orgId)}/from-request/${encodeURIComponent(requestId)}`, { method: "POST" });

/** For the dashboard. */
export const listDueReminders = (orgId: string, due: "today" | "overdue" | "week") =>
  apiFetch<{ items: DueReminder[] }>(`${base(orgId)}/reminders?due=${due}`, { cache: "no-store" });
