/**
 * The rules of a tenancy's rent (API 0.36.1, BR-019, FR-047) that are not
 * the API's, as pure functions: the words and tones of a due's status, exact
 * decimal sums and comparisons in one currency, the oldest-first allocation
 * of a receipt and the checks on a chosen allocation, the receipt and waive
 * forms and their bodies, the ageing buckets of arrears grouped per currency,
 * the statement's query, and tolerant readers for the API's answers.
 *
 * Money is the API's decimal string with its ISO 4217 code. Amounts in
 * different currencies are never added together: every sum here takes one
 * currency, and every report is a list of currency blocks. Dates are
 * market-local YYYY-MM-DD and never move through a time zone.
 *
 * A receipt is recorded by the team, never verified by a bank or a gateway:
 * its ledger entry is USER_RECORDED_UNVERIFIED, and nothing here says more.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/rent.test.mjs).
 * The amount check is passed in (`amountProblem` from `lib/ledger.ts`).
 */

// ---- Exact decimals, one currency at a time ---------------------------------------------------------

const DECIMAL = /^-?\d+(\.\d+)?$/;
/** The API stores four decimals; every sum here is made at that scale. */
const SCALE = 4;

/** A decimal string as a whole number of 10^-4 units, or null. */
export function toUnits(amount: string | null | undefined): bigint | null {
  const text = (amount ?? "").trim();
  if (!DECIMAL.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  if (fraction.length > SCALE) return null;
  const value = BigInt(whole + fraction.padEnd(SCALE, "0"));
  return negative ? -value : value;
}

/** Units back to a decimal string with `places` decimals (the currency's minor units). Never rounds a non-zero digit away. */
export function fromUnits(value: bigint, places = SCALE): string {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(SCALE + 1, "0");
  const whole = digits.slice(0, -SCALE);
  let fraction = digits.slice(-SCALE);
  while (fraction.length > places && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** The sum of decimal strings of ONE currency, exactly; null when one is not a decimal. */
export function sumAmounts(amounts: readonly (string | null | undefined)[], places = SCALE): string | null {
  let total = BigInt(0);
  for (const amount of amounts) {
    const units = toUnits(amount);
    if (units === null) return null;
    total += units;
  }
  return fromUnits(total, places);
}

/** a - b, exactly, in one currency. */
export function subtractAmounts(a: string, b: string, places = SCALE): string | null {
  const left = toUnits(a);
  const right = toUnits(b);
  return left === null || right === null ? null : fromUnits(left - right, places);
}

/** -1, 0 or 1; null when either is not a decimal. */
export function compareAmounts(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  const left = toUnits(a);
  const right = toUnits(b);
  if (left === null || right === null) return null;
  return left < right ? -1 : left > right ? 1 : 0;
}

export const isPositive = (amount: string | null | undefined) => compareAmounts(amount, "0") === 1;

// ---- Due statuses ----------------------------------------------------------------------------------

export const DUE_STATUSES = ["DUE", "PART_PAID", "PAID", "WAIVED"] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

export const isDueStatus = (value: unknown): value is DueStatus => typeof value === "string" && (DUE_STATUSES as readonly string[]).includes(value);

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

/** "Sentence words" from a code the app does not know. */
function wordsFromCode(code: string): string {
  const text = code.replace(/_/g, " ").toLowerCase().trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

const DUE_WORDS: Record<DueStatus, string> = { DUE: "Due", PART_PAID: "Part paid", PAID: "Paid in full", WAIVED: "Waived" };

/**
 * The badge of a rent due, in words (never colour alone). A due or part-paid
 * line whose date has passed with something still outstanding reads
 * "Overdue" / "Part paid, overdue". `today` is the person's YYYY-MM-DD.
 */
export function dueBadge(due: { status: string; dueDate: string | null; outstanding: string | null }, today: string, apiLabel?: string | null): { words: string; tone: Tone } {
  const late = isOverdue(due, today);
  switch (due.status) {
    case "PAID":
      return { words: apiLabel || DUE_WORDS.PAID, tone: "success" };
    case "WAIVED":
      return { words: apiLabel || DUE_WORDS.WAIVED, tone: "info" };
    case "PART_PAID":
      return { words: late ? "Part paid, overdue" : apiLabel || DUE_WORDS.PART_PAID, tone: late ? "danger" : "warning" };
    case "DUE":
      return { words: late ? "Overdue" : apiLabel || DUE_WORDS.DUE, tone: late ? "danger" : "neutral" };
    default:
      return { words: apiLabel || wordsFromCode(due.status), tone: "neutral" };
  }
}

export const dueStatusLabel = (status: string, apiLabel?: string | null) => apiLabel || (isDueStatus(status) ? DUE_WORDS[status] : wordsFromCode(status));

/** Still open: DUE or PART_PAID with something outstanding. */
export const isOpen = (due: { status: string; outstanding: string | null }) =>
  (due.status === "DUE" || due.status === "PART_PAID") && isPositive(due.outstanding);

/** Open, and its due date is before today. The API's `overdue` flag wins when it sends one. */
export const isOverdue = (due: { status: string; dueDate: string | null; outstanding: string | null; overdue?: boolean | null }, today: string) =>
  typeof due.overdue === "boolean" ? due.overdue : isOpen(due) && Boolean(due.dueDate) && (due.dueDate as string) < today;

/** Days from a YYYY-MM-DD to another, in whole calendar days. */
export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

function dayNumber(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

// ---- Ageing ------------------------------------------------------------------------------------------

/** The contract's buckets, in order. */
export const AGEING = [
  { key: "0-30", words: "0 to 30 days", aliases: ["0-30", "0_30", "days_0_30", "current", "d0_30"] },
  { key: "31-60", words: "31 to 60 days", aliases: ["31-60", "31_60", "days_31_60", "d31_60"] },
  { key: "61-90", words: "61 to 90 days", aliases: ["61-90", "61_90", "days_61_90", "d61_90"] },
  { key: "90+", words: "Over 90 days", aliases: ["90+", "90_plus", "over_90", "days_90_plus", "91_plus", "d90_plus"] },
] as const;

export type AgeingKey = (typeof AGEING)[number]["key"];
export const AGEING_KEYS: AgeingKey[] = AGEING.map((bucket) => bucket.key);

/** The bucket of an amount this many days past its due date: 0-30, 31-60, 61-90, then 90+. */
export function ageingBucket(daysOverdue: number): AgeingKey {
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export const ageingKeyOf = (value: unknown): AgeingKey | null =>
  AGEING.find((bucket) => (bucket.aliases as readonly string[]).includes(String(value)))?.key ?? null;

export const ageingWords = (key: string) => AGEING.find((bucket) => bucket.key === key)?.words ?? key;

export type Buckets = Record<AgeingKey, string>;

const zeroBuckets = (places: number): Buckets => ({ "0-30": fromUnits(BigInt(0), places), "31-60": fromUnits(BigInt(0), places), "61-90": fromUnits(BigInt(0), places), "90+": fromUnits(BigInt(0), places) });

/** One tenancy's arrears in one currency. */
export type ArrearsRow = {
  tenancyId: string;
  currency: string;
  tenants: string;
  property: string;
  unit: string | null;
  buckets: Buckets;
  total: string;
  oldestDueDate: string | null;
  daysOverdue: number | null;
  dues: number | null;
};

export type ArrearsBlock = { currency: string; buckets: Buckets; total: string; rows: ArrearsRow[] };

/**
 * Rows grouped per currency, in the order each currency first appears, with
 * each block's bucket totals and total added exactly. One currency is never
 * added to another; a row of each currency stays in its own block. Within a
 * block the largest total comes first, then the oldest debt.
 */
export function groupArrears(rows: readonly ArrearsRow[], minorUnits: (currency: string) => number = () => 2): ArrearsBlock[] {
  const blocks = new Map<string, ArrearsRow[]>();
  for (const row of rows) {
    const list = blocks.get(row.currency);
    if (list) list.push(row);
    else blocks.set(row.currency, [row]);
  }
  return [...blocks.entries()].map(([currency, list]) => {
    const places = minorUnits(currency);
    const buckets = zeroBuckets(places);
    for (const key of AGEING_KEYS) buckets[key] = sumAmounts(list.map((row) => row.buckets[key]), places) ?? buckets[key];
    const total = sumAmounts(list.map((row) => row.total), places) ?? fromUnits(BigInt(0), places);
    const sorted = [...list].sort((a, b) => {
      const byDays = (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1);
      if (byDays !== 0) return byDays;
      const byOldest = (a.oldestDueDate ?? "9999").localeCompare(b.oldestDueDate ?? "9999");
      if (byOldest !== 0) return byOldest;
      return (compareAmounts(b.total, a.total) ?? 0) || a.tenancyId.localeCompare(b.tenancyId);
    });
    return { currency, buckets, total, rows: sorted };
  });
}

/**
 * One tenancy's open, overdue dues aged on `today`, per currency (a tenancy
 * has one rent currency, but nothing here assumes it). Dues not yet late are
 * not arrears.
 */
export function ageDues(
  dues: readonly RentDue[],
  today: string,
  info: Pick<ArrearsRow, "tenancyId" | "tenants" | "property" | "unit">,
  minorUnits: (currency: string) => number = () => 2,
): ArrearsRow[] {
  const byCurrency = new Map<string, RentDue[]>();
  for (const due of dues) {
    if (!isOverdue(due, today)) continue;
    const list = byCurrency.get(due.currency);
    if (list) list.push(due);
    else byCurrency.set(due.currency, [due]);
  }
  return [...byCurrency.entries()].map(([currency, list]) => {
    const places = minorUnits(currency);
    const buckets = zeroBuckets(places);
    const sorted = [...list].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    for (const key of AGEING_KEYS) {
      const inBucket = sorted.filter((due) => ageingBucket(daysBetween(due.dueDate as string, today) ?? 0) === key);
      buckets[key] = sumAmounts(inBucket.map((due) => due.outstanding), places) ?? buckets[key];
    }
    const oldest = sorted[0]?.dueDate ?? null;
    return {
      ...info,
      currency,
      buckets,
      total: sumAmounts(sorted.map((due) => due.outstanding), places) ?? fromUnits(BigInt(0), places),
      oldestDueDate: oldest,
      daysOverdue: oldest ? daysBetween(oldest, today) : null,
      dues: sorted.length,
    };
  });
}

// ---- The schedule's summary ------------------------------------------------------------------------

/**
 * The API's DueSummary, one currency: `charged` sums the dues dated today or
 * earlier, `outstanding` is what is left of them, `overdue` the part dated
 * before today, `paidInAdvance` what is paid on later dues, `nextDue` the
 * first due dated today or later with something outstanding.
 */
export type RentSummary = {
  currency: string;
  charged: string;
  paid: string;
  waived: string;
  outstanding: string;
  overdue: string;
  overdueCount: number;
  paidInAdvance: string;
  nextDue: RentDue | null;
};

/** The same summary made from the dues, per currency, when the API sends none (exact, never across currencies). */
export function rentSummary(dues: readonly RentDue[], today: string, minorUnits: (currency: string) => number = () => 2): RentSummary[] {
  const currencies = [...new Set(dues.map((due) => due.currency))];
  return currencies.map((currency) => {
    const places = minorUnits(currency);
    const zero = fromUnits(BigInt(0), places);
    const mine = dues.filter((due) => due.currency === currency);
    const toDate = mine.filter((due) => (due.dueDate ?? "") <= today);
    const later = mine.filter((due) => (due.dueDate ?? "") > today);
    const late = mine.filter((due) => isOverdue(due, today));
    const upcoming = mine.filter((due) => isOpen(due) && (due.dueDate ?? "") >= today).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return {
      currency,
      charged: sumAmounts(toDate.map((due) => due.amount), places) ?? zero,
      paid: sumAmounts(toDate.map((due) => due.paid ?? "0"), places) ?? zero,
      waived: sumAmounts(toDate.map((due) => due.waived ?? "0"), places) ?? zero,
      outstanding: sumAmounts(toDate.map((due) => due.outstanding ?? "0"), places) ?? zero,
      overdue: sumAmounts(late.map((due) => due.outstanding), places) ?? zero,
      overdueCount: late.length,
      paidInAdvance: sumAmounts(later.map((due) => due.paid ?? "0"), places) ?? zero,
      nextDue: upcoming[0] ?? null,
    };
  });
}

// ---- Allocation of a receipt -----------------------------------------------------------------------

export type Allocation = { dueId: string; amount: string };

/** Open dues, oldest due date first (the API's default order of allocation). */
export const openDuesOldestFirst = (dues: readonly RentDue[]) =>
  dues.filter(isOpen).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.id.localeCompare(b.id));

/**
 * How a receipt of `amount` is spread oldest first: each open due takes what
 * it still owes until the money runs out. `left` is what nothing took (more
 * than everything outstanding). Exact; null when the amount is not a decimal.
 */
export function oldestFirst(dues: readonly RentDue[], amount: string, places = 2): { allocations: Allocation[]; left: string } | null {
  let remaining = toUnits(amount);
  if (remaining === null) return null;
  const allocations: Allocation[] = [];
  for (const due of openDuesOldestFirst(dues)) {
    if (remaining <= BigInt(0)) break;
    const owed = toUnits(due.outstanding);
    if (owed === null || owed <= BigInt(0)) continue;
    const take = owed < remaining ? owed : remaining;
    allocations.push({ dueId: due.id, amount: fromUnits(take, places) });
    remaining -= take;
  }
  return { allocations, left: fromUnits(remaining, places) };
}

export type AllocationProblems = { rows: Record<string, string>; total?: string };

/**
 * Checks a chosen allocation against the receipt: each amount a valid
 * positive amount in the currency (`amountCheck`, the ledger's), none more
 * than its due still owes, at least one due chosen, and together exactly the
 * receipt. Rows left empty are not chosen. Exact decimals, never floats.
 */
export function allocationProblems(
  receipt: string,
  currency: string,
  chosen: Readonly<Record<string, string>>,
  dues: readonly RentDue[],
  amountCheck: (value: string, currency: string) => string | null,
  places = 2,
): AllocationProblems {
  const rows: Record<string, string> = {};
  const amounts: string[] = [];
  for (const [dueId, raw] of Object.entries(chosen)) {
    const value = raw.replace(/\s+/g, "");
    if (!value) continue;
    const due = dues.find((item) => item.id === dueId);
    if (!due || !isOpen(due)) {
      rows[dueId] = "This due is no longer open. Read the schedule again.";
      continue;
    }
    const problem = amountCheck(value, currency);
    if (problem) {
      rows[dueId] = problem;
      continue;
    }
    if (compareAmounts(value, due.outstanding) === 1) {
      rows[dueId] = `More than the ${currency} ${fromUnits(toUnits(due.outstanding) ?? BigInt(0), places)} still outstanding on this due.`;
      continue;
    }
    amounts.push(value);
  }
  const problems: AllocationProblems = { rows };
  if (Object.keys(rows).length) return problems;
  if (amounts.length === 0) {
    problems.total = "Enter an amount against at least one due, or use oldest first.";
    return problems;
  }
  const total = sumAmounts(amounts, places);
  const comparison = compareAmounts(total, receipt);
  if (total !== null && comparison !== 0 && comparison !== null) {
    const difference = fromUnits((toUnits(receipt) ?? BigInt(0)) - (toUnits(total) ?? BigInt(0)), places);
    problems.total =
      comparison === -1
        ? `The amounts add up to ${currency} ${total}, ${currency} ${difference} less than the receipt. They must add up to the receipt exactly.`
        : `The amounts add up to ${currency} ${total}, ${currency} ${difference.replace(/^-/, "")} more than the receipt. They must add up to the receipt exactly.`;
  }
  return problems;
}

export const hasAllocationProblems = (problems: AllocationProblems) => Boolean(problems.total) || Object.keys(problems.rows).length > 0;

// ---- The receipt form ----------------------------------------------------------------------------

export const RECEIPT_REFERENCE_MAX = 120;
export const WAIVE_REASON_MAX = 500;
export const REVERSE_REASON_MAX = 500;

export type ReceiptForm = {
  amount: string;
  method: string;
  receivedOn: string;
  reference: string;
  /** Who paid, when the tenancy has more than one tenant; empty is the API's default (the first live tenant). */
  tenantContactId: string;
  mode: "OLDEST_FIRST" | "CHOSEN";
  /** Due id -> the amount typed against it. */
  chosen: Record<string, string>;
};

export const emptyReceiptForm = (today: string): ReceiptForm => ({ amount: "", method: "", receivedOn: today, reference: "", tenantContactId: "", mode: "OLDEST_FIRST", chosen: {} });

export type ReceiptProblems = { amount?: string; method?: string; receivedOn?: string; reference?: string; allocation?: AllocationProblems };

const isRealDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
};

/**
 * The "Record a payment" form, checked before sending. `amountCheck` is the
 * ledger's `amountProblem`. Oldest first needs open dues to take the money;
 * a chosen allocation must add up to the receipt exactly.
 */
export function receiptProblems(
  form: ReceiptForm,
  currency: string,
  dues: readonly RentDue[],
  today: string,
  amountCheck: (value: string, currency: string) => string | null,
  places = 2,
  startDate: string | null = null,
): ReceiptProblems {
  const problems: ReceiptProblems = {};
  const amount = form.amount.replace(/\s+/g, "");
  const amountIssue = amountCheck(amount, currency);
  if (amountIssue) problems.amount = amountIssue;
  if (!form.method) problems.method = "Choose how the money was paid.";
  const day = form.receivedOn.trim();
  if (!day) problems.receivedOn = "Enter the date the money was received.";
  else if (!isRealDay(day)) problems.receivedOn = "Enter a real date, for example 2026-11-05.";
  else if (day > today) problems.receivedOn = "The date cannot be in the future.";
  else if (startDate && day < startDate) problems.receivedOn = "The date cannot be before the tenancy started.";
  if (form.reference.trim().length > RECEIPT_REFERENCE_MAX) problems.reference = `Keep the reference to ${RECEIPT_REFERENCE_MAX} characters.`;
  if (problems.amount) return problems;
  if (form.mode === "CHOSEN") {
    const allocation = allocationProblems(amount, currency, form.chosen, dues, amountCheck, places);
    if (hasAllocationProblems(allocation)) problems.allocation = allocation;
  } else {
    const open = openDuesOldestFirst(dues);
    const spread = oldestFirst(dues, amount, places);
    if (open.length === 0) problems.allocation = { rows: {}, total: "Nothing is outstanding on this tenancy, so there is nothing to allocate this payment to." };
    else if (spread && isPositive(spread.left)) {
      const outstanding = sumAmounts(open.map((due) => due.outstanding), places);
      problems.allocation = { rows: {}, total: `That is more than the ${currency} ${outstanding} outstanding on the whole schedule.` };
    }
  }
  return problems;
}

export const hasReceiptProblems = (problems: ReceiptProblems) =>
  Boolean(problems.amount || problems.method || problems.receivedOn || problems.reference) || (problems.allocation ? hasAllocationProblems(problems.allocation) : false);

/** "0012.50 " -> "12.50"; never rounded. */
export function cleanAmount(value: string): string {
  const [whole, fraction] = value.replace(/\s+/g, "").split(".");
  const trimmed = whole.replace(/^0+(?=\d)/, "");
  return fraction !== undefined ? `${trimmed}.${fraction}` : trimmed;
}

/**
 * `POST …/tenancies/{id}/receipts`. The currency is the rent's (the API
 * refuses another). Oldest first sends no `allocations`: that is the API's
 * default. A chosen allocation sends the dues with an amount, oldest first.
 */
export function receiptBody(form: ReceiptForm, currency: string, dues: readonly RentDue[] = []): Record<string, unknown> {
  const body: Record<string, unknown> = {
    amount: cleanAmount(form.amount),
    currency,
    method: form.method,
    received_on: form.receivedOn.trim(),
  };
  if (form.reference.trim()) body.reference = form.reference.trim();
  if (form.tenantContactId) body.tenant_contact_id = form.tenantContactId;
  if (form.mode === "CHOSEN") {
    const order = new Map(dues.map((due) => [due.id, due.dueDate ?? ""]));
    body.allocations = Object.entries(form.chosen)
      .filter(([, value]) => value.replace(/\s+/g, ""))
      .sort(([a], [b]) => (order.get(a) ?? "").localeCompare(order.get(b) ?? ""))
      .map(([dueId, value]) => ({ due_id: dueId, amount: cleanAmount(value) }));
  }
  return body;
}

export function waiveReasonProblem(reason: string): string | null {
  const text = reason.trim();
  if (!text) return "Say why this rent is waived, for example: agreed rent-free month for repairs.";
  if (text.length > WAIVE_REASON_MAX) return `Keep the reason to ${WAIVE_REASON_MAX} characters.`;
  return null;
}

export function reverseReasonProblem(reason: string): string | null {
  const text = reason.trim();
  if (!text) return "Say why the payment is being undone, for example: recorded twice.";
  if (text.length > REVERSE_REASON_MAX) return `Keep the reason to ${REVERSE_REASON_MAX} characters.`;
  return null;
}

/** Who may record payments and waive dues: OWNER, MANAGER, AGENT (STAFF read). The API's `can` wins when sent. */
export const canWriteRent = (role: string | null | undefined) => ["OWNER", "MANAGER", "AGENT"].includes(role ?? "");

/** Rent can be recorded against an ACTIVE tenancy, and against one that ended with rent still open (never a DRAFT). */
export const canRecordReceipt = (status: string, dues: readonly RentDue[]) =>
  status === "ACTIVE" || ((status === "ENDED" || status === "TERMINATED") && dues.some(isOpen));

/**
 * The API's field errors on a receipt placed under the form's controls:
 * `allocations[0].amount` under that line's due (from the body sent), `allocations`
 * as the allocation's total, `ledger.*` and anything unknown in `other`.
 */
export function receiptApiProblems(fields: Record<string, string> | undefined, body: Record<string, unknown>): ReceiptProblems & { other: string[] } {
  const problems: ReceiptProblems & { other: string[] } = { other: [] };
  const sent = Array.isArray(body.allocations) ? (body.allocations as { due_id?: string }[]) : [];
  for (const [key, text] of Object.entries(fields ?? {})) {
    const line = /^allocations\[(\d+)\]/.exec(key);
    if (key === "amount" || key === "currency") problems.amount ??= text;
    else if (key === "method") problems.method ??= text;
    else if (key === "received_on") problems.receivedOn ??= text;
    else if (key === "reference") problems.reference ??= text;
    else if (line && sent[Number(line[1])]?.due_id) {
      problems.allocation ??= { rows: {} };
      problems.allocation.rows[sent[Number(line[1])].due_id as string] = text;
    } else if (key === "allocations" || line) {
      problems.allocation ??= { rows: {} };
      problems.allocation.total = text;
    } else problems.other.push(text);
  }
  return problems;
}

// ---- The statement --------------------------------------------------------------------------------

export type StatementFormat = "json" | "csv" | "pdf";

/** `?from=&to=&format=` for the statement; JSON is the default and sends no format. */
export function statementQuery(span: { from?: string; to?: string }, format: StatementFormat = "json"): string {
  const search = new URLSearchParams();
  if (span.from && isRealDay(span.from)) search.set("from", span.from);
  if (span.to && isRealDay(span.to)) search.set("to", span.to);
  if (format !== "json") search.set("format", format);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** A dated file name for a download when the API sends none. */
export const statementFileName = (format: "csv" | "pdf", span: { from?: string; to?: string }) =>
  `rent-statement${span.from ? `-${span.from}` : ""}${span.to ? `-to-${span.to}` : ""}.${format}`;

// ---- Page addresses ----------------------------------------------------------------------------------

export const arrearsHref = (org?: string) => `/agent/arrears${org ? `?${new URLSearchParams({ org })}` : ""}`;

// ---- Reading the API's answers ------------------------------------------------------------------------

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const dec = (value: unknown): string | null =>
  typeof value === "string" && DECIMAL.test(value.trim()) ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
const int = (value: unknown): number | null => {
  const n = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
};
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const first = (raw: Raw, ...keys: string[]): unknown => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};
const code = (value: unknown): string | null => {
  const text = str(value);
  return text && /^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : null;
};

/** An amount as `"950.00"`, `{amount, currency}`, or `{amount: {amount, currency}}`. */
function amountOf(raw: Raw, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    const inner = obj(value);
    const found = inner ? dec(inner.amount) : dec(value);
    if (found !== null) return found;
  }
  return null;
}

function currencyOf(raw: Raw, ...keys: string[]): string | null {
  for (const key of keys) {
    const inner = obj(raw[key]);
    const found = code(inner?.currency);
    if (found) return found;
  }
  return code(raw.currency) ?? code(raw.currency_code);
}

const personName = (value: unknown) => str(obj(value)?.name) ?? str(value);

export type RentDue = {
  id: string;
  dueDate: string | null;
  /** From the due date to the day before the next one, cut at the tenancy's end. */
  periodStart: string | null;
  periodEnd: string | null;
  amount: string;
  /** Allocations of receipts that are not reversed. */
  paid: string | null;
  waived: string | null;
  outstanding: string | null;
  currency: string;
  minorUnit: number | null;
  status: string;
  statusLabel: string | null;
  /** The API's flag (`due_date` before today, UTC, with something outstanding); null when it sends none. */
  overdue: boolean | null;
  daysOverdue: number | null;
  /** The reason and who: the team's view only; the tenant's has the date alone. */
  waivedReason: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  can: { waive: boolean } | null;
};

export function normaliseDue(value: unknown): RentDue | null {
  const raw = obj(obj(value)?.due) ?? obj(value);
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.due_id);
  const amount = amountOf(raw, "amount");
  const currency = currencyOf(raw, "amount");
  if (!id || amount === null || !currency) return null;
  const status = str(raw.status) ?? "DUE";
  const paid = amountOf(raw, "paid", "amount_paid", "allocated", "paid_amount");
  let outstanding = amountOf(raw, "outstanding", "amount_outstanding", "outstanding_amount");
  if (outstanding === null) outstanding = status === "WAIVED" ? "0" : paid !== null ? subtractAmounts(amount, paid) : null;
  const can = obj(raw.can);
  const waiver = obj(raw.waiver);
  const period = obj(raw.period);
  return {
    id,
    dueDate: str(raw.due_date) ?? str(raw.date),
    periodStart: str(period?.from) ?? str(raw.period_start),
    periodEnd: str(period?.to) ?? str(raw.period_end),
    amount,
    paid,
    waived: amountOf(raw, "waived"),
    outstanding,
    currency,
    minorUnit: int(raw.minor_unit) ?? int(obj(raw.amount)?.minor_unit),
    status,
    statusLabel: str(raw.status_label),
    overdue: bool(raw.overdue),
    daysOverdue: int(raw.days_overdue),
    waivedReason: str(waiver?.reason) ?? str(raw.waive_reason),
    waivedAt: str(waiver?.at) ?? str(raw.waived_at),
    waivedBy: personName(waiver?.by) ?? personName(raw.waived_by),
    can: can ? { waive: bool(can.waive) ?? false } : null,
  };
}

export type ReceiptAllocation = { dueId: string | null; dueDate: string | null; amount: string };

export type Receipt = {
  id: string;
  reference: string | null;
  amount: string;
  currency: string;
  method: string;
  methodLabel: string | null;
  receivedOn: string | null;
  /** Who paid (the team's view): the tenant contact the ledger entry names. */
  tenant: string | null;
  /** The ledger entry the receipt wrote (RENT_RECEIVED); the team's view only. */
  ledgerEntryId: string | null;
  /** The entry's current status in the ledger (it may become RECONCILED there). */
  ledgerStatus: string | null;
  /** Status REVERSED: its ledger entry was reversed and its allocations no longer count. */
  reversed: boolean;
  reversalEntryId: string | null;
  reversedOn: string | null;
  /** Allocations stay listed after a reversal. */
  allocations: ReceiptAllocation[];
  recordedBy: string | null;
  recordedAt: string | null;
  can: { reverse: boolean } | null;
};

function allocation(value: unknown): ReceiptAllocation | null {
  const raw = obj(value);
  if (!raw) return null;
  const amount = amountOf(raw, "amount");
  if (amount === null) return null;
  const due = obj(raw.due);
  return { dueId: str(raw.due_id) ?? str(due?.id), dueDate: str(raw.due_date) ?? str(due?.due_date), amount };
}

export function normaliseReceipt(value: unknown): Receipt | null {
  const raw = obj(obj(value)?.receipt) ?? obj(value);
  if (!raw) return null;
  const id = str(raw.id) ?? str(raw.receipt_id);
  const amount = amountOf(raw, "amount");
  const currency = currencyOf(raw, "amount");
  if (!id || amount === null || !currency) return null;
  const reversal = obj(raw.reversal);
  const reversalEntryId = str(reversal?.ledger_entry_id) ?? str(raw.reversal_entry_id);
  const reversedOn = str(reversal?.reversed_on) ?? str(raw.reversed_on);
  const status = str(raw.status);
  const can = obj(raw.can);
  return {
    id,
    reference: str(raw.reference),
    amount,
    currency,
    method: str(raw.method) ?? "OTHER",
    methodLabel: str(raw.method_label),
    receivedOn: str(raw.received_on) ?? str(raw.date),
    tenant: personName(raw.tenant),
    ledgerEntryId: str(raw.ledger_entry_id) ?? str(obj(raw.ledger_entry)?.id),
    ledgerStatus: str(raw.ledger_status) ?? str(obj(raw.ledger_entry)?.status),
    reversed: status === "REVERSED" || Boolean(reversal) || Boolean(reversedOn) || bool(raw.reversed) === true,
    reversalEntryId,
    reversedOn,
    allocations: arr(raw.allocations).map(allocation).filter((item): item is ReceiptAllocation => item !== null),
    recordedBy: personName(raw.recorded_by),
    recordedAt: str(raw.recorded_at) ?? str(raw.created_at),
    can: can ? { reverse: bool(can.reverse) ?? false } : null,
  };
}

const listOf = (value: unknown, ...keys: string[]): unknown[] => {
  if (Array.isArray(value)) return value;
  const raw = obj(value);
  return raw ? arr(first(raw, ...keys, "items", "data")) : [];
};

/** The schedule, oldest due date first. */
export const normaliseDues = (value: unknown): RentDue[] =>
  listOf(value, "items", "dues")
    .map(normaliseDue)
    .filter((due): due is RentDue => due !== null)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

/** The rule the schedule runs by: "Monthly on day 1", through a date, rolling or to the tenancy's end. */
export type ScheduleInfo = { rolling: boolean | null; through: string | null; count: number | null; rule: string | null };

export type DueList = { dues: RentDue[]; summary: RentSummary | null; schedule: ScheduleInfo | null };

export function normaliseSummary(value: unknown): RentSummary | null {
  const raw = obj(value);
  const currency = raw ? code(raw.currency) : null;
  if (!raw || !currency) return null;
  const outstanding = amountOf(raw, "outstanding");
  if (outstanding === null) return null;
  return {
    currency,
    charged: amountOf(raw, "charged") ?? "0",
    paid: amountOf(raw, "paid") ?? "0",
    waived: amountOf(raw, "waived") ?? "0",
    outstanding,
    overdue: amountOf(raw, "overdue") ?? "0",
    overdueCount: int(raw.overdue_count) ?? 0,
    paidInAdvance: amountOf(raw, "paid_in_advance") ?? "0",
    nextDue: normaliseDue(raw.next_due),
  };
}

/** `GET …/dues`: `{items, summary, schedule}`; `schedule` is null for a draft. */
export function normaliseDueList(value: unknown): DueList {
  const raw = obj(value);
  const schedule = obj(raw?.schedule);
  return {
    dues: normaliseDues(value),
    summary: normaliseSummary(raw?.summary),
    schedule: schedule
      ? { rolling: bool(schedule.rolling), through: str(schedule.through), count: int(schedule.count), rule: str(schedule.rule) }
      : null,
  };
}

/** Receipts, newest received first. */
export const normaliseReceipts = (value: unknown): Receipt[] =>
  listOf(value, "receipts")
    .map(normaliseReceipt)
    .filter((receipt): receipt is Receipt => receipt !== null)
    .sort((a, b) => (b.receivedOn ?? "").localeCompare(a.receivedOn ?? "") || (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));

/** The new receipt's id and its ledger entry's, from `{receipt: {...}}` or the receipt itself. */
export function createdReceipt(value: unknown): { id: string | null; ledgerEntryId: string | null } {
  const receipt = normaliseReceipt(value);
  const raw = obj(value);
  return {
    id: receipt?.id ?? str(obj(raw?.receipt)?.id) ?? str(raw?.id),
    ledgerEntryId: receipt?.ledgerEntryId ?? str(obj(raw?.ledger_entry)?.id) ?? str(raw?.ledger_entry_id),
  };
}

/** Report blocks as a list, `{currencies: [...]}`, or a map `{USD: {...}}`. */
function currencyBlocks(value: unknown): Raw[] {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : raw ? first(raw, "currencies", "items", "blocks", "by_currency") : undefined;
  if (Array.isArray(list)) return list.map(obj).filter((item): item is Raw => item !== null);
  const map = obj(list) ?? (raw && Object.keys(raw).every((key) => /^[A-Z]{3}$/.test(key)) ? raw : null);
  if (!map) return [];
  return Object.entries(map)
    .map(([currency, block]): Raw | null => (obj(block) ? { currency, ...(block as Raw) } : null))
    .filter((item): item is Raw => item !== null);
}

export type StatementLine = {
  key: string;
  date: string | null;
  kind: string;
  description: string;
  reference: string | null;
  /** What the tenant owes more: rent charged, or a payment undone. Null when zero. */
  charge: string | null;
  /** What the tenant owes less: a payment, or a waiver. Null when zero. */
  credit: string | null;
  /** Running balance: positive, the tenant owes; negative, in credit. */
  balance: string | null;
  dueId: string | null;
  receiptId: string | null;
  ledgerEntryId: string | null;
};

export type StatementBlock = {
  currency: string;
  opening: string | null;
  charged: string | null;
  received: string | null;
  reversed: string | null;
  waived: string | null;
  closing: string | null;
  /** Outstanding at the end of the period on dues dated before it. */
  overdue: string | null;
  lines: StatementLine[];
};

const LINE_WORDS: Record<string, string> = {
  DUE: "Rent due",
  CHARGE: "Rent due",
  RENT_DUE: "Rent due",
  RECEIPT: "Payment received",
  PAYMENT: "Payment received",
  RENT_RECEIVED: "Payment received",
  WAIVER: "Rent waived",
  WAIVED: "Rent waived",
  REVERSAL: "Payment undone (reversed)",
  PAYMENT_REVERSED: "Payment undone (reversed)",
  RECEIPT_REVERSED: "Payment undone (reversed)",
};

/** A zero amount ("0.00") shown as nothing in a debit or credit column. */
const nonZero = (amount: string | null) => (amount !== null && /[1-9]/.test(amount) ? amount : null);

export const statementLineWords = (kind: string) => LINE_WORDS[kind.toUpperCase()] ?? wordsFromCode(kind);

function statementLine(value: unknown, index: number): StatementLine | null {
  const raw = obj(value);
  if (!raw) return null;
  const kind = str(raw.kind) ?? str(raw.type) ?? "LINE";
  const charge = amountOf(raw, "charge", "debit", "charged");
  const credit = amountOf(raw, "credit", "payment", "received", "paid");
  const plain = charge === null && credit === null ? amountOf(raw, "amount") : null;
  const isCharge = /DUE|CHARGE|REVERS/i.test(kind);
  return {
    key: str(raw.id) ?? `${kind}-${index}`,
    date: str(raw.date) ?? str(raw.due_date) ?? str(raw.received_on),
    kind,
    description: str(raw.description) ?? str(raw.label) ?? statementLineWords(kind),
    reference: str(raw.reference),
    charge: nonZero(charge ?? (plain !== null && isCharge ? plain.replace(/^-/, "") : null)),
    credit: nonZero(credit ?? (plain !== null && !isCharge ? plain.replace(/^-/, "") : null)),
    balance: amountOf(raw, "balance", "running_balance"),
    dueId: str(raw.due_id),
    receiptId: str(raw.receipt_id),
    ledgerEntryId: str(raw.ledger_entry_id) ?? str(raw.entry_id),
  };
}

/** The statement, one block per currency, never combined. */
export function normaliseStatement(value: unknown): StatementBlock[] {
  const raw = obj(value);
  const source = obj(raw?.statement) ?? value;
  return currencyBlocks(source)
    .map((block): StatementBlock | null => {
      const currency = code(block.currency);
      if (!currency) return null;
      const totals = obj(block.totals) ?? block;
      return {
        currency,
        opening: amountOf(block, "opening", "opening_balance", "brought_forward"),
        charged: amountOf(totals, "charged", "total_charged", "charges", "due"),
        received: amountOf(totals, "received", "total_received", "payments", "paid"),
        reversed: amountOf(totals, "reversed", "total_reversed"),
        waived: amountOf(totals, "waived", "total_waived"),
        closing: amountOf(block, "closing", "closing_balance", "balance", "outstanding"),
        overdue: amountOf(block, "overdue"),
        lines: arr(first(block, "lines", "items", "entries")).map(statementLine).filter((line): line is StatementLine => line !== null),
      };
    })
    .filter((block): block is StatementBlock => block !== null);
}

function bucketsFrom(raw: Raw): Buckets | null {
  const list = arr(raw.buckets);
  const map = obj(raw.buckets) ?? obj(raw.ageing) ?? raw;
  const found: Partial<Buckets> = {};
  for (const item of list) {
    const row = obj(item);
    const key = row ? ageingKeyOf(row.bucket ?? row.key ?? row.range) : null;
    if (row && key) {
      const amount = amountOf(row, "outstanding", "amount", "total");
      if (amount !== null) found[key] = amount;
    }
  }
  for (const bucket of AGEING) {
    if (found[bucket.key] !== undefined) continue;
    for (const alias of bucket.aliases) {
      const amount = amountOf(map, alias);
      if (amount !== null) {
        found[bucket.key] = amount;
        break;
      }
    }
  }
  if (Object.keys(found).length === 0) return null;
  return { "0-30": found["0-30"] ?? "0", "31-60": found["31-60"] ?? "0", "61-90": found["61-90"] ?? "0", "90+": found["90+"] ?? "0" };
}

function arrearsRow(value: unknown, currency: string | null): ArrearsRow | null {
  const raw = obj(value);
  if (!raw) return null;
  const tenancy = obj(raw.tenancy);
  const tenancyId = str(raw.tenancy_id) ?? str(tenancy?.id) ?? str(raw.id);
  const rowCurrency = currencyOf(raw, "total", "outstanding") ?? currency;
  const buckets = bucketsFrom(raw);
  if (!tenancyId || !rowCurrency || !buckets) return null;
  const tenantsRaw = arr(first(raw, "tenants") ?? tenancy?.tenants);
  const tenants = tenantsRaw.map((item) => personName(item)).filter((name): name is string => Boolean(name));
  const property = obj(raw.property) ?? obj(tenancy?.property);
  const unit = obj(raw.unit) ?? obj(tenancy?.unit);
  const total = amountOf(raw, "total", "outstanding", "total_outstanding") ?? sumAmounts(AGEING_KEYS.map((key) => buckets[key])) ?? "0";
  return {
    tenancyId,
    currency: rowCurrency,
    tenants: tenants.length <= 2 ? tenants.join(" and ") : `${tenants[0]} and ${tenants.length - 1} others`,
    property: str(property?.name) ?? str(raw.property_name) ?? "",
    unit: str(unit?.label) ?? str(raw.unit_label),
    buckets,
    total,
    oldestDueDate: str(raw.oldest_due_date) ?? str(raw.oldest_due),
    daysOverdue: int(raw.days_overdue) ?? int(raw.oldest_days_overdue),
    dues: int(raw.dues) ?? int(raw.dues_count) ?? int(raw.count),
  };
}

/**
 * `GET …/arrears`: currency blocks each with their tenancies (`rows`,
 * `tenancies` or `items`), or one flat list of tenancy rows with a currency
 * each. Either way the answer is grouped per currency here and each block's
 * totals are the API's when it sends them, otherwise added exactly.
 */
export function normaliseArrears(value: unknown, minorUnits: (currency: string) => number = () => 2): ArrearsBlock[] {
  const raw = obj(value);
  const blocks = currencyBlocks(raw?.arrears ?? value).filter((block) => code(block.currency) && first(block, "rows", "tenancies", "items") !== undefined);
  if (blocks.length) {
    return blocks.map((block) => {
      const currency = code(block.currency) as string;
      const rows = arr(first(block, "rows", "tenancies", "items"))
        .map((item) => arrearsRow(item, currency))
        .filter((row): row is ArrearsRow => row !== null)
        .map((row) => ({ ...row, currency }));
      const computed = groupArrears(rows, minorUnits)[0] ?? { currency, buckets: zeroBuckets(minorUnits(currency)), total: fromUnits(BigInt(0), minorUnits(currency)), rows: [] };
      return { currency, buckets: bucketsFrom(block) ?? computed.buckets, total: amountOf(block, "total", "outstanding", "total_outstanding") ?? computed.total, rows: computed.rows };
    });
  }
  const rows = listOf(raw?.arrears ?? value, "tenancies", "rows")
    .map((item) => arrearsRow(item, null))
    .filter((row): row is ArrearsRow => row !== null);
  return groupArrears(rows, minorUnits);
}
