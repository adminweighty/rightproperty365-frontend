// Checks the lead conversion page's pure helpers (API 0.38.0): durations and shares in words, the
// filters in the address and the API query, the funnel rows as shown, and sorting. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  checkFunnelDates,
  daysInclusive,
  formatDays,
  formatDuration,
  formatRatio,
  formatShare,
  funnelApiQuery,
  funnelRows,
  funnelSearch,
  funnelSentence,
  funnelWindow,
  parseFunnelFilters,
  sortRows,
} from "../src/lib/lead-funnel.ts";

const today = "2026-11-19";
const params = (query) => new URLSearchParams(query);
const AGENT = "0195c0de-0000-7000-8000-00000000d002";
const LISTING = "0195c0de-0000-7000-8000-000000000001";
const ORG = "0195c0de-0000-7000-8000-00000000b001";

test("durations read in minutes, hours and days", () => {
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(undefined), null);
  assert.equal(formatDuration(Number.NaN), null);
  assert.equal(formatDuration(-5), null);
  assert.equal(formatDuration(0), "Under 1 min");
  assert.equal(formatDuration(0.4), "Under 1 min");
  assert.equal(formatDuration(1), "1 min");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(59.4), "59 min");
  assert.equal(formatDuration(59.6), "1 h");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(95), "1 h 35 min");
  assert.equal(formatDuration(185.5), "3 h 6 min");
  assert.equal(formatDuration(1439), "23 h 59 min");
  assert.equal(formatDuration(1440), "1 day");
  assert.equal(formatDuration(2880), "2 days");
  assert.equal(formatDuration(3600), "2.5 days");
});

test("time to conversion in days reads the same way", () => {
  assert.equal(formatDays(null), null);
  assert.equal(formatDays(6.42), "6.4 days");
  assert.equal(formatDays(1), "1 day");
  assert.equal(formatDays(0.25), "6 h");
});

test("shares come from 4-place decimal strings, and null stays null", () => {
  assert.equal(formatShare("0.8333"), "83.3%");
  assert.equal(formatShare("1.0000"), "100%");
  assert.equal(formatShare("0.0000"), "0%");
  assert.equal(formatShare("0.5000"), "50%");
  assert.equal(formatShare("0.2083"), "20.8%");
  assert.equal(formatShare("0.0005"), "0.1%");
  assert.equal(formatShare(null), null);
  assert.equal(formatShare(undefined), null);
  assert.equal(formatShare(""), null);
  assert.equal(formatShare("n/a"), null);
  assert.equal(formatShare(0.25), "25%");
});

test("the address: defaults, presets, chosen dates and filters", () => {
  assert.deepEqual(parseFunnelFilters(params(""), today), { filters: { period: "30d" }, errors: {} });
  assert.deepEqual(parseFunnelFilters(params("period=1y"), today).filters, { period: "30d" });
  assert.deepEqual(parseFunnelFilters(params("period=90d&from=2026-01-01"), today).filters, { period: "90d" });
  const full = parseFunnelFilters(
    params(`org=${ORG}&period=custom&from=2026-11-01&to=2026-11-10&agent=${AGENT}&listing=${LISTING}&type=VIEWING_REQUEST&market=zw`),
    today,
  );
  assert.deepEqual(full, {
    filters: { period: "custom", from: "2026-11-01", to: "2026-11-10", agent: AGENT, listing: LISTING, type: "VIEWING_REQUEST", market: "ZW", org: ORG },
    errors: {},
  });
  assert.equal(parseFunnelFilters(params("org=me"), today).filters.org, "me");
});

test("values the API would refuse are dropped", () => {
  const { filters } = parseFunnelFilters(params("agent=bob&listing=12&type=SPAM&market=ZWE&org=other"), today);
  assert.deepEqual(filters, { period: "30d" });
});

test("chosen dates are checked: both, in order, not after today, at most 366 days", () => {
  assert.ok(parseFunnelFilters(params("period=custom&from=2026-02-30&to=2026-03-01"), today).errors.from);
  assert.equal(checkFunnelDates(undefined, "2026-11-01", today).from, "Enter the first day.");
  assert.equal(checkFunnelDates("2026-11-10", "2026-11-01", today).from, "The first day must be on or before the last day.");
  assert.equal(checkFunnelDates("2026-11-10", "2026-11-20", today).to, "The last day cannot be after today.");
  assert.deepEqual(checkFunnelDates("2025-11-19", "2026-11-19", today), {});
  assert.equal(checkFunnelDates("2025-11-18", "2026-11-19", today).to, "Choose at most 366 days.");
});

test("the address written back reads back to the same filters", () => {
  const cases = [
    { period: "30d" },
    { period: "7d", type: "ENQUIRY" },
    { period: "custom", from: "2026-10-01", to: "2026-10-31", agent: AGENT, listing: LISTING, market: "GB", org: ORG },
    { period: "90d", org: "me" },
  ];
  for (const filters of cases) {
    assert.deepEqual(parseFunnelFilters(params(funnelSearch(filters).slice(1)), today).filters, filters);
  }
  assert.equal(funnelSearch({ period: "30d" }), "");
  assert.equal(funnelSearch({ period: "7d", from: "2026-01-01" }), "?period=7d");
});

test("presets end today (UTC) and cover that many days", () => {
  assert.deepEqual(funnelWindow({ period: "7d" }, today), { from: "2026-11-13", to: today });
  assert.deepEqual(funnelWindow({ period: "30d" }, today), { from: "2026-10-21", to: today });
  assert.deepEqual(funnelWindow({ period: "90d" }, today), { from: "2026-08-22", to: today });
  assert.equal(funnelWindow({ period: "custom", from: "2026-11-01" }, today), null);
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysInclusive("2026-10-21", today), 30);
});

