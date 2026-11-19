import { apiFetch, type ApiFailure, type ApiResult } from "@/lib/api/http";
import {
  normaliseEligibility,
  normaliseReviewAnswer,
  normaliseReviewPage,
  type Eligibility,
  type Review,
  type ReviewPage,
} from "@/lib/reviews";

/*
 * Reviews of service providers (API 0.36.4, BR-019, FR-047). Only someone
 * with a completed, linked job or enquiry may review (the eligibility
 * endpoint decides): a CLOSED or RESOLVED maintenance request assigned to the
 * provider (the organisation reviews, under the book), or a business enquiry
 * to them that is at least 14 days old and was replied to (the customer
 * reviews, under `/v1/me`). One review per basis. Every review is checked by
 * a moderator before it is published; the reviewer may change or delete it
 * meanwhile. The provider replies once, and may change the reply for 7 days.
 * Anyone signed in may report a review. Moderation is `/v1/admin/reviews`.
 *
 * Every answer is read through a tolerant reader in `lib/reviews.ts`.
 */

const unexpected: ApiFailure = { code: "UNEXPECTED_ANSWER", status: 502, message: "Something went wrong on our side. Please try again." };

function mapped<T>(result: ApiResult<unknown>, read: (data: unknown) => T): ApiResult<T> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

function required<T>(result: ApiResult<unknown>, read: (data: unknown) => T | null): ApiResult<T> {
  if (!result.ok) return result;
  const data = read(result.data);
  return data === null ? { ok: false, failure: unexpected } : { ok: true, status: result.status, data };
}

const enc = encodeURIComponent;
const book = (orgId: string) => `/v1/agent/organisations/${enc(orgId)}`;

/** Who writes: the signed-in customer (`me`), or an organisation's book (`org`). */
export type Reviewer = { as: "me" } | { as: "org"; orgId: string };

const reviewerBase = (who: Reviewer) => (who.as === "me" ? "/v1/me/reviews" : `${book(who.orgId)}/reviews`);

// ---- Public -------------------------------------------------------------------------------------------

/** Published reviews of a profile with their replies, newest first, and the published count and average. */
export async function listProfileReviews(kind: string, slug: string, page = 1, pageSize = 10): Promise<ApiResult<ReviewPage>> {
  const search = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return mapped(await apiFetch<unknown>(`/v1/directory/${enc(kind)}/${enc(slug)}/reviews?${search}`, { cache: "no-store" }), (data) =>
    normaliseReviewPage(data, page),
  );
}

/** Anyone signed in. Answers 204 (or `{report}`); a second report of the same review by the same person is a 409. */
export const reportReview = (id: string, reason: string) => apiFetch<unknown>(`/v1/reviews/${enc(id)}/report`, { method: "POST", body: { reason } });

// ---- The reviewer's ---------------------------------------------------------------------------------

/**
 * What the caller (or the book) may review on one profile, named by its id
 * or by kind and slug: the jobs or enquiries open for a review (`bases`),
 * those not yet (`upcoming`, with the reason) and those already reviewed
 * (`reviewed`, with the caller's review id). The profile's id comes back in
 * `profile`, for `createReview`.
 */
export async function getEligibility(who: Reviewer, profile: { id?: string | null; kind?: string; slug?: string }): Promise<ApiResult<Eligibility>> {
  const search = profile.id ? new URLSearchParams({ directory_profile_id: profile.id }) : new URLSearchParams({ kind: profile.kind ?? "", slug: profile.slug ?? "" });
  return mapped(await apiFetch<unknown>(`${reviewerBase(who)}/eligibility?${search}`, { cache: "no-store" }), normaliseEligibility);
}

/** The reviews the caller (or the book) wrote, every status, newest first (never paged; at most 200). */
export async function listMyReviews(who: Reviewer): Promise<ApiResult<ReviewPage>> {
  return mapped(await apiFetch<unknown>(reviewerBase(who), { cache: "no-store" }), (data) => normaliseReviewPage(data));
}

