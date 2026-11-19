// Checks the rules of reviews of service providers (src/lib/reviews.ts, API
// 0.36.4): the star average in figures and words, the stars drawn, the
// reviewer's public name, the text checks and counter, the reply's 7-day
// edit window and countdown, the statuses and moderation actions, the
// moderation filters in the address, the JSON-LD rating and the tolerant
// readers of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateRatingJsonLd,
  basisWords,
  countdownTick,
  countdownWords,
  formatAverage,
  hasRatings,
  moderationActions,
  moderationApiQuery,
  moderationHref,
  moderationNeedsReason,
  moderationReasonProblem,
  moderationVerb,
  queueCount,
  eligibilityFor,
  notYetWords,
  normaliseEligibility,
  normaliseReview,
  normaliseReviewPage,
  normaliseSummary,
  parseModerationFilters,
  profileSummary,
  publicReviewerName,
  ratingProblem,
  ratingWords,
  replyEditWindow,
  replyProblem,
  reportReasonProblem,
  reviewApiProblems,
  reviewBody,
  reviewCountWords,
  reviewFormProblems,
  reviewStatusLabel,
  reviewStatusTone,
  reviewTextProblem,
  starFills,
  starsWords,
  textCounterWords,
  textLength,
  TEXT_MAX,
  TEXT_MIN,
} from "../src/lib/reviews.ts";

const params = (text) => new URLSearchParams(text);

test("the average in figures: one decimal, rounded half up", () => {
  assert.equal(formatAverage(4.5), "4.5");
  assert.equal(formatAverage(4), "4.0");
  assert.equal(formatAverage(4.25), "4.3");
  assert.equal(formatAverage(4.249), "4.2");
  assert.equal(formatAverage(4.666666), "4.7");
  assert.equal(formatAverage(1), "1.0");
  assert.equal(formatAverage(7), "5.0", "never above 5");
  assert.equal(formatAverage(null), null);
  assert.equal(formatAverage(Number.NaN), null);
});

test("the average in words, only with at least one review", () => {
  assert.equal(ratingWords(4.5, 12), "4.5 out of 5 from 12 reviews");
  assert.equal(ratingWords(4, 1), "4 out of 5 from 1 review");
  assert.equal(ratingWords(3.333, 3), "3.3 out of 5 from 3 reviews");
  assert.equal(ratingWords(4.5, 0), null);
  assert.equal(ratingWords(null, 3), null);
  assert.equal(reviewCountWords(1), "1 review");
  assert.equal(reviewCountWords(2), "2 reviews");
  assert.equal(starsWords(4), "4 out of 5 stars");
  assert.equal(hasRatings({ count: 0, average: null }), false);
  assert.equal(hasRatings({ count: 2, average: 4 }), true);
  assert.equal(hasRatings(null), false);
});

test("the stars drawn for an average, to the nearest half", () => {
  assert.deepEqual(starFills(4.5), ["full", "full", "full", "full", "half"]);
  assert.deepEqual(starFills(4.3), ["full", "full", "full", "full", "half"]);
  assert.deepEqual(starFills(4.2), ["full", "full", "full", "full", "empty"]);
  assert.deepEqual(starFills(5), ["full", "full", "full", "full", "full"]);
  assert.deepEqual(starFills(1), ["full", "empty", "empty", "empty", "empty"]);
  assert.deepEqual(starFills(null), ["empty", "empty", "empty", "empty", "empty"]);
});

test("aggregateRating JSON-LD only with a published review", () => {
  assert.deepEqual(aggregateRatingJsonLd({ count: 12, average: 4.46 }), {
    "@type": "AggregateRating",
    ratingValue: "4.5",
    reviewCount: 12,
    bestRating: 5,
    worstRating: 1,
  });
  assert.equal(aggregateRatingJsonLd({ count: 0, average: null }), null);
  assert.equal(aggregateRatingJsonLd(null), null);
});

