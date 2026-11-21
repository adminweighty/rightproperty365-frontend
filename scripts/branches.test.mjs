// Checks the plain words for the branch answers (API 0.57.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { STALE_CODES, teamMessage } from "../src/lib/team-messages.ts";

test("branch codes have plain words", () => {
  for (const code of ["BRANCH_NAME_TAKEN", "BRANCH_NOT_FOUND", "BRANCH_LIMIT", "BRANCH_FORBIDDEN"]) {
    const text = teamMessage({ code, message: "api words" });
    assert.notEqual(text, "api words", code);
    assert.match(text, /branch/i);
  }
});

test("a missing branch reloads the list", () => {
  assert.ok(STALE_CODES.has("BRANCH_NOT_FOUND"));
  assert.ok(!STALE_CODES.has("BRANCH_NAME_TAKEN"));
});