test("the API query uses the contract's names", () => {
  assert.equal(funnelApiQuery({ period: "7d" }, today), "?from=2026-11-13&to=2026-11-19");
  assert.equal(
    funnelApiQuery({ period: "custom", from: "2026-11-01", to: "2026-11-10", agent: AGENT, listing: LISTING, type: "ENQUIRY", market: "ZW", org: ORG }, today),
    `?from=2026-11-01&to=2026-11-10&agent_user_id=${AGENT}&listing_id=${LISTING}&request_type=ENQUIRY&market_code=ZW`,
  );
  assert.equal(funnelApiQuery({ period: "30d", type: "ENQUIRY" }, today, "csv"), "?from=2026-10-21&to=2026-11-19&request_type=ENQUIRY&format=csv");
  // The seller's report has no agent filter.
  assert.equal(funnelApiQuery({ period: "7d", agent: AGENT, org: "me" }, today), "?from=2026-11-13&to=2026-11-19");
  assert.equal(funnelApiQuery({ period: "custom" }, today), null);
});

const steps = [
  { step: "RECEIVED", label: "Received", reached: 24, conversion_from_previous: null, conversion_from_received: "1.0000", current: 4 },
  { step: "ASSIGNED", label: "Assigned", reached: 20, conversion_from_previous: "0.8333", conversion_from_received: "0.8333", current: 2 },
  { step: "CONTACTED", label: "Contacted", reached: 16, conversion_from_previous: "0.8000", conversion_from_received: "0.6667", current: 3 },
  { step: "VIEWING_REQUESTED", label: "Viewing requested", reached: 10, conversion_from_previous: "0.6250", conversion_from_received: "0.4167", current: 1 },
  { step: "VIEWING_SCHEDULED", label: "Viewing scheduled", reached: 8, conversion_from_previous: "0.8000", conversion_from_received: "0.3333", current: 2 },
  { step: "CONVERTED", label: "Converted", reached: 5, conversion_from_previous: "0.6250", conversion_from_received: "0.2083", current: 4 },
];

test("funnel rows: rates in words, widths against received, what was lost", () => {
  const rows = funnelRows(steps, 24);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((row) => [row.key, row.reached, row.fromPrevious, row.fromReceived, row.lost, row.current]),
    [
      ["RECEIVED", 24, null, "100%", null, 4],
      ["ASSIGNED", 20, "83.3%", "83.3%", 4, 2],
      ["CONTACTED", 16, "80%", "66.7%", 4, 3],
      ["VIEWING_REQUESTED", 10, "62.5%", "41.7%", 6, 1],
      ["VIEWING_SCHEDULED", 8, "80%", "33.3%", 2, 2],
      ["CONVERTED", 5, "62.5%", "20.8%", 3, 4],
    ],
  );
  assert.equal(rows[0].width, 1);
  assert.equal(rows[5].width, 5 / 24);
  assert.equal(rows[2].summary, "16 reached · 80% of assigned · 66.7% of received");
  assert.equal(rows[0].summary, "24 reached");
  assert.equal(funnelSentence(rows, 24), "24 requests received; 5 reached converted (20.8%).");
});

test("an empty period has zero-width bars and no rates", () => {
  const empty = steps.map((step) => ({ ...step, reached: 0, current: 0, conversion_from_previous: null, conversion_from_received: null }));
  const rows = funnelRows(empty, 0);
  assert.ok(rows.every((row) => row.width === 0 && row.fromPrevious === null && row.fromReceived === null));
  assert.equal(rows[1].summary, "0 reached");
  assert.equal(funnelSentence(rows, 0), "No requests were received in this period.");
});

test("sorting: numbers as numbers, names by name, empty values last, ties in the API's order", () => {
  const rows = [
    { name: "Bea", minutes: 95, rate: 0.3 },
    { name: "Organisation inbox", minutes: null, rate: null },
    { name: "ama", minutes: 10, rate: 0.3 },
    { name: "Chi", minutes: 400, rate: 1 },
  ];
  assert.deepEqual(sortRows(rows, (row) => row.minutes, "asc").map((row) => row.name), ["ama", "Bea", "Chi", "Organisation inbox"]);
  assert.deepEqual(sortRows(rows, (row) => row.minutes, "desc").map((row) => row.name), ["Chi", "Bea", "ama", "Organisation inbox"]);
  assert.deepEqual(sortRows(rows, (row) => row.name, "asc").map((row) => row.name), ["ama", "Bea", "Chi", "Organisation inbox"]);
  assert.deepEqual(sortRows(rows, (row) => row.rate, "desc").map((row) => row.name), ["Chi", "Bea", "ama", "Organisation inbox"]);
});

test("rates are rounded once from the counts, and the second step names received once", () => {
  assert.equal(formatRatio(4, 21), "19%"); // 19.05% rounds to 19.0%, not 19.1% (0.1905 rounded again)
  assert.equal(formatRatio(1, 3), "33.3%");
  assert.equal(formatRatio(0, 5), "0%");
  assert.equal(formatRatio(3, 0), null);
  const rows = funnelRows(
    steps.map((step, i) => ({ ...step, reached: [21, 19, 14, 8, 7, 4][i], conversion_from_received: ["1.0000", "0.9048", "0.6667", "0.3810", "0.3333", "0.1905"][i] })),
    21,
  );
  assert.equal(rows[5].fromReceived, "19%");
  assert.equal(rows[1].summary, "19 reached · 90.5% of received");
  assert.equal(funnelSentence(rows, 21), "21 requests received; 4 reached converted (19%).");
});