test("the reviewer's public name: first name and initial, or the organisation", () => {
  assert.equal(publicReviewerName({ name: "Chipo Dube" }), "Chipo D.");
  assert.equal(publicReviewerName({ name: "  Rudo   Tendai Moyo " }), "Rudo M.");
  assert.equal(publicReviewerName({ name: "Chipo dube" }), "Chipo D.", "the initial is a capital");
  assert.equal(publicReviewerName({ name: "Madonna" }), "Madonna");
  assert.equal(publicReviewerName({ name: "Émile Ölander" }), "Émile Ö.");
  assert.equal(publicReviewerName({ organisationName: "Sample Estates", name: "Chipo Dube" }), "Sample Estates");
  assert.equal(publicReviewerName({ kind: "ORGANISATION", name: "Sample Estates" }), "Sample Estates");
  assert.equal(publicReviewerName({ publicName: "Tariro N.", name: "Tariro Ncube" }), "Tariro N.", "the API's name wins");
  assert.equal(publicReviewerName({ name: "someone@example.test" }), "A customer", "never an email address");
  assert.equal(publicReviewerName({ name: "" }), "A customer");
  assert.equal(publicReviewerName(null), "A customer");
});

test("text length: 20 to 2000 characters, trimmed, counted as people count", () => {
  assert.equal(textLength("  abc  "), 3);
  assert.equal(textLength("😀😀"), 2, "an emoji is one character");
  assert.equal(reviewTextProblem(""), "Write your review.");
  assert.equal(reviewTextProblem("   "), "Write your review.");
  assert.match(reviewTextProblem("Too short"), /at least 20 characters\. 11 more/);
  assert.equal(reviewTextProblem("x".repeat(TEXT_MIN)), null);
  assert.equal(reviewTextProblem(`  ${"x".repeat(TEXT_MIN - 1)}  `) !== null, true, "spaces around do not count");
  assert.equal(reviewTextProblem("x".repeat(TEXT_MAX)), null);
  assert.match(reviewTextProblem("x".repeat(TEXT_MAX + 3)), /at most 2000 characters\. Remove 3/);
  assert.equal(textCounterWords("x".repeat(57)), "57 of 2000 characters");
  assert.equal(textCounterWords("x".repeat(12)), "12 of 2000 characters, at least 20");
  assert.equal(textCounterWords("x".repeat(2005)), "2005 of 2000 characters: 5 too many");
});

test("the review form and its body", () => {
  assert.deepEqual(reviewFormProblems({ rating: null, text: "" }), {
    rating: "Choose a rating from 1 to 5 stars.",
    text: "Write your review.",
  });
  assert.deepEqual(reviewFormProblems({ rating: 4, text: "Quick, tidy and fairly priced work." }), {});
  assert.equal(ratingProblem(0) !== null, true);
  assert.equal(ratingProblem(6) !== null, true);
  assert.equal(ratingProblem(2.5) !== null, true);
  assert.equal(ratingProblem(5), null);
  assert.deepEqual(reviewBody("p1", { kind: "MAINTENANCE_REQUEST", id: "m1" }, { rating: 5, text: "  Great work on the kitchen tap.  " }), {
    directory_profile_id: "p1",
    basis: { kind: "MAINTENANCE_REQUEST", id: "m1" },
    rating: 5,
    text: "Great work on the kitchen tap.",
  });
  assert.deepEqual(reviewApiProblems({ rating: "Bad", text: "Short", "basis.id": "Already reviewed" }), {
    rating: "Bad",
    text: "Short",
    other: ["Already reviewed"],
  });
});

test("report reason, reply and moderation reason", () => {
  assert.equal(reportReasonProblem(" "), "Say what is wrong with this review.");
  assert.equal(reportReasonProblem("Abusive language"), null);
  assert.equal(reportReasonProblem("x".repeat(501)) !== null, true);
  assert.equal(replyProblem(""), "Write your reply.");
  assert.equal(replyProblem("Thank you"), null);
  assert.equal(moderationNeedsReason("PUBLISH"), false);
  assert.equal(moderationNeedsReason("HIDE"), true);
  assert.equal(moderationNeedsReason("REJECT"), true);
  assert.equal(moderationNeedsReason("REMOVE_REPLY"), true);
  assert.equal(moderationReasonProblem("PUBLISH", ""), null);
  assert.match(moderationReasonProblem("REJECT", ""), /reason/);
  assert.equal(moderationReasonProblem("HIDE", "Personal details"), null);
});

