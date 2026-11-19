/**
 * The rules of reviews of service providers (API 0.36.4, BR-019, FR-047)
 * that are not the API's, as pure functions: the star average in figures and
 * in words, the stars drawn for an average, the reviewer's public name, the
 * checks on the review text, the report reason and the reply, the reply's
 * 7-day edit window and its countdown, the review statuses, the moderation
 * filters in the address and the API query, and tolerant readers for the
 * API's answers.
 *
 * Who may review is the API's decision (the eligibility endpoint): a closed or
 * resolved maintenance request assigned to the provider, or a business enquiry
 * to them that is at least 14 days old and was replied to.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/reviews.test.mjs).
 */

// ---- Limits ---------------------------------------------------------------------------------------

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const TEXT_MIN = 20;
export const TEXT_MAX = 2000;
export const REASON_MIN = 1;
export const REASON_MAX = 500;
export const REPLY_MIN = 1;
export const REPLY_MAX = 2000;
export const MODERATION_REASON_MAX = 500;
/** A provider's reply may be changed for this long after it was first posted. */
export const REPLY_EDIT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Characters as people count them (code points, as the API counts runes), after trimming. */
export const textLength = (text: string) => [...text.trim()].length;

// ---- The average in figures and words -------------------------------------------------------------

/** One decimal, rounded half up: 4.25 -> "4.3", 4 -> "4.0". Null for no average. */
export function formatAverage(average: number | null | undefined): string | null {
  if (typeof average !== "number" || !Number.isFinite(average)) return null;
  const clamped = Math.min(RATING_MAX, Math.max(0, average));
  // Rounded on a whole number of tenths, so 4.25 is not taken for 4.2499999.
  return (Math.round(Math.round(clamped * 1000) / 100) / 10).toFixed(1);
}

export const reviewCountWords = (count: number) => (count === 1 ? "1 review" : `${count} reviews`);

/**
 * "4.5 out of 5 from 12 reviews", for screen readers and the visible line
 * beside the stars. Null when there is nothing to show (no published review).
 */
export function ratingWords(average: number | null | undefined, count: number | null | undefined): string | null {
  const shown = formatAverage(average);
  if (!shown || typeof count !== "number" || count < 1) return null;
  return `${shown.endsWith(".0") ? shown.slice(0, -2) : shown} out of ${RATING_MAX} from ${reviewCountWords(count)}`;
}

/** One review's rating in words: "4 out of 5 stars", "1 out of 5 stars". */
export const starsWords = (rating: number) => `${rating} out of ${RATING_MAX} stars`;

export type StarFill = "full" | "half" | "empty";

/** Five stars for an average, rounded to the nearest half: 4.3 -> four full and one half star; 4.2 -> four full and one empty. */
export function starFills(average: number | null | undefined): StarFill[] {
  const value = typeof average === "number" && Number.isFinite(average) ? Math.min(RATING_MAX, Math.max(0, average)) : 0;
  const halves = Math.round(value * 2);
  return Array.from({ length: RATING_MAX }, (_, index) => {
    const left = halves - index * 2;
    return left >= 2 ? "full" : left === 1 ? "half" : "empty";
  });
}

/** Whether to show the summary (stars and count): only with at least one published review. */
export const hasRatings = (summary: { count: number; average: number | null } | null | undefined) =>
  Boolean(summary && summary.count >= 1 && formatAverage(summary.average) !== null);

/**
 * schema.org `AggregateRating` for a profile's main entity, only when it has
 * a published review. The figures are the API's published count and average.
 */
export function aggregateRatingJsonLd(summary: { count: number; average: number | null } | null | undefined) {
  if (!summary || !hasRatings(summary)) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: formatAverage(summary.average) as string,
    reviewCount: summary.count,
    bestRating: RATING_MAX,
    worstRating: RATING_MIN,
  };
}

// ---- The reviewer's public name -------------------------------------------------------------------

/**
 * How a reviewer is shown publicly: an organisation by its name, a person by
 * first name and the initial of their last name ("Chipo D."). The API's own
 * public name wins. Never the full name, never an email address.
 */
