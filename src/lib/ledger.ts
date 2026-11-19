/**
 * The rules of an organisation's own books (`/agent/books`, API 0.34.0) that
 * are not the API's, as pure functions: the words for entry types, methods
 * and statuses, the amount check per currency (its minor units), exact
 * decimal formatting and per-currency totals, the list's filters in the page
 * address and in the API query, who sees which controls, how entries are
 * linked to each other, and tolerant readers for the API's answers.
 *
 * Two rules are absolute here (FR-028, FR-029, BR-012):
 * - an entry's status never claims a bank or gateway verification. There are
 *   exactly two words: "Recorded by you, not verified" and "Marked reconciled
 *   by your team". Anything else, GATEWAY_CONFIRMED included, reads as the first.
 * - amounts in different currencies are never added together. Totals are
 *   always per currency.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/ledger.test.mjs).
 */

// ---- Entry types, directions, methods --------------------------------------------------

/** The types a person can record. REVERSAL is made by the API only. */
export const ENTRY_TYPES = [
  "INCOME",
  "EXPENSE",
  "RENT_RECEIVED",
  "COMMISSION",
  "DEPOSIT_HELD",
  "DEPOSIT_RETURNED",
  "TRANSFER",
  "OPENING_BALANCE",
  "RECEIVABLE",
  "PAYABLE",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];
export type Direction = "IN" | "OUT";

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  RENT_RECEIVED: "Rent received",
  COMMISSION: "Commission",
  DEPOSIT_HELD: "Deposit held",
  DEPOSIT_RETURNED: "Deposit returned",
  TRANSFER: "Transfer",
  OPENING_BALANCE: "Opening balance",
  RECEIVABLE: "Owed to you (receivable)",
  PAYABLE: "Owed by you (payable)",
  REVERSAL: "Reversal",
};

/** Memo types: an amount owed, not money moving. They have no method and never move a cashbook balance. */
export const isMemoType = (type: string) => type === "RECEIVABLE" || type === "PAYABLE";

/** "SOME_CODE" -> "Some code": the last resort for a code with no words. */
export function wordsFromCode(code: string): string {
  const words = code.toLowerCase().split(/[_\s-]+/).filter(Boolean).join(" ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : code;
}

export const entryTypeLabel = (type: string, apiLabel?: string | null) => apiLabel || TYPE_LABELS[type] || wordsFromCode(type);

/** The types whose direction is fixed: the API sets it, and the form shows it as text. */
const FIXED_DIRECTION: Record<string, Direction> = {
  INCOME: "IN",
  RENT_RECEIVED: "IN",
  COMMISSION: "IN",
  DEPOSIT_HELD: "IN",
  EXPENSE: "OUT",
  DEPOSIT_RETURNED: "OUT",
  RECEIVABLE: "IN",
  PAYABLE: "OUT",
};

/**
 * The direction a type fixes, or null when the body chooses (an opening
 * balance) or for a transfer. The API's `GET /options` types win when given.
 */
export function fixedDirection(type: string, types?: readonly TypeOption[]): Direction | null {
  const option = types?.find((item) => item.code === type);
  if (option) return option.direction;
  return FIXED_DIRECTION[type] ?? null;
}

/** Types the general entry form records. Transfers and opening balances have their own forms. */
export const FORM_ENTRY_TYPES = ENTRY_TYPES.filter((type) => type !== "TRANSFER" && type !== "OPENING_BALANCE");

export const DIRECTION_LABELS: Record<Direction, string> = { IN: "Money in", OUT: "Money out" };
export const directionLabel = (direction: string) => DIRECTION_LABELS[direction as Direction] ?? wordsFromCode(direction);

export const METHODS = ["CASH", "BANK", "MOBILE_MONEY", "OTHER"] as const;
export type Method = (typeof METHODS)[number];

const METHOD_LABELS: Record<string, string> = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile money", OTHER: "Other" };
export const methodLabel = (method: string, apiLabel?: string | null) => apiLabel || METHOD_LABELS[method] || wordsFromCode(method);

// ---- Status -----------------------------------------------------------------------------

export const STATUS_UNVERIFIED = "USER_RECORDED_UNVERIFIED";
export const STATUS_RECONCILED = "RECONCILED";
/** The two statuses a person can filter by. GATEWAY_CONFIRMED is reserved and never set (D-05). */
export const FILTER_STATUSES = [STATUS_UNVERIFIED, STATUS_RECONCILED] as const;

export const UNVERIFIED_WORDS = "Recorded by you, not verified";
export const RECONCILED_WORDS = "Marked reconciled by your team";

/**
 * The badge of an entry. Only RECONCILED has its own words; every other
 * status, an unknown one or GATEWAY_CONFIRMED included, reads as "Recorded by
 * you, not verified", so the page never says more than the organisation did.
 * The API's own label is deliberately not used.
 */
export function statusBadge(status: string | null | undefined): { words: string; tone: "success" | "warning" } {
  return status === STATUS_RECONCILED ? { words: RECONCILED_WORDS, tone: "success" } : { words: UNVERIFIED_WORDS, tone: "warning" };
}

/** Words that must never describe an entry of these books. Used by the tests. */
export const FORBIDDEN_STATUS_WORDS = [/bank[- ]?verified/i, /verified by (the )?bank/i, /gateway/i, /confirmed by/i, /\bpaid\b/i];

// ---- Currencies and amounts ---------------------------------------------------------------

/** ISO 4217 minor units that some browsers' Intl data get wrong or do not know. */
const MINOR_UNITS: Record<string, number> = {
  BHD: 3,
  CLF: 4,
  IQD: 3,
  JOD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  UYW: 4,
  ISK: 0,
  UGX: 0,
  VND: 0,
  XAF: 0,
  XOF: 0,
  RWF: 0,
  PYG: 0,
  CLP: 0,
};

export const isCurrencyCode = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{3}$/.test(value);

/** How many decimals an amount in this currency may have: JPY 0, USD 2, KWD 3. */
export function currencyMinorUnits(currency: string): number {
  const code = currency.toUpperCase();
  if (code in MINOR_UNITS) return MINOR_UNITS[code];
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" && digits >= 0 && digits <= 4 ? digits : 2;
  } catch {
    return 2;
  }
}

/** numeric(20,4): at most 16 digits before the point. */
const MAX_WHOLE_DIGITS = 16;

/** What a person typed, without spaces. Commas are not removed: "1,5" might be a decimal comma. */
export const cleanAmountInput = (value: string) => value.replace(/\s+/g, "");

/**
 * Why an amount cannot be recorded in this currency, in words, or null. A
 * positive decimal with at most the currency's minor units (the sign comes
 * from the direction). Exact: no floating point anywhere.
 */
export function amountProblem(value: string, currency: string, minorUnits?: number | null): string | null {
  const text = cleanAmountInput(value);
  if (!text) return "Enter the amount.";
  if (text.includes(",")) return "Enter the amount without commas, with a full stop for the decimals, for example 1250.50.";
  if (text.startsWith("-")) return "Enter the amount without a minus sign. Choose money in or money out instead.";
  if (!/^\d+(\.\d+)?$/.test(text)) return "Enter the amount in figures, for example 1250.50.";
  const [whole, fraction = ""] = text.split(".");
  const units = typeof minorUnits === "number" ? minorUnits : currencyMinorUnits(currency || "USD");
  if (fraction.length > units) {
    return units === 0
      ? `${currency} has no decimal places. Enter a whole number.`
      : `${currency} amounts have at most ${units} decimal place${units === 1 ? "" : "s"}.`;
  }
  if (whole.replace(/^0+/, "").length > MAX_WHOLE_DIGITS) return "That amount is too large.";
  if (/^0*$/.test(whole) && /^0*$/.test(fraction)) return "Enter an amount above zero.";
  return null;
}

