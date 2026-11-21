// Account security wording (API 0.50.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deviceLine, revokedText, securityErrorText } from "../src/lib/account-security.ts";

test("device lines", () => {
  const f = (iso) => `[${iso}]`;
  assert.equal(deviceLine({ created_at: "a", last_seen_at: "b", current: true }, f), "This device · signed in [a]");
  assert.equal(deviceLine({ created_at: "a", last_seen_at: "b", current: false }, f), "Signed in [a] · last used [b]");
});

test("sign out everywhere else", () => {
  assert.equal(revokedText(0), "No other device was signed in.");
  assert.equal(revokedText(1), "1 other device was signed out.");
  assert.equal(revokedText(3), "3 other devices were signed out.");
});

test("errors", () => {
  assert.match(securityErrorText("INVALID_TOKEN"), /not valid any more/);
  assert.match(securityErrorText("PLATFORM_ACCOUNT"), /operator tool/);
  assert.equal(securityErrorText("OTHER"), null);
});
