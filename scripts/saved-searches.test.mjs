// Saved search wording (API 0.52.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSearchName, frequencyLabel, savedSearchErrorText, searchHref } from "../src/lib/saved-searches.ts";

test("names, links and wording", () => {
  assert.equal(searchHref("deal=rent&city=harare"), "/listings?deal=rent&city=harare");
  assert.equal(searchHref("?deal=sale"), "/listings?deal=sale");
  assert.equal(searchHref(""), "/listings");
  assert.equal(defaultSearchName("  Houses   to rent in Harare "), "Houses to rent in Harare");
  assert.equal(defaultSearchName(""), "My search");
  assert.equal(defaultSearchName("x".repeat(100)).length, 80);
  assert.equal(frequencyLabel("DAILY"), "Once a day");
  assert.match(savedSearchErrorText("SAVED_SEARCH_LIMIT"), /25 saved searches/);
  assert.equal(savedSearchErrorText("OTHER"), null);
});
