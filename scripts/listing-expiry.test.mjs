// Checks the listing expiry words and states (API 0.45.0): days wording, the view for each
// state and status, null expiry, and the fallback from `expires_at`. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveExpiry,
  expiresInText,
  expiryOf,
  expiryView,
  formatExpiryDate,
} from "../src/lib/listing-expiry.ts";
import { listingActionButtons } from "../src/lib/listing-manage.ts";

const AT = "2026-12-04T09:00:00Z";
const DAY = 24 * 60 * 60 * 1000;
const expiry = (state, days_left) => ({ expires_at: AT, days_left, state, relist_no: 1 });

test("days wording", () => {
  assert.equal(expiresInText(1), "Expires tomorrow");
  assert.equal(expiresInText(6), "Expires in 6 days");
  assert.equal(expiresInText(14), "Expires in 14 days");
  assert.equal(expiresInText(0), "Expires today");
});

test("the date is day, short month and year", () => {
  assert.equal(formatExpiryDate(AT, "UTC"), "4 Dec 2026");
  assert.equal(formatExpiryDate("not a date"), "not a date");
});

test("an active published listing shows its date and no badge", () => {
  const view = expiryView("PUBLISHED", expiry("ACTIVE", 40), "UTC");
  assert.equal(view.line, "Expires 4 Dec 2026");
  assert.equal(view.badge, null);
  assert.equal(view.expired, false);
  assert.equal(view.callout, null);
});

test("an expiring listing gets the warning badge", () => {
  assert.deepEqual(expiryView("PUBLISHED", expiry("EXPIRING_SOON", 6), "UTC").badge, { text: "Expires in 6 days", tone: "warning" });
  assert.deepEqual(expiryView("PUBLISHED", expiry("EXPIRING_SOON", 1), "UTC").badge, { text: "Expires tomorrow", tone: "warning" });
});

test("an expired listing says when and has the callout", () => {
  const view = expiryView("EXPIRED", expiry("EXPIRED", 0), "UTC");
  assert.equal(view.expired, true);
  assert.equal(view.line, "Expired on 4 Dec 2026");
  assert.equal(view.badge, null);
  assert.equal(
    view.callout,
    "This listing expired on 4 Dec 2026 and is hidden from search. Relist it to send it for review; once approved it is live for another 90 days.",
  );
  // Published but past its date (read before the sweep ran): the same.
  assert.equal(expiryView("PUBLISHED", expiry("EXPIRED", 0), "UTC").expired, true);
  // Expired without an expiry object: expired, nothing to date.
  assert.deepEqual(expiryView("EXPIRED", null), { expired: true, relistInReview: false, line: null, badge: null, callout: null });
});

test("a relist waiting for review", () => {
  const view = expiryView("PENDING_REVIEW", expiry("EXPIRED", 0), "UTC");
  assert.equal(view.relistInReview, true);
  assert.deepEqual(view.badge, { text: "Relist sent for review", tone: "info" });
  assert.equal(view.line, null);
  assert.equal(view.expired, false);
});

test("null expiry and other statuses say nothing", () => {
  const none = { expired: false, relistInReview: false, line: null, badge: null, callout: null };
  assert.deepEqual(expiryView("DRAFT", null), none);
  assert.deepEqual(expiryView("PENDING_REVIEW", null), none);
  assert.deepEqual(expiryView("PUBLISHED", null), none);
  assert.deepEqual(expiryView("ARCHIVED", expiry("EXPIRED", 0)), none);
});

test("deriveExpiry rounds days up and uses the 14-day threshold", () => {
  const at = Date.parse(AT);
  assert.equal(deriveExpiry(null, at), null);
  assert.equal(deriveExpiry("nope", at), null);
  assert.deepEqual(deriveExpiry(AT, at - 6 * DAY + 1), expiry("EXPIRING_SOON", 6));
  assert.deepEqual(deriveExpiry(AT, at - 1), expiry("EXPIRING_SOON", 1));
  assert.deepEqual(deriveExpiry(AT, at - 14 * DAY), expiry("EXPIRING_SOON", 14));
  assert.deepEqual(deriveExpiry(AT, at - 14 * DAY - 1), expiry("ACTIVE", 15));
  assert.deepEqual(deriveExpiry(AT, at), expiry("EXPIRED", 0));
  assert.deepEqual(deriveExpiry(AT, at + DAY), expiry("EXPIRED", 0));
});

test("expiryOf prefers the API's value, null included", () => {
  const now = Date.parse(AT) - 3 * DAY;
  const api = expiry("ACTIVE", 99);
  assert.equal(expiryOf({ expiry: api, expires_at: AT, published_at: "2026-09-05T09:00:00Z" }, now), api);
  assert.equal(expiryOf({ expiry: null, expires_at: AT, published_at: "2026-09-05T09:00:00Z" }, now), null);
  // Older API build: worked out from expires_at, only for a published listing.
  assert.deepEqual(expiryOf({ expires_at: AT, published_at: "2026-09-05T09:00:00Z" }, now), expiry("EXPIRING_SOON", 3));
  assert.equal(expiryOf({ expires_at: AT, published_at: null }, now), null);
});

test("Relist is the first, primary button of an expired listing", () => {
  const expired = listingActionButtons({ actions: ["edit", "archive", "relist"], ready: true, expired: true });
  assert.deepEqual(expired.map((b) => [b.action, b.variant]), [["relist", "primary"], ["archive", "secondary"]]);
  const archived = listingActionButtons({ actions: ["relist"], ready: true });
  assert.deepEqual(archived.map((b) => [b.action, b.variant]), [["relist", "secondary"]]);
  assert.deepEqual(listingActionButtons({ actions: ["archive"], ready: true, expired: true }).map((b) => b.action), ["archive"]);
});