/** The amount as sent to the API: "0012.50" -> "12.50". Only for an amount without a problem. */
export function normaliseAmount(value: string): string {
  const [whole, fraction] = cleanAmountInput(value).split(".");
  const trimmed = whole.replace(/^0+(?=\d)/, "");
  return fraction !== undefined ? `${trimmed}.${fraction}` : trimmed;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** "1234.5" -> "1,234.5"; digits after the point stay as they are. */
export function groupDigits(amount: string): string {
  const text = amount.trim();
  if (!DECIMAL.test(text)) return text;
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
}

/**
 * The amount to the currency's minor units, exactly: "123.4500" in USD is
 * "123.45", "1000" in KWD is "1000.000". Extra digits that are not zero are
 * kept (the API stores four), never rounded away.
 */
export function toMinorUnits(amount: string, currency: string): string {
  const text = amount.trim();
  if (!DECIMAL.test(text)) return text;
  const units = currencyMinorUnits(currency);
  const [whole, fraction = ""] = text.split(".");
  let digits = fraction;
  while (digits.length > units && digits.endsWith("0")) digits = digits.slice(0, -1);
  digits = digits.padEnd(units, "0");
  return digits ? `${whole}.${digits}` : whole;
}

/**
 * "USD 1,234.50", always with the currency code. A negative amount is
 * "-USD 10.00". The digits are the API's, only grouped and padded.
 */
export function formatLedgerAmount(amount: string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === "") return `${currency} —`;
  const grouped = groupDigits(toMinorUnits(amount, currency));
  return grouped.startsWith("-") ? `-${currency} ${grouped.slice(1)}` : `${currency} ${grouped}`;
}

/** "+USD 100.00" for money in, "−USD 100.00" for money out (with a true minus sign). */
export function signedLedgerAmount(amount: string, currency: string, direction: string): string {
  const text = formatLedgerAmount(amount.replace(/^-/, ""), currency);
  return direction === "OUT" ? `−${text}` : `+${text}`;
}

// ---- Exact sums, one currency at a time ------------------------------------------------------

/** A decimal string as a whole number of 10^-scale units. */
function toScaled(amount: string, scale: number): bigint | null {
  const text = amount.trim();
  if (!DECIMAL.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  if (fraction.length > scale) return null;
  const value = BigInt(whole + fraction.padEnd(scale, "0"));
  return negative ? -value : value;
}

function fromScaled(value: bigint, scale: number): string {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale) : "";
  return `${negative ? "-" : ""}${whole}${scale ? `.${fraction}` : ""}`;
}

/** Adds decimal strings of ONE currency exactly (at the API's four decimals). Null when one is not a decimal. */
export function addDecimals(amounts: readonly string[]): string | null {
  let total = BigInt(0);
  for (const amount of amounts) {
    const scaled = toScaled(amount, 4);
    if (scaled === null) return null;
    total += scaled;
  }
  return fromScaled(total, 4);
}

export type CurrencyGroup<T> = { currency: string; rows: T[] };

/**
 * Rows grouped by their currency, in the order each currency first appears.
 * The groups are kept apart: nothing here, or anywhere in the books, adds
 * one currency to another.
 */
export function groupByCurrency<T extends { currency: string }>(rows: readonly T[]): CurrencyGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.currency);
    if (list) list.push(row);
    else groups.set(row.currency, [row]);
  }
  return [...groups.entries()].map(([currency, list]) => ({ currency, rows: list }));
}

export type CurrencyTotals = { currency: string; moneyIn: string; moneyOut: string; net: string; count: number };

/** Money in, money out and the difference, per currency, exactly. Never one figure for two currencies. */
export function totalsByCurrency(rows: readonly { currency: string; amount: string; direction: string }[]): CurrencyTotals[] {
  return groupByCurrency(rows).map(({ currency, rows: list }) => {
    const moneyIn = addDecimals(list.filter((row) => row.direction === "IN").map((row) => row.amount.replace(/^-/, ""))) ?? "0.0000";
    const moneyOut = addDecimals(list.filter((row) => row.direction === "OUT").map((row) => row.amount.replace(/^-/, ""))) ?? "0.0000";
    const net = addDecimals([moneyIn, `-${moneyOut}`.replace(/^--/, "")]) ?? "0.0000";
    return { currency, moneyIn, moneyOut, net, count: list.length };
  });
}

// ---- Who sees which controls (the API decides) --------------------------------------------------

const WRITERS = ["OWNER", "MANAGER", "AGENT"];
const MANAGERS = ["OWNER", "MANAGER"];

/** Record entries: OWNER, MANAGER and AGENT. STAFF read only. */
export const canWriteBooks = (role: string | null | undefined) => WRITERS.includes(role ?? "");
/** Export, manage categories, correct anyone's entries. */
export const canExportBooks = (role: string | null | undefined) => MANAGERS.includes(role ?? "");
export const canManageCategories = canExportBooks;

type Correctable = {
  author_user_id?: string | null;
  status?: string | null;
  reversed_by?: string | null;
  type?: string | null;
  can_reverse?: boolean;
  can_correct?: boolean;
  can_reconcile?: boolean;
};

const isLive = (entry: Correctable) => !entry.reversed_by && entry.type !== "REVERSAL";

/**
 * Reverse and correct: OWNER and MANAGER on any live entry; an AGENT only on
 * their own entries that are not reconciled. A reversal and a reversed entry
 * cannot be reversed again. The API's `can_*` flags win when it sends them.
 */
export function canCorrectEntry(role: string | null | undefined, entry: Correctable, userId: string, action: "reverse" | "correct" = "correct"): boolean {
  const flag = action === "reverse" ? entry.can_reverse : entry.can_correct;
  if (typeof flag === "boolean") return flag;
  if (!isLive(entry)) return false;
  if (MANAGERS.includes(role ?? "")) return true;
  return role === "AGENT" && Boolean(entry.author_user_id) && entry.author_user_id === userId && entry.status !== STATUS_RECONCILED;
}

/** Opening balances are corrected by reversing them only. */
export const canCorrectType = (type: string) => type !== "OPENING_BALANCE" && type !== "TRANSFER" && type !== "REVERSAL";

/** Marking reconciled: OWNER and MANAGER, unless the API says otherwise. */
export function canReconcileEntry(role: string | null | undefined, entry: Correctable): boolean {
  if (typeof entry.can_reconcile === "boolean") return entry.can_reconcile;
  return MANAGERS.includes(role ?? "") && entry.type !== "REVERSAL";
}

// ---- The list's filters ------------------------------------------------------------------------

export const LEDGER_QUERY_MAX = 100;

export type LedgerFilters = {
  currency?: string;
  type?: string;
  category?: string;
  method?: string;
  status?: string;
  /** Effective date, YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
  contact?: string;
  listing?: string;
  q?: string;
  /** Leave reversed entries and their reversals out (`include_reversed=false`). */
  hideReversed?: boolean;
  page: number;
};

