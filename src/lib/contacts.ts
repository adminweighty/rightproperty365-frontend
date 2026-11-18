/**
 * The rules of the agent contact book (`/agent/contacts`, API 0.31.0) that
 * are not the API's: stage words and tones, the list's filters in the page
 * address and in the API query, the "filters in use" chips, the merge
 * preview, the client-side check of a CSV before it is uploaded, and where a
 * timeline entry links to. Pure functions with no imports, so `npm test`
 * (scripts/contacts.test.mjs) runs them directly.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable.
 */

// ---- Lead stages ---------------------------------------------------------------

/** The lead stages of a contact, in pipeline order. A fixed enum of the API. */
export const CONTACT_STAGES = [
  "NEW",
  "CONTACTED",
  "VIEWING_REQUESTED",
  "VIEWING_CONFIRMED",
  "NEGOTIATING",
  "CLOSED",
  "UNSUCCESSFUL",
] as const;

export type ContactStage = (typeof CONTACT_STAGES)[number];

export const isContactStage = (value: unknown): value is ContactStage =>
  typeof value === "string" && (CONTACT_STAGES as readonly string[]).includes(value);

/**
 * Used only when neither the API's `stage_label` nor a reference set gives the
 * words: the stages are a fixed enum, so this is the one list of their names
 * written in the app (as `platformRoleLabels` is for administrator roles).
 */
const STAGE_FALLBACK: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  VIEWING_REQUESTED: "Viewing requested",
  VIEWING_CONFIRMED: "Viewing confirmed",
  NEGOTIATING: "Negotiating",
  CLOSED: "Closed",
  UNSUCCESSFUL: "Unsuccessful",
};

