/**
 * The rules of properties, units and tenancies (`/agent/properties`,
 * `/agent/tenancies`, `/account/tenancies`, API 0.36.0, BR-019, FR-047) that
 * are not the API's, as pure functions: the words for rent frequencies, due
 * days and tenancy statuses, the checks on the forms (dates, due days, unit
 * labels), the forms' request bodies, the list filters in the page address
 * and the API query, page addresses, who sees which controls, the status
 * timeline, and tolerant readers for the API's answers.
 *
 * Money is the API's decimal string with its ISO 4217 code and is formatted
 * by `formatLedgerAmount` in `lib/ledger.ts`; amounts in different currencies
 * are never added together. Dates are market-local YYYY-MM-DD and never move
 * through a time zone.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/tenancies.test.mjs).
 * The amount check is passed in (`amountProblem` from `lib/ledger.ts`).
 */

// ---- Rent frequencies and due days -------------------------------------------------------------

export const RENT_FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"] as const;
export type RentFrequency = (typeof RENT_FREQUENCIES)[number];

export const isRentFrequency = (value: unknown): value is RentFrequency =>
  typeof value === "string" && (RENT_FREQUENCIES as readonly string[]).includes(value);

const FREQUENCY_LABELS: Record<RentFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly (every three months)",
  ANNUALLY: "Annually (once a year)",
};

const FREQUENCY_PER: Record<RentFrequency, string> = {
  WEEKLY: "a week",
  MONTHLY: "a month",
  QUARTERLY: "a quarter",
  ANNUALLY: "a year",
};

/** "Sentence words" from a code the app does not know: "SIX_MONTHLY" -> "Six monthly". */
export function wordsFromCode(code: string): string {
  const text = code.replace(/_/g, " ").toLowerCase().trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** "Monthly", for a select and a heading. */
export const frequencyLabel = (frequency: string) =>
  isRentFrequency(frequency) ? FREQUENCY_LABELS[frequency] : wordsFromCode(frequency);

/** "a month", after an amount: "USD 450.00 a month". */
export const frequencyPer = (frequency: string) =>
  isRentFrequency(frequency) ? FREQUENCY_PER[frequency] : `(${wordsFromCode(frequency).toLowerCase()})`;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Weekly rent falls on a day of the week, 1 (Monday) to 7 (Sunday); the others on a day of the month, 1 to 31. */
export const dueDayRange = (frequency: string): { min: number; max: number } =>
  frequency === "WEEKLY" ? { min: 1, max: 7 } : { min: 1, max: 31 };

/** "1st", "2nd", "23rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = suffixes[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The choices of the "Due on" field for a frequency, as `{ value, label }`. */
export function dueDayOptions(frequency: string): { value: string; label: string }[] {
  if (frequency === "WEEKLY") return WEEKDAYS.map((day, index) => ({ value: String(index + 1), label: day }));
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return { value: String(day), label: day > 28 ? `${ordinal(day)} (the last day in shorter months)` : ordinal(day) };
  });
}

/** "due every Monday", "due on the 1st of each month", or "" for a day the frequency does not have. */
export function dueDayWords(frequency: string, dueDay: number | null | undefined): string {
  if (typeof dueDay !== "number" || !Number.isInteger(dueDay)) return "";
  const { min, max } = dueDayRange(frequency);
  if (dueDay < min || dueDay > max) return "";
  switch (frequency) {
    case "WEEKLY":
      return `due every ${WEEKDAYS[dueDay - 1]}`;
    case "MONTHLY":
      return `due on the ${ordinal(dueDay)} of each month`;
    case "QUARTERLY":
      return `due every three months, on the ${ordinal(dueDay)}`;
    case "ANNUALLY":
      return `due once a year, on the ${ordinal(dueDay)}`;
    default:
      return `due on day ${dueDay}`;
  }
}

/** Why a due day cannot be used with a frequency, in words, or null. */
export function dueDayProblem(frequency: string, value: string): string | null {
  const text = value.trim();
  if (!text) return frequency === "WEEKLY" ? "Choose the day of the week the rent is due." : "Choose the day of the month the rent is due.";
  const day = Number(text);
  const { min, max } = dueDayRange(frequency);
  if (!/^\d+$/.test(text) || day < min || day > max) {
    return frequency === "WEEKLY" ? "Choose a day of the week, Monday to Sunday." : "Choose a day of the month, 1 to 31.";
  }
  return null;
}

// ---- Tenancy statuses ---------------------------------------------------------------------------

export const TENANCY_STATUSES = ["DRAFT", "ACTIVE", "ENDED", "TERMINATED"] as const;
export type TenancyStatus = (typeof TENANCY_STATUSES)[number];

