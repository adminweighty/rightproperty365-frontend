/**
 * The rules of maintenance requests (`/agent/maintenance`, the tenancy page's
 * Maintenance section and the tenant's "Report a problem" on
 * `/account/tenancies/<id>`, API 0.36.2, BR-019, FR-047) that are not the
 * API's, as pure functions: the words and tones of statuses and priorities,
 * the status flow and the moves a request may make, the checks on photos and
 * on the forms (new request, comment, assignment, cost), their request
 * bodies, the list filters in the page address and the API query, the
 * board's columns, page addresses, the timeline in words, and tolerant
 * readers for the API's answers.
 *
 * Money is the API's decimal string with its ISO 4217 code, formatted by
 * `formatLedgerAmount` in `lib/ledger.ts`; costs in different currencies are
 * never added together (the API gives `cost_totals` per currency).
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/maintenance.test.mjs).
 * The amount check is passed in (`amountProblem` from `lib/ledger.ts`).
 */

// ---- Words ----------------------------------------------------------------------------------------

/** "doors-windows" -> "Doors windows"; "IN_PROGRESS" -> "In progress". */
export function wordsFromCode(code: string): string {
  const words = code.toLowerCase().replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

// ---- Statuses and the flow ---------------------------------------------------------------------------

export const MAINTENANCE_STATUSES = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const isMaintenanceStatus = (value: unknown): value is MaintenanceStatus =>
  typeof value === "string" && (MAINTENANCE_STATUSES as readonly string[]).includes(value);

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<MaintenanceStatus, Tone> = {
  NEW: "info",
  TRIAGED: "primary",
  ASSIGNED: "accent",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  CANCELLED: "neutral",
};

export const maintenanceStatusLabel = (status: string, apiLabel?: string | null) =>
  apiLabel || (isMaintenanceStatus(status) ? STATUS_LABELS[status] : wordsFromCode(status));

export const maintenanceStatusTone = (status: string): Tone => (isMaintenanceStatus(status) ? STATUS_TONES[status] : "neutral");

/** One sentence per status, for the team. */
export const STATUS_EXPLAINED: Record<MaintenanceStatus, string> = {
  NEW: "Reported and not looked at yet.",
  TRIAGED: "Looked at. Assign a service provider, or start the work.",
  ASSIGNED: "A service provider has been sent an enquiry about the work.",
  IN_PROGRESS: "The work is under way.",
  RESOLVED: "The work is done. Close the request, or reopen it if the problem is back.",
  CLOSED: "Finished. Nothing more is expected.",
  CANCELLED: "Will not be done.",
};

/** One sentence per status, for the tenant. */
export const TENANT_STATUS_EXPLAINED: Record<MaintenanceStatus, string> = {
  NEW: "Your landlord or agent has your report and will look at it.",
  TRIAGED: "Your landlord or agent has looked at it and is arranging the work.",
  ASSIGNED: "Someone has been asked to do the work.",
  IN_PROGRESS: "The work is under way.",
  RESOLVED: "The work is done. If it is not, say so in a comment.",
  CLOSED: "Finished.",
  CANCELLED: "Your landlord or agent cancelled this request.",
};

/**
 * The moves `POST .../status` accepts (API 0.36.2). ASSIGNED is reached only
 * by assigning a provider (`POST .../assign`, from NEW, TRIAGED or
 * ASSIGNED), which sends the provider an enquiry. CLOSED and CANCELLED are
 * final; a resolved request may be reopened (back to IN_PROGRESS).
 */
export const TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  NEW: ["TRIAGED", "CANCELLED"],
  TRIAGED: ["IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

/** Assigning a provider is possible from these statuses. */
export const ASSIGNABLE: readonly MaintenanceStatus[] = ["NEW", "TRIAGED", "ASSIGNED"];

export const isFinalStatus = (status: string) => status === "CLOSED" || status === "CANCELLED";
export const isOpenStatus = (status: string) => isMaintenanceStatus(status) && !isFinalStatus(status);

/**
 * The statuses a request may move to from `status`, in flow order. The API's
 * own list (the request's `can.transitions`, or the options' `transitions`)
 * wins when it sends one: it knows the caller's rights. Never the status it
 * already has, never ASSIGNED (that is an assignment), never an unknown code.
 */
export function allowedTransitions(status: string, apiAllowed?: readonly string[] | null): MaintenanceStatus[] {
  const list: readonly string[] = apiAllowed ?? (isMaintenanceStatus(status) ? TRANSITIONS[status] : []);
  return MAINTENANCE_STATUSES.filter((item) => item !== status && item !== "ASSIGNED" && list.includes(item));
}

export const canMoveTo = (from: string, to: string, apiAllowed?: readonly string[] | null) =>
  (allowedTransitions(from, apiAllowed) as string[]).includes(to);

/** A cancellation needs its reason (1-500). Any other move may carry a note. */
export const moveNeedsNote = (_from: string, to: string) => to === "CANCELLED";

/** "Move to in progress", "Reopen (back to in progress)", "Cancel the request". */
export function moveWords(from: string, to: string, label?: string | null): string {
  if (to === "CANCELLED") return "Cancel the request";
  if (from === "RESOLVED" && to === "IN_PROGRESS") return "Reopen (back to in progress)";
  if (to === "CLOSED") return "Close the request";
  return `Move to ${maintenanceStatusLabel(to, label).toLowerCase()}`;
}

/** The `allowed` list of a `409 MAINTENANCE_INVALID_TRANSITION`, or null. */
export function allowedFromConflict(body: unknown): string[] | null {
  const details = obj(obj(obj(body)?.error)?.details) ?? obj(obj(body)?.details);
  const allowed = details?.allowed;
  return Array.isArray(allowed) ? allowed.filter((item): item is string => typeof item === "string") : null;
}

// ---- Priorities and categories (admin-editable reference sets, lower-case codes) ----------------------

export type Choice = { code: string; label: string };

/** The seeded defaults, until (or when) the API's sets are read. */
export const DEFAULT_PRIORITIES: readonly Choice[] = [
  { code: "low", label: "Low" },
  { code: "normal", label: "Normal" },
  { code: "high", label: "High" },
  { code: "urgent", label: "Urgent (safety, no water or power)" },
];

export const DEFAULT_CATEGORIES: readonly Choice[] = [
  { code: "plumbing", label: "Plumbing" },
  { code: "electrical", label: "Electrical" },
  { code: "appliances", label: "Appliances" },
  { code: "structure", label: "Walls, roof and structure" },
  { code: "doors-windows", label: "Doors, windows and locks" },
  { code: "pests", label: "Pests" },
  { code: "garden", label: "Garden and grounds" },
  { code: "other", label: "Other" },
];

const labelIn = (list: readonly Choice[], code: string) => list.find((item) => item.code === code.toLowerCase())?.label;

const PRIORITY_TONES: Record<string, Tone> = { low: "neutral", normal: "info", high: "warning", urgent: "danger" };
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const priorityLabel = (code: string, apiLabel?: string | null) => apiLabel || labelIn(DEFAULT_PRIORITIES, code) || wordsFromCode(code);
export const priorityTone = (code: string): Tone => PRIORITY_TONES[code.toLowerCase()] ?? "neutral";
/** Most urgent first; a priority added by an admin after the seeded ones. */
export const priorityRank = (code: string) => PRIORITY_RANK[code.toLowerCase()] ?? 4;

export const categoryLabel = (code: string, apiLabel?: string | null) => apiLabel || labelIn(DEFAULT_CATEGORIES, code) || wordsFromCode(code);

/** The API's reference items, or the defaults when it sends none. */
export function choicesOr(list: readonly Choice[] | null | undefined, defaults: readonly Choice[]): Choice[] {
  return list && list.length ? [...list] : [...defaults];
}

/** The default priority of a new request: "normal" when the set has it, else its first. */
export function defaultPriority(priorities: readonly Choice[]): string {
  return priorities.some((item) => item.code === "normal") ? "normal" : (priorities[0]?.code ?? "normal");
}

// ---- Who sees which controls -----------------------------------------------------------------------------

const WRITERS = ["OWNER", "MANAGER", "AGENT"];

/** OWNER, MANAGER and AGENT change requests; STAFF read them. */
export const canWriteMaintenance = (role: string | null | undefined) => WRITERS.includes(role ?? "");

export type MaintenanceCan = { edit: boolean; transitions: string[] | null; assign: boolean; addCost: boolean; comment: boolean; addPhoto: boolean };

/** What the page offers on a request: the API's `can` when it sends one, else the role and the status. */
export function maintenanceActions(request: { status: string; can: MaintenanceCan | null }, role: string | null | undefined) {
  const writer = canWriteMaintenance(role);
  const can = request.can;
  if (can) {
    return {
      moves: allowedTransitions(request.status, can.transitions ?? []),
      assign: can.assign,
      addCost: can.addCost,
      comment: can.comment,
      addPhoto: can.addPhoto,
      edit: can.edit,
    };
  }
  const open = isOpenStatus(request.status);
  return {
    moves: writer ? allowedTransitions(request.status) : [],
    assign: writer && (ASSIGNABLE as readonly string[]).includes(request.status),
    addCost: writer,
    comment: writer,
    addPhoto: writer && open,
    edit: writer && open,
  };
}

// ---- Photos ------------------------------------------------------------------------------------------

export type PhotoRules = { maxPhotos: number; maxBytes: number; types: string[] };

/** Images only (the API decides by the bytes), kept in private storage and re-encoded without metadata. */
export const DEFAULT_PHOTO_RULES: PhotoRules = { maxPhotos: 10, maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] };

const EXTENSIONS: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };

