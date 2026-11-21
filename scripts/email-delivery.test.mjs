// Checks the email delivery wording (API 0.59.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alertLabel,
  clearReasonProblem,
  emailKindLabel,
  formatEmailRate,
  problemLabel,
  suppressionReasonLabel,
} from "../src/lib/email-delivery.ts";

test("rates", () => {
  assert.equal(formatEmailRate("0.0123"), "1.2%");
  assert.equal(formatEmailRate("0.2500"), "25%");
  assert.equal(formatEmailRate("0.0000"), "0%");
  assert.equal(formatEmailRate(null), "–");
});

test("problems in plain words", () => {
  assert.equal(problemLabel({ status: "PROVIDER_ACCEPTED", delivery_state: "BOUNCED", bounce_type: "Permanent", reason: null }), "Bounced (permanent)");
  assert.equal(problemLabel({ status: "PROVIDER_ACCEPTED", delivery_state: "BOUNCED", bounce_type: "Transient", reason: null }), "Bounced (temporary)");
  assert.equal(problemLabel({ status: "PROVIDER_ACCEPTED", delivery_state: "COMPLAINED", bounce_type: null, reason: null }), "Marked as spam");
  assert.equal(problemLabel({ status: "FAILED", delivery_state: null, bounce_type: null, reason: "suppressed" }), "Not sent: address suppressed");
  assert.equal(problemLabel({ status: "FAILED", delivery_state: null, bounce_type: null, reason: "http_422" }), "Refused by the provider");
});

test("labels and the clear reason", () => {
  assert.equal(alertLabel("COMPLAINT_SPIKE"), "Spam complaints spike");
  assert.equal(suppressionReasonLabel("HARD_BOUNCE"), "Address bounced permanently");
  assert.equal(emailKindLabel("saved-search-alert"), "Saved search alert");
  assert.ok(clearReasonProblem("no"));
  assert.equal(clearReasonProblem("Customer fixed their mailbox"), undefined);
  assert.ok(clearReasonProblem("x".repeat(501)));
});