export const isTenancyStatus = (value: unknown): value is TenancyStatus =>
  typeof value === "string" && (TENANCY_STATUSES as readonly string[]).includes(value);

const STATUS_LABELS: Record<TenancyStatus, string> = { DRAFT: "Draft", ACTIVE: "Active", ENDED: "Ended", TERMINATED: "Terminated early" };

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

const STATUS_TONES: Record<TenancyStatus, Tone> = { DRAFT: "neutral", ACTIVE: "success", ENDED: "info", TERMINATED: "warning" };

export const tenancyStatusLabel = (status: string, apiLabel?: string | null) =>
  apiLabel || (isTenancyStatus(status) ? STATUS_LABELS[status] : wordsFromCode(status));

export const tenancyStatusTone = (status: string): Tone => (isTenancyStatus(status) ? STATUS_TONES[status] : "neutral");

/** One sentence on what a status means, for the agent's tenancy page. */
export const TENANCY_STATUS_EXPLAINED: Record<TenancyStatus, string> = {
  DRAFT: "Not started yet. Check the parties and terms, then activate it.",
  ACTIVE: "The tenancy is running.",
  ENDED: "The tenancy has ended. It is kept as a record.",
  TERMINATED: "The tenancy was ended early. It is kept as a record.",
};

/** The same, as the tenant reads it. */
export const TENANT_STATUS_EXPLAINED: Record<TenancyStatus, string> = {
  DRAFT: "Your landlord or agent is still preparing this tenancy.",
  ACTIVE: "Your tenancy is running.",
  ENDED: "This tenancy has ended.",
  TERMINATED: "This tenancy was ended early.",
};

// ---- Who sees which controls ---------------------------------------------------------------------

const WRITERS = ["OWNER", "MANAGER", "AGENT"];

/** OWNER, MANAGER and AGENT create and change properties and tenancies; STAFF only read. */
export const canWriteTenancies = (role: string | null | undefined) => WRITERS.includes(role ?? "");

export const canActivate = (status: string) => status === "DRAFT";
export const canEnd = (status: string) => status === "ACTIVE";

// ---- Dates ---------------------------------------------------------------------------------------

/** A real calendar day as YYYY-MM-DD. */
export function isDay(value: string | null | undefined): value is string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
}

/** The start and end dates' problems, under their controls. The end is optional (a periodic tenancy). */
export function tenancyDateProblems(start: string, end: string): { start?: string; end?: string } {
  const problems: { start?: string; end?: string } = {};
  if (!start.trim()) problems.start = "Enter the date the tenancy starts.";
  else if (!isDay(start.trim())) problems.start = "Enter a real date, for example 2026-12-01.";
  if (end.trim()) {
    if (!isDay(end.trim())) problems.end = "Enter a real date, for example 2027-11-30, or leave it empty.";
    else if (!problems.start && end.trim() <= start.trim()) problems.end = "The end date must be after the start date.";
  }
  return problems;
}

export const END_REASON_MAX = 500;

/** The "End the tenancy" form: a date on or after the start, and a reason. */
export function endProblems(endDate: string, reason: string, startDate?: string | null): { endDate?: string; reason?: string } {
  const problems: { endDate?: string; reason?: string } = {};
  const day = endDate.trim();
  if (!day) problems.endDate = "Enter the date the tenancy ends.";
  else if (!isDay(day)) problems.endDate = "Enter a real date, for example 2027-01-31.";
  else if (startDate && isDay(startDate) && day < startDate) problems.endDate = "The tenancy cannot end before it started.";
  const why = reason.trim();
  if (!why) problems.reason = "Say why the tenancy is ending, for example: the tenant gave notice.";
  else if (why.length > END_REASON_MAX) problems.reason = `Keep the reason to ${END_REASON_MAX} characters.`;
  return problems;
}

// ---- Properties: the form and its body --------------------------------------------------------------

// The API's limits (contract 0.36.0, "Response shapes (a)").
export const PROPERTY_NAME_MAX = 200;
export const ADDRESS_MAX = 500;
export const UNIT_LABEL_MAX = 80;
export const UNITS_MAX = 200;
export const NOTES_MAX = 5000;
export const TENANTS_MAX = 10;
export const LANDLORDS_MAX = 10;

export type PropertyForm = { name: string; address: string; marketCode: string; listingId: string; notes: string; units: string[] };

export const emptyPropertyForm = (marketCode = ""): PropertyForm => ({ name: "", address: "", marketCode, listingId: "", notes: "", units: [] });

