/**
 * Leases and signing (API 0.24.0): plain words per error code, status labels,
 * the checks the forms run before anything is sent, and the geometry of the
 * field editor. Pure functions with no imports, so `npm test` can run them
 * directly. The API stays the authority on every rule.
 */

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

/* ------------------------------------------------------------------------ */
/* Messages                                                                  */
/* ------------------------------------------------------------------------ */

const messages: Record<string, string> = {
  FORBIDDEN: "Only people who manage listings (and their agency's principal or administrators) can do this.",
  LEASE_NOT_FOUND: "We could not find that lease, or you no longer have access to it.",
  LEASE_TEMPLATE_NOT_FOUND: "We could not find that template.",
  LISTING_NOT_FOUND: "That listing is not one you can use. Choose another or type the address.",
  LEASE_DOCUMENT_UNAVAILABLE: "The PDF is not ready yet. Try again in a moment.",
  LEASE_NOT_EDITABLE: "This lease was already sent, so it can no longer be changed.",
  LEASE_STATE_CONFLICT: "This lease has moved on since you opened it. The page has been loaded again.",
  LEASE_TEMPLATE_DRAFT_EXISTS: "This template already has a draft of its next version. Edit that draft instead.",
  LEASE_TEMPLATE_NOT_EDITABLE: "A retired template cannot be changed.",
  LEASE_TEMPLATE_STATE_CONFLICT: "Only a draft can be published or approved, and a retired template cannot be retired again.",
  LEASE_TEMPLATE_NOT_AVAILABLE: "That template is no longer offered. Choose another one.",
  LEASE_MARKET_MISMATCH: "That template is for another country than the property. Choose a template for the property's country.",
  AGREEMENT_NOT_FOUND: "We could not find that document, or you no longer have access to it.",
  RECIPIENT_NOT_FOUND: "That recipient is no longer on the document. The page has been loaded again.",
  AGREEMENT_STATE_CONFLICT: "This document has moved on since you opened it (sent, signed or cancelled). The page has been loaded again.",
  AGREEMENT_DOCUMENT_REQUIRED: "Upload the PDF to be signed first.",
  AGREEMENT_FIELDS_INCOMPLETE: "Some fields are missing or misplaced. Every signer needs at least one signature field.",
  UNSUPPORTED_FILE_TYPE: "That file is not a PDF we can read. Use a PDF of at most 50 pages that opens without a password.",
  FILE_TOO_LARGE: "That file is larger than 20 MB.",
  NOT_OPEN_FOR_SIGNING: "It is not this person's turn yet, or the document is no longer out for signature.",
  ALREADY_SIGNED: "This has already been signed or approved.",
  SIGNING_LINK_NOT_FOUND: "We could not find this signing link. Check that you opened the whole link from the email.",
  SIGNING_LINK_EXPIRED: "This signing link has expired.",
  SIGNING_LINK_NO_LONGER_VALID:
    "This link no longer works: a newer link was sent, the address was changed, or the document was cancelled.",
  CODE_EXPIRED: "That code has expired or was used up. Send a new code.",
  RATE_LIMITED: "That was a lot of attempts at once. Please wait a minute and try again.",
};

/** The message to show for a failed lease, agreement or signing action. A code not listed keeps the API's message. */
export function signingMessage(failure: { code: string; message: string }): string {
  return messages[failure.code] ?? failure.message;
}

/** True when the plain words replaced the API's message (a support reference only helps with the unexpected). */
export const isKnownCode = (code: string) => Object.prototype.hasOwnProperty.call(messages, code);

/* ------------------------------------------------------------------------ */
/* Labels                                                                    */
/* ------------------------------------------------------------------------ */

export const AGREEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  OUT_FOR_SIGNATURE: { label: "Out for signature", tone: "primary" },
  COMPLETED: { label: "Completed", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "warning" },
};

export const RECIPIENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  WAITING: { label: "Waiting for their turn", tone: "neutral" },
  ACTIVE: { label: "Needs to act", tone: "primary" },
  SIGNED: { label: "Signed", tone: "success" },
  APPROVED: { label: "Approved", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CC: { label: "Gets a copy", tone: "info" },
};