type Params = { get(name: string): string | null };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{1,64}$/;

export const isUuid = (value: string | null | undefined) => UUID.test(value ?? "");

/** A real calendar day as YYYY-MM-DD. */
export function isDay(value: string | null | undefined): value is string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
}

export function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** The filters in a page address. Anything the API would refuse is dropped; dates the wrong way round are swapped. */
export function parseLedgerFilters(params: Params): LedgerFilters {
  const filters: LedgerFilters = { page: pageNumber(params.get("page")) };
  const currency = (params.get("currency") ?? "").toUpperCase();
  const type = params.get("type") ?? "";
  const category = params.get("category") ?? "";
  const method = params.get("method") ?? "";
  const status = params.get("status") ?? "";
  let from = params.get("from") ?? "";
  let to = params.get("to") ?? "";
  const contact = params.get("contact") ?? "";
  const listing = params.get("listing") ?? "";
  const q = (params.get("q") ?? "").trim().slice(0, LEDGER_QUERY_MAX);
  const hide = params.get("hide_reversed") ?? "";
  if (isCurrencyCode(currency)) filters.currency = currency;
  if (CODE.test(type)) filters.type = type.toUpperCase();
  if (CODE.test(category)) filters.category = category;
  if ((METHODS as readonly string[]).includes(method)) filters.method = method;
  if ((FILTER_STATUSES as readonly string[]).includes(status)) filters.status = status;
  if (isDay(from) && isDay(to) && from > to) [from, to] = [to, from];
  if (isDay(from)) filters.from = from;
  if (isDay(to)) filters.to = to;
  if (isUuid(contact)) filters.contact = contact;
  if (isUuid(listing)) filters.listing = listing;
  if (q) filters.q = q;
  if (hide === "1" || hide === "true") filters.hideReversed = true;
  return filters;
}

const FILTER_KEYS = ["currency", "type", "category", "method", "status", "from", "to", "contact", "listing", "q"] as const;

export const hasLedgerFilters = (filters: LedgerFilters) => FILTER_KEYS.some((key) => Boolean(filters[key])) || Boolean(filters.hideReversed);