/** Why a unit label cannot be used, or null. `others` are the property's other labels. */
export function unitLabelProblem(label: string, others: readonly string[] = []): string | null {
  const text = label.trim();
  if (!text) return "Enter the unit's name or number, for example Flat 2.";
  if (text.length > UNIT_LABEL_MAX) return `Keep it to ${UNIT_LABEL_MAX} characters.`;
  if (others.some((other) => other.trim().toLowerCase() === text.toLowerCase())) return "Another unit of this property already has that name.";
  return null;
}

export type PropertyProblems = { name?: string; address?: string; marketCode?: string; notes?: string; units?: Record<number, string> };

export function propertyFormProblems(form: PropertyForm): PropertyProblems {
  const problems: PropertyProblems = {};
  const name = form.name.trim();
  if (!name) problems.name = "Enter a name for the property, for example 12 Fife Avenue.";
  else if (name.length > PROPERTY_NAME_MAX) problems.name = `Keep the name to ${PROPERTY_NAME_MAX} characters.`;
  const address = form.address.trim();
  if (!address) problems.address = "Enter the property's address.";
  else if (address.length > ADDRESS_MAX) problems.address = `Keep the address to ${ADDRESS_MAX} characters.`;
  if (!/^[A-Z]{2}$/.test(form.marketCode)) problems.marketCode = "Choose the country the property is in.";
  if (form.notes.length > NOTES_MAX) problems.notes = `Keep the notes to ${NOTES_MAX} characters.`;
  const units: Record<number, string> = {};
  form.units.forEach((label, index) => {
    const problem = unitLabelProblem(label, form.units.filter((_, other) => other !== index && other < index));
    if (problem) units[index] = problem;
  });
  if (form.units.length > UNITS_MAX) units[UNITS_MAX] = `A property can have at most ${UNITS_MAX} units.`;
  if (Object.keys(units).length) problems.units = units;
  return problems;
}

export const hasProblems = (problems: Record<string, unknown>) =>
  Object.values(problems).some((value) => (value && typeof value === "object" ? Object.keys(value).length > 0 : Boolean(value)));

/** `POST …/properties`. A property with no units counts as a single unit, so `units` may be empty. */
export function propertyBody(form: PropertyForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    address: form.address.trim(),
    market_code: form.marketCode,
    notes: form.notes.trim(),
    units: form.units.map((label) => label.trim()).filter(Boolean).map((label) => ({ label })),
  };
  if (form.listingId) body.listing_id = form.listingId;
  return body;
}

/** `PATCH …/properties/{id}`: the details only (`units` there is a 400; units have their own routes). */
export function propertyPatch(form: Omit<PropertyForm, "units">): Record<string, unknown> {
  return { name: form.name.trim(), address: form.address.trim(), market_code: form.marketCode, listing_id: form.listingId || null, notes: form.notes.trim() };
}

// ---- Tenancies: the form and its body ---------------------------------------------------------------

export type Chosen = { id: string; label: string };

export type TenancyForm = {
  propertyId: string;
  unitId: string;
  tenants: Chosen[];
  landlords: Chosen[];
  leaseId: string;
  rentAmount: string;
  rentCurrency: string;
  frequency: string;
  dueDay: string;
  /** In the rent's currency: the API requires the deposit's currency to equal the rent's. */
  depositAmount: string;
  startDate: string;
  endDate: string;
  notes: string;
};

export const emptyTenancyForm = (currency = "USD"): TenancyForm => ({
  propertyId: "",
  unitId: "",
  tenants: [],
  landlords: [],
  leaseId: "",
  rentAmount: "",
  rentCurrency: currency,
  frequency: "MONTHLY",
  dueDay: "1",
  depositAmount: "",
  startDate: "",
  endDate: "",
  notes: "",
});

export type TenancyField =
  | "propertyId"
  | "unitId"
  | "tenants"
  | "landlords"
  | "rentAmount"
  | "rentCurrency"
  | "frequency"
  | "dueDay"
  | "depositAmount"
  | "startDate"
  | "endDate"
  | "notes";

export type TenancyProblems = Partial<Record<TenancyField, string>>;

/**
 * Checked before sending, in the words shown under each control. `amountCheck`
 * is `amountProblem` from `lib/ledger.ts` (a positive decimal with at most
 * the currency's minor units). `unitRequired`: the property has units, so one
 * must be chosen.
 */