/** "VIEWING_REQUESTED" -> "Viewing requested": the last resort for a code with no label. */
export function sentenceFromCode(code: string): string {
  const words = code.toLowerCase().split(/[_\s-]+/).filter(Boolean).join(" ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : code;
}

/** The words for a stage: the API's label, else the reference set's, else the fallback. */
export function stageLabel(stage: string, labels: Record<string, string> = {}, apiLabel?: string | null): string {
  return apiLabel || labels[stage] || STAGE_FALLBACK[stage] || sentenceFromCode(stage);
}

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

/** New ones stand out, finished ones are quiet. The word is always shown with the colour. */
const STAGE_TONES: Record<string, Tone> = {
  NEW: "primary",
  CONTACTED: "info",
  VIEWING_REQUESTED: "accent",
  VIEWING_CONFIRMED: "accent",
  NEGOTIATING: "warning",
  CLOSED: "success",
  UNSUCCESSFUL: "neutral",
};

export const stageTone = (stage: string): Tone => STAGE_TONES[stage] ?? "neutral";

/** Every stage as a drop-down option, in pipeline order. */
export const stageOptions = (labels: Record<string, string> = {}) =>
  CONTACT_STAGES.map((stage) => ({ value: stage, label: stageLabel(stage, labels) }));

// ---- Who may do what (for showing the right controls; the API decides) --------------

const WRITERS = ["OWNER", "MANAGER", "AGENT"];
const EXPORTERS = ["OWNER", "MANAGER"];

/** Create, edit, notes, reminders, stage and merge. STAFF read only. */
export const canWriteContacts = (role: string | null | undefined) => WRITERS.includes(role ?? "");

/** Import and export. */
export const canExportContacts = (role: string | null | undefined) => EXPORTERS.includes(role ?? "");

/** Reassigning the relationship owner: an OWNER or MANAGER, or the current owner. */
export const canReassignOwner = (role: string | null | undefined, ownerId: string | null | undefined, userId: string) =>
  EXPORTERS.includes(role ?? "") || (Boolean(ownerId) && ownerId === userId && canWriteContacts(role));

// ---- The list's filters -------------------------------------------------------------

export const CONTACT_SORTS = ["last_contact", "name", "created"] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

/** The API's limits on the free-text search and on a tag. */
export const CONTACT_QUERY_MAX = 100;
export const TAG_MAX = 50;

export type ContactFilters = {
  q?: string;
  type?: string;
  stage?: string;
  tag?: string;
  /** A member's user id. */
  owner?: string;
  /** Only contacts with a reminder due (`has_reminder_due`). */
  due?: boolean;
  /** Absent: the API's default order (last contact). */
  sort?: string;
  page: number;
};

type Params = { get(name: string): string | null };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{1,64}$/;

export const isUuid = (value: string | null | undefined) => UUID.test(value ?? "");

/** A page number from the address: a whole number from 1, else 1. */
export function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** The filters in a page address. Anything the API would refuse is dropped, so the list still loads. */
export function parseContactFilters(params: Params): ContactFilters {
  const filters: ContactFilters = { page: pageNumber(params.get("page")) };
  const q = (params.get("q") ?? "").trim().slice(0, CONTACT_QUERY_MAX);
  const type = params.get("type") ?? "";
  const stage = params.get("stage") ?? "";
  const tag = (params.get("tag") ?? "").trim().slice(0, TAG_MAX);
  const owner = params.get("owner") ?? "";
  const due = params.get("due") ?? "";
  const sort = params.get("sort") ?? "";
  if (q) filters.q = q;
  if (CODE.test(type)) filters.type = type;
  if (isContactStage(stage)) filters.stage = stage;
  if (tag) filters.tag = tag;
  if (isUuid(owner)) filters.owner = owner;
  if (due === "1" || due === "true") filters.due = true;
  if ((CONTACT_SORTS as readonly string[]).includes(sort) && sort !== "last_contact") filters.sort = sort;
  return filters;
}

/** True when anything other than the stage, the sort and the page narrows the list. */
export const hasNarrowingContactFilters = (filters: ContactFilters) =>
  Boolean(filters.q || filters.type || filters.tag || filters.owner || filters.due);

/**
 * The page address's query: "" or "?org=…&stage=…&page=2". The organisation
 * comes first when there is one to keep; page 1 is left out.
 */
export function contactFiltersSearch(filters: ContactFilters, org?: string): string {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const key of ["q", "type", "stage", "tag", "owner"] as const) {
    const value = filters[key];
    if (value) search.set(key, value);
  }
  if (filters.due) search.set("due", "1");
  if (filters.sort) search.set("sort", filters.sort);
  if (filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** The API query for these filters (`GET …/contacts`). */
export function contactFiltersApiQuery(filters: ContactFilters, pageSize = 20): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.type) search.set("type", filters.type);
  if (filters.stage) search.set("stage", filters.stage);
  if (filters.tag) search.set("tag", filters.tag);
  if (filters.owner) search.set("owner", filters.owner);
  if (filters.due) search.set("has_reminder_due", "true");
  if (filters.sort) search.set("sort", filters.sort);
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search.toString()}`;
}

export type FilterChip = { key: string; label: string; href: string };

/**
 * The filters in use as removable chips, in the order of the form. Each chip
 * is the address of the same list without that filter (and back at page 1).
 * The stage has its own row of links, and the sort is not a filter.
 */
export function contactFilterChips(
  filters: ContactFilters,
  words: { type?: (code: string) => string; owner?: (id: string) => string },
  hrefFor: (filters: ContactFilters) => string,
): FilterChip[] {
  const without = (key: keyof ContactFilters): string => {
    const next: ContactFilters = { ...filters, page: 1 };
    delete next[key];
    return hrefFor(next);
  };
  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, href: without("q") });
  if (filters.type) chips.push({ key: "type", label: words.type?.(filters.type) ?? filters.type, href: without("type") });
  if (filters.tag) chips.push({ key: "tag", label: `Tag: ${filters.tag}`, href: without("tag") });
  if (filters.owner) {
    chips.push({ key: "owner", label: `Owner: ${words.owner?.(filters.owner) ?? "a colleague"}`, href: without("owner") });
  }
  if (filters.due) chips.push({ key: "due", label: "Reminder due", href: without("due") });
  return chips;
}

// ---- Emails, phones and tags -----------------------------------------------------------

/** Trimmed, without empties and without repeats (ignoring case), in the order given. */
export function cleanList(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** An email address for comparing: trimmed and lower case. */
export const normaliseEmail = (value: string) => value.trim().toLowerCase();

/** A phone number for comparing: only the digits, with a leading + kept. */
export function normalisePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plain-words problem with an email address, or null. */
export function emailProblem(value: string): string | null {
  return EMAIL.test(value.trim()) ? null : "Enter an email address like name@example.com.";
}

/** A plain-words problem with a phone number, or null. The API stores it in E.164. */
export function phoneProblem(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+")) return "Enter the phone number with the country code, starting with +.";
  if (digits.length < 7 || digits.length > 15) return "Enter a phone number of 7 to 15 digits after the +.";
  return null;
}

// ---- Duplicates and answers ------------------------------------------------------------

/**
 * The ids in a 409 `CONTACT_DUPLICATE` answer: `{duplicates: [ids]}` at the
 * top of the body, or inside its `error` (or `error.details`).
 */
export function duplicateIdsFrom(body: unknown): string[] {
  const pick = (value: unknown): string[] | null => {
    if (!value || typeof value !== "object") return null;
    const list = (value as { duplicates?: unknown }).duplicates;
    if (!Array.isArray(list)) return null;
    return list
      .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? (item as { id?: unknown }).id : null))
      .filter((item): item is string => typeof item === "string" && item.length > 0);
  };
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  const details = error && typeof error === "object" ? (error as { details?: unknown }).details : undefined;
  return pick(body) ?? pick(error) ?? pick(details) ?? [];
}

/** The id of the contact in an answer: `{contact: {id}}`, or the contact itself. */
export function contactIdFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const contact = (data as { contact?: unknown }).contact;
  const source = contact && typeof contact === "object" ? contact : data;
  const id = (source as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

// ---- Merge preview -----------------------------------------------------------------------

export type MergeSide = {
  id: string;
  emails: readonly string[];
  phones: readonly string[];
  tags: readonly string[];
  notes?: readonly unknown[];
  reminders?: readonly unknown[];
  listings?: readonly unknown[];
  links?: readonly unknown[];
};

export type MergePreview = {
  /** Addresses, numbers and tags `keep` does not have yet, in the order found. */
  emails: string[];
  phones: string[];
  tags: string[];
  notes: number;
  reminders: number;
  listings: number;
  links: number;
};

/** What a merge moves onto `keep`: nothing is lost, and nothing already there is counted twice. */
export function mergePreview(keep: MergeSide, others: readonly MergeSide[]): MergePreview {
  const emails = new Set(keep.emails.map(normaliseEmail));
  const phones = new Set(keep.phones.map(normalisePhone));
  const tags = new Set(keep.tags.map((tag) => tag.trim().toLowerCase()));
  const preview: MergePreview = { emails: [], phones: [], tags: [], notes: 0, reminders: 0, listings: 0, links: 0 };
  for (const other of others) {
    if (other.id === keep.id) continue;
    for (const email of other.emails) {
      const key = normaliseEmail(email);
      if (key && !emails.has(key)) {
        emails.add(key);
        preview.emails.push(email.trim());
      }
    }
    for (const phone of other.phones) {
      const key = normalisePhone(phone);
      if (key && !phones.has(key)) {
        phones.add(key);
        preview.phones.push(phone.trim());
      }
    }
    for (const tag of other.tags) {
      const key = tag.trim().toLowerCase();
      if (key && !tags.has(key)) {
        tags.add(key);
        preview.tags.push(tag.trim());
      }
    }
    preview.notes += other.notes?.length ?? 0;
    preview.reminders += other.reminders?.length ?? 0;
    preview.listings += other.listings?.length ?? 0;
    preview.links += other.links?.length ?? 0;
  }
  return preview;
}

// ---- CSV, checked before it is uploaded ---------------------------------------------------

/** The API's limit on one import. */
export const IMPORT_MAX_ROWS = 5000;
/** A generous ceiling on the file itself, so a wrong file is caught before it is sent. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Splits CSV text into rows of cells (RFC 4180: quoted cells may hold commas,
 * line breaks and doubled quotes). A leading byte-order mark is dropped, and
 * empty lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const endRow = () => {
    row.push(cell);
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

export type CsvCheck =
  | { ok: true; headers: string[]; rows: number }
  | { ok: false; problem: string };

/**
 * A first look at a file before it is sent for the API's preview: a header
 * row with a name column, at least one row and at most 5,000. The API's
 * preview, row by row, is what decides.
 */
export function checkContactCsv(text: string, maxRows = IMPORT_MAX_ROWS): CsvCheck {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, problem: "The file is empty. Choose a CSV file with a header row and one contact per row." };
  const headers = rows[0].map((cell) => cell.trim());
  if (!headers.some((header) => header.toLowerCase() === "name")) {
    return { ok: false, problem: "The first row must name the columns, and one of them must be “name”." };
  }
  const count = rows.length - 1;
  if (count === 0) return { ok: false, problem: "The file has a header row but no contacts under it." };
  if (count > maxRows) {
    return {
      ok: false,
      problem: `The file has ${count.toLocaleString("en-GB")} contacts. Import at most ${maxRows.toLocaleString("en-GB")} at a time: split it into smaller files.`,
    };
  }
  return { ok: true, headers, rows: count };
}

// ---- Timeline links --------------------------------------------------------------------------

/**
 * The page of something a timeline entry is about, or null when this site has
 * no page for it (shown as plain text, never as a link that leads nowhere).
 */
export function linkedItemHref(kind: string | null | undefined, id: string | null | undefined, org?: string): string | null {
  if (!kind) return null;
  const safe = id ? encodeURIComponent(id) : "";
  switch (kind.toUpperCase()) {
    case "PROPERTY_REQUEST":
      return safe ? `/agent/requests/${safe}` : "/agent/requests";
    case "BUSINESS_ENQUIRY":
      return "/agent/requests#business-enquiries";
    case "APPOINTMENT":
      return "/agent/appointments";
    case "LISTING":
      return safe ? `/agent/listings/${safe}` : null;
    case "CONTACT":
      return safe ? `/agent/contacts/${safe}${org ? `?org=${encodeURIComponent(org)}` : ""}` : null;
    default:
      return null;
  }
}

/** The address of a contact's page, keeping the organisation. */
export const contactHref = (id: string, org?: string) =>
  `/agent/contacts/${encodeURIComponent(id)}${org ? `?org=${encodeURIComponent(org)}` : ""}`;

/** An address in the contact book (`/agent/contacts/pipeline`…) for an organisation. */
export const contactsPath = (path: string, org?: string, extra: Record<string, string | undefined> = {}) => {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
  const text = search.toString();
  return `/agent/contacts${path}${text ? `?${text}` : ""}`;
};

// ---- Times -----------------------------------------------------------------------------------

/** A `datetime-local` value ("2026-11-18T09:30") as an instant in UTC, or null when it is not one. */
export function localDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const at = new Date(year, month - 1, day, hour, minute);
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day || at.getHours() !== hour) return null;
  return at.toISOString();
}

/** True when a reminder that is not done is due at or before `now`. */
export const isReminderDue = (reminder: { due_at: string; done: boolean }, now: number) =>
  !reminder.done && Date.parse(reminder.due_at) <= now;

/**
 * The API sends stage counts as a map ({ "NEW": 3, ... }); older drafts of
 * the contract had a list of { stage, label, count }. Accept both.
 */
export function normaliseStageCounts(
  raw: unknown,
): { stage: string; label?: string | null; count: number }[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is { stage: string; label?: string | null; count: number } =>
        Boolean(item) && typeof item.stage === "string" && typeof item.count === "number")
      .map((item) => ({ stage: item.stage, label: item.label ?? null, count: item.count }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number")
      .map(([stage, count]) => ({ stage, count: count as number }));
  }
  return [];
}
