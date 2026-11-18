// Checks the saved-properties rules: the sign-in link a signed-out heart
// follows, the saved ids after a change, the failure wording and the list's
// addresses. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { signInHref } from "../src/lib/portal.ts";
import { saveFailureMessage, savedCountText, savedPageHref, withSaved } from "../src/lib/saved-listings.ts";

test("signInHref returns to the page and its query", () => {
  assert.equal(signInHref("/listings"), "/sign-in?next=%2Flistings");
  assert.equal(
    signInHref("/listings?deal=rent&city=harare&page=2"),
    "/sign-in?next=%2Flistings%3Fdeal%3Drent%26city%3Dharare%26page%3D2",
  );
  assert.equal(signInHref("/listings/3-bed-house-borrowdale"), "/sign-in?next=%2Flistings%2F3-bed-house-borrowdale");
});

test("signInHref never carries a path off the site or back to sign-in", () => {
  for (const value of [null, undefined, "", "https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/sign-in", "/register?next=/x"]) {
    assert.equal(signInHref(value), "/sign-in", String(value));
  }
});

test("withSaved adds and removes without changing the original", () => {
  const ids = new Set(["a"]);
  const added = withSaved(ids, "b", true);
  assert.deepEqual([...added].sort(), ["a", "b"]);
  assert.deepEqual([...ids], ["a"]);
  assert.deepEqual([...withSaved(added, "a", false)], ["b"]);
  // Saving twice or removing what is not there changes nothing.
  assert.deepEqual([...withSaved(ids, "a", true)], ["a"]);
  assert.deepEqual([...withSaved(ids, "z", false)], ["a"]);
});

test("saveFailureMessage names the property and the next step", () => {
  const title = "3-bedroom house in Borrowdale";
  const failure = (status, code = `HTTP_${status}`, message = "") => ({ status, code, message });
  assert.equal(
    saveFailureMessage(failure(404, "LISTING_NOT_FOUND"), { saving: true, title }),
    "3-bedroom house in Borrowdale is no longer available, so it cannot be saved.",
  );
  assert.match(saveFailureMessage(failure(401), { saving: true, title }), /Sign in again/);
  assert.match(saveFailureMessage(failure(403), { saving: false, title }), /cannot save properties/);
  assert.match(saveFailureMessage(failure(429), { saving: true, title }), /Wait a minute/);
  assert.equal(
    saveFailureMessage(failure(0, "NETWORK_ERROR"), { saving: false, title }),
    "We could not remove 3-bedroom house in Borrowdale from your saved properties. Check your connection and try again.",
  );
  assert.equal(saveFailureMessage(failure(500), { saving: true, title }), "We could not save 3-bedroom house in Borrowdale. Please try again.");
  // A 404 on removal is not "no longer available": removing is idempotent, so it is a plain failure.
  assert.match(saveFailureMessage(failure(404), { saving: false, title }), /We could not remove/);
});

test("the Saved list's count line and page addresses", () => {
  assert.equal(savedCountText({ total: 1, page: 1, total_pages: 1 }), "1 saved property, newest saved first");
  assert.equal(savedCountText({ total: 30, page: 2, total_pages: 2 }), "30 saved properties, page 2 of 2, newest saved first");
  assert.equal(savedPageHref(1), "/account/saved");
  assert.equal(savedPageHref(3), "/account/saved?page=3");
});