export function tenancyFormProblems(
  form: TenancyForm,
  amountCheck: (value: string, currency: string) => string | null,
  { unitRequired = false }: { unitRequired?: boolean } = {},
): TenancyProblems {
  const problems: TenancyProblems = {};
  if (!form.propertyId) problems.propertyId = "Choose the property.";
  if (unitRequired && !form.unitId) problems.unitId = "Choose the unit the tenancy is for.";
  if (form.tenants.length === 0) problems.tenants = "Add at least one tenant from your contact book.";
  else if (form.tenants.length > TENANTS_MAX) problems.tenants = `A tenancy can have at most ${TENANTS_MAX} tenants.`;
  if (form.landlords.length > LANDLORDS_MAX) problems.landlords = `A tenancy can have at most ${LANDLORDS_MAX} landlords.`;
  const overlap = form.tenants.find((tenant) => form.landlords.some((landlord) => landlord.id === tenant.id));
  if (overlap) problems.landlords = `${overlap.label} is already a tenant. A contact cannot be tenant and landlord of one tenancy.`;
  if (!/^[A-Z]{3}$/.test(form.rentCurrency)) problems.rentCurrency = "Choose the currency of the rent.";
  else {
    const amount = amountCheck(form.rentAmount, form.rentCurrency);
    if (amount) problems.rentAmount = amount;
  }
  if (!isRentFrequency(form.frequency)) problems.frequency = "Choose how often the rent is due.";
  else {
    const day = dueDayProblem(form.frequency, form.dueDay);
    if (day) problems.dueDay = day;
  }
  if (form.depositAmount.trim() && /^[A-Z]{3}$/.test(form.rentCurrency)) {
    const deposit = amountCheck(form.depositAmount, form.rentCurrency);
    if (deposit) problems.depositAmount = deposit;
  }
  const dates = tenancyDateProblems(form.startDate, form.endDate);
  if (dates.start) problems.startDate = dates.start;
  if (dates.end) problems.endDate = dates.end;
  if (form.notes.length > NOTES_MAX) problems.notes = `Keep the notes to ${NOTES_MAX} characters.`;
  return problems;
}

const API_FIELDS: Record<string, TenancyField> = {
  property_id: "propertyId",
  unit_id: "unitId",
  tenants: "tenants",
  landlords: "landlords",
  "rent.amount": "rentAmount",
  rent_amount: "rentAmount",
  "rent.currency": "rentCurrency",
  rent_currency: "rentCurrency",
  "rent.frequency": "frequency",
  frequency: "frequency",
  "rent.due_day": "dueDay",
  due_day: "dueDay",
  "deposit.amount": "depositAmount",
  deposit_amount: "depositAmount",
  "deposit.currency": "depositAmount",
  deposit: "depositAmount",
  start_date: "startDate",
  end_date: "endDate",
  notes: "notes",
};

/**
 * The API's field errors (`{"rent.amount": "…"}`, `{"tenants[0]": "…"}`)
 * placed under the form's controls. `lease_id` and anything unknown go to
 * `other`, shown in the summary.
 */
export function tenancyApiProblems(fields: Record<string, string> | undefined): TenancyProblems & { leaseId?: string; other?: string[] } {
  const problems: TenancyProblems & { leaseId?: string; other?: string[] } = {};
  for (const [key, text] of Object.entries(fields ?? {})) {
    const plain = key.replace(/\[\d+\]$/, "").replace(/\.\d+$/, "");
    if (plain === "lease_id") problems.leaseId = text;
    else if (API_FIELDS[plain]) problems[API_FIELDS[plain]] ??= text;
    else (problems.other ??= []).push(text);
  }
  return problems;
}

/** "0012.50 " -> "12.50": spaces and leading zeros go; the digits are never rounded. */
export function cleanAmount(value: string): string {
  const [whole, fraction] = value.replace(/\s+/g, "").split(".");
  const trimmed = whole.replace(/^0+(?=\d)/, "");
  return fraction !== undefined ? `${trimmed}.${fraction}` : trimmed;
}

/** `POST …/tenancies`: the contract's body. Optional parts are left out when empty. */
export function tenancyBody(form: TenancyForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    property_id: form.propertyId,
    tenants: form.tenants.map((tenant) => tenant.id),
    rent: {
      amount: cleanAmount(form.rentAmount),
      currency: form.rentCurrency,
      frequency: form.frequency,
      due_day: Number(form.dueDay),
    },
    start_date: form.startDate.trim(),
    notes: form.notes.trim(),
  };
  if (form.unitId) body.unit_id = form.unitId;
  if (form.landlords.length) body.landlords = form.landlords.map((landlord) => landlord.id);
  if (form.leaseId) body.lease_id = form.leaseId;
  if (form.depositAmount.trim()) body.deposit = { amount: cleanAmount(form.depositAmount), currency: form.rentCurrency };
  if (form.endDate.trim()) body.end_date = form.endDate.trim();
  return body;
}

