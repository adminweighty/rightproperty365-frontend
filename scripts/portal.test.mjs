// Checks where people land after sign-in, the dashboard's links, the sign-in
// code checks and the request-list filters. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { counterHref, landingPath, safeNextPath, targetHref, TARGET_PATHS } from "../src/lib/portal.ts";
import {
  cleanCode,
  codeProblem,
  formatCountdown,
  hasExpired,
  isSignInChallenge,
  secondsLeft,
} from "../src/lib/sign-in-code.ts";
import {
  isDay,
  nextDay,
  pageFrom,
  parseRequestFilters,
  parseStatusFilter,
  requestFiltersApiQuery,
  requestFiltersSearch,
  statusFilterSearch,
} from "../src/lib/request-filters.ts";

const params = (query) => new URLSearchParams(query);

test("safeNextPath keeps paths on this site", () => {
  assert.equal(safeNextPath("/agent/requests"), "/agent/requests");
  assert.equal(safeNextPath("/agent/requests?stage=CLOSED#top"), "/agent/requests?stage=CLOSED#top");
  assert.equal(safeNextPath("/account/requests/abc"), "/account/requests/abc");
});

test("safeNextPath refuses anything that could leave the site", () => {
  for (const value of [
    null,
    undefined,
    "",
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\tevil",
    "/\nevil",
    "javascript:alert(1)",
    "agent/requests",
    `/${"a".repeat(2001)}`,
  ]) {
    assert.equal(safeNextPath(value), null, String(value));
  }
});

test("safeNextPath does not send people back to the sign-in pages", () => {
  assert.equal(safeNextPath("/sign-in"), null);
  assert.equal(safeNextPath("/sign-in?next=/x"), null);
  assert.equal(safeNextPath("/admin/sign-in"), null);
  assert.equal(safeNextPath("/register"), null);
  assert.equal(safeNextPath("/sign-in-help"), "/sign-in-help", "only the page itself and below it");
});

test("landingPath picks next, else the home of the session", () => {
  assert.equal(landingPath("customer", null), "/dashboard");
  assert.equal(landingPath("customer", "//evil.example"), "/dashboard");
  assert.equal(landingPath("customer", "/agent/requests"), "/agent/requests");
  assert.equal(landingPath("admin", null), "/admin");
  assert.equal(landingPath("admin", "/admin/verifications?status=SUBMITTED"), "/admin/verifications?status=SUBMITTED");
  assert.equal(landingPath("admin", "/agent/requests"), "/admin", "an admin session only goes to /admin pages");
  assert.equal(landingPath("admin", "/administrator"), "/admin");
});

test("every dashboard target has a page, and unknown ones have none", () => {
  for (const [target, path] of Object.entries(TARGET_PATHS)) {
    assert.equal(targetHref(target), path);
    assert.ok(path.startsWith("/"), target);
  }
  assert.equal(targetHref("search"), "/listings");
  assert.equal(targetHref("team"), "/agent/team");
  assert.equal(targetHref(null), null);
  assert.equal(targetHref("billing"), null);
  assert.equal(targetHref("constructor"), null, "not an inherited property");
});

test("counters for one stage or status open the filtered list", () => {
  assert.equal(
    counterHref({ key: "requests.stage.FOLLOW_UP_REQUIRED", target: "requests" }),
    "/agent/requests?stage=FOLLOW_UP_REQUIRED",
  );
  assert.equal(counterHref({ key: "requests.new", target: "requests" }), "/agent/requests?stage=NEW_ENQUIRY");
  assert.equal(counterHref({ key: "requests.open", target: "requests" }), "/agent/requests");
  assert.equal(counterHref({ key: "my_requests.status.RESPONDED", target: "my_requests" }), "/account/requests?status=RESPONDED");
  assert.equal(counterHref({ key: "requests.stage.NOT_A_STAGE", target: "requests" }), "/agent/requests");
  assert.equal(counterHref({ key: "listings.total", target: "listings" }), "/agent/listings");
  assert.equal(counterHref({ key: "listings.total", target: null }), null);
});

test("a code challenge is told apart from a session", () => {
  assert.equal(
    isSignInChallenge({ status: "CODE_REQUIRED", challenge_id: "c1", sent_to: "u•••@x.com", expires_at: "", code_length: 6 }),
    true,
  );
  assert.equal(isSignInChallenge({ user: {}, session: { scope: "customer" } }), false);
  assert.equal(isSignInChallenge({ status: "CODE_REQUIRED" }), false);
  assert.equal(isSignInChallenge(null), false);
});