export function publicReviewerName(reviewer: {
  publicName?: string | null;
  kind?: string | null;
  name?: string | null;
  organisationName?: string | null;
} | null | undefined): string {
  if (!reviewer) return "A customer";
  if (reviewer.publicName && reviewer.publicName.trim()) return reviewer.publicName.trim();
  if (reviewer.organisationName && reviewer.organisationName.trim()) return reviewer.organisationName.trim();
  const name = (reviewer.name ?? "").trim();
  if (!name || name.includes("@")) return "A customer";
  if ((reviewer.kind ?? "").toUpperCase() === "ORGANISATION") return name;
  const words = name.split(/\s+/);
  const firstName = words[0];
  if (words.length === 1) return firstName;
  const initial = [...words[words.length - 1]][0]?.toLocaleUpperCase("en-GB") ?? "";
  return initial ? `${firstName} ${initial}.` : firstName;
}

// ---- Checks on the forms --------------------------------------------------------------------------

export function ratingProblem(rating: number | null | undefined): string | null {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return `Choose a rating from ${RATING_MIN} to ${RATING_MAX} stars.`;
  }
  return null;
}

export function reviewTextProblem(text: string): string | null {
  const length = textLength(text);
  if (length === 0) return "Write your review.";
  if (length < TEXT_MIN) return `Write at least ${TEXT_MIN} characters. ${TEXT_MIN - length} more to go.`;
  if (length > TEXT_MAX) return `Use at most ${TEXT_MAX} characters. Remove ${length - TEXT_MAX}.`;
  return null;
}

/** The counter under the text: "57 of 2000 characters" or "12 of 2000 characters, at least 20". */
export function textCounterWords(text: string, min = TEXT_MIN, max = TEXT_MAX): string {
  const length = textLength(text);
  if (length > max) return `${length} of ${max} characters: ${length - max} too many`;
  if (length < min) return `${length} of ${max} characters, at least ${min}`;
  return `${length} of ${max} characters`;
}

export function reportReasonProblem(reason: string): string | null {
  const length = textLength(reason);
  if (length < REASON_MIN) return "Say what is wrong with this review.";
  if (length > REASON_MAX) return `Use at most ${REASON_MAX} characters.`;
  return null;
}

export function replyProblem(text: string): string | null {
  const length = textLength(text);
  if (length < REPLY_MIN) return "Write your reply.";
  if (length > REPLY_MAX) return `Use at most ${REPLY_MAX} characters.`;
  return null;
}

export function moderationReasonProblem(action: string, reason: string): string | null {
  const length = textLength(reason);
  if (moderationNeedsReason(action) && length === 0) return "Give the reason. The reviewer is told it.";
  if (length > MODERATION_REASON_MAX) return `Use at most ${MODERATION_REASON_MAX} characters.`;
  return null;
}

export type ReviewForm = { rating: number | null; text: string };
export type ReviewProblems = { rating?: string; text?: string };

export function reviewFormProblems(form: ReviewForm): ReviewProblems {
  const problems: ReviewProblems = {};
  const rating = ratingProblem(form.rating);
  const text = reviewTextProblem(form.text);
  if (rating) problems.rating = rating;
  if (text) problems.text = text;
  return problems;
}

export const hasProblems = (problems: Record<string, unknown>) => Object.values(problems).some(Boolean);

export const reviewBody = (profileId: string, basis: { kind: string; id: string }, form: ReviewForm) => ({
  directory_profile_id: profileId,
  basis: { kind: basis.kind, id: basis.id },
  rating: form.rating,
  text: form.text.trim(),
});

export const reviewEditBody = (form: ReviewForm) => ({ rating: form.rating, text: form.text.trim() });

/** The API's field errors on the form's fields ("basis.id" and the like go to the form). */
export function reviewApiProblems(fields: Record<string, string> | undefined): ReviewProblems & { other?: string[] } {
  if (!fields) return {};
  const problems: ReviewProblems & { other?: string[] } = {};
  const other: string[] = [];
  for (const [key, text] of Object.entries(fields)) {
    if (key === "rating") problems.rating = text;
    else if (key === "text") problems.text = text;
    else other.push(text);
  }
  if (other.length > 0) problems.other = other;
  return problems;
}