/** Adds a contact to a list of chosen contacts, once. */
export const addChosen = (list: readonly Chosen[], item: Chosen): Chosen[] =>
  item.id && !list.some((other) => other.id === item.id) ? [...list, item] : [...list];

export const removeChosen = (list: readonly Chosen[], id: string): Chosen[] => list.filter((item) => item.id !== id);

// ---- Filters in the address and the API query ---------------------------------------------------------

type Params = { get(name: string): string | null };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const QUERY_MAX = 100;

export function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** The API filters by status, property, unit and contact (a tenant or landlord); there is no free-text search. */
export type TenancyFilters = { status?: TenancyStatus; property?: string; contact?: string; page: number };

export function parseTenancyFilters(params: Params): TenancyFilters {
  const filters: TenancyFilters = { page: pageNumber(params.get("page")) };
  const status = (params.get("status") ?? "").toUpperCase();
  if (isTenancyStatus(status)) filters.status = status;
  const property = params.get("property") ?? "";
  if (ID.test(property)) filters.property = property;
  const contact = params.get("contact") ?? "";
  if (ID.test(contact)) filters.contact = contact;
  return filters;
}

/** The page address of the tenancy list, keeping the organisation. */
export function tenancyListHref(filters: Partial<TenancyFilters>, org?: string): string {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  if (filters.status) search.set("status", filters.status);
  if (filters.property) search.set("property", filters.property);
  if (filters.contact) search.set("contact", filters.contact);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return `/agent/tenancies${text ? `?${text}` : ""}`;
}