/** The page address's query: "" or "?org=…&currency=USD&page=2". The organisation first; page 1 left out. */
export function ledgerFiltersSearch(filters: LedgerFilters, org?: string): string {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) search.set(key, value);
  }
  if (filters.hideReversed) search.set("hide_reversed", "1");
  if (filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** The API query for these filters (`GET …/ledger/entries`), in the contract's names. */
export function ledgerFiltersApiQuery(filters: LedgerFilters, pageSize = 25): string {
  const search = new URLSearchParams();
  if (filters.currency) search.set("currency", filters.currency);
  if (filters.type) search.set("type", filters.type);
  if (filters.category) search.set("category", filters.category);
  if (filters.method) search.set("method", filters.method);
  if (filters.status) search.set("status", filters.status);
  if (filters.from) search.set("from", filters.from);
  if (filters.to) search.set("to", filters.to);
  if (filters.contact) search.set("contact_id", filters.contact);
  if (filters.listing) search.set("listing_id", filters.listing);
  if (filters.q) search.set("q", filters.q);
  if (filters.hideReversed) search.set("include_reversed", "false");
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search.toString()}`;
}

export type FilterChip = { key: string; label: string; href: string };

/** The filters in use as removable chips; each is the list's address without that filter, at page 1. */
export function ledgerFilterChips(
  filters: LedgerFilters,
  words: { category?: (code: string) => string; contact?: (id: string) => string; listing?: (id: string) => string },
  hrefFor: (filters: LedgerFilters) => string,
): FilterChip[] {
  const without = (...keys: (keyof LedgerFilters)[]) => {
    const next: LedgerFilters = { ...filters, page: 1 };
    for (const key of keys) delete next[key];
    return hrefFor(next);
  };
  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, href: without("q") });
  if (filters.currency) chips.push({ key: "currency", label: filters.currency, href: without("currency") });
  if (filters.type) chips.push({ key: "type", label: entryTypeLabel(filters.type), href: without("type") });
  if (filters.category) chips.push({ key: "category", label: `Category: ${words.category?.(filters.category) ?? filters.category}`, href: without("category") });
  if (filters.method) chips.push({ key: "method", label: methodLabel(filters.method), href: without("method") });
  if (filters.status) chips.push({ key: "status", label: statusBadge(filters.status).words, href: without("status") });
  if (filters.from || filters.to) {
    const label = filters.from && filters.to ? `${filters.from} to ${filters.to}` : filters.from ? `From ${filters.from}` : `Until ${filters.to}`;
    chips.push({ key: "dates", label, href: without("from", "to") });
  }
  if (filters.contact) chips.push({ key: "contact", label: `Contact: ${words.contact?.(filters.contact) ?? "chosen contact"}`, href: without("contact") });
  if (filters.listing) chips.push({ key: "listing", label: `Listing: ${words.listing?.(filters.listing) ?? "chosen listing"}`, href: without("listing") });
  if (filters.hideReversed) chips.push({ key: "hide_reversed", label: "Reversed entries hidden", href: without("hideReversed") });
  return chips;
}

/** An address in the books (`/agent/books/new`…) for an organisation. */
export const booksPath = (path: string, org?: string, extra: Record<string, string | undefined> = {}) => {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
  const text = search.toString();
  return `/agent/books${path}${text ? `?${text}` : ""}`;
};

export const entryHref = (id: string, org?: string) => booksPath(`/${encodeURIComponent(id)}`, org);

// ---- Reading the API's answers -------------------------------------------------------------------

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
/** A decimal string; a number from an older build is turned into one (display only). */
const dec = (value: unknown): string | null =>
  typeof value === "string" && DECIMAL.test(value.trim()) ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
const bool = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const first = (raw: Raw, ...keys: string[]): unknown => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};

export type Person = { id: string | null; name: string };

function person(raw: Raw, key: string): Person | null {
  const value = raw[key];
  const inner = obj(value);
  if (inner) {
    const name = str(inner.name) ?? str(inner.display_name);
    const id = str(inner.user_id) ?? str(inner.id);
    return name || id ? { id, name: name ?? "A colleague" } : null;
  }
  const name = str(raw[`${key}_name`]);
  const id = str(raw[`${key}_user_id`]) ?? str(raw[`${key}_id`]);
  return name || id ? { id, name: name ?? "A colleague" } : null;
}

export type LinkedThing = { id: string; label: string | null; reference: string | null };

function linked(raw: Raw, key: string): LinkedThing | null {
  const inner = obj(raw[key]);
  if (inner) {
    const id = str(inner.id) ?? str(inner[`${key}_id`]);
    return id ? { id, label: str(inner.name) ?? str(inner.title) ?? str(inner.label), reference: str(inner.reference) } : null;
  }
  const id = str(raw[`${key}_id`]);
  return id ? { id, label: str(raw[`${key}_name`]) ?? str(raw[`${key}_title`]) ?? str(raw[`${key}_label`]), reference: str(raw[`${key}_reference`]) } : null;
}

export type EntryNote = { id: string; text: string; author: Person | null; createdAt: string | null };
export type EntryAttachment = { id: string; name: string; size: number | null; type: string | null; uploadedAt: string | null; uploadedBy: Person | null };
export type EntryEvent = { id: string; kind: string; label: string | null; text: string | null; at: string | null; actor: Person | null; relatedId: string | null };

export type LedgerEntry = {
  id: string;
  type: string;
  typeLabel: string | null;
  direction: Direction;
  category: string | null;
  categoryLabel: string | null;
  method: string | null;
  methodLabel: string | null;
  /** Positive, as the API stores it; the sign is the direction. */
  amount: string;
  currency: string;
  effectiveDate: string;
  recordedAt: string | null;
  author: Person | null;
  author_user_id: string | null;
  status: string;
  reconciledNote: string | null;
  reconciledAt: string | null;
  reconciledBy: Person | null;
  reversal_of: string | null;
  reversed_by: string | null;
  correction_of: string | null;
  corrected_by: string | null;
  transfer_pair: string | null;
  reason: string | null;
  contact: LinkedThing | null;
  listing: LinkedThing | null;
  leaseId: string | null;
  tenancyId: string | null;
  /** A cash entry settling a RECEIVABLE or PAYABLE: that entry. */
  settles: string | null;
  /** False for the memo types RECEIVABLE and PAYABLE. */
  cash: boolean;
  noteCount: number | null;
  attachmentCount: number | null;
  branch: string | null;
  description: string | null;
  reference: string | null;
  notes: EntryNote[];
  attachments: EntryAttachment[];
  history: EntryEvent[];
  can_reverse?: boolean;
  can_correct?: boolean;
  can_reconcile?: boolean;
  can_note?: boolean;
  can_attach?: boolean;
};

function normaliseNote(value: unknown, index: number): EntryNote | null {
  const raw = obj(value);
  if (!raw) return typeof value === "string" && value ? { id: `note-${index}`, text: value, author: null, createdAt: null } : null;
  const text = str(raw.text) ?? str(raw.note) ?? str(raw.body);
  if (!text) return null;
  return { id: str(raw.id) ?? `note-${index}`, text, author: person(raw, "author") ?? person(raw, "created_by"), createdAt: str(raw.created_at) ?? str(raw.at) };
}

export function normaliseAttachment(value: unknown): EntryAttachment | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.attachment_id) ?? str(raw.file_id);
  if (!id) return null;
  const size = first(raw, "size", "size_bytes", "bytes");
  return {
    id,
    name: str(raw.file_name) ?? str(raw.filename) ?? str(raw.name) ?? "Attachment",
    size: typeof size === "number" ? size : null,
    type: str(raw.content_type) ?? str(raw.mime_type) ?? str(raw.type),
    uploadedAt: str(raw.uploaded_at) ?? str(raw.created_at),
    uploadedBy: person(raw, "uploaded_by") ?? person(raw, "author"),
  };
}

function normaliseEvent(value: unknown, index: number): EntryEvent | null {
  const raw = obj(value);
  if (!raw) return null;
  const kind = str(raw.kind) ?? str(raw.action) ?? str(raw.type) ?? str(raw.event);
  if (!kind) return null;
  return {
    id: str(raw.id) ?? `event-${index}`,
    kind,
    label: str(raw.label),
    text: str(raw.text) ?? str(raw.reason) ?? str(raw.note),
    at: str(raw.at) ?? str(raw.created_at) ?? str(raw.occurred_at),
    actor: person(raw, "actor") ?? person(raw, "by"),
    relatedId: str(raw.related_entry_id) ?? str(raw.entry_id),
  };
}

export type EntryDetail = { entry: LedgerEntry; related: LedgerEntry[] };

/**
 * `GET /entries/{id}`: `{entry, notes, attachments, related}`. The notes and
 * attachments come beside the entry and are put on it here.
 */
export function normaliseEntryDetail(value: unknown): EntryDetail | null {
  const entry = normaliseEntry(value);
  if (!entry) return null;
  const raw = obj(value) ?? {};
  const notes = arr(raw.notes).map(normaliseNote).filter((note): note is EntryNote => note !== null);
  const attachments = arr(raw.attachments).map(normaliseAttachment).filter((file): file is EntryAttachment => file !== null);
  const related = arr(raw.related)
    .map(normaliseEntry)
    .filter((item): item is LedgerEntry => item !== null && item.id !== entry.id);
  return {
    entry: {
      ...entry,
      notes: notes.length ? notes : entry.notes,
      attachments: attachments.length ? attachments : entry.attachments,
    },
    related,
  };
}

/** One entry, from `{entry: {...}}` or the entry itself. Null when it has no id, amount or currency. */
export function normaliseEntry(value: unknown): LedgerEntry | null {
  const outer = obj(value);
  const raw = obj(outer?.entry) ?? outer;
  if (!raw) return null;
  const id = str(raw.id);
  const signed = dec(first(raw, "amount"));
  const currency = str(raw.currency);
  if (!id || signed === null || !currency) return null;
  const rawDirection = str(raw.direction);
  const direction: Direction = rawDirection === "OUT" || rawDirection === "IN" ? rawDirection : signed.startsWith("-") ? "OUT" : "IN";
  const type = str(raw.type) ?? "INCOME";
  const category = obj(raw.category);
  const method = obj(raw.method);
  const reconciliation = obj(raw.reconciliation);
  const author = person(raw, "author") ?? person(raw, "recorded_by");
  const can = obj(raw.can) ?? {};
  const lease = obj(raw.lease);
  return {
    id,
    type,
    typeLabel: str(raw.type_label),
    direction,
    category: category ? str(category.code) : str(raw.category),
    categoryLabel: category ? str(category.label) ?? str(category.name) : str(raw.category_label),
    method: method ? str(method.code) : str(raw.method),
    methodLabel: method ? str(method.label) : str(raw.method_label),
    amount: signed.replace(/^-/, ""),
    currency,
    effectiveDate: str(raw.effective_date) ?? "",
    recordedAt: str(raw.recorded_at) ?? str(raw.created_at),
    author,
    author_user_id: str(raw.author_user_id) ?? author?.id ?? null,
    status: str(raw.status) ?? STATUS_UNVERIFIED,
    reconciledNote: str(reconciliation?.note) ?? str(raw.reconciled_note) ?? str(raw.reconcile_note),
    reconciledAt: str(reconciliation?.at) ?? str(raw.reconciled_at),
    reconciledBy: (reconciliation ? person(reconciliation, "by") : null) ?? person(raw, "reconciled_by"),
    reversal_of: str(raw.reversal_of),
    reversed_by: str(raw.reversed_by),
    correction_of: str(raw.correction_of),
    corrected_by: str(raw.corrected_by),
    transfer_pair: str(raw.transfer_pair) ?? str(raw.transfer_pair_id),
    reason: str(raw.reason),
    contact: linked(raw, "contact"),
    listing: linked(raw, "listing"),
    leaseId: str(lease?.id) ?? str(raw.lease_id),
    tenancyId: str(raw.tenancy_id),
    settles: str(raw.settles),
    cash: bool(raw.cash) ?? !isMemoType(type),
    noteCount: typeof raw.note_count === "number" ? raw.note_count : null,
    attachmentCount: typeof raw.attachment_count === "number" ? raw.attachment_count : null,
    branch: str(raw.branch),
    description: str(raw.description),
    reference: str(raw.reference),
    notes: arr(raw.notes).map(normaliseNote).filter((note): note is EntryNote => note !== null),
    attachments: arr(raw.attachments).map(normaliseAttachment).filter((file): file is EntryAttachment => file !== null),
    history: arr(first(raw, "history", "events", "audit")).map(normaliseEvent).filter((event): event is EntryEvent => event !== null),
    can_reverse: bool(can.reverse) ?? bool(raw.can_reverse),
    can_correct: bool(can.correct) ?? bool(raw.can_correct),
    can_reconcile: bool(can.reconcile) ?? bool(raw.can_reconcile),
    can_note: bool(can.note) ?? bool(raw.can_note),
    can_attach: bool(can.attach) ?? bool(raw.can_attach),
  };
}

export type EntryPage = { items: LedgerEntry[]; page: number; pageSize: number; total: number; totalPages: number };

/** `{items, page, page_size, total, total_pages}` (or `entries`), with what is missing filled in. */
export function normaliseEntryPage(value: unknown, fallbackPage = 1): EntryPage {
  const raw = obj(value) ?? {};
  const items = arr(first(raw, "items", "entries") ?? (Array.isArray(value) ? value : []))
    .map(normaliseEntry)
    .filter((entry): entry is LedgerEntry => entry !== null);
  const num = (key: string, fallback: number) => (typeof raw[key] === "number" ? (raw[key] as number) : fallback);
  const pageSize = num("page_size", Math.max(items.length, 1));
  const total = num("total", items.length);
  return { items, page: num("page", fallbackPage), pageSize, total, totalPages: num("total_pages", Math.max(1, Math.ceil(total / pageSize))) };
}

/** The entries that answer a transfer, a correction or a reversal: the ids of entries an entry created. */
export function entryIdsFrom(value: unknown): string[] {
  const raw = obj(value);
  if (!raw) return [];
  const ids: string[] = [];
  const push = (item: unknown) => {
    const entry = normaliseEntry(item);
    if (entry && !ids.includes(entry.id)) ids.push(entry.id);
  };
  for (const key of ["entry", "corrected", "correction", "new_entry", "reversal", "out", "in"]) if (raw[key]) push({ entry: raw[key] });
  for (const item of arr(first(raw, "entries", "items"))) push(item);
  if (!ids.length) push(raw);
  return ids;
}

/** The entry a create, correct or transfer answer is best opened at: the new (corrected) entry, else the first. */
export function primaryEntryId(value: unknown): string | null {
  const raw = obj(value);
  if (!raw) return null;
  for (const key of ["corrected", "correction", "new_entry", "entry", "out"]) {
    const entry = normaliseEntry({ entry: raw[key] });
    if (entry) return entry.id;
  }
  return entryIdsFrom(value)[0] ?? null;
}

// ---- How entries point at each other -----------------------------------------------------------

export type EntryRelation = { kind: "REVERSES" | "REVERSED_BY" | "CORRECTS" | "CORRECTED_BY" | "TRANSFER_PAIR"; id: string; words: string };

/** Every other entry this one is linked to, in words. Both sides of a reversal or correction stay visible. */
export function entryRelations(entry: Pick<LedgerEntry, "reversal_of" | "reversed_by" | "correction_of" | "corrected_by" | "transfer_pair">): EntryRelation[] {
  const relations: EntryRelation[] = [];
  if (entry.reversal_of) relations.push({ kind: "REVERSES", id: entry.reversal_of, words: "Reverses the entry" });
  if (entry.reversed_by) relations.push({ kind: "REVERSED_BY", id: entry.reversed_by, words: "Reversed by the entry" });
  if (entry.correction_of) relations.push({ kind: "CORRECTS", id: entry.correction_of, words: "Correction of the entry" });
  if (entry.corrected_by) relations.push({ kind: "CORRECTED_BY", id: entry.corrected_by, words: "Corrected by the entry" });
  if (entry.transfer_pair) relations.push({ kind: "TRANSFER_PAIR", id: entry.transfer_pair, words: "Other half of this transfer" });
  return relations;
}

/** A short marker for the list: "Reversed", "Reversal", "Correction". */
export function entryMarkers(entry: Pick<LedgerEntry, "type" | "reversal_of" | "reversed_by" | "correction_of"> & { cash?: boolean; settles?: string | null }): string[] {
  const markers: string[] = [];
  if (entry.reversed_by) markers.push("Reversed");
  if (entry.type === "REVERSAL" || entry.reversal_of) markers.push("Reversal");
  if (entry.correction_of) markers.push("Correction");
  // An amount owed: no money moved, it never changes a cashbook balance.
  if (entry.cash === false) markers.push("Amount owed, no money moved");
  if (entry.settles) markers.push("Payment against an amount owed");
  return markers;
}

// ---- The new-entry forms ---------------------------------------------------------------------------

export type EntryForm = {
  kind: "entry" | "transfer" | "opening";
  type: string;
  direction: string;
  category: string;
  method: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  description: string;
  reference: string;
  contactId: string;
  listingId: string;
  branch: string;
  notes: string;
  /** A transfer: to another method, or to another branch. */
  transferToMethod: string;
  transferToBranch: string;
  /** A correction: why. */
  reason: string;
  /** Kept from the entry being corrected. */
  leaseId: string;
  /** A payment against a RECEIVABLE or PAYABLE: that entry. */
  settles: string;
};

export const DESCRIPTION_MAX = 500;
export const REFERENCE_MAX = 120;
export const NOTE_MAX = 2000;
export const REASON_MAX = 500;
export const BRANCH_MAX = 80;

export const emptyEntryForm = (kind: EntryForm["kind"], today: string, currency = "USD"): EntryForm => ({
  kind,
  type: kind === "transfer" ? "TRANSFER" : kind === "opening" ? "OPENING_BALANCE" : "INCOME",
  direction: "IN",
  category: "",
  method: "CASH",
  amount: "",
  currency,
  effectiveDate: today,
  description: "",
  reference: "",
  contactId: "",
  listingId: "",
  branch: "",
  notes: "",
  transferToMethod: "",
  transferToBranch: "",
  reason: "",
  leaseId: "",
  settles: "",
});

/** The form pre-filled from an entry, to correct it. The amount is shown in the currency's minor units. */
export function formFromEntry(entry: LedgerEntry): EntryForm {
  return {
    ...emptyEntryForm("entry", entry.effectiveDate, entry.currency),
    type: entry.type,
    direction: entry.direction,
    category: entry.category ?? "",
    method: entry.method ?? "CASH",
    amount: toMinorUnits(entry.amount, entry.currency),
    currency: entry.currency,
    effectiveDate: entry.effectiveDate,
    description: entry.description ?? "",
    reference: entry.reference ?? "",
    contactId: entry.contact?.id ?? "",
    listingId: entry.listing?.id ?? "",
    branch: entry.branch ?? "",
    leaseId: entry.leaseId ?? "",
    settles: entry.settles ?? "",
  };
}

/**
 * The form for a payment against an amount owed: money in (INCOME) against
 * a RECEIVABLE, money out (EXPENSE) against a PAYABLE, in its currency, with
 * its category, contact and listing, dated today. The amount starts at the
 * amount owed; the API refuses more than what is still open.
 */
export function paymentFormFor(owed: LedgerEntry, today: string): EntryForm {
  return {
    ...emptyEntryForm("entry", today, owed.currency),
    type: owed.type === "PAYABLE" ? "EXPENSE" : "INCOME",
    category: owed.category ?? "",
    amount: toMinorUnits(owed.amount, owed.currency),
    description: owed.description ? `Payment: ${owed.description}`.slice(0, DESCRIPTION_MAX) : "Payment",
    contactId: owed.contact?.id ?? "",
    listingId: owed.listing?.id ?? "",
    leaseId: owed.leaseId ?? "",
    branch: owed.branch ?? "",
    settles: owed.id,
  };
}

/** Problems with a form, by field name (the API's field names, so its errors land in the same places). */
export function entryFormProblems(
  form: EntryForm,
  mode: "create" | "correct" = "create",
  context: { types?: readonly TypeOption[]; minorUnits?: Record<string, number> } = {},
): Record<string, string> {
  const problems: Record<string, string> = {};
  const types = context.types?.length ? context.types.map((item) => item.code) : (FORM_ENTRY_TYPES as readonly string[]);
  if (form.kind === "entry" && (!types.includes(form.type) || form.type === "TRANSFER" || form.type === "OPENING_BALANCE")) problems.type = "Choose the type of entry.";
  if ((form.kind === "opening" || (form.kind === "entry" && !fixedDirection(form.type, context.types))) && form.direction !== "IN" && form.direction !== "OUT") {
    problems.direction = "Choose money in or money out.";
  }
  const defaultCategory = context.types?.find((item) => item.code === form.type)?.category;
  if (form.kind === "entry" && !form.category && !defaultCategory) problems.category = "Choose a category.";
  const memo = form.kind === "entry" && isMemoType(form.type);
  if (!memo && !(METHODS as readonly string[]).includes(form.method)) problems.method = form.kind === "transfer" ? "Choose where the money came from." : "Choose how the money moved.";
  if (!isCurrencyCode(form.currency)) problems.currency = "Choose the currency.";
  const amount = amountProblem(form.amount, form.currency, context.minorUnits?.[form.currency]);
  if (amount) problems.amount = amount;
  if (!isDay(form.effectiveDate)) problems.effective_date = "Enter the date, for example 12 November 2026.";
  if (form.kind !== "opening" && !form.description.trim()) problems.description = "Describe the entry in a few words.";
  if (form.description.length > DESCRIPTION_MAX) problems.description = `Use at most ${DESCRIPTION_MAX} characters.`;
  if (form.reference.length > REFERENCE_MAX) problems.reference = `Use at most ${REFERENCE_MAX} characters.`;
  if (form.branch.length > BRANCH_MAX) problems.branch = `Use at most ${BRANCH_MAX} characters.`;
  if (form.notes.length > NOTE_MAX) problems.notes = `Use at most ${NOTE_MAX} characters.`;
  if (form.kind === "transfer") {
    const toMethod = form.transferToMethod;
    const toBranch = form.transferToBranch.trim();
    if (!toMethod && !toBranch) problems.transfer_to = "Choose where the money went: another method or another branch.";
    else if (toMethod && toMethod === form.method && (!toBranch || toBranch === form.branch.trim())) {
      problems.transfer_to = "The money has to go somewhere else: choose another method or another branch.";
    }
  }
  if (mode === "correct" && !form.reason.trim()) problems.reason = "Say why the entry is being corrected.";
  if (form.reason.length > REASON_MAX) problems.reason = `Use at most ${REASON_MAX} characters.`;
  return problems;
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

/** The body of `POST …/entries` (or of `…/correct`, with the reason) for a form without problems. */
export function entryBody(form: EntryForm, mode: "create" | "correct" = "create", types?: readonly TypeOption[]): Record<string, unknown> {
  const type = form.kind === "transfer" ? "TRANSFER" : form.kind === "opening" ? "OPENING_BALANCE" : form.type;
  const direction = form.kind === "transfer" ? "OUT" : (fixedDirection(type, types) ?? form.direction);
  const body: Record<string, unknown> = {
    type,
    direction,
    // RECEIVABLE and PAYABLE record an amount owed, not money moving: no method.
    method: isMemoType(type) ? null : form.method,
    amount: normaliseAmount(form.amount),
    currency: form.currency,
    effective_date: form.effectiveDate,
    description: orNull(form.description),
    reference: orNull(form.reference),
    contact_id: orNull(form.contactId),
    listing_id: orNull(form.listingId),
    lease_id: orNull(form.leaseId),
    tenancy_id: null,
    branch: orNull(form.branch),
    notes: orNull(form.notes),
  };
  // Left out when empty: the type’s default category applies.
  if (form.category) body.category = form.category;
  if (form.settles) body.settles = form.settles;
  if (form.kind === "transfer") {
    const transferTo: Record<string, string> = {};
    transferTo.method = form.transferToMethod || form.method;
    if (form.transferToBranch.trim()) transferTo.branch = form.transferToBranch.trim();
    body.transfer_to = transferTo;
  }
  if (mode === "correct") body.reason = form.reason.trim();
  return body;
}

// ---- Categories --------------------------------------------------------------------------------------

/** `kind` IN, OUT or ANY (null here): an entry's direction must match unless ANY. */
export type LedgerCategory = { code: string; label: string; active: boolean; direction: Direction | null; used: boolean | null; isDefault: boolean };

export function normaliseCategory(value: unknown): LedgerCategory | null {
  const raw = obj(value);
  if (!raw) return null;
  const code = str(raw.code) ?? str(raw.id);
  if (!code) return null;
  const active = bool(raw.active) ?? (bool(raw.deactivated) === true || Boolean(str(raw.deactivated_at)) ? false : true);
  const direction = str(raw.kind) ?? str(raw.direction);
  return {
    code,
    label: str(raw.label) ?? str(raw.name) ?? wordsFromCode(code),
    active,
    direction: direction === "IN" || direction === "OUT" ? direction : null,
    used: bool(raw.used) ?? (typeof raw.entry_count === "number" ? raw.entry_count > 0 : null),
    isDefault: bool(raw.default) ?? bool(raw.is_default) ?? false,
  };
}

/** `{items: [Category]}` (or `categories`, or a bare list). */
export function normaliseCategories(value: unknown): LedgerCategory[] {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : arr(raw ? first(raw, "items", "categories") : undefined);
  return list.map(normaliseCategory).filter((item): item is LedgerCategory => item !== null);
}

export const CATEGORY_LABEL_MAX = 80;

/** The categories a form offers for a direction: those of that kind and those for both. */
export const categoriesFor = (items: readonly LedgerCategory[], direction: string | null) =>
  items.filter((item) => !item.direction || !direction || item.direction === direction);

// ---- What the form offers (`GET /options`) ------------------------------------------------------------

export type TypeOption = { code: string; label: string; direction: Direction | null; cash: boolean; category: string | null };

export type LedgerOptions = {
  types: TypeOption[];
  /** ISO 4217 code -> minor units, from the API's reference data. */
  minorUnits: Record<string, number>;
  currencies: string[];
  categories: LedgerCategory[];
  branches: string[];
  permissions: { write: boolean | null; manage: boolean | null; export: boolean | null };
};

export function normaliseOptions(value: unknown): LedgerOptions {
  const raw = obj(value) ?? {};
  const types = arr(raw.types)
    .map(obj)
    .filter((item): item is Raw => item !== null)
    .map((item): TypeOption | null => {
      const code = str(item.code);
      if (!code || code === "REVERSAL") return null;
      const direction = str(item.direction);
      return {
        code,
        label: str(item.label) ?? entryTypeLabel(code),
        direction: direction === "IN" || direction === "OUT" ? direction : null,
        cash: bool(item.cash) ?? !isMemoType(code),
        category: str(item.category),
      };
    })
    .filter((item): item is TypeOption => item !== null);
  const minorUnits: Record<string, number> = {};
  const currencies: string[] = [];
  for (const item of arr(raw.currencies)) {
    const row = obj(item);
    const code = row ? str(row.code) : str(item);
    if (!isCurrencyCode(code)) continue;
    currencies.push(code);
    if (row && typeof row.minor_unit === "number") minorUnits[code] = row.minor_unit;
  }
  const permissions = obj(raw.permissions) ?? {};
  return {
    types,
    minorUnits,
    currencies,
    categories: normaliseCategories({ items: raw.categories }),
    branches: arr(raw.branches).filter((item): item is string => typeof item === "string" && item !== ""),
    permissions: { write: bool(permissions.write) ?? null, manage: bool(permissions.manage) ?? null, export: bool(permissions.export) ?? null },
  };
}

// ---- History of an entry ---------------------------------------------------------------------------------

/**
 * What happened to an entry, newest first, from the entry and the entries
 * related to it (the API has no per-entry history; the organisation's
 * activity log holds the audit). Recorded, reconciled, reversed, corrected,
 * notes and attachments, each with who and when.
 */
export function entryHistory(entry: LedgerEntry, related: readonly LedgerEntry[] = []): EntryEvent[] {
  if (entry.history.length) return [...entry.history].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const events: EntryEvent[] = [];
  const recorded =
    entry.type === "REVERSAL" || entry.reversal_of ? "Recorded as a reversal" : entry.correction_of ? "Recorded as a correction" : "Recorded";
  events.push({ id: `recorded-${entry.id}`, kind: "RECORDED", label: recorded, text: entry.reason, at: entry.recordedAt, actor: entry.author, relatedId: entry.reversal_of ?? entry.correction_of });
  if (entry.status === STATUS_RECONCILED) {
    events.push({ id: `reconciled-${entry.id}`, kind: "RECONCILED", label: RECONCILED_WORDS, text: entry.reconciledNote, at: entry.reconciledAt, actor: entry.reconciledBy, relatedId: null });
  }
  for (const item of related) {
    if (item.reversal_of === entry.id) {
      events.push({ id: `reversed-${item.id}`, kind: "REVERSED", label: "Reversed", text: item.reason, at: item.recordedAt, actor: item.author, relatedId: item.id });
    } else if (item.correction_of === entry.id) {
      events.push({ id: `corrected-${item.id}`, kind: "CORRECTED", label: "Corrected", text: item.reason, at: item.recordedAt, actor: item.author, relatedId: item.id });
    } else if (item.settles === entry.id) {
      events.push({ id: `settled-${item.id}`, kind: "SETTLED", label: "Payment recorded against it", text: null, at: item.recordedAt, actor: item.author, relatedId: item.id });
    }
  }
  for (const note of entry.notes) events.push({ id: `note-${note.id}`, kind: "NOTE_ADDED", label: "Note added", text: null, at: note.createdAt, actor: note.author, relatedId: null });
  for (const file of entry.attachments) {
    events.push({ id: `file-${file.id}`, kind: "ATTACHMENT_ADDED", label: `Attachment added: ${file.name}`, text: null, at: file.uploadedAt, actor: file.uploadedBy, relatedId: null });
  }
  return events.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

// ---- Reports, per currency ------------------------------------------------------------------------------

/** The currency blocks of a report: `currencies` (the contract), or `by_currency`, `totals`, `items` (a list or a map). */
function currencyBlocks(value: unknown): Raw[] {
  const raw = obj(value);
  if (!raw) return Array.isArray(value) ? value.map(obj).filter((item): item is Raw => item !== null) : [];
  const listed = first(raw, "currencies", "by_currency", "totals", "items", "report");
  if (Array.isArray(listed)) return listed.map(obj).filter((item): item is Raw => item !== null);
  const map = obj(listed);
  if (map) {
    return Object.entries(map)
      .map(([currency, block]) => {
        const inner = obj(block);
        return inner ? ({ currency, ...inner } as Raw) : null;
      })
      .filter((item): item is Raw => item !== null);
  }
  return [];
}

const amountOf = (raw: Raw, ...keys: string[]) => dec(first(raw, ...keys));
const IN_KEYS = ["in", "total_in", "money_in"];
const OUT_KEYS = ["out", "total_out", "money_out"];

/**
 * One line of a cashbook or statement: the entry and the amount in its
 * column. A reversal shows a negative amount in its original's column, so
 * the columns add up to the totals; `null` is an empty column.
 */
export type ReportRow = { entry: LedgerEntry; moneyIn: string | null; moneyOut: string | null; runningBalance: string | null };

function reportRows(block: Raw): ReportRow[] {
  return arr(first(block, "entries", "items"))
    .map((item): ReportRow | null => {
      const row = obj(item) ?? {};
      const entry = normaliseEntry(item);
      if (!entry) return null;
      const wrapped = Boolean(obj(row.entry));
      const moneyIn = wrapped ? amountOf(row, ...IN_KEYS) : entry.direction === "IN" ? entry.amount : null;
      const moneyOut = wrapped ? amountOf(row, ...OUT_KEYS) : entry.direction === "OUT" ? entry.amount : null;
      return {
        entry,
        moneyIn: moneyIn !== null && /^-?0+(\.0+)?$/.test(moneyIn) ? null : moneyIn,
        moneyOut: moneyOut !== null && /^-?0+(\.0+)?$/.test(moneyOut) ? null : moneyOut,
        runningBalance: wrapped ? amountOf(row, "running_balance", "balance") : null,
      };
    })
    .filter((row): row is ReportRow => row !== null);
}

/** A group of a cashbook (`by=method`): its key (CASH…) and label. */
export type CashbookGroup = { key: string | null; label: string | null; opening: string | null; moneyIn: string | null; moneyOut: string | null; closing: string | null };

export type CashbookCurrency = {
  currency: string;
  opening: string | null;
  moneyIn: string | null;
  moneyOut: string | null;
  closing: string | null;
  rows: ReportRow[];
  groups: CashbookGroup[];
};

export function normaliseCashbook(value: unknown): CashbookCurrency[] {
  return currencyBlocks(value)
    .map((block): CashbookCurrency | null => {
      const currency = str(block.currency);
      if (!isCurrencyCode(currency)) return null;
      const groups = arr(first(block, "groups", "methods", "by_method"))
        .map(obj)
        .filter((item): item is Raw => item !== null)
        .map((item) => ({
          key: str(item.key) ?? str(item.method),
          label: str(item.label),
          opening: amountOf(item, "opening_balance", "opening"),
          moneyIn: amountOf(item, ...IN_KEYS),
          moneyOut: amountOf(item, ...OUT_KEYS),
          closing: amountOf(item, "closing_balance", "closing"),
        }));
      return {
        currency,
        opening: amountOf(block, "opening_balance", "opening"),
        moneyIn: amountOf(block, ...IN_KEYS),
        moneyOut: amountOf(block, ...OUT_KEYS),
        closing: amountOf(block, "closing_balance", "closing"),
        rows: reportRows(block),
        groups,
      };
    })
    .filter((block): block is CashbookCurrency => block !== null);
}

export type CategoryRow = { category: string; label: string | null; moneyIn: string | null; moneyOut: string | null; net: string | null };
export type CategoriesCurrency = { currency: string; rows: CategoryRow[]; moneyIn: string | null; moneyOut: string | null; net: string | null };

/**
 * Per currency, each category's money in and out and the currency's total
 * (the contract's `total`). Also accepts a flat list of `{currency, category,
 * in, out}` rows, grouped here; a currency's totals are added up here
 * (exactly) only when the API does not send them, and only within that currency.
 */
export function normaliseCategoriesReport(value: unknown): CategoriesCurrency[] {
  const blocks = currencyBlocks(value);
  const toRow = (item: Raw): CategoryRow => {
    const category = obj(item.category);
    return {
      category: (category ? str(category.code) : str(item.category)) ?? "uncategorised",
      label: (category ? str(category.label) : null) ?? str(item.category_label) ?? str(item.label) ?? (item.category === null ? "Uncategorised" : null),
      moneyIn: amountOf(item, ...IN_KEYS),
      moneyOut: amountOf(item, ...OUT_KEYS),
      net: amountOf(item, "net"),
    };
  };
  const nested = blocks.some((block) => Array.isArray(block.categories) || Array.isArray(block.rows));
  const groups: { currency: string; rows: CategoryRow[]; total: Raw | null }[] = nested
    ? blocks
        .filter((block) => isCurrencyCode(block.currency))
        .map((block) => ({
          currency: block.currency as string,
          total: obj(block.total) ?? block,
          rows: arr(first(block, "categories", "rows"))
            .map(obj)
            .filter((item): item is Raw => item !== null)
            .map(toRow),
        }))
    : groupByCurrency(blocks.filter((block): block is Raw & { currency: string } => isCurrencyCode(block.currency))).map((group) => ({
        currency: group.currency,
        total: null,
        rows: group.rows.map(toRow),
      }));
  return groups.map(({ currency, rows, total }) => {
    const moneyIn = (total && amountOf(total, ...IN_KEYS)) ?? addDecimals(rows.map((row) => row.moneyIn ?? "0"));
    const moneyOut = (total && amountOf(total, ...OUT_KEYS)) ?? addDecimals(rows.map((row) => row.moneyOut ?? "0"));
    const net = (total && amountOf(total, "net")) ?? (moneyIn !== null && moneyOut !== null ? addDecimals([moneyIn, moneyOut.startsWith("-") ? moneyOut.slice(1) : `-${moneyOut}`]) : null);
    return { currency, rows, moneyIn, moneyOut, net };
  });
}

export type StatementCurrency = {
  currency: string;
  opening: string | null;
  moneyIn: string | null;
  moneyOut: string | null;
  balance: string | null;
  receivableOutstanding: string | null;
  payableOutstanding: string | null;
  rows: ReportRow[];
};

export function normaliseStatement(value: unknown): { contact: LinkedThing | null; currencies: StatementCurrency[] } {
  const raw = obj(value) ?? {};
  return {
    contact: linked(raw, "contact"),
    currencies: currencyBlocks(value)
      .map((block): StatementCurrency | null => {
        const currency = str(block.currency);
        if (!isCurrencyCode(currency)) return null;
        return {
          currency,
          opening: amountOf(block, "opening_balance", "opening"),
          moneyIn: amountOf(block, ...IN_KEYS),
          moneyOut: amountOf(block, ...OUT_KEYS),
          balance: amountOf(block, "closing_balance", "balance", "closing"),
          receivableOutstanding: amountOf(block, "receivable_outstanding"),
          payableOutstanding: amountOf(block, "payable_outstanding"),
          rows: reportRows(block),
        };
      })
      .filter((block): block is StatementCurrency => block !== null),
  };
}

/** The ageing buckets of the receivables report, in order (the contract's "0-30", "31-60", "61-90", "90+"). */
export const AGEING_BUCKETS = [
  { key: "0-30", words: "0 to 30 days", aliases: ["0-30", "0_30", "days_0_30", "current"] },
  { key: "31-60", words: "31 to 60 days", aliases: ["31-60", "31_60", "days_31_60"] },
  { key: "61-90", words: "61 to 90 days", aliases: ["61-90", "61_90", "days_61_90"] },
  { key: "90+", words: "Over 90 days", aliases: ["90+", "90_plus", "over_90", "days_90_plus", "91_plus"] },
] as const;

export const ageingWords = (bucket: string | null | undefined) =>
  AGEING_BUCKETS.find((item) => (item.aliases as readonly string[]).includes(bucket ?? ""))?.words ?? (bucket ? wordsFromCode(bucket) : "");

export type ReceivableItem = { entry: LedgerEntry; amount: string | null; settled: string | null; outstanding: string | null; daysOverdue: number | null; bucket: string | null };

export type ReceivablesCurrency = {
  currency: string;
  buckets: { key: string; words: string; amount: string | null; count: number | null }[];
  total: string | null;
  count: number | null;
  items: ReceivableItem[];
  /** The part of `total` that is tenancy rent arrears (API 0.36.1); those dues are listed on `/agent/arrears`, not in `items`. */
  rentOutstanding: string | null;
};

export function normaliseReceivables(value: unknown): ReceivablesCurrency[] {
  return currencyBlocks(value)
    .map((block): ReceivablesCurrency | null => {
      const currency = str(block.currency);
      if (!isCurrencyCode(currency)) return null;
      const bucketList = arr(block.buckets);
      const bucketMap = obj(block.buckets) ?? obj(block.ageing) ?? block;
      const buckets = AGEING_BUCKETS.map((bucket) => {
        let amount: string | null = null;
        let count: number | null = null;
        for (const item of bucketList) {
          const row = obj(item);
          if (row && (bucket.aliases as readonly string[]).includes(String(row.bucket ?? row.key ?? row.range))) {
            amount = dec(row.outstanding ?? row.amount ?? row.total);
            count = typeof row.count === "number" ? row.count : null;
          }
        }
        if (amount === null) for (const alias of bucket.aliases) amount = amount ?? dec(bucketMap[alias]);
        return { key: bucket.key as string, words: bucket.words as string, amount, count };
      });
      const items = arr(first(block, "items", "entries"))
        .map((item): ReceivableItem | null => {
          const row = obj(item) ?? {};
          const entry = normaliseEntry(item);
          if (!entry) return null;
          return {
            entry,
            amount: amountOf(row, "amount") ?? entry.amount,
            settled: amountOf(row, "settled"),
            outstanding: amountOf(row, "outstanding"),
            daysOverdue: typeof row.days_overdue === "number" ? row.days_overdue : null,
            bucket: str(row.bucket),
          };
        })
        .filter((item): item is ReceivableItem => item !== null);
      return {
        currency,
        buckets,
        total: amountOf(block, "outstanding", "total", "total_open"),
        count: typeof block.count === "number" ? block.count : null,
        items,
        rentOutstanding: amountOf(block, "rent_outstanding"),
      };
    })
    .filter((block): block is ReceivablesCurrency => block !== null);
}

/** The API's file name from a Content-Disposition header, or a dated fallback. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition ?? "")?.[1];
  if (star) {
    try {
      return decodeURIComponent(star.trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain name
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition ?? "")?.[1] ?? fallback;
}