export const LEASE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT_FOR_SIGNING: { label: "Out for signing", tone: "primary" },
  SIGNED: { label: "Signed", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "warning" },
};

export const TEMPLATE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  APPROVED: { label: "Approved", tone: "success" },
  RETIRED: { label: "Retired", tone: "warning" },
};

/** An organisation's own templates: APPROVED reads "Published". */
export const ORG_TEMPLATE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  APPROVED: { label: "Published", tone: "success" },
  RETIRED: { label: "Retired", tone: "warning" },
};

export const statusOf = (table: Record<string, { label: string; tone: Tone }>, status: string) =>
  table[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "), tone: "neutral" as Tone };

export const ROLE_LABELS: Record<string, string> = { SIGNER: "Signer", APPROVER: "Approver", CC: "Copy" };

export const ROLE_HINTS: Record<string, string> = {
  SIGNER: "Signs the document.",
  APPROVER: "Approves it without signing.",
  CC: "Gets the completed copy. Nothing to do.",
};

export const REMINDER_OPTIONS = [
  { value: "NONE", label: "No reminders" },
  { value: "DAILY", label: "Every day until they act" },
  { value: "EVERY_3_DAYS", label: "Every 3 days until they act" },
  { value: "WEEKLY", label: "Every week until they act" },
] as const;

export const RENT_PERIODS = [
  { value: "MONTHLY", label: "Per month" },
  { value: "WEEKLY", label: "Per week" },
  { value: "ANNUALLY", label: "Per year" },
] as const;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** What the history of an agreement says for each event. */
export const EVENT_LABELS: Record<string, string> = {
  CREATED: "Created",
  DOCUMENT_ADDED: "Document added",
  FIELDS_CHANGED: "Fields placed",
  SENT: "Sent for signature",
  EMAILED: "Emailed",
  VIEWED: "Opened",
  CODE_SENT: "Email code sent",
  EMAIL_VERIFIED: "Email address verified",
  SIGNED: "Signed",
  APPROVED: "Approved",
  DECLINED: "Declined",
  REMINDED: "Reminder sent",
  RECIPIENT_REPLACED: "Recipient's address changed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  COMPLETED: "Completed",
  COPY_SENT: "Completed copy emailed",
  EDITED: "Edited",
  PDF_GENERATED: "PDF made",
  NEW_VERSION: "New version started",
  PUBLISHED: "Published",
  COPIED: "Copied",
  RETIRED: "Retired",
};

export const eventLabel = (action: string) =>
  EVENT_LABELS[action] ??
  EVENT_LABELS[action.replace(/^AGREEMENT_/, "")] ??
  action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

/* ------------------------------------------------------------------------ */
/* Recipients                                                                */
/* ------------------------------------------------------------------------ */

export const RECIPIENTS_MAX = 20;

/** The order of each row: 1..n when they complete in order, all 1 otherwise. */
export const assignOrders = (count: number, sequential: boolean): number[] =>
  Array.from({ length: count }, (_, index) => (sequential ? index + 1 : 1));

/** True when the saved orders say "complete in order": more than one distinct order. */
export const isSequential = (orders: number[]) => new Set(orders).size > 1;

/** Moves item `from` to `to`, returning a new array. */
export function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** The names of signers who have no SIGNATURE field yet. */
export function signersWithoutSignature(
  recipients: { id: string; name: string; role: string }[],
  fields: { recipient_id: string; type: string }[],
): string[] {
  return recipients
    .filter((recipient) => recipient.role === "SIGNER")
    .filter((recipient) => !fields.some((field) => field.recipient_id === recipient.id && field.type === "SIGNATURE"))
    .map((recipient) => recipient.name);
}

/** Up to 8 distinct colours, one per recipient, readable on a white page. */
export const RECIPIENT_COLOURS = ["#1d4ed8", "#b45309", "#15803d", "#7e22ce", "#0e7490", "#be123c", "#4d7c0f", "#a16207"];
export const recipientColour = (index: number) => RECIPIENT_COLOURS[((index % RECIPIENT_COLOURS.length) + RECIPIENT_COLOURS.length) % RECIPIENT_COLOURS.length];

/** "Jane van der Berg" -> "JB". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/* ------------------------------------------------------------------------ */
/* Fields and geometry                                                       */
/* ------------------------------------------------------------------------ */

export const FIELD_MIN = 6;

/** The field types in the editor's toolbar, with their size when placed and their smallest size (PDF points). */
export const FIELD_TYPES = [
  { type: "SIGNATURE", label: "Signature", w: 180, h: 40, min: FIELD_MIN, signerOnly: true },
  { type: "INITIALS", label: "Initials", w: 60, h: 30, min: FIELD_MIN, signerOnly: true },
  // A 40 mm square; at least 57 points (20 mm) so the stamp stays legible.
  { type: "STAMP", label: "Stamp", w: 113, h: 113, min: 57, signerOnly: true },
  { type: "DATE_SIGNED", label: "Date signed", w: 110, h: 20, min: FIELD_MIN, signerOnly: false },
  { type: "NAME", label: "Name", w: 160, h: 20, min: FIELD_MIN, signerOnly: false },
  { type: "TEXT", label: "Text", w: 160, h: 22, min: FIELD_MIN, signerOnly: false },
  { type: "CHECKBOX", label: "Checkbox", w: 16, h: 16, min: FIELD_MIN, signerOnly: false },
] as const;

export const fieldTypeLabel = (type: string) => FIELD_TYPES.find((item) => item.type === type)?.label ?? type;

/** The smallest a field of `type` may be, in points. */
export const fieldMin = (type: string): number => FIELD_TYPES.find((item) => item.type === type)?.min ?? FIELD_MIN;

/** Only a SIGNER can have these (an approver approves without signing). */
export const isSignerOnly = (type: string) => FIELD_TYPES.some((item) => item.type === type && item.signerOnly);

export type Box = { x: number; y: number; w: number; h: number };

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Keeps a field on its page and at least `min` x `min` points (6 by default), rounded to hundredths. */
export function clampBox(box: Box, page: { width: number; height: number }, min: number = FIELD_MIN): Box {
  const w = Math.min(Math.max(box.w, min), page.width);
  const h = Math.min(Math.max(box.h, min), page.height);
  const x = Math.min(Math.max(box.x, 0), page.width - w);
  const y = Math.min(Math.max(box.y, 0), page.height - h);
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
}

/** A field of `size` centred on a point (PDF points), kept on the page. */
export const boxAt = (point: { x: number; y: number }, size: { w: number; h: number }, page: { width: number; height: number }) =>
  clampBox({ x: point.x - size.w / 2, y: point.y - size.h / 2, w: size.w, h: size.h }, page);

/**
 * A point on the page in PDF points from the top-left, from a pointer
 * position in CSS pixels relative to the page's top-left at `scale` pixels per point.
 */
export const toPoints = (px: { x: number; y: number }, scale: number) => ({ x: px.x / scale, y: px.y / scale });

/** The required fields of a recipient that they fill themselves (not NAME or DATE_SIGNED, filled for them). */
export const isSelfFilled = (type: string) => type !== "NAME" && type !== "DATE_SIGNED";

/* ------------------------------------------------------------------------ */
/* Files                                                                     */
/* ------------------------------------------------------------------------ */

export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const SIGNATURE_UPLOAD_MAX_BYTES = 500 * 1024;
export const SIGNATURE_DRAWN_MAX_BYTES = 200 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What is wrong with a file chosen as the document to sign, before it is uploaded. */
export function pdfFileProblem(file: { name: string; type: string; size: number }): string | undefined {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "Choose a PDF file. Save other documents as PDF first.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > PDF_MAX_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 20 MB.`;
  return undefined;
}

/** An uploaded signature image: PNG or JPEG of at most 500 KB. */
export function signatureImageProblem(file: { type: string; size: number }): string | undefined {
  if (file.type !== "image/png" && file.type !== "image/jpeg") return "Choose a PNG or JPEG image.";
  if (file.size > SIGNATURE_UPLOAD_MAX_BYTES) return `That image is ${formatBytes(file.size)}. The limit is 500 KB.`;
  return undefined;
}

/** Image dimensions the API accepts for a signature: 20 x 10 to 2000 x 1000 pixels. */
export function signatureDimensionsProblem(width: number, height: number): string | undefined {
  if (width < 20 || height < 10) return "That image is too small. Use one at least 20 pixels wide and 10 high.";
  if (width > 2000 || height > 1000) return "That image is too large. Use one at most 2000 pixels wide and 1000 high.";
  return undefined;
}

/** The size in bytes of the data behind a base64 string (with or without a data-URL prefix). */
export function base64Bytes(value: string): number {
  const data = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

/* ------------------------------------------------------------------------ */
/* Dates                                                                     */
/* ------------------------------------------------------------------------ */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written YYYY-MM-DD. */
export function isDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The local calendar day `days` after `nowMs`, as YYYY-MM-DD. */
export function dayAfter(nowMs: number, days: number): string {
  const at = new Date(nowMs);
  at.setDate(at.getDate() + days);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The end (23:59) of a local calendar day, as an RFC 3339 time. */
export function endOfDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 23, 59, 0).toISOString();
}

/** The local calendar day of an RFC 3339 time, as YYYY-MM-DD. */
export function dayOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** An expiry day: from tomorrow to a year from now (the API wants at least an hour and at most a year). */
export function expiryProblem(day: string, nowMs: number): string | undefined {
  if (!day) return "Choose the last day it can be signed.";
  if (!isDay(day)) return "Enter a date like 2026-12-31.";
  const at = Date.parse(endOfDay(day));
  if (at - nowMs < 60 * 60 * 1000) return "Choose a day after today.";
  if (at - nowMs > 365 * 24 * 60 * 60 * 1000) return "Choose a day within a year from today.";
  return undefined;
}

/* ------------------------------------------------------------------------ */
/* Leases                                                                    */
/* ------------------------------------------------------------------------ */

/** "SAMPLE — not reviewed by a lawyer": a template whose wording no lawyer approved. */
export function isSampleReview(
  review: { reviewer_name?: string; organisation?: string; note?: string } | null | undefined,
): boolean {
  if (!review) return true;
  return [review.reviewer_name, review.organisation, review.note].some((text) => /\bsample\b/i.test(text ?? ""));
}

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

/** A rent: a number above 0 with at most two decimals, written without separators. */
export function amountProblem(value: string, what: string, optional = false): string | undefined {
  const text = value.trim();
  if (!text) return optional ? undefined : `Enter the ${what}.`;
  if (!AMOUNT.test(text)) return `Write the ${what} as a number, like 1200 or 1200.50, without commas or a currency sign.`;
  if (!optional && Number(text) <= 0) return `The ${what} must be more than 0.`;
  return undefined;
}

/** 1-31 for a monthly or yearly rent, 1-7 (Monday-Sunday) for a weekly one. */
export function paymentDayProblem(day: number | null, period: string): string | undefined {
  if (day === null || Number.isNaN(day)) return "Choose the day the rent is due.";
  const max = period === "WEEKLY" ? 7 : 31;
  if (!Number.isInteger(day) || day < 1 || day > max) {
    return period === "WEEKLY" ? "Choose a day of the week." : "Choose a day from 1 to 31.";
  }
  return undefined;
}

export function noticeProblem(days: number | null): string | undefined {
  if (days === null || Number.isNaN(days)) return "Enter the notice period in days.";
  if (!Number.isInteger(days) || days < 1 || days > 365) return "Use a whole number of days from 1 to 365.";
  return undefined;
}

export function leaseDatesProblems(start: string, end: string, periodic: boolean): { start_date?: string; end_date?: string } {
  const problems: { start_date?: string; end_date?: string } = {};
  if (!start) problems.start_date = "Choose the day the lease starts.";
  else if (!isDay(start)) problems.start_date = "Enter a date like 2026-12-01.";
  if (!periodic) {
    if (!end) problems.end_date = "Choose the day it ends, or make it a periodic lease.";
    else if (!isDay(end)) problems.end_date = "Enter a date like 2027-11-30.";
    else if (start && isDay(start) && end <= start) problems.end_date = "The end must be after the start.";
  }
  return problems;
}

/* ------------------------------------------------------------------------ */
/* Templates                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The placeholders a text uses that are not allowed, and whether a `{{` or
 * `}}` is left without its pair. The API refuses both.
 */
export function placeholderProblem(text: string, allowed: Set<string>): string | undefined {
  const unknown = new Set<string>();
  const rest = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name: string) => {
    if (!allowed.has(name)) unknown.add(name);
    return "";
  });
  if (unknown.size > 0) {
    const names = [...unknown].map((name) => `{{${name}}}`).join(", ");
    return `${names} ${unknown.size === 1 ? "is not a variable" : "are not variables"} a template can use.`;
  }
  if (rest.includes("{{") || rest.includes("}}")) return "A {{ or }} is not part of a {{variable}}. Remove it or finish the variable.";
  if (/[<>]/.test(text)) return "Use plain text: < and > are not allowed.";
  return undefined;
}