test("the reply's 7-day edit window", () => {
  const posted = "2026-11-10T12:00:00Z";
  const at = (iso) => Date.parse(iso);
  const open = replyEditWindow({ createdAt: posted }, at("2026-11-12T12:00:00Z"));
  assert.equal(open.open, true);
  assert.equal(open.until, "2026-11-17T12:00:00.000Z");
  assert.equal(open.remainingMs, 5 * 24 * 3600 * 1000);
  const ended = replyEditWindow({ createdAt: posted }, at("2026-11-17T12:00:00Z"));
  assert.equal(ended.open, false, "closed exactly 7 days later");
  assert.equal(ended.remainingMs, 0);
  const api = replyEditWindow({ createdAt: posted, editableUntil: "2026-11-11T00:00:00Z" }, at("2026-11-12T00:00:00Z"));
  assert.equal(api.open, false, "the API's date wins");
  assert.equal(replyEditWindow(null).open, true, "no reply yet: it can be written");
  assert.equal(replyEditWindow({ createdAt: null }).open, false, "an unknown date is not editable");
});

test("the countdown in words", () => {
  const minute = 60000;
  const hour = 60 * minute;
  const day = 24 * hour;
  assert.equal(countdownWords(6 * day + 4 * hour + 5 * minute), "6 days 4 hours left");
  assert.equal(countdownWords(1 * day), "1 day left");
  assert.equal(countdownWords(3 * hour + 12 * minute), "3 hours 12 minutes left");
  assert.equal(countdownWords(1 * hour + 1 * minute), "1 hour 1 minute left");
  assert.equal(countdownWords(12 * minute + 30000), "12 minutes left");
  assert.equal(countdownWords(30000), "less than a minute left");
  assert.equal(countdownWords(0), "The time to change it has ended");
  assert.equal(countdownTick(30000), 1000);
  assert.equal(countdownTick(2 * hour), 60000);
});

test("statuses and moderation actions", () => {
  assert.equal(reviewStatusLabel("PENDING"), "Waiting to be checked");
  assert.equal(reviewStatusLabel("PUBLISHED", "Live"), "Live", "the API's label wins");
  assert.equal(reviewStatusLabel("ON_HOLD"), "On hold");
  assert.equal(reviewStatusTone("REJECTED"), "danger");
  assert.deepEqual(moderationActions({ status: "PENDING" }), ["PUBLISH", "REJECT"]);
  assert.deepEqual(moderationActions({ status: "PUBLISHED" }), ["HIDE"]);
  assert.deepEqual(moderationActions({ status: "PUBLISHED", reportCount: 2, hasReply: true }), ["PUBLISH", "HIDE", "REMOVE_REPLY"]);
  assert.deepEqual(moderationActions({ status: "HIDDEN" }), ["PUBLISH"]);
  assert.deepEqual(moderationActions({ status: "REJECTED" }), []);
  assert.deepEqual(moderationActions({ status: "PUBLISHED" }, ["HIDE", "REMOVE_REPLY"]), ["HIDE", "REMOVE_REPLY"], "the API's list wins");
  assert.equal(moderationVerb("PUBLISH", "PUBLISHED"), "Keep published");
  assert.equal(moderationVerb("PUBLISH", "PENDING"), "Publish");
  assert.equal(moderationVerb("REMOVE_REPLY"), "Remove the reply");
});

test("moderation filters in the address and the API query", () => {
  assert.deepEqual(parseModerationFilters(params("")), { queue: "NEW", status: "", page: 1 });
  assert.deepEqual(parseModerationFilters(params("queue=reported&status=published&page=3")), { queue: "REPORTED", status: "PUBLISHED", page: 3 });
  assert.deepEqual(parseModerationFilters(params("queue=x&status=nope&page=-2")), { queue: "NEW", status: "", page: 1 });
  assert.equal(moderationHref({ queue: "NEW" }), "/admin/reviews");
  assert.equal(moderationHref({ queue: "REPORTED", status: "HIDDEN", page: 2 }), "/admin/reviews?queue=reported&status=HIDDEN&page=2");
  assert.equal(moderationApiQuery({ queue: "NEW", status: "HIDDEN", page: 1 }), "?view=queue&status=PENDING&page=1&page_size=20");
  assert.equal(moderationApiQuery({ queue: "REPORTED", status: "", page: 2 }), "?view=queue&reported=true&page=2&page_size=20");
  assert.equal(moderationApiQuery({ queue: "ALL", status: "HIDDEN", page: 1 }), "?view=all&status=HIDDEN&page=1&page_size=20");
  assert.equal(queueCount("NEW", { PENDING: 3, REPORTED: 1 }), 3);
  assert.equal(queueCount("REPORTED", { PENDING: 3, REPORTED: 1 }), 1);
  assert.equal(queueCount("ALL", { PENDING: 3 }), undefined);
});