test("codes of 4 to 6 digits can be sent", () => {
  assert.equal(codeProblem("1234"), undefined, "the demo code on the test site");
  assert.equal(codeProblem("123456"), undefined);
  assert.equal(codeProblem(" 123 456 "), undefined, "spaces are ignored");
  assert.equal(codeProblem("123-456"), undefined, "a dash is ignored");
  assert.equal(cleanCode(" 12 34-56 "), "123456");
  assert.match(codeProblem(""), /Enter the code/);
  assert.match(codeProblem("   "), /Enter the code/);
  assert.match(codeProblem("12a4"), /numbers only/);
  assert.match(codeProblem("123"), /too short/);
  assert.match(codeProblem("1234567"), /too long/);
});

test("countdown and expiry", () => {
  assert.equal(secondsLeft(10_500, 0), 11);
  assert.equal(secondsLeft(0, 5_000), 0);
  assert.equal(formatCountdown(27), "0:27");
  assert.equal(formatCountdown(65), "1:05");
  assert.equal(formatCountdown(-3), "0:00");
  assert.equal(hasExpired("2026-11-15T10:00:00Z", Date.parse("2026-11-15T10:00:01Z")), true);
  assert.equal(hasExpired("2026-11-15T10:00:00Z", Date.parse("2026-11-15T09:59:00Z")), false);
  assert.equal(hasExpired("not a date", 0), false);
});

test("calendar days", () => {
  assert.equal(isDay("2026-02-28"), true);
  assert.equal(isDay("2026-02-30"), false);
  assert.equal(isDay("2026-2-3"), false);
  assert.equal(nextDay("2026-11-30"), "2026-12-01");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  assert.equal(pageFrom("3"), 3);
  assert.equal(pageFrom("0"), 1);
  assert.equal(pageFrom("2.5"), 1);
  assert.equal(pageFrom(null), 1);
});

test("request filters are read from the address and written back", () => {
  const filters = parseRequestFilters(params("stage=CONTACTED&type=VIEWING_REQUEST&from=2026-11-01&to=2026-11-30&q=+Moyo+&page=2"));
  assert.deepEqual(filters, { stage: "CONTACTED", type: "VIEWING_REQUEST", from: "2026-11-01", to: "2026-11-30", q: "Moyo", page: 2 });
  assert.equal(requestFiltersSearch(filters), "?stage=CONTACTED&type=VIEWING_REQUEST&from=2026-11-01&to=2026-11-30&q=Moyo&page=2");
  assert.equal(requestFiltersSearch({ page: 1 }), "");
});

test("filters the API would refuse are dropped", () => {
  assert.deepEqual(parseRequestFilters(params("stage=WON&type=SPAM&from=yesterday&page=-1")), { page: 1 });
  assert.deepEqual(parseRequestFilters(params("from=2026-11-30&to=2026-11-01")), { from: "2026-11-30", page: 1 }, "to before from");
  assert.equal(parseRequestFilters(params(`q=${"a".repeat(150)}`)).q.length, 100);
});

test("the API query includes the whole last day", () => {
  const query = new URLSearchParams(requestFiltersApiQuery({ from: "2026-11-01", to: "2026-11-01", page: 1 }).slice(1));
  const from = Date.parse(query.get("from"));
  const to = Date.parse(query.get("to"));
  assert.ok(Number.isFinite(from) && Number.isFinite(to));
  assert.ok(to - from >= 23 * 3600_000 && to - from <= 25 * 3600_000, "one calendar day");
  assert.equal(query.get("page"), "1");
  assert.equal(query.get("page_size"), "20");
});

test("the customer's status filter", () => {
  assert.deepEqual(parseStatusFilter(params("status=RESPONDED&page=2")), { status: "RESPONDED", page: 2 });
  assert.deepEqual(parseStatusFilter(params("status=CONTACTED")), { page: 1 }, "a lead stage is not a customer status");
  assert.equal(statusFilterSearch({ status: "CLOSED", page: 1 }), "?status=CLOSED");
  assert.equal(statusFilterSearch({ page: 3 }), "?page=3");
});