// ---- The reply's edit window ----------------------------------------------------------------------

export type EditWindow = { open: boolean; until: string | null; remainingMs: number };

/**
 * Whether a reply can still be changed, and until when. The API's
 * `editable_until` wins; otherwise 7 days after the reply was first posted.
 * A reply that is not there yet can always be written (`open`, no `until`).
 */
export function replyEditWindow(
  reply: { createdAt: string | null; editableUntil?: string | null } | null | undefined,
  now: number = Date.now(),
): EditWindow {
  if (!reply) return { open: true, until: null, remainingMs: Number.POSITIVE_INFINITY };
  let until: number | null = null;
  if (reply.editableUntil) {
    const parsed = Date.parse(reply.editableUntil);
    if (!Number.isNaN(parsed)) until = parsed;
  }
  if (until === null && reply.createdAt) {
    const created = Date.parse(reply.createdAt);
    if (!Number.isNaN(created)) until = created + REPLY_EDIT_DAYS * DAY_MS;
  }
  if (until === null) return { open: false, until: null, remainingMs: 0 };
  const remainingMs = Math.max(0, until - now);
  return { open: remainingMs > 0, until: new Date(until).toISOString(), remainingMs };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The countdown in words: "6 days 4 hours left", "3 hours 12 minutes left",
 * "12 minutes left", "less than a minute left", "The time to change it has ended".
 */
export function countdownWords(remainingMs: number): string {
  if (!Number.isFinite(remainingMs)) return "";
  if (remainingMs <= 0) return "The time to change it has ended";
  const minutes = Math.floor(remainingMs / 60000);
  if (minutes < 1) return "less than a minute left";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${plural(days, "day")}${hours > 0 ? ` ${plural(hours, "hour")}` : ""} left`;
  if (hours > 0) return `${plural(hours, "hour")}${mins > 0 ? ` ${plural(mins, "minute")}` : ""} left`;
  return `${plural(mins, "minute")} left`;
}

/** How often to redraw the countdown: every minute, every second in its last minute. */
export const countdownTick = (remainingMs: number) => (remainingMs > 0 && remainingMs < 60000 ? 1000 : 60000);

// ---- Statuses -------------------------------------------------------------------------------------

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting to be checked",
  PUBLISHED: "Published",
  HIDDEN: "Hidden",
  REJECTED: "Rejected",
};
const STATUS_TONES: Record<string, Tone> = { PENDING: "warning", PUBLISHED: "success", HIDDEN: "neutral", REJECTED: "danger" };

function wordsFromCode(code: string): string {
  const words = code.toLowerCase().replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

export const reviewStatusLabel = (status: string, apiLabel?: string | null) => apiLabel || STATUS_LABELS[status] || wordsFromCode(status);
export const reviewStatusTone = (status: string): Tone => STATUS_TONES[status] ?? "neutral";

/** What each status means, for the reviewer. */
export const STATUS_FOR_REVIEWER: Record<string, string> = {
  PENDING: "We check every review before it is published. You can still change or delete it.",
  PUBLISHED: "Published on the provider's profile.",
  HIDDEN: "Hidden from the provider's profile by our moderators.",
  REJECTED: "Not published: it does not meet our review rules.",
};

export const MODERATION_ACTIONS = ["PUBLISH", "HIDE", "REJECT", "REMOVE_REPLY"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/** Every action but publishing needs a reason (1-500); the reviewer, or the provider for a reply, is told it. */
export const moderationNeedsReason = (action: string) => action !== "PUBLISH";

const ACTION_WORDS: Record<string, { verb: string; done: string }> = {
  PUBLISH: { verb: "Publish", done: "published" },
  HIDE: { verb: "Hide", done: "hidden" },
  REJECT: { verb: "Reject", done: "rejected" },
  REMOVE_REPLY: { verb: "Remove the reply", done: "left without its reply" },
};

/** "Publish", or "Keep published" for a published review that was reported (publishing again closes the reports). */
export function moderationVerb(action: string, status?: string): string {
  if (action === "PUBLISH" && status === "PUBLISHED") return "Keep published";
  return ACTION_WORDS[action]?.verb ?? wordsFromCode(action);
}
export const moderationDone = (action: string, status?: string) =>
  action === "PUBLISH" && status === "PUBLISHED" ? "kept published" : (ACTION_WORDS[action]?.done ?? "changed");

/**
 * The actions a moderator may take now; the API's `can` wins. Otherwise as
 * the API decides: publish a pending or hidden review (or a published one
 * that was reported, to keep it), hide a published one, reject a pending
 * one, and remove a reply.
 */
export function moderationActions(
  review: { status: string; reportCount?: number; hasReply?: boolean },
  apiAllowed?: readonly string[] | null,
): ModerationAction[] {
  if (apiAllowed) return MODERATION_ACTIONS.filter((action) => apiAllowed.includes(action));
  const { status } = review;
  return MODERATION_ACTIONS.filter((action) => {
    if (action === "PUBLISH") return status === "PENDING" || status === "HIDDEN" || (status === "PUBLISHED" && (review.reportCount ?? 0) > 0);
    if (action === "HIDE") return status === "PUBLISHED";
    if (action === "REJECT") return status === "PENDING";
    return Boolean(review.hasReply);
  });
}

// ---- The moderation queue in the address ----------------------------------------------------------

export const QUEUES = ["NEW", "REPORTED", "ALL"] as const;
export type Queue = (typeof QUEUES)[number];
export type ModerationFilters = { queue: Queue; status: string; page: number };

const QUEUE_LABELS: Record<Queue, string> = { NEW: "New", REPORTED: "Reported", ALL: "All reviews" };
export const queueLabel = (queue: Queue) => QUEUE_LABELS[queue];

export function pageNumber(value: string | null | undefined): number {
  const n = value && /^\d{1,5}$/.test(value) ? Number(value) : 1;
  return n >= 1 ? n : 1;
}

type Params = { get(name: string): string | null };

export function parseModerationFilters(params: Params): ModerationFilters {
  const queueText = (params.get("queue") ?? "").toUpperCase();
  const queue = (QUEUES as readonly string[]).includes(queueText) ? (queueText as Queue) : "NEW";
  const statusText = (params.get("status") ?? "").toUpperCase();
  const status = (REVIEW_STATUSES as readonly string[]).includes(statusText) ? statusText : "";
  return { queue, status, page: pageNumber(params.get("page")) };
}

export function moderationHref(filters: Partial<ModerationFilters>): string {
  const search = new URLSearchParams();
  if (filters.queue && filters.queue !== "NEW") search.set("queue", filters.queue.toLowerCase());
  if (filters.status) search.set("status", filters.status);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return text ? `/admin/reviews?${text}` : "/admin/reviews";
}

/**
 * The query of `GET /v1/admin/reviews`: New is the pending reviews and
 * Reported those with an open report (any status, or the one chosen), both
 * oldest first; All is every review (or those of the status chosen), newest
 * first.
 */
export function moderationApiQuery(filters: ModerationFilters, pageSize = 20): string {
  // The queue view is oldest first; "all" newest first.
  const search = new URLSearchParams({ view: filters.queue === "ALL" ? "all" : "queue" });
  if (filters.queue === "NEW") search.set("status", "PENDING");
  else if (filters.status) search.set("status", filters.status);
  if (filters.queue === "REPORTED") search.set("reported", "true");
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search}`;
}

/** The counter of a queue from the API's `{pending, reported}`. */
export function queueCount(queue: Queue, counts: Record<string, number> | undefined): number | undefined {
  if (!counts) return undefined;
  if (queue === "NEW") return counts.PENDING;
  if (queue === "REPORTED") return counts.REPORTED;
  return undefined;
}

// ---- Bases ------------------------------------------------------------------------------------------

export const BASIS_KINDS = ["MAINTENANCE", "ENQUIRY"] as const;
const MAINTENANCE_KINDS = ["MAINTENANCE", "MAINTENANCE_REQUEST"];
const ENQUIRY_KINDS = ["ENQUIRY", "BUSINESS_ENQUIRY"];

/** "Maintenance request RPM-2026-000001", "Enquiry BE-7K3M9QXD". */
export function basisWords(basis: { kind: string; reference: string | null } | null | undefined): string {
  if (!basis) return "";
  const what = MAINTENANCE_KINDS.includes(basis.kind) ? "Maintenance request" : ENQUIRY_KINDS.includes(basis.kind) ? "Enquiry" : wordsFromCode(basis.kind);
  return basis.reference ? `${what} ${basis.reference}` : what;
}

// ---- Tolerant readers -------------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number | null => {
  const n = typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const int = (value: unknown): number | null => {
  const n = num(value);
  return n !== null && Number.isInteger(n) ? n : null;
};
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const first = (raw: Raw, ...keys: string[]): unknown => {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};
const strings = (value: unknown): string[] => arr(value).filter((item): item is string => typeof item === "string");

export type RatingSummary = { count: number; average: number | null };

/** `{count, average}` (also `review_count`, `rating_count`, `average_rating`). Null when absent. */
export function normaliseSummary(value: unknown): RatingSummary | null {
  const raw = obj(value);
  if (!raw) return null;
  const count = int(first(raw, "count", "review_count", "rating_count", "published_count")) ?? 0;
  const average = num(first(raw, "average", "average_rating", "rating_average", "avg"));
  return { count: Math.max(0, count), average: count > 0 ? average : null };
}

/** The summary from a profile answer: `reviews`, `rating`, `review_summary` or flat fields. */
export function profileSummary(profile: unknown): RatingSummary | null {
  const raw = obj(profile);
  if (!raw) return null;
  for (const key of ["review_summary", "rating", "reviews_summary", "ratings", "reviews"]) {
    const found = normaliseSummary(raw[key]);
    if (found) return found;
  }
  if (raw.review_count !== undefined || raw.average_rating !== undefined) return normaliseSummary(raw);
  return null;
}

export type Reply = { text: string; createdAt: string | null; updatedAt: string | null; editableUntil: string | null; by: string | null };

function reply(value: unknown, editableUntil: string | null): Reply | null {
  const raw = obj(value);
  const text = raw ? str(raw.text) : null;
  if (!raw || !text) return null;
  return {
    text,
    createdAt: str(first(raw, "replied_at", "created_at", "at")),
    updatedAt: str(raw.updated_at),
    editableUntil: editableUntil ?? str(first(raw, "editable_until", "edit_until")),
    by: str(obj(raw.by)?.name) ?? str(raw.by_name),
  };
}

export type Report = { id: string | null; reason: string; status: string | null; createdAt: string | null; resolution: string | null };

function report(value: unknown): Report | null {
  const raw = obj(value);
  const reason = raw ? str(raw.reason) : null;
  if (!raw || !reason) return null;
  return { id: str(raw.id), reason, status: str(raw.status), createdAt: str(first(raw, "created_at", "at")), resolution: str(raw.resolution) };
}

export type ReviewBasis = { kind: string; id: string | null; reference: string | null };

function basis(value: unknown): ReviewBasis | null {
  const raw = obj(value);
  const kind = raw ? str(raw.kind) : str(value);
  if (!kind) return null;
  return { kind, id: str(raw?.id), reference: str(first(raw ?? {}, "reference", "label")) };
}

export type ProfileRef = { id: string | null; kind: string | null; slug: string | null; name: string };

function profileRef(value: unknown): ProfileRef | null {
  const raw = obj(value);
  const name = raw ? str(raw.name) : null;
  if (!raw || !name) return null;
  return { id: str(raw.id), kind: str(raw.kind), slug: str(raw.slug), name };
}

export type Review = {
  id: string;
  rating: number;
  text: string;
  status: string;
  statusLabel: string | null;
  /** As the public sees the reviewer: first name and initial, or the organisation's name (the API's). */
  reviewerName: string;
  /** CUSTOMER or ORGANISATION (DIRECT_OWNER for moderators). */
  reviewerKind: string | null;
  /** The member who wrote an organisation's review (the reviewer's own list and moderation only). */
  authorName: string | null;
  /** Moderation only: the account behind it (reviews are never anonymous to the platform). */
  reviewerUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  reply: Reply | null;
  /** A moderator removed the provider's reply (then no new one may be written). */
  replyRemoved: { at: string | null; reason: string | null } | null;
  profile: ProfileRef | null;
  basis: ReviewBasis | null;
  /** Moderation detail only. */
  reports: Report[];
  /** Open reports. */
  reportCount: number;
  moderation: { reason: string | null; at: string | null; by: string | null } | null;
  can: { edit: boolean; delete: boolean; reply: boolean; editReply: boolean; actions: string[] | null };
};

const ADMIN_CAN: Record<string, string> = { publish: "PUBLISH", hide: "HIDE", reject: "REJECT", remove_reply: "REMOVE_REPLY" };

export function normaliseReview(value: unknown): Review | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  const rating = int(first(raw, "rating", "stars"));
  if (!id || rating === null) return null;
  const reviewerRaw = obj(raw.reviewer);
  const reviewerKind = str(reviewerRaw?.kind);
  // The API sends the public name with the reviewer's kind; a bare full name is cut to first name and initial.
  const apiName = str(raw.reviewer_name) ?? str(reviewerRaw?.public_name) ?? str(reviewerRaw?.name);
  const reviewerName = reviewerKind || str(raw.reviewer_name) ? (apiName ?? "A customer") : publicReviewerName({ name: apiName });
  const can = obj(raw.can) ?? {};
  const adminActions = Object.keys(ADMIN_CAN).some((key) => typeof can[key] === "boolean")
    ? Object.entries(ADMIN_CAN).flatMap(([key, action]) => (can[key] === true ? [action] : []))
    : Array.isArray(can.actions)
      ? strings(can.actions)
      : null;
  const reports = arr(raw.reports).map(report).filter((item): item is Report => item !== null);
  const openReports = reports.filter((item) => !item.status || item.status === "OPEN").length;
  const moderation = obj(raw.moderation);
  const removed = raw.reply_removed;
  const removedRaw = obj(removed);
  const author = obj(raw.author);
  return {
    id,
    rating: Math.min(RATING_MAX, Math.max(RATING_MIN, rating)),
    text: str(raw.text) ?? "",
    status: str(raw.status) ?? "PUBLISHED",
    statusLabel: str(raw.status_label),
    reviewerName,
    reviewerKind,
    authorName: str(reviewerRaw?.author_name) ?? str(author?.name),
    reviewerUserId: str(reviewerRaw?.user_id) ?? str(author?.user_id),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    publishedAt: str(raw.published_at),
    reply: reply(raw.reply, str(raw.reply_editable_until)),
    replyRemoved: removedRaw ? { at: str(removedRaw.at), reason: str(removedRaw.reason) } : removed === true ? { at: null, reason: null } : null,
    profile: profileRef(raw.profile),
    basis: basis(raw.basis) ?? basis(raw.basis_kind),
    reports,
    reportCount: int(first(raw, "open_reports", "report_count")) ?? openReports,
    moderation: moderation ? { reason: str(moderation.reason), at: str(moderation.at), by: str(obj(moderation.by)?.name) } : null,
    can: {
      edit: bool(can.edit) ?? false,
      delete: bool(can.delete) ?? false,
      reply: bool(can.reply) ?? false,
      editReply: bool(can.edit_reply) ?? false,
      actions: adminActions,
    },
  };
}

