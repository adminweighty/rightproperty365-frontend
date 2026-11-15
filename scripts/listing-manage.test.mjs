// Checks the listing manager's rules: status tabs, which buttons a listing's actions become,
// the banners, and the checks on typed values. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountForInput,
  countByStatus,
  editLinkLabel,
  fieldControlId,
  isListingStatus,
  listingActionButtons,
  listingBanner,
  listingManagerHref,
  listingStatusLabel,
  listingStatusTone,
  parseAmount,
  parseWholeNumber,
  pendingChangesBadge,
  reviewReasonProblem,
  savedAtText,
  statusTabs,
  timelineText,
} from "../src/lib/listing-manage.ts";

const actionsOf = (buttons) => buttons.map((button) => button.action);

test("each status maps to the actions the API allows, in a fixed order", () => {
  // A draft: edit, submit, archive, delete.
  assert.deepEqual(actionsOf(listingActionButtons({ actions: ["delete", "archive", "submit", "edit"], ready: true })), [
    "submit",
    "archive",
    "delete",
  ]);
  // Published: archive only, unless it has changes to send.
  assert.deepEqual(actionsOf(listingActionButtons({ actions: ["edit", "archive"], ready: true })), ["archive"]);
  // Archived or expired: relist first.
  assert.deepEqual(actionsOf(listingActionButtons({ actions: ["edit", "archive", "relist"], ready: true })), ["relist", "archive"]);
  // Rejected: delete only.
  assert.deepEqual(actionsOf(listingActionButtons({ actions: ["delete"], ready: false })), ["delete"]);
  // A colleague's listing: nothing.
  assert.deepEqual(listingActionButtons({ actions: [], ready: true }), []);
});

test("submit is shown but not usable before the listing is complete", () => {
  const [submit] = listingActionButtons({ actions: ["submit"], ready: false });
  assert.equal(submit.label, "Submit for review");
  assert.match(submit.disabledReason, /Still needed/);
  const [ready] = listingActionButtons({ actions: ["submit"], ready: true });
  assert.equal(ready.disabledReason, undefined);
  const [changes] = listingActionButtons({ actions: ["submit"], ready: true, publishedWithChanges: true });
  assert.equal(changes.label, "Send changes for review");
});

test("archive, relist and delete ask first; submit does not", () => {
  const buttons = listingActionButtons({ actions: ["submit", "archive", "relist", "delete"], ready: true });
  assert.deepEqual(
    buttons.map((button) => [button.action, button.confirm]),
    [
      ["submit", false],
      ["relist", true],
      ["archive", true],
      ["delete", true],
    ],
  );
  assert.equal(buttons.find((button) => button.action === "delete").variant, "danger");
});

test("the row link edits or only shows", () => {
  assert.equal(editLinkLabel(["edit", "archive"]), "Edit");
  assert.equal(editLinkLabel(["archive"]), "View");
  assert.equal(editLinkLabel(undefined), "Edit");
});