test("bases in words", () => {
  assert.equal(basisWords({ kind: "MAINTENANCE_REQUEST", reference: "RPM-2026-900004" }), "Maintenance request RPM-2026-900004");
  assert.equal(basisWords({ kind: "BUSINESS_ENQUIRY", reference: "BE-7K3M9QXD" }), "Enquiry BE-7K3M9QXD");
  assert.equal(basisWords({ kind: "MAINTENANCE", reference: "RPM-1" }), "Maintenance request RPM-1");
  assert.equal(basisWords({ kind: "ENQUIRY", reference: null }), "Enquiry");
  assert.equal(basisWords(null), "");
});

test("tolerant readers: the public list", () => {
  assert.deepEqual(normaliseSummary({ average: "4.5", count: 12 }), { count: 12, average: 4.5 }, "the average is a decimal string");
  assert.deepEqual(normaliseSummary({ average: null, count: 0 }), { count: 0, average: null });
  assert.equal(normaliseSummary(null), null);
  assert.deepEqual(profileSummary({ name: "Sample Plumbers", rating: { average: "4.0", count: 3 } }), { count: 3, average: 4 });
  assert.equal(profileSummary({ name: "x" }), null);

  const page = normaliseReviewPage({
    profile: { kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers" },
    rating: { average: "4.5", count: 11 },
    items: [
      {
        id: "r1",
        rating: 4,
        text: "Fixed the tap quickly and left everything clean.",
        reviewer: { kind: "CUSTOMER", name: "Chipo D." },
        basis_kind: "ENQUIRY",
        published_at: "2026-11-01T10:00:00Z",
        reply: { text: "Thank you, Chipo.", replied_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-02T10:00:00Z" },
      },
      { id: "r2", rating: 5, text: "Very good.", reviewer: { kind: "CUSTOMER", name: "Former customer" } },
      { nope: true },
    ],
    total: 11,
    page: 2,
    page_size: 10,
  });
  assert.equal(page.items.length, 2);
  assert.equal(page.totalPages, 2);
  assert.deepEqual(page.summary, { count: 11, average: 4.5 });
  const [first, second] = page.items;
  assert.equal(first.reviewerName, "Chipo D.", "the API's public name");
  assert.equal(second.reviewerName, "Former customer", "kept as the API sends it");
  assert.equal(first.basis.kind, "ENQUIRY");
  assert.equal(first.reply.createdAt, "2026-11-02T10:00:00Z");
  assert.equal(normaliseReview({ id: "r9", rating: 4, reviewer_name: undefined, reviewer: { name: "Tariro Ncube" } }).reviewerName, "Tariro N.", "a bare full name is cut");
  assert.equal(normaliseReview({ id: "r2" }), null, "a review without a rating is not shown");
  assert.equal(normaliseReview({ id: "r3", rating: 9 }).rating, 5);
  assert.equal(normaliseReviewPage(null).items.length, 0);
});

test("tolerant readers: the provider's, the reviewer's and the moderators' views", () => {
  const received = normaliseReview({
    id: "r1",
    profile: { id: "p1", kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers" },
    rating: 5,
    text: "Great work.",
    reviewer: { kind: "ORGANISATION", name: "Sample Estates" },
    reply: { text: "Thanks", replied_at: "2026-11-10T12:00:00Z", updated_at: "2026-11-10T12:00:00Z" },
    reply_removed: false,
    reply_editable_until: "2026-11-17T12:00:00Z",
    can: { reply: false, edit_reply: true },
  });
  assert.equal(received.reply.editableUntil, "2026-11-17T12:00:00Z");
  assert.equal(received.can.editReply, true);
  assert.equal(received.replyRemoved, null);
  assert.equal(received.profile.id, "p1");

  const mine = normaliseReview({
    id: "r2",
    rating: 3,
    text: "Fine.",
    status: "REJECTED",
    status_label: "Not published",
    reviewer: { kind: "ORGANISATION", name: "Sample Estates" },
    author: { user_id: "u1", name: "Chipo Dube" },
    moderation: { reason: "Personal details", at: "2026-11-12T10:00:00Z" },
    basis: { kind: "MAINTENANCE", id: "m1", reference: "RPM-2026-900004" },
    can: { edit: false, delete: true },
  });
  assert.equal(mine.statusLabel, "Not published");
  assert.equal(mine.authorName, "Chipo Dube");
  assert.equal(mine.moderation.reason, "Personal details");
  assert.deepEqual(mine.basis, { kind: "MAINTENANCE", id: "m1", reference: "RPM-2026-900004" });
  assert.equal(mine.can.delete, true);
  assert.equal(mine.can.actions, null);

  const admin = normaliseReview({
    id: "r3",
    rating: 1,
    text: "Terrible.",
    status: "PUBLISHED",
    reviewer: { kind: "CUSTOMER", name: "Rudo M.", user_id: "u2", organisation_id: null, author_name: "" },
    open_reports: 2,
    reports: [{ id: "x", reason: "Spam", status: "OPEN", created_at: "2026-11-03T10:00:00Z" }, { reason: "" }],
    reply_removed: { at: "2026-11-04T10:00:00Z", reason: "Rude" },
    can: { publish: true, hide: true, reject: false, remove_reply: false },
  });
  assert.deepEqual(admin.can.actions, ["PUBLISH", "HIDE"]);
  assert.equal(admin.reportCount, 2);
  assert.equal(admin.reports.length, 1);
  assert.equal(admin.reviewerUserId, "u2");
  assert.deepEqual(admin.replyRemoved, { at: "2026-11-04T10:00:00Z", reason: "Rude" });

  const counts = normaliseReviewPage({ items: [], total: 0, page: 1, page_size: 20, counts: { pending: 3, reported: 1 } }).counts;
  assert.deepEqual(counts, { PENDING: 3, REPORTED: 1 });
});

test("tolerant readers: eligibility", () => {
  const eligibility = normaliseEligibility({
    profile: { id: "p1", kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers" },
    reviewable: true,
    eligible: true,
    bases: [
      { kind: "MAINTENANCE", id: "m1", reference: "RPM-1", label: "Maintenance request RPM-1", date: "2026-11-01T00:00:00Z" },
      { kind: "MAINTENANCE", id: "m2", reference: "RPM-2", label: "Maintenance request RPM-2", date: null },
      { kind: "X" },
    ],
    upcoming: [{ basis: { kind: "ENQUIRY", id: "e1", reference: "BE-1", label: "Enquiry BE-1" }, reason: "TOO_RECENT", eligible_from: "2026-12-01T09:00:00Z" }],
    reviewed: [{ basis: { kind: "MAINTENANCE", id: "m3", reference: "RPM-3", label: "x" }, review_id: "r1", status: "PENDING" }],
  });
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.bases.length, 2);
  assert.equal(eligibility.profile.id, "p1");
  assert.equal(eligibility.upcoming[0].eligibleFrom, "2026-12-01T09:00:00Z");
  assert.equal(eligibility.reviewed[0].reviewId, "r1");
  const one = eligibilityFor(eligibility, "m2");
  assert.deepEqual(one.bases.map((item) => item.id), ["m2"]);
  assert.equal(eligibilityFor(eligibility, "m3").eligible, false);
  assert.equal(eligibilityFor(eligibility, "m3").reviewed.length, 1);
  assert.equal(eligibilityFor(eligibility, null).bases.length, 2);
  assert.equal(normaliseEligibility({ reviewable: false, bases: [] }).eligible, false);
  assert.equal(notYetWords({ reason: "TOO_RECENT", eligibleFrom: "2026-12-01T09:00:00Z" }), "You can review the provider from 2026-12-01.");
  assert.match(notYetWords({ reason: "NOT_REPLIED", eligibleFrom: null }), /replied/);
  assert.match(notYetWords({ reason: "WHATEVER", eligibleFrom: null }), /cannot review/);
});