export type ReviewPage = {
  items: Review[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: RatingSummary | null;
  /** The moderation queue's counters: PENDING and REPORTED. */
  counts: Record<string, number>;
  /** The profile the list is about (the public list). */
  profile: ProfileRef | null;
};

export function normaliseReviewPage(value: unknown, fallbackPage = 1): ReviewPage {
  const raw = obj(value) ?? {};
  const items = arr(first(raw, "items", "reviews")).map(normaliseReview).filter((item): item is Review => item !== null);
  const page = int(raw.page) ?? fallbackPage;
  const pageSize = int(raw.page_size) ?? (items.length || 10);
  const total = int(raw.total) ?? items.length;
  const totalPages = int(raw.total_pages) ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const counts: Record<string, number> = {};
  const rawCounts = obj(first(raw, "counts", "queue_counts"));
  if (rawCounts) {
    for (const [key, count] of Object.entries(rawCounts)) {
      const n = int(count);
      if (n !== null) counts[key.toUpperCase()] = n;
    }
  }
  return { items, page, pageSize, total, totalPages, summary: normaliseSummary(first(raw, "rating", "summary")), counts, profile: profileRef(raw.profile) };
}

export type BasisChoice = { kind: string; id: string; reference: string | null; label: string | null; date: string | null };

function basisChoice(value: unknown): BasisChoice | null {
  const raw = obj(value);
  const kind = raw ? str(raw.kind) : null;
  const id = raw ? str(raw.id) : null;
  if (!raw || !kind || !id) return null;
  return { kind, id, reference: str(raw.reference), label: str(raw.label), date: str(raw.date) };
}

export type Eligibility = {
  profile: ProfileRef | null;
  /** False for a profile that cannot be reviewed, or one of the caller's own business. */
  reviewable: boolean;
  eligible: boolean;
  /** Jobs and enquiries the caller may review now. */
  bases: BasisChoice[];
  /** Not yet: the reason (NOT_COMPLETED, TOO_RECENT, NOT_REPLIED) and, for a recent enquiry, from when. */
  upcoming: { basis: BasisChoice; reason: string; eligibleFrom: string | null }[];
  /** Already reviewed; `reviewId` and `status` only when the caller wrote it. */
  reviewed: { basis: BasisChoice; reviewId: string | null; status: string | null }[];
};

export function normaliseEligibility(value: unknown): Eligibility {
  const raw = obj(value) ?? {};
  const bases = arr(raw.bases).map(basisChoice).filter((item): item is BasisChoice => item !== null);
  const upcoming = arr(raw.upcoming).flatMap((item) => {
    const entry = obj(item);
    const b = basisChoice(entry?.basis);
    return entry && b ? [{ basis: b, reason: str(entry.reason) ?? "", eligibleFrom: str(entry.eligible_from) }] : [];
  });
  const reviewed = arr(raw.reviewed).flatMap((item) => {
    const entry = obj(item);
    const b = basisChoice(entry?.basis);
    return entry && b ? [{ basis: b, reviewId: str(entry.review_id), status: str(entry.status) }] : [];
  });
  return {
    profile: profileRef(raw.profile),
    reviewable: bool(raw.reviewable) ?? true,
    eligible: (bool(raw.eligible) ?? true) && bases.length > 0,
    bases,
    upcoming,
    reviewed,
  };
}

/** Keeps one basis (a page about one maintenance request); every basis when `id` is not given. */
export function eligibilityFor(eligibility: Eligibility, id: string | null | undefined): Eligibility {
  if (!id) return eligibility;
  const bases = eligibility.bases.filter((item) => item.id === id);
  return {
    ...eligibility,
    bases,
    eligible: bases.length > 0,
    upcoming: eligibility.upcoming.filter((item) => item.basis.id === id),
    reviewed: eligibility.reviewed.filter((item) => item.basis.id === id),
  };
}

const NOT_YET: Record<string, string> = {
  NOT_COMPLETED: "You can review the provider once the job is resolved or closed.",
  TOO_RECENT: "You can review the provider 14 days after your enquiry.",
  NOT_REPLIED: "You can review the provider once they have marked your enquiry as replied to.",
};

/** Why a basis cannot be reviewed yet, in words, with the date it can be when the API gives one. */
export function notYetWords(entry: { reason: string; eligibleFrom: string | null }, formatDate: (iso: string) => string = (iso) => iso.slice(0, 10)): string {
  if (entry.reason === "TOO_RECENT" && entry.eligibleFrom) return `You can review the provider from ${formatDate(entry.eligibleFrom)}.`;
  return NOT_YET[entry.reason] ?? "You cannot review the provider for this yet.";
}

export function normaliseReviewAnswer(value: unknown): Review | null {
  const raw = obj(value);
  return raw ? normaliseReview(raw.review ?? raw) : null;
}
