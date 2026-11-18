// Checks the analytics pages' pure helpers (API 0.30.0): the period in the address, the chart's
// scale and columns, the zero days, the text summary, rates, the funnel and breakdowns. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakdown,
  checkDates,
  columnLayout,
  daysBetween,
  fillDays,
  formatRate,
  funnel,
  niceScale,
  parsePeriod,
  periodQuery,
  rate,
  seriesSummary,
  yFor,
} from "../src/lib/analytics/report.ts";

const today = "2026-11-18";

test("an unknown or missing period is 30 days", () => {
  assert.deepEqual(parsePeriod({}, today), { choice: { period: "30d" }, errors: {} });
  assert.deepEqual(parsePeriod({ period: "1y" }, today).choice, { period: "30d" });
  assert.deepEqual(parsePeriod({ period: "24h", from: "2026-01-01" }, today).choice, { period: "24h" });
});

test("chosen dates are checked", () => {
  assert.deepEqual(parsePeriod({ period: "custom", from: "2026-11-01", to: "2026-11-10" }, today), {
    choice: { period: "custom", from: "2026-11-01", to: "2026-11-10" },
    errors: {},
  });
  assert.ok(parsePeriod({ period: "custom", from: "nope" }, today).errors.from);
  assert.equal(checkDates("2026-11-10", "2026-11-01", today).from, "The first day must be on or before the last day.");
  assert.equal(checkDates("2026-11-10", "2026-11-19", today).to, "The last day cannot be after today.");
  assert.deepEqual(checkDates("2026-11-18", "2026-11-18", today), {});
});

test("the query names the period, and dates only for a custom one", () => {
  assert.equal(periodQuery({ period: "7d", from: "2026-01-01" }), "?period=7d");
  assert.equal(periodQuery({ period: "custom", from: "2026-11-01", to: "2026-11-10" }), "?period=custom&from=2026-11-01&to=2026-11-10");
  assert.equal(periodQuery({ period: "30d" }, { market: "ZW", org: undefined }), "?period=30d&market=ZW");
});

test("the axis rounds up to 1, 2 or 5 times a power of ten, in whole steps", () => {
  assert.deepEqual(niceScale(0), { max: 4, step: 1, ticks: [0, 1, 2, 3, 4] });
  assert.deepEqual(niceScale(3), { max: 3, step: 1, ticks: [0, 1, 2, 3] });
  assert.deepEqual(niceScale(7), { max: 8, step: 2, ticks: [0, 2, 4, 6, 8] });
  assert.deepEqual(niceScale(17), { max: 20, step: 5, ticks: [0, 5, 10, 15, 20] });
  assert.deepEqual(niceScale(100), { max: 100, step: 50, ticks: [0, 50, 100] });
  const big = niceScale(12_345);
  assert.ok(big.max >= 12_345 && big.max <= 15_000);
  assert.ok(big.ticks.every((tick) => Number.isInteger(tick)));
  assert.equal(big.ticks.at(-1), big.max);
});

test("columns grow from the baseline, fill their slots, and a small value is never invisible", () => {
  const bars = columnLayout([0, 1, 10], { width: 300, height: 100, max: 10, gap: 10 });
  assert.equal(bars.length, 3);
  assert.equal(bars[0].height, 0);
  assert.equal(bars[0].y, 100);
  assert.ok(bars[1].height >= 2);
  assert.equal(bars[2].height, 100);
  assert.equal(bars[2].y, 0);
  assert.equal(bars[0].width, 90);
  assert.equal(bars[1].x, 105);
  for (const bar of bars) assert.equal(bar.y + bar.height, 100);
  assert.deepEqual(columnLayout([], { width: 300, height: 100, max: 10 }), []);
  assert.deepEqual(columnLayout([1], { width: 0, height: 100, max: 10 }), []);
  // A value above the axis is clipped to the plot, never drawn outside it.
  assert.equal(columnLayout([20], { width: 10, height: 50, max: 10 })[0].height, 50);
});

test("gridlines sit at their value", () => {
  assert.equal(yFor(0, 10, 200), 200);
  assert.equal(yFor(5, 10, 200), 100);
  assert.equal(yFor(10, 10, 200), 0);
  assert.equal(yFor(3, 0, 200), 200);
});

test("days the API left out are zero days, in order, across month ends", () => {
  assert.deepEqual(daysBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(daysBetween("2026-11-02", "2026-11-01"), []);
  const filled = fillDays([{ date: "2026-11-02", views: 3 }], "2026-11-01", "2026-11-03", (date) => ({ date, views: 0 }));
  assert.deepEqual(filled, [
    { date: "2026-11-01", views: 0 },
    { date: "2026-11-02", views: 3 },
    { date: "2026-11-03", views: 0 },
  ]);
  assert.deepEqual(fillDays([{ date: "b" }, { date: "a" }], undefined, undefined, (date) => ({ date })), [{ date: "a" }, { date: "b" }]);
});

test("the summary gives the total, the days and the busiest day", () => {
  const noun = { one: "listing view", many: "listing views" };
  assert.equal(
    seriesSummary(
      [
        { date: "2026-11-01", value: 2 },
        { date: "2026-11-02", value: 1200 },
        { date: "2026-11-03", value: 0 },
      ],
      noun,
    ),
    "1,202 listing views from 1 November 2026 to 3 November 2026. Busiest day: 2 November 2026, with 1,200 listing views.",
  );
  assert.equal(seriesSummary([{ date: "2026-11-01", value: 1 }], noun), "1 listing view on 1 November 2026.");
  assert.equal(seriesSummary([{ date: "2026-11-01", value: 0 }, { date: "2026-11-02", value: 0 }], noun), "No listing views from 1 November 2026 to 2 November 2026.");
  assert.equal(seriesSummary([], noun), "No listing views in this period.");
});

test("rates need something to divide by", () => {
  assert.equal(rate(1, 0), null);
  assert.equal(formatRate(rate(1, 4)), "25%");
  assert.equal(formatRate(rate(1, 3)), "33.3%");
  assert.equal(formatRate(null), null);
  assert.equal(formatRate(Number.NaN), null);
});

test("the funnel goes from cards seen to enquiries, each step against the one before", () => {
  const steps = funnel({ impressions: 1000, views: 100, contact_clicks: 10, enquiries: 5 });
  assert.deepEqual(steps.map((step) => step.key), ["impressions", "views", "contact_clicks", "enquiries"]);
  assert.equal(steps[0].fromPrevious, null);
  assert.equal(steps[1].fromPrevious, 0.1);
  assert.equal(steps[3].fromPrevious, 0.5);
  assert.equal(steps[0].share, 1);
  assert.equal(steps[1].share, 0.1);
  const empty = funnel({ impressions: 0, views: 0, contact_clicks: 0, enquiries: 0 });
  assert.ok(empty.every((step) => step.share === 0));
  assert.equal(empty[1].fromPrevious, null);
});

test("breakdowns are labelled, largest first, with their share; empty rows are left out", () => {
  const rows = breakdown(
    [
      { key: "direct", count: 1 },
      { key: "search_engine", count: 3 },
      { key: "social", count: 0 },
      { key: "new_kind", count: 1 },
    ],
    { direct: "Direct", search_engine: "Search engines" },
  );
  assert.deepEqual(rows.map((row) => row.label), ["Search engines", "Direct", "new_kind"]);
  assert.equal(rows[0].share, 0.6);
  assert.deepEqual(breakdown([], {}), []);
});