export function tenancyApiQuery(filters: TenancyFilters, pageSize = 20): string {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.property) search.set("property_id", filters.property);
  if (filters.contact) search.set("contact_id", filters.contact);
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search}`;
}

export function propertyApiQuery(page: number, q = "", pageSize = 20): string {
  const search = new URLSearchParams();
  const text = q.trim().slice(0, QUERY_MAX);
  if (text) search.set("q", text);
  search.set("page", String(page));
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

export const propertiesPath = (path: string, org?: string, extra?: Record<string, string | undefined>) => withOrg("/agent/properties", path, org, extra);
export const tenanciesPath = (path: string, org?: string, extra?: Record<string, string | undefined>) => withOrg("/agent/tenancies", path, org, extra);
export const propertyHref = (id: string, org?: string) => propertiesPath(`/${encodeURIComponent(id)}`, org);
export const tenancyHref = (id: string, org?: string) => tenanciesPath(`/${encodeURIComponent(id)}`, org);
export const myTenancyHref = (id: string) => `/account/tenancies/${encodeURIComponent(id)}`;

// ---- Reading the API's answers ------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const DECIMAL = /^-?\d+(\.\d+)?$/;
/** A decimal string; a number from an older build is turned into one (display only). */
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
/** `{property: {...}}` or the object itself. */
const unwrap = (value: unknown, key: string): Raw | null => obj(obj(value)?.[key]) ?? obj(obj(value)?.data) ?? obj(value);

export type Money = { amount: string; currency: string };

function money(value: unknown, raw?: Raw, prefix?: string): Money | null {
  const inner = obj(value);
  if (inner) {
    const amount = dec(inner.amount);
    const currency = str(inner.currency) ?? str(inner.currency_code);
    return amount && currency ? { amount, currency: currency.toUpperCase() } : null;
  }
  if (raw && prefix) {
    const amount = dec(raw[`${prefix}_amount`]);
    const currency = str(raw[`${prefix}_currency`]);
    return amount && currency ? { amount, currency: currency.toUpperCase() } : null;
  }
  return null;
}

export type Unit = { id: string; label: string; position: number | null; occupied: boolean | null; activeTenancyId: string | null };

export function normaliseUnit(value: unknown): Unit | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.unit_id);
  const label = str(raw.label) ?? str(raw.name);
  if (!id || !label) return null;
  const hasActive = "active_tenancy_id" in raw;
  const activeTenancyId = str(raw.active_tenancy_id);
  return { id, label, position: int(raw.position), occupied: bool(raw.occupied) ?? (hasActive ? Boolean(activeTenancyId) : null), activeTenancyId };
}

export type LinkedListing = { id: string; title: string | null; reference: string | null };

export type Property = {
  id: string;
  name: string;
  address: string;
  marketCode: string;
  listing: LinkedListing | null;
  notes: string;
  /** In the API's order (`position`). */
  units: Unit[];
  unitCount: number;
  /** `max(unit_count, 1)`: a property with no units is one unit. */
  lettableUnits: number;
  /** Lettable units with an ACTIVE tenancy, when the API says. */
  occupiedUnits: number | null;
  /** DRAFT + ACTIVE tenancies, when the API says. */
  openTenancies: number | null;
  /** The ACTIVE tenancy of the whole property (one with no unit). */
  activeTenancyId: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** The API's `can`; null when it sends none (the role decides). */
  can: { edit: boolean; delete: boolean } | null;
};

export function normaliseProperty(value: unknown): Property | null {
  const raw = unwrap(value, "property");
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  const units = arr(raw.units)
    .map(normaliseUnit)
    .filter((unit): unit is Unit => unit !== null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const listingRaw = obj(raw.listing);
  const listingId = str(listingRaw?.id) ?? str(raw.listing_id);
  const unitCount = int(raw.unit_count) ?? units.length;
  const can = obj(raw.can);
  return {
    id,
    name: str(raw.name) ?? "Unnamed property",
    address: str(raw.address) ?? "",
    marketCode: str(raw.market_code) ?? "",
    listing: listingId ? { id: listingId, title: str(listingRaw?.title), reference: str(listingRaw?.reference) } : null,
    notes: str(raw.notes) ?? "",
    units,
    unitCount,
    lettableUnits: int(raw.lettable_units) ?? Math.max(unitCount, 1),
    occupiedUnits: int(raw.occupied_units),
    openTenancies: int(raw.open_tenancies),
    activeTenancyId: str(raw.active_tenancy_id),
    createdBy: str(obj(raw.created_by)?.name),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    can: can ? { edit: bool(can.edit) ?? true, delete: bool(can.delete) ?? false } : null,
  };
}

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

function paged<T>(value: unknown, read: (item: unknown) => T | null, keys: string[], fallbackPage: number): Paged<T> {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : raw ? arr(first(raw, ...keys, "items", "data")) : [];
  const items = list.map(read).filter((item): item is T => item !== null);
  const pageSize = int(raw?.page_size) ?? (items.length || 25);
  const total = int(raw?.total) ?? items.length;
  return {
    items,
    page: int(raw?.page) ?? fallbackPage,
    pageSize,
    total,
    totalPages: int(raw?.total_pages) ?? Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
  };
}

export const normalisePropertyPage = (value: unknown, fallbackPage = 1): Paged<Property> =>
  paged(value, normaliseProperty, ["properties"], fallbackPage);

/**
 * A tenant or landlord: the API's ContactRef `{id, name, live}` (the tenant's
 * own view has only `{name}`), or a bare contact id. `live` is false when the
 * contact was deleted or merged since; the name is then the last one known.
 * `id` is null when the API sends none: never link it.
 */
export type Party = { id: string | null; key: string; name: string; live: boolean; email: string | null; phone: string | null };

function party(value: unknown, index: number): Party | null {
  if (typeof value === "string" && value) return { id: value, key: value, name: "A contact", live: true, email: null, phone: null };
  const raw = obj(value);
  if (!raw) return null;
  const source = obj(raw.contact) ?? raw;
  const id = str(source.id) ?? str(raw.contact_id);
  const name = str(source.name) ?? str(raw.name) ?? str(raw.contact_name);
  if (!id && !name) return null;
  return {
    id,
    key: id ?? `${name}-${index}`,
    name: name ?? "A contact",
    live: bool(source.live) ?? true,
    email: str(source.email) ?? str(arr(source.emails)[0]),
    phone: str(source.phone) ?? str(arr(source.phones)[0]),
  };
}

const parties = (value: unknown) => arr(value).map(party).filter((item): item is Party => item !== null);

export type TenancyEvent = { id: string; kind: string; label: string | null; at: string | null; day: string | null; actor: string | null; text: string | null };

function event(value: unknown, index: number): TenancyEvent | null {
  const raw = obj(value);
  if (!raw) return null;
  const kind = str(raw.kind) ?? str(raw.action) ?? str(raw.type) ?? str(raw.status);
  if (!kind) return null;
  const actor = obj(raw.actor) ?? obj(raw.by);
  return {
    id: str(raw.id) ?? `${kind}-${index}`,
    kind,
    label: str(raw.label),
    at: str(raw.at) ?? str(raw.created_at),
    day: str(raw.date) ?? str(raw.effective_date),
    actor: str(actor?.name) ?? str(raw.actor_name),
    text: str(raw.reason) ?? str(raw.note) ?? str(raw.text),
  };
}

export type Tenancy = {
  id: string;
  reference: string | null;
  status: string;
  statusLabel: string | null;
  /** `id` is null in the tenant's view, which carries no ids. */
  property: { id: string | null; name: string; address: string; marketCode: string | null; archived: boolean } | null;
  unit: { id: string | null; label: string; archived: boolean } | null;
  /** The tenant's view: who manages the tenancy. */
  managedBy: { kind: string | null; name: string } | null;
  tenants: Party[];
  landlords: Party[];
  lease: { id: string; reference: string | null } | null;
  rent: { amount: string; currency: string; frequency: string; frequencyLabel: string | null; dueDay: number | null } | null;
  deposit: Money | null;
  startDate: string | null;
  /** The agreed end; it stays when the tenancy ends earlier. */
  endDate: string | null;
  /** The day it actually ended. */
  endedOn: string | null;
  endReason: string | null;
  notes: string;
  createdAt: string | null;
  createdBy: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  endedAt: string | null;
  endedBy: string | null;
  events: TenancyEvent[];
  /** The API's `can`; null when it sends none (the role and status decide). */
  can: { edit: boolean; activate: boolean; end: boolean; delete: boolean } | null;
};

const personName = (value: unknown) => str(obj(value)?.name);

export function normaliseTenancy(value: unknown): Tenancy | null {
  const raw = unwrap(value, "tenancy");
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  const propertyRaw = obj(raw.property);
  const propertyId = str(propertyRaw?.id) ?? str(raw.property_id);
  const propertyName = str(propertyRaw?.name) ?? str(raw.property_name);
  const unitRaw = obj(raw.unit);
  const unitId = str(unitRaw?.id) ?? str(raw.unit_id);
  const unitLabel = str(unitRaw?.label) ?? str(raw.unit_label);
  const leaseRaw = obj(raw.lease);
  const leaseId = str(leaseRaw?.id) ?? str(raw.lease_id);
  const rentRaw = obj(raw.rent);
  const rentMoney = money(rentRaw, raw, "rent");
  const frequency = str(rentRaw?.frequency) ?? str(raw.rent_frequency) ?? str(raw.frequency);
  const managed = obj(raw.managed_by);
  const managedName = str(managed?.name);
  const can = obj(raw.can);
  return {
    id,
    reference: str(raw.reference),
    status: str(raw.status) ?? "DRAFT",
    statusLabel: str(raw.status_label),
    property:
      propertyId || propertyName
        ? {
            id: propertyId,
            name: propertyName ?? "The property",
            address: str(propertyRaw?.address) ?? str(raw.property_address) ?? "",
            marketCode: str(propertyRaw?.market_code),
            archived: bool(propertyRaw?.archived) ?? false,
          }
        : null,
    unit: unitId || unitLabel ? { id: unitId, label: unitLabel ?? "A unit", archived: bool(unitRaw?.archived) ?? false } : null,
    managedBy: managedName ? { kind: str(managed?.kind), name: managedName } : null,
    tenants: parties(raw.tenants),
    landlords: parties(raw.landlords),
    lease: leaseId ? { id: leaseId, reference: str(leaseRaw?.reference) ?? str(raw.lease_reference) } : null,
    rent: rentMoney && frequency ? { ...rentMoney, frequency, frequencyLabel: str(rentRaw?.frequency_label), dueDay: int(rentRaw?.due_day ?? raw.due_day) } : null,
    deposit: money(raw.deposit, raw, "deposit"),
    startDate: str(raw.start_date),
    endDate: str(raw.end_date),
    endedOn: str(raw.ended_on),
    endReason: str(raw.end_reason) ?? str(raw.ended_reason),
    notes: str(raw.notes) ?? "",
    createdAt: str(raw.created_at),
    createdBy: personName(raw.created_by),
    activatedAt: str(raw.activated_at),
    activatedBy: personName(raw.activated_by),
    endedAt: str(raw.ended_at),
    endedBy: personName(raw.ended_by),
    events: arr(first(raw, "events", "timeline", "history")).map(event).filter((item): item is TenancyEvent => item !== null),
    can: can
      ? { edit: bool(can.edit) ?? false, activate: bool(can.activate) ?? false, end: bool(can.end) ?? false, delete: bool(can.delete) ?? false }
      : null,
  };
}

export type StatusCount = { status: string; label: string | null; count: number };

export type TenancyPage = Paged<Tenancy> & { statusCounts: StatusCount[] };

/** `status_counts` as the API's map `{ACTIVE: 2}`, or a list of `{status, count}`. They ignore the status filter. */
function statusCounts(value: unknown): StatusCount[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const raw = obj(item);
        const status = str(raw?.status);
        const count = int(raw?.count);
        return status && count !== null ? { status, label: str(raw?.label), count } : null;
      })
      .filter((item): item is StatusCount => item !== null);
  }
  const map = obj(value);
  if (!map) return [];
  return Object.entries(map)
    .map(([status, count]) => ({ status, label: null, count: int(count) ?? -1 }))
    .filter((item) => item.count >= 0);
}

export function normaliseTenancyPage(value: unknown, fallbackPage = 1): TenancyPage {
  return { ...paged(value, normaliseTenancy, ["tenancies"], fallbackPage), statusCounts: statusCounts(obj(value)?.status_counts) };
}

/** What the agent may do with a tenancy: the API's `can` when it sends one, otherwise the role and the status. */
export function tenancyActions(tenancy: Pick<Tenancy, "status" | "can">, role: string | null | undefined) {
  const writer = canWriteTenancies(role);
  if (tenancy.can) return { activate: writer && tenancy.can.activate, end: writer && tenancy.can.end, delete: writer && tenancy.can.delete };
  return { activate: writer && canActivate(tenancy.status), end: writer && canEnd(tenancy.status), delete: writer && tenancy.status === "DRAFT" };
}

/** The tenancy a 409 `UNIT_OCCUPIED` names (`details.tenancy_id`), or null. */
export function occupyingTenancyId(body: unknown): string | null {
  const details = obj(obj(obj(body)?.error)?.details);
  return str(details?.tenancy_id);
}

// ---- The status timeline ---------------------------------------------------------------------------------

export type TimelineStep = { key: string; words: string; at: string | null; day: string | null; actor: string | null; text: string | null };

const EVENT_WORDS: Record<string, string> = {
  CREATED: "Created as a draft",
  DRAFT: "Created as a draft",
  UPDATED: "Details changed",
  ACTIVATED: "Activated",
  ACTIVE: "Activated",
  ENDED: "Ended",
  TERMINATED: "Ended early (terminated)",
};

/**
 * The tenancy's history, oldest first: the API's events when it sends them,
 * otherwise made from the dates it does send (created, activated, ended, with
 * who did it). Nothing is made up: a step with no date is left out.
 */
export function tenancyTimeline(tenancy: Tenancy): TimelineStep[] {
  if (tenancy.events.length) {
    return tenancy.events
      .map((item) => ({
        key: item.id,
        words: item.label ?? EVENT_WORDS[item.kind.toUpperCase().replace(/^TENANCY_/, "")] ?? wordsFromCode(item.kind),
        at: item.at,
        day: item.day,
        actor: item.actor,
        text: item.text,
      }))
      .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  }
  const steps: TimelineStep[] = [];
  if (tenancy.createdAt) steps.push({ key: "created", words: EVENT_WORDS.CREATED, at: tenancy.createdAt, day: null, actor: tenancy.createdBy, text: null });
  if (tenancy.activatedAt) steps.push({ key: "activated", words: EVENT_WORDS.ACTIVATED, at: tenancy.activatedAt, day: null, actor: tenancy.activatedBy, text: null });
  if ((tenancy.status === "ENDED" || tenancy.status === "TERMINATED") && (tenancy.endedAt || tenancy.endedOn)) {
    steps.push({
      key: "ended",
      words: EVENT_WORDS[tenancy.status],
      at: tenancy.endedAt,
      day: tenancy.endedOn,
      actor: tenancy.endedBy,
      text: tenancy.endReason,
    });
  }
  return steps;
}

/** "Let" / "Not let" for a property let as a whole; "1 of 3 units let" otherwise. */
export function occupancyWords(occupied: number, lettable: number): string {
  if (lettable <= 1) return occupied > 0 ? "Let" : "Not let";
  return `${occupied} of ${lettable} units let`;
}

/** "Rudo Moyo", "Rudo Moyo and Tendai Moyo", "Rudo Moyo and 2 others". */
export function partyNames(parties: readonly { name: string }[]): string {
  if (parties.length === 0) return "";
  if (parties.length === 1) return parties[0].name;
  if (parties.length === 2) return `${parties[0].name} and ${parties[1].name}`;
  return `${parties[0].name} and ${parties.length - 1} others`;
}

/** The id of a created record from `{property: {id}}`, `{tenancy: {id}}`, `{id}`. */
export function createdId(value: unknown): string | null {
  const raw = obj(value);
  if (!raw) return null;
  return str(obj(raw.property)?.id) ?? str(obj(raw.tenancy)?.id) ?? str(obj(raw.data)?.id) ?? str(raw.id);
}