test("statuses have words and tones, the API's label first", () => {
  assert.equal(listingStatusLabel("CHANGES_REQUESTED"), "Changes requested");
  assert.equal(listingStatusLabel("PENDING_REVIEW", "Pending review"), "Pending review");
  assert.equal(listingStatusLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(listingStatusTone("PUBLISHED"), "success");
  assert.equal(listingStatusTone("REJECTED"), "danger");
  assert.equal(listingStatusTone("CHANGES_REQUESTED"), "warning");
  assert.equal(listingStatusTone("DRAFT"), "neutral");
  assert.equal(isListingStatus("ARCHIVED"), true);
  assert.equal(isListingStatus("archived"), false);
  assert.equal(isListingStatus(null), false);
});

test("tabs count by status and always show the usual ones", () => {
  const counts = countByStatus([{ status: "DRAFT" }, { status: "DRAFT" }, { status: "PUBLISHED" }, { status: "SOLD" }]);
  assert.deepEqual(counts, { DRAFT: 2, PUBLISHED: 1, SOLD: 1 });
  const tabs = statusTabs(counts, 4);
  assert.deepEqual(
    tabs.map((tab) => [tab.status, tab.count]),
    [
      ["", 4],
      ["DRAFT", 2],
      ["CHANGES_REQUESTED", 0],
      ["PENDING_REVIEW", 0],
      ["PUBLISHED", 1],
      ["ARCHIVED", 0],
      ["SOLD", 1],
    ],
  );
  assert.equal(listingManagerHref(), "/agent/listings");
  assert.equal(listingManagerHref("DRAFT"), "/agent/listings?status=DRAFT");
  assert.equal(listingManagerHref("DRAFT", 2), "/agent/listings?status=DRAFT&page=2");
  assert.equal(listingManagerHref("", 3), "/agent/listings?page=3");
});

test("banners say where the listing stands, with the reviewer's reason", () => {
  const base = { public: false, review: { reason: null }, pending_changes: null };
  assert.equal(listingBanner({ ...base, status: "DRAFT" }), null);
  assert.equal(listingBanner({ ...base, status: "PENDING_REVIEW" }).title, "We are reviewing this listing");
  const changes = listingBanner({ ...base, status: "CHANGES_REQUESTED", review: { reason: "Add a kitchen photo." } });
  assert.equal(changes.tone, "warning");
  assert.equal(changes.reason, "Add a kitchen photo.");
  const rejected = listingBanner({ ...base, status: "REJECTED", review: { reason: "Not a real property." } });
  assert.equal(rejected.tone, "danger");
  assert.match(rejected.body, /delete it/);
  assert.equal(listingBanner({ ...base, status: "PUBLISHED", public: true }).tone, "success");
  const editing = listingBanner({ ...base, status: "PUBLISHED", public: true, pending_changes: { status: "EDITING", reason: null } });
  assert.equal(editing.title, "Your changes are not public yet");
  const asked = listingBanner({
    ...base,
    status: "PUBLISHED",
    public: true,
    pending_changes: { status: "CHANGES_REQUESTED", reason: "Fix the price." },
  });
  assert.equal(asked.reason, "Fix the price.");
});

test("a published listing's waiting changes get their own badge", () => {
  assert.equal(pendingChangesBadge(null), null);
  assert.deepEqual(pendingChangesBadge({ status: "PENDING_REVIEW", reason: null }), { text: "Changes waiting for review", tone: "info" });
  assert.equal(pendingChangesBadge({ status: "EDITING", reason: null }).text, "Changes not sent yet");
});

test("missing fields lead to their controls", () => {
  assert.equal(fieldControlId("title"), "listing-title");
  assert.equal(fieldControlId("price"), "listing-price-amount");
  assert.equal(fieldControlId("price.currency"), "listing-price-currency");
  assert.equal(fieldControlId("photos"), "listing-photos");
  assert.equal(fieldControlId("photos[2].alt"), "listing-photos");
  assert.equal(fieldControlId("max_guests"), "listing-max-guests");
  assert.equal(fieldControlId("nothing"), null);
});

test("numbers and prices are checked before they are saved", () => {
  assert.deepEqual(parseWholeNumber("", "the number of bedrooms", 0, 50), { ok: true, value: null });
  assert.deepEqual(parseWholeNumber(" 3 ", "the number of bedrooms", 0, 50), { ok: true, value: 3 });
  assert.equal(parseWholeNumber("3.5", "the number of bedrooms", 0, 50).ok, false);
  assert.match(parseWholeNumber("51", "the number of bedrooms", 0, 50).message, /at most 50/);
  assert.match(parseWholeNumber("0", "the number of guests", 1, 100).message, /at least 1/);
  assert.deepEqual(parseAmount("250,000"), { ok: true, value: "250000" });
  assert.deepEqual(parseAmount("950.50"), { ok: true, value: "950.50" });
  assert.deepEqual(parseAmount(""), { ok: true, value: null });
  assert.equal(parseAmount("12.345").ok, false);
  assert.equal(parseAmount("abc").ok, false);
  assert.equal(amountForInput("385000.00"), "385000");
  assert.equal(amountForInput("950.50"), "950.50");
  assert.equal(amountForInput(null), "");
});

test("saved time, timeline words and the reviewer's reason", () => {
  assert.equal(savedAtText(new Date(2026, 10, 15, 14, 2)), "Saved at 14:02");
  assert.equal(timelineText({ action: "SUBMITTED", review_kind: "NEW" }), "Sent for review");
  assert.equal(timelineText({ action: "APPROVED", review_kind: "EDIT" }), "Changes approved");
  assert.match(reviewReasonProblem("  "), /Write the reason/);
  assert.match(reviewReasonProblem("x".repeat(1001)), /1000 characters/);
  assert.equal(reviewReasonProblem("Please add a photo of the kitchen."), null);
});