/** One review the caller (or the book) wrote. */
export async function getMyReview(who: Reviewer, id: string): Promise<ApiResult<Review>> {
  return required(await apiFetch<unknown>(`${reviewerBase(who)}/${enc(id)}`, { cache: "no-store" }), normaliseReviewAnswer);
}

/** The body comes from `reviewBody`. Answers `201 {review}`, status PENDING. */
export async function createReview(who: Reviewer, body: Record<string, unknown>): Promise<ApiResult<Review>> {
  return required(await apiFetch<unknown>(reviewerBase(who), { method: "POST", body }), normaliseReviewAnswer);
}

/** While it waits to be checked. The body comes from `reviewEditBody`. Answers `{review}`. */
export async function updateReview(who: Reviewer, id: string, body: Record<string, unknown>): Promise<ApiResult<Review>> {
  return required(await apiFetch<unknown>(`${reviewerBase(who)}/${enc(id)}`, { method: "PATCH", body }), normaliseReviewAnswer);
}

export const deleteReview = (who: Reviewer, id: string) => apiFetch<unknown>(`${reviewerBase(who)}/${enc(id)}`, { method: "DELETE" });

// ---- The provider's -----------------------------------------------------------------------------------

/**
 * Published reviews of the organisation's own profiles with their replies,
 * newest first. `permissions.reply`: OWNER and MANAGER may reply. A
 * non-member is 404 BOOK_NOT_FOUND.
 */
export async function listReceivedReviews(orgId: string, page = 1): Promise<ApiResult<ReviewPage>> {
  const search = new URLSearchParams({ page: String(page), page_size: "20" });
  return mapped(await apiFetch<unknown>(`${book(orgId)}/reviews/received?${search}`, { cache: "no-store" }), (data) => normaliseReviewPage(data, page));
}

/**
 * The provider's one reply (`POST`, 201), or a change to it within 7 days
 * of first posting (`PATCH`; later it is 409 REVIEW_REPLY_LOCKED). Answers
 * `{review}`.
 */
export async function replyToReview(orgId: string, id: string, text: string, change = false): Promise<ApiResult<Review>> {
  return required(
    await apiFetch<unknown>(`${book(orgId)}/reviews/${enc(id)}/reply`, { method: change ? "PATCH" : "POST", body: { text: text.trim() } }),
    normaliseReviewAnswer,
  );
}

// ---- Moderation ----------------------------------------------------------------------------------------

/** `query` comes from `moderationApiQuery`. Answers the page and the queue's counters (`{pending, reported}`). */
export async function listModerationQueue(query: string): Promise<ApiResult<ReviewPage>> {
  return mapped(await apiFetch<unknown>(`/v1/admin/reviews${query}`, { cache: "no-store" }), (data) => normaliseReviewPage(data));
}

/** One review with every report and its reason. */
export async function getModeratedReview(id: string): Promise<ApiResult<Review>> {
  return required(await apiFetch<unknown>(`/v1/admin/reviews/${enc(id)}`, { cache: "no-store" }), normaliseReviewAnswer);
}

const ACTION_PATHS: Record<string, string> = { PUBLISH: "publish", HIDE: "hide", REJECT: "reject", REMOVE_REPLY: "remove-reply" };

/**
 * PUBLISH, HIDE, REJECT or REMOVE_REPLY, with the reason (required for all
 * but publishing; the reviewer is told it). Closes the review's open
 * reports. Audited. Answers `{review}` with its reports.
 */
export async function moderateReview(id: string, action: string, reason: string): Promise<ApiResult<Review>> {
  const path = ACTION_PATHS[action];
  if (!path) return { ok: false, failure: unexpected };
  const body = reason.trim() ? { reason: reason.trim() } : {};
  return required(await apiFetch<unknown>(`/v1/admin/reviews/${enc(id)}/${path}`, { method: "POST", body }), normaliseReviewAnswer);
}