export const CLAUSE_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

/* ------------------------------------------------------------------------ */
/* Stamps                                                                    */
/* ------------------------------------------------------------------------ */

export const STAMP_SHAPES = [
  { value: "ROUND", label: "Round" },
  { value: "OVAL", label: "Oval" },
  { value: "RECTANGLE", label: "Rectangle" },
] as const;

export const STAMP_COLOURS = [
  { value: "BLUE", label: "Blue" },
  { value: "RED", label: "Red" },
  { value: "BLACK", label: "Black" },
  { value: "GREEN", label: "Green" },
  { value: "PURPLE", label: "Purple" },
] as const;

export const STAMP_LINES_MAX = 3;

type StampText = { top_text: string; centre_lines: string[]; bottom_text: string };

const length = (text: string) => Array.from(text).length;

/**
 * What is wrong with a stamp's text, keyed like the API's field errors:
 * `top_text`, `centre_lines`, `centre_lines[0]`, `bottom_text`.
 */
export function stampProblems(stamp: StampText): Record<string, string | undefined> {
  const problems: Record<string, string | undefined> = {};
  const top = stamp.top_text.trim();
  if (!top) problems.top_text = "Type the text along the top, such as the company name.";
  else if (length(top) > 60) problems.top_text = "Use 60 characters or fewer.";
  if (stamp.centre_lines.length > STAMP_LINES_MAX) problems.centre_lines = "Use at most 3 centre lines.";
  stamp.centre_lines.forEach((line, index) => {
    if (length(line.trim()) > 30) problems[`centre_lines[${index}]`] = "Use 30 characters or fewer.";
  });
  if (length(stamp.bottom_text.trim()) > 60) problems.bottom_text = "Use 60 characters or fewer.";
  return problems;
}

/** A stamp as it is sent: text trimmed, empty centre lines left out. */
export function cleanStamp<T extends StampText>(stamp: T): T {
  return {
    ...stamp,
    top_text: stamp.top_text.trim(),
    centre_lines: stamp.centre_lines.map((line) => line.trim()).filter(Boolean),
    bottom_text: stamp.bottom_text.trim(),
  };
}

/** API field names (`stamp.top_text`, `centre_lines[1]`) as the keys of `stampProblems`. */
export function stampFieldErrors(fields: Record<string, string> | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const name = key.replace(/^stamp\./, "");
    if (name === key && !/^(shape|colour|top_text|centre_lines|bottom_text|include_date)/.test(key)) continue;
    errors[name] = message;
  }
  return errors;
}

/* ------------------------------------------------------------------------ */
/* Verification                                                              */
/* ------------------------------------------------------------------------ */

export const AGREEMENT_REFERENCE = /^RPA-\d{4}-\d{6,}$/;

/** "rpa-2026-000123 " -> "RPA-2026-000123". */
export const cleanReference = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");