/** For `<input type="file" accept>`. */
export function photoAccept(rules: PhotoRules = DEFAULT_PHOTO_RULES): string {
  const extensions = rules.types.flatMap((type) => (EXTENSIONS[type] ?? []).map((ext) => `.${ext}`));
  return [...extensions, ...rules.types].join(",");
}

/** "JPEG, PNG or WebP". */
export function photoTypeWords(rules: PhotoRules = DEFAULT_PHOTO_RULES): string {
  const names = rules.types.map((type) => (type === "image/jpeg" ? "JPEG" : type === "image/png" ? "PNG" : type === "image/webp" ? "WebP" : type.replace(/^image\//, "").toUpperCase()));
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

export const megabytes = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

export type FileLike = { name: string; type: string; size: number };

/** Why a file cannot be sent as a photo of the problem, in words, or null. A file with no type is judged by its name. */
export function maintenancePhotoProblem(file: FileLike, rules: PhotoRules = DEFAULT_PHOTO_RULES): string | null {
  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  const known = file.type
    ? rules.types.includes(file.type.toLowerCase())
    : rules.types.some((type) => (EXTENSIONS[type] ?? []).includes(extension));
  if (!known) return `${file.name} is not a photo we accept. Choose a ${photoTypeWords(rules)} image.`;
  if (file.size === 0) return `${file.name} is empty. Choose another photo.`;
  if (file.size > rules.maxBytes) return `${file.name} is larger than ${megabytes(rules.maxBytes)}. Choose a smaller photo.`;
  return null;
}

/**
 * Splits the files chosen into those that may be added (up to the limit,
 * counting the photos the request has and those already chosen) and the
 * problems with the rest, in words.
 */
export function sortPhotos<T extends FileLike>(files: readonly T[], already: number, rules: PhotoRules = DEFAULT_PHOTO_RULES) {
  const accepted: T[] = [];
  const problems: string[] = [];
  let room = Math.max(0, rules.maxPhotos - already);
  for (const file of files) {
    const problem = maintenancePhotoProblem(file, rules);
    if (problem) {
      problems.push(problem);
      continue;
    }
    if (room === 0) {
      problems.push(`${file.name} was not added: a request can have up to ${rules.maxPhotos} photos.`);
      continue;
    }
    accepted.push(file);
    room -= 1;
  }
  return { accepted, problems };
}

/** "3 of 10 photos". */
export const photoCountWords = (count: number, limit: number = DEFAULT_PHOTO_RULES.maxPhotos) => `${count} of ${limit} ${limit === 1 ? "photo" : "photos"}`;

// ---- Forms --------------------------------------------------------------------------------------------

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const COMMENT_MAX = 2000;
export const NOTE_MAX = 500;
export const ASSIGN_MESSAGE_MAX = 1500;
export const COST_DESCRIPTION_MAX = 500;

export type RequestForm = {
  propertyId: string;
  unitId: string;
  tenancyId: string;
  category: string;
  priority: string;
  title: string;
  description: string;
};

export const emptyRequestForm = (priority = "normal"): RequestForm => ({
  propertyId: "",
  unitId: "",
  tenancyId: "",
  category: "",
  priority,
  title: "",
  description: "",
});

export type RequestField = keyof RequestForm;
export type RequestProblems = Partial<Record<RequestField, string>>;

/**
 * The checks the browser can make. `tenant`: the tenant's own form, which
 * has no property, unit or tenancy (the tenancy says where). A unit is never
 * required: a request may be for the whole property.
 */
export function requestFormProblems(form: RequestForm, options: { tenant?: boolean } = {}): RequestProblems {
  const problems: RequestProblems = {};
  if (!options.tenant && !form.propertyId) problems.propertyId = "Choose the property.";
  if (!form.priority) problems.priority = "Choose how urgent it is.";
  if (!form.category) problems.category = "Choose what kind of problem it is.";
  const title = form.title.trim();
  if (!title) problems.title = "Say in a few words what is wrong.";
  else if (title.length > TITLE_MAX) problems.title = `Use at most ${TITLE_MAX} characters.`;
  if (form.description.trim().length > DESCRIPTION_MAX) problems.description = `Use at most ${DESCRIPTION_MAX} characters.`;
  return problems;
}

export const hasProblems = (problems: Record<string, unknown>) => Object.values(problems).some(Boolean);

/** The body of `POST /maintenance` (the team's) or `POST /v1/me/tenancies/{id}/maintenance` (the tenant's). */
export function requestBody(form: RequestForm, tenant = false): Record<string, unknown> {
  const base = { category: form.category, priority: form.priority, title: form.title.trim(), description: form.description.trim() };
  if (tenant) return base;
  return { property_id: form.propertyId, unit_id: form.unitId || null, tenancy_id: form.tenancyId || null, ...base };
}

const API_FIELDS: Record<string, RequestField> = {
  property_id: "propertyId",
  unit_id: "unitId",
  tenancy_id: "tenancyId",
  category: "category",
  priority: "priority",
  title: "title",
  description: "description",
};

/** The API's field errors on the form's fields; anything else in `other`. */
export function requestApiProblems(fields: Record<string, string> | undefined): RequestProblems & { other?: string[] } {
  const problems: RequestProblems & { other?: string[] } = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const field = API_FIELDS[key];
    if (field) problems[field] = message;
    else (problems.other ??= []).push(message);
  }
  return problems;
}

export function commentProblem(text: string): string | null {
  const value = text.trim();
  if (!value) return "Write a comment first.";
  if (value.length > COMMENT_MAX) return `Use at most ${COMMENT_MAX} characters.`;
  return null;
}

export function moveNoteProblem(from: string, to: string, note: string): string | null {
  const value = note.trim();
  if (moveNeedsNote(from, to) && !value) return "Say why it is cancelled.";
  if (value.length > NOTE_MAX) return `Use at most ${NOTE_MAX} characters.`;
  return null;
}

/** `POST .../status`: the note only when there is one. */
export const statusBody = (status: string, note: string) => (note.trim() ? { status, note: note.trim() } : { status });

export function assignProblems(providerId: string, message: string): { provider?: string; message?: string } {
  const problems: { provider?: string; message?: string } = {};
  if (!providerId) problems.provider = "Choose a service provider.";
  if (message.trim().length > ASSIGN_MESSAGE_MAX) problems.message = `Use at most ${ASSIGN_MESSAGE_MAX} characters.`;
  return problems;
}

export const assignBody = (providerId: string, message: string) => ({ directory_profile_id: providerId, message: message.trim() || null });

export const COST_METHODS = ["CASH", "BANK", "MOBILE_MONEY", "OTHER"] as const;

export type CostForm = { amount: string; currency: string; description: string; method: string; incurredOn: string };
export type CostProblems = Partial<Record<keyof CostForm, string>>;

export const emptyCostForm = (currency: string, today: string): CostForm => ({ amount: "", currency, description: "", method: "OTHER", incurredOn: today });

/** `amountCheck` is `amountProblem` from `lib/ledger.ts` (the currency's decimals). `today` is the market-local date. */
export function costFormProblems(form: CostForm, amountCheck: (value: string, currency: string) => string | null, today?: string): CostProblems {
  const problems: CostProblems = {};
  if (!/^[A-Z]{3}$/.test(form.currency)) problems.currency = "Choose the currency.";
  const amount = amountCheck(form.amount, form.currency || "USD");
  if (amount) problems.amount = amount;
  const description = form.description.trim();
  if (!description) problems.description = "Say what the cost was for.";
  else if (description.length > COST_DESCRIPTION_MAX) problems.description = `Use at most ${COST_DESCRIPTION_MAX} characters.`;
  if (form.incurredOn && !/^\d{4}-\d{2}-\d{2}$/.test(form.incurredOn)) problems.incurredOn = "Enter the date as YYYY-MM-DD.";
  else if (form.incurredOn && today && form.incurredOn > today) problems.incurredOn = "The date cannot be in the future.";
  return problems;
}

export const costBody = (form: CostForm): Record<string, unknown> => ({
  amount: form.amount.replace(/\s+/g, ""),
  currency: form.currency,
  description: form.description.trim(),
  method: form.method || "OTHER",
  ...(form.incurredOn ? { incurred_on: form.incurredOn } : {}),
});

// ---- Filters in the address and the API query ---------------------------------------------------------

type Params = { get(name: string): string | null };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Reference codes: "plumbing", "doors-windows". */
const CODE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const QUERY_MAX = 100;

export function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type MaintenanceView = "list" | "board";

export type MaintenanceFilters = {
  status?: MaintenanceStatus;
  priority?: string;
  category?: string;
  property?: string;
  tenancy?: string;
  q?: string;
  view: MaintenanceView;
  page: number;
};

export function parseMaintenanceFilters(params: Params): MaintenanceFilters {
  const filters: MaintenanceFilters = { view: params.get("view") === "board" ? "board" : "list", page: pageNumber(params.get("page")) };
  const status = (params.get("status") ?? "").toUpperCase();
  if (isMaintenanceStatus(status)) filters.status = status;
  const priority = (params.get("priority") ?? "").toLowerCase();
  if (CODE.test(priority)) filters.priority = priority;
  const category = (params.get("category") ?? "").toLowerCase();
  if (CODE.test(category)) filters.category = category;
  const property = params.get("property") ?? "";
  if (ID.test(property)) filters.property = property;
  const tenancy = params.get("tenancy") ?? "";
  if (ID.test(tenancy)) filters.tenancy = tenancy;
  const q = (params.get("q") ?? "").trim().slice(0, QUERY_MAX);
  if (q) filters.q = q;
  return filters;
}

export const hasMaintenanceFilters = (filters: MaintenanceFilters) =>
  Boolean(filters.status || filters.priority || filters.category || filters.property || filters.tenancy || filters.q);

/** The page address of the list (or board), keeping the organisation. The board ignores the status filter and the page. */
export function maintenanceListHref(filters: Partial<MaintenanceFilters>, org?: string): string {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  if (filters.view === "board") search.set("view", "board");
  if (filters.status && filters.view !== "board") search.set("status", filters.status);
  if (filters.priority) search.set("priority", filters.priority);
  if (filters.category) search.set("category", filters.category);
  if (filters.property) search.set("property", filters.property);
  if (filters.tenancy) search.set("tenancy", filters.tenancy);
  if (filters.q) search.set("q", filters.q);
  if (filters.page && filters.page > 1 && filters.view !== "board") search.set("page", String(filters.page));
  const text = search.toString();
  return `/agent/maintenance${text ? `?${text}` : ""}`;
}

export function maintenanceApiQuery(filters: Omit<MaintenanceFilters, "view">, pageSize = 25): string {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.priority) search.set("priority", filters.priority);
  if (filters.category) search.set("category", filters.category);
  if (filters.property) search.set("property_id", filters.property);
  if (filters.tenancy) search.set("tenancy_id", filters.tenancy);
  if (filters.q) search.set("q", filters.q);
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search}`;
}

// ---- Page addresses ---------------------------------------------------------------------------------

function withOrg(base: string, path: string, org?: string, extra: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
  const text = search.toString();
  return `${base}${path}${text ? `?${text}` : ""}`;
}

export const maintenancePath = (path: string, org?: string, extra?: Record<string, string | undefined>) => withOrg("/agent/maintenance", path, org, extra);
export const maintenanceHref = (id: string, org?: string) => maintenancePath(`/${encodeURIComponent(id)}`, org);
/** "Report an issue" from a tenancy: the new-request form with the property, unit and tenancy filled in. */
export const newRequestHref = (org: string, from: { property?: string | null; unit?: string | null; tenancy?: string | null } = {}) =>
  maintenancePath("/new", org, { property: from.property ?? undefined, unit: from.unit ?? undefined, tenancy: from.tenancy ?? undefined });
/** A provider's public directory profile. */
export const providerHref = (provider: { kind: string | null; slug: string | null }) =>
  provider.kind && provider.slug ? `/directory/${encodeURIComponent(provider.kind)}/${encodeURIComponent(provider.slug)}` : null;

// ---- The board -----------------------------------------------------------------------------------------

export type Column<T> = { status: MaintenanceStatus; items: T[] };

/**
 * The board's columns, one per status in flow order, each most urgent first
 * then oldest first. A request whose status is unknown is left off (the list
 * shows it).
 */
export function boardColumns<T extends { status: string; priority: string; createdAt: string | null }>(
  items: readonly T[],
  statuses: readonly MaintenanceStatus[] = MAINTENANCE_STATUSES,
): Column<T>[] {
  return statuses.map((status) => ({
    status,
    items: items
      .filter((item) => item.status === status)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "")),
  }));
}

// ---- Reading the API's answers ------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const DECIMAL = /^-?\d+(\.\d+)?$/;
const dec = (value: unknown): string | null =>
  typeof value === "string" && DECIMAL.test(value.trim()) ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
const int = (value: unknown): number | null => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
};
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const first = (raw: Raw, ...keys: string[]): unknown => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};
const personName = (value: unknown) => (typeof value === "string" ? str(value) : str(obj(value)?.name));

/** A CodeLabel `{code, label}`, or a bare code (its label then from `label`). */
function coded(value: unknown, label: (code: string) => string): Choice | null {
  const inner = obj(value);
  const code = str(inner?.code) ?? str(value);
  if (!code) return null;
  return { code, label: str(inner?.label) ?? label(code) };
}

export type Actor = { kind: string | null; name: string | null; you: boolean };

function actor(value: unknown): Actor | null {
  const raw = obj(value);
  if (!raw) return null;
  return { kind: str(raw.kind), name: str(raw.name), you: bool(raw.you) ?? false };
}

export type MaintenancePhoto = { id: string; url: string | null; width: number | null; height: number | null; uploadedBy: string | null; uploadedAt: string | null };

export function normalisePhoto(value: unknown): MaintenancePhoto | null {
  const raw = obj(obj(value)?.photo) ?? obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    url: str(raw.url),
    width: int(raw.width),
    height: int(raw.height),
    uploadedBy: personName(raw.uploaded_by),
    uploadedAt: str(raw.uploaded_at),
  };
}

export type ProviderRef = { id: string | null; name: string; kind: string | null; slug: string | null; trade: string | null; city: string | null; verified: boolean };

function provider(value: unknown): ProviderRef | null {
  const raw = obj(value);
  if (!raw) return null;
  const name = str(raw.name);
  if (!name) return null;
  return {
    id: str(raw.id),
    name,
    kind: str(raw.kind),
    slug: str(raw.slug),
    trade: str(obj(raw.trade)?.label) ?? str(raw.trade),
    city: str(raw.city) ?? str(obj(raw.city)?.name),
    verified: bool(raw.verified) ?? false,
  };
}

export type Assignment = { provider: ProviderRef; enquiry: { id: string | null; reference: string | null } | null; at: string | null; by: string | null };

function assignment(value: unknown): Assignment | null {
  const raw = obj(value);
  const who = provider(raw?.provider);
  if (!raw || !who) return null;
  const enquiry = obj(raw.enquiry);
  const enquiryId = str(enquiry?.id);
  const enquiryReference = str(enquiry?.reference);
  return {
    provider: who,
    enquiry: enquiryId || enquiryReference ? { id: enquiryId, reference: enquiryReference } : null,
    at: str(raw.assigned_at),
    by: personName(raw.assigned_by),
  };
}

export type MaintenanceCost = {
  id: string;
  amount: string;
  currency: string;
  description: string;
  method: string | null;
  methodLabel: string | null;
  incurredOn: string | null;
  ledgerEntryId: string | null;
  ledgerStatusLabel: string | null;
  reversed: boolean;
  by: string | null;
  at: string | null;
};

export function normaliseCost(value: unknown): MaintenanceCost | null {
  const raw = obj(obj(value)?.cost) ?? obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  const amount = dec(raw.amount);
  const currency = str(raw.currency);
  if (!id || !amount || !currency) return null;
  return {
    id,
    amount,
    currency: currency.toUpperCase(),
    description: str(raw.description) ?? "",
    method: str(raw.method),
    methodLabel: str(raw.method_label),
    incurredOn: str(raw.incurred_on),
    ledgerEntryId: str(raw.ledger_entry_id),
    ledgerStatusLabel: str(raw.ledger_status_label),
    reversed: bool(raw.reversed) ?? false,
    by: personName(raw.recorded_by),
    at: str(raw.recorded_at),
  };
}

export type CostTotal = { currency: string; amount: string; count: number };

function costTotal(value: unknown): CostTotal | null {
  const raw = obj(value);
  const amount = dec(raw?.amount);
  const currency = str(raw?.currency);
  return raw && amount && currency ? { currency: currency.toUpperCase(), amount, count: int(raw.count) ?? 0 } : null;
}

export type TimelineEntry = {
  id: string;
  /** CREATED, STATUS_CHANGED, COMMENT, ASSIGNED, COST_ADDED, PHOTO_ADDED, UPDATED. */
  type: string;
  at: string | null;
  actor: Actor | null;
  fromStatus: string | null;
  toStatus: string | null;
  text: string | null;
  internal: boolean;
  details: {
    provider: string | null;
    enquiryReference: string | null;
    costId: string | null;
    amount: string | null;
    currency: string | null;
    description: string | null;
    fields: string[];
  } | null;
};

export function normaliseTimelineItem(value: unknown, index = 0): TimelineEntry | null {
  const raw = obj(obj(value)?.item) ?? obj(value);
  if (!raw) return null;
  const type = str(raw.type) ?? str(raw.kind);
  if (!type) return null;
  const details = obj(raw.details);
  return {
    id: str(raw.id) ?? `${type}-${index}`,
    type: type.toUpperCase(),
    at: str(raw.at),
    actor: actor(raw.actor),
    fromStatus: str(raw.from_status),
    toStatus: str(raw.to_status),
    text: str(raw.text),
    internal: bool(raw.internal) ?? false,
    details: details
      ? {
          provider: str(obj(details.provider)?.name),
          enquiryReference: str(details.enquiry_reference),
          costId: str(details.cost_id),
          amount: dec(details.amount),
          currency: str(details.currency),
          description: str(details.description),
          fields: arr(details.fields).filter((item): item is string => typeof item === "string"),
        }
      : null,
  };
}

export type MaintenanceRequest = {
  id: string;
  reference: string | null;
  status: string;
  statusLabel: string | null;
  priority: string;
  priorityLabel: string | null;
  category: string;
  categoryLabel: string | null;
  title: string;
  description: string;
  /** `id` is null in the tenant's view, which carries no ids. */
  property: { id: string | null; name: string; address: string | null; archived: boolean } | null;
  unit: { id: string | null; label: string; archived: boolean } | null;
  tenancy: { id: string; status: string | null; tenants: string[] } | null;
  raisedBy: Actor | null;
  /** The provider assigned (summary and tenant view); the full assignment on the team's request. */
  provider: ProviderRef | null;
  assignment: Assignment | null;
  photos: MaintenancePhoto[];
  photoCount: number;
  commentCount: number | null;
  costs: MaintenanceCost[];
  costTotals: CostTotal[];
  timeline: TimelineEntry[];
  createdAt: string | null;
  updatedAt: string | null;
  statusChangedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  can: MaintenanceCan | null;
};

function canOf(value: unknown): MaintenanceCan | null {
  const can = obj(value);
  if (!can) return null;
  return {
    edit: bool(can.edit) ?? false,
    transitions: Array.isArray(can.transitions) ? can.transitions.filter((item): item is string => typeof item === "string") : null,
    assign: bool(can.assign) ?? false,
    addCost: bool(can.add_cost) ?? false,
    comment: bool(can.comment) ?? false,
    addPhoto: bool(can.add_photo) ?? false,
  };
}

/** `{request: MaintenanceRequest}`, a MaintenanceSummary, or the tenant's MyMaintenance. */
export function normaliseRequest(value: unknown): MaintenanceRequest | null {
  const wrapper = obj(value);
  const raw = obj(wrapper?.request) ?? wrapper;
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  const propertyRaw = obj(raw.property);
  const unitRaw = obj(raw.unit);
  const tenancyRaw = obj(raw.tenancy);
  const tenancyId = str(tenancyRaw?.id) ?? str(raw.tenancy_id);
  const status = str(raw.status) ?? "NEW";
  const priority = coded(raw.priority, (code) => priorityLabel(code));
  const category = coded(raw.category, (code) => categoryLabel(code));
  const photos = arr(raw.photos).map(normalisePhoto).filter((item): item is MaintenancePhoto => item !== null);
  const assigned = assignment(raw.assignment);
  return {
    id,
    reference: str(raw.reference),
    status,
    statusLabel: str(raw.status_label),
    priority: priority?.code ?? "normal",
    priorityLabel: priority?.label ?? null,
    category: category?.code ?? "other",
    categoryLabel: category?.label ?? null,
    title: str(raw.title) ?? "Maintenance request",
    description: str(raw.description) ?? "",
    property: propertyRaw
      ? { id: str(propertyRaw.id), name: str(propertyRaw.name) ?? "The property", address: str(propertyRaw.address), archived: bool(propertyRaw.archived) ?? false }
      : null,
    unit: unitRaw ? { id: str(unitRaw.id), label: str(unitRaw.label) ?? "A unit", archived: bool(unitRaw.archived) ?? false } : null,
    tenancy: tenancyId
      ? {
          id: tenancyId,
          status: str(tenancyRaw?.status),
          tenants: arr(tenancyRaw?.tenants)
            .map(personName)
            .filter((item): item is string => item !== null),
        }
      : null,
    raisedBy: actor(raw.raised_by),
    provider: provider(raw.provider) ?? assigned?.provider ?? null,
    assignment: assigned,
    photos,
    photoCount: int(raw.photo_count) ?? photos.length,
    commentCount: int(raw.comment_count),
    costs: arr(raw.costs).map(normaliseCost).filter((item): item is MaintenanceCost => item !== null),
    costTotals: arr(raw.cost_totals).map(costTotal).filter((item): item is CostTotal => item !== null),
    timeline: arr(raw.timeline)
      .map(normaliseTimelineItem)
      .filter((item): item is TimelineEntry => item !== null),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    statusChangedAt: str(raw.status_changed_at),
    resolvedAt: str(raw.resolved_at),
    closedAt: str(raw.closed_at),
    can: canOf(raw.can),
  };
}

export type StatusCount = { status: string; count: number };

export type MaintenancePage = { items: MaintenanceRequest[]; page: number; pageSize: number; total: number; totalPages: number; statusCounts: StatusCount[] };

function statusCounts(value: unknown): StatusCount[] {
  const map = obj(value);
  if (!map) return [];
  return Object.entries(map)
    .map(([status, count]) => ({ status, count: int(count) ?? -1 }))
    .filter((item) => item.count >= 0);
}

/** The team's paged list, or the tenant's `{items}` (never paged). */
export function normaliseRequestPage(value: unknown, fallbackPage = 1): MaintenancePage {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : raw ? arr(first(raw, "items", "requests")) : [];
  const items = list.map(normaliseRequest).filter((item): item is MaintenanceRequest => item !== null);
  const pageSize = int(raw?.page_size) ?? (items.length || 25);
  const total = int(raw?.total) ?? items.length;
  return {
    items,
    page: int(raw?.page) ?? fallbackPage,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
    statusCounts: statusCounts(raw?.status_counts),
  };
}

export type MaintenanceOptions = {
  categories: Choice[];
  priorities: Choice[];
  transitions: Record<string, string[]> | null;
  currencies: { code: string; minorUnit: number | null }[];
  methods: Choice[];
  photoRules: PhotoRules;
  write: boolean | null;
};

function choices(value: unknown): Choice[] {
  return arr(value)
    .map((item) => coded(item, wordsFromCode))
    .filter((item): item is Choice => item !== null);
}

function photoRules(value: unknown): PhotoRules {
  const raw = obj(value);
  const types = arr(raw?.types).filter((item): item is string => typeof item === "string" && item.startsWith("image/"));
  return {
    maxPhotos: int(raw?.max_photos) ?? DEFAULT_PHOTO_RULES.maxPhotos,
    maxBytes: int(raw?.max_bytes) ?? DEFAULT_PHOTO_RULES.maxBytes,
    types: types.length ? types : DEFAULT_PHOTO_RULES.types,
  };
}

/** `GET /maintenance/options` (or the tenant's): the reference sets, with the seeded defaults when the API sends none. */
export function normaliseOptions(value: unknown): MaintenanceOptions {
  const raw = obj(value) ?? {};
  const transitions = obj(raw.transitions);
  const methods = choices(raw.methods);
  return {
    categories: choicesOr(choices(raw.categories), DEFAULT_CATEGORIES),
    priorities: choicesOr(choices(raw.priorities), DEFAULT_PRIORITIES),
    transitions: transitions
      ? Object.fromEntries(Object.entries(transitions).map(([from, to]) => [from, arr(to).filter((item): item is string => typeof item === "string")]))
      : null,
    currencies: arr(raw.currencies)
      .map((item) => {
        const inner = obj(item);
        const code = str(inner?.code) ?? str(item);
        return code ? { code, minorUnit: int(inner?.minor_unit) } : null;
      })
      .filter((item): item is { code: string; minorUnit: number | null } => item !== null),
    methods: methods.length ? methods : COST_METHODS.map((code) => ({ code, label: code === "MOBILE_MONEY" ? "Mobile money" : wordsFromCode(code) })),
    photoRules: photoRules(raw.photo_rules),
    write: bool(obj(raw.permissions)?.write),
  };
}

/** `GET /maintenance/providers`: verified service providers, each with the profile id `assign` takes. */
export function normaliseProviders(value: unknown): ProviderRef[] {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : arr(raw?.items);
  return list.map(provider).filter((item): item is ProviderRef => item !== null && item.id !== null);
}

/** `assign`'s answer: the enquiry sent (its reference), and whether it was a replay of one already sent. */
export function assignedEnquiry(value: unknown): { reference: string | null; replayed: boolean } | null {
  const enquiry = obj(obj(value)?.enquiry);
  return enquiry ? { reference: str(enquiry.reference), replayed: bool(enquiry.replayed) ?? false } : null;
}

/** The id of a created request from `{request: {id}}`. */
export const createdRequestId = (value: unknown): string | null => normaliseRequest(value)?.id ?? null;

// ---- The timeline ------------------------------------------------------------------------------------

const FIELD_WORDS: Record<string, string> = { category: "category", priority: "priority", title: "title", description: "details" };

/** One line per timeline item, in words. `tenant`: the tenant's view (no internal or money items reach it). */
export function timelineWords(item: TimelineEntry): string {
  const to = item.toStatus ? maintenanceStatusLabel(item.toStatus).toLowerCase() : "";
  switch (item.type) {
    case "CREATED":
      return "Reported";
    case "STATUS_CHANGED":
      if (item.fromStatus === "RESOLVED" && item.toStatus === "IN_PROGRESS") return "Reopened";
      return item.fromStatus ? `Moved from ${maintenanceStatusLabel(item.fromStatus).toLowerCase()} to ${to}` : `Status set to ${to}`;
    case "COMMENT":
      return item.internal ? "Internal comment" : "Comment";
    case "ASSIGNED":
      return item.details?.provider ? `Assigned to ${item.details.provider}` : "Assigned to a service provider";
    case "COST_ADDED":
      return item.details?.amount && item.details.currency ? `Cost recorded: ${item.details.currency} ${item.details.amount}` : "Cost recorded";
    case "PHOTO_ADDED":
      return "Photo added";
    case "UPDATED": {
      const fields = (item.details?.fields ?? []).map((field) => FIELD_WORDS[field] ?? wordsFromCode(field).toLowerCase());
      return fields.length ? `Changed the ${fields.length === 1 ? fields[0] : `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}`}` : "Details changed";
    }
    default:
      return wordsFromCode(item.type);
  }
}

/** "Chipo Dube", "You", "Sample Estates (manager)", "Kudzai Sithole (tenant)". */
export function actorWords(value: Actor | null, roleWords = false): string | null {
  if (!value) return null;
  if (value.you) return "You";
  if (value.kind === "SYSTEM") return "RightProperty365";
  const name = value.name ?? (value.kind === "TENANT" ? "The tenant" : "The manager");
  if (!roleWords) return name;
  return value.kind === "TENANT" ? `${name} (tenant)` : name;
}

/** The request's history, oldest first. When the API sends none, the report alone (with its date) is shown. */
export function maintenanceTimeline(request: Pick<MaintenanceRequest, "timeline" | "createdAt" | "raisedBy">): TimelineEntry[] {
  if (request.timeline.length === 0) {
    return request.createdAt
      ? [{ id: "created", type: "CREATED", at: request.createdAt, actor: request.raisedBy, fromStatus: null, toStatus: "NEW", text: null, internal: false, details: null }]
      : [];
  }
  return [...request.timeline].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
}

/** "Avondale Court, Flat 1". */
export function requestPlace(request: Pick<MaintenanceRequest, "property" | "unit">): string {
  return [request.property?.name, request.unit?.label].filter(Boolean).join(", ") || "No property";
}
