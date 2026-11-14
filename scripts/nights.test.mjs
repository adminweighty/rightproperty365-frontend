// Checks the night and range arithmetic of short stays. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  addMonths,
  canCheckIn,
  canCheckOut,
  changeFieldOf,
  eachNight,
  firstTakenNight,
  formatMonth,
  formatNight,
  formatRange,
  formatStay,
  isNight,
  monthOf,
  monthWeeks,
  monthsBetween,
  nightsBetween,
  orderedRange,
  pickStayDay,
  stayEstimate,
  stayProblems,
  toRanges,
  todayIn,
  windowEnd,
} from "../src/lib/nights.ts";

test("isNight accepts real dates only", () => {
  assert.equal(isNight("2026-11-17"), true);
  assert.equal(isNight("2028-02-29"), true);
  assert.equal(isNight("2026-02-30"), false);
  assert.equal(isNight("2026-13-01"), false);
  assert.equal(isNight("17/11/2026"), false);
  assert.equal(isNight(""), false);
  assert.equal(isNight(undefined), false);
});

test("addDays and nightsBetween cross months, years and clock changes", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  // The UK puts its clocks back on 25 October 2026: still one night each.
  assert.equal(nightsBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(nightsBetween("2026-11-17", "2026-11-20"), 3);
  assert.equal(nightsBetween("2026-11-20", "2026-11-17"), -3);
  assert.deepEqual(eachNight("2026-12-30", "2027-01-01"), ["2026-12-30", "2026-12-31", "2027-01-01"]);
  assert.deepEqual(eachNight("2026-12-30", "2026-12-29"), []);
  assert.equal(windowEnd("2026-11-14"), "2027-11-14");
});

test("todayIn is the date in the listing's time zone", () => {
  // 22:30 UTC on 14 November is already the 15th in Harare (UTC+2) and Mauritius (UTC+4).
  const now = new Date("2026-11-14T22:30:00Z");
  assert.equal(todayIn("Africa/Harare", now), "2026-11-15");
  assert.equal(todayIn("Indian/Mauritius", now), "2026-11-15");
  assert.equal(todayIn("Europe/London", now), "2026-11-14");
  assert.equal(todayIn("America/Los_Angeles", now), "2026-11-14");
  assert.equal(todayIn("Not/AZone", now), "2026-11-14");
});

test("months", () => {
  assert.equal(monthOf("2026-11-17"), "2026-11");
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2027-01", -1), "2026-12");
  assert.equal(monthsBetween("2026-11", "2027-01"), 2);
  const weeks = monthWeeks("2026-11");
  // 1 November 2026 is a Sunday: the first week has six empty cells, Monday first.
  assert.deepEqual(weeks[0], [null, null, null, null, null, null, "2026-11-01"]);
  assert.equal(weeks.at(-1)[0], "2026-11-30");
  assert.equal(weeks.flat().filter(Boolean).length, 30);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(monthWeeks("2028-02").flat().filter(Boolean).length, 29);
});

test("dates in words", () => {
  assert.equal(formatNight("2026-11-17"), "17 Nov 2026");
  assert.equal(formatNight("2026-11-17", "long"), "Tuesday 17 November 2026");
  assert.equal(formatMonth("2026-11"), "November 2026");
  assert.equal(formatRange("2026-11-17", "2026-11-20"), "17–20 Nov 2026");
  assert.equal(formatRange("2026-11-28", "2026-12-02"), "28 Nov – 2 Dec 2026");
  assert.equal(formatRange("2026-12-30", "2027-01-02"), "30 Dec 2026 – 2 Jan 2027");
  assert.equal(formatRange("2026-11-17", "2026-11-17"), "17 Nov 2026");
  assert.equal(formatStay("2026-11-17", "2026-11-20"), "17–20 Nov 2026 · 3 nights");
  assert.equal(formatStay("2026-11-17", "2026-11-18"), "17–18 Nov 2026 · 1 night");
});

test("toRanges and orderedRange", () => {
  assert.deepEqual(toRanges(["2026-12-03", "2026-12-01", "2026-12-02", "2026-12-07", "2026-12-07"]), [
    { from: "2026-12-01", to: "2026-12-03" },
    { from: "2026-12-07", to: "2026-12-07" },
  ]);
  assert.deepEqual(toRanges(["2026-12-31", "2027-01-01"]), [{ from: "2026-12-31", to: "2027-01-01" }]);
  assert.deepEqual(toRanges([]), []);
  assert.deepEqual(orderedRange("2026-12-07", "2026-12-01"), { from: "2026-12-01", to: "2026-12-07" });
});

const taken = new Set(["2026-11-20", "2026-11-21"]);
const rules = {
  today: "2026-11-14",
  lastNight: "2027-11-14",
  minNights: 2,
  maxGuests: 4,
  isTaken: (night) => taken.has(night),
};

test("a stay ends on the day of leaving, which may itself be taken", () => {
  assert.equal(firstTakenNight("2026-11-17", "2026-11-20", rules.isTaken), null);
  assert.equal(firstTakenNight("2026-11-17", "2026-11-21", rules.isTaken), "2026-11-20");
  assert.equal(canCheckIn("2026-11-17", rules), true);
  assert.equal(canCheckIn("2026-11-20", rules), false);
  assert.equal(canCheckIn("2026-11-13", rules), false);
  assert.equal(canCheckIn("2027-11-15", rules), false);
  assert.equal(canCheckOut("2026-11-17", "2026-11-20", rules), true);
  assert.equal(canCheckOut("2026-11-17", "2026-11-21", rules), false);
  assert.equal(canCheckOut("2026-11-17", "2026-11-17", rules), false);
  assert.equal(canCheckOut("2026-11-22", "2027-02-20", rules), true);
  assert.equal(canCheckOut("2026-11-22", "2027-02-21", rules), false, "more than 90 nights");
  assert.equal(canCheckOut("2027-11-14", "2027-11-15", rules), true, "the last night of the window");
  assert.equal(canCheckOut("2027-11-14", "2027-11-16", rules), false);
});

test("picking days in the calendar", () => {
  const start = pickStayDay({ checkIn: null, checkOut: null }, "2026-11-17", rules);
  assert.deepEqual(start, { checkIn: "2026-11-17", checkOut: null });
  assert.deepEqual(pickStayDay(start, "2026-11-20", rules), { checkIn: "2026-11-17", checkOut: "2026-11-20" });
  // An earlier night starts again; a taken night changes nothing.
  assert.deepEqual(pickStayDay(start, "2026-11-15", rules), { checkIn: "2026-11-15", checkOut: null });
  assert.deepEqual(pickStayDay(start, "2026-11-21", rules), start);
  // With both chosen, the next pick starts again.
  assert.deepEqual(pickStayDay({ checkIn: "2026-11-17", checkOut: "2026-11-20" }, "2026-11-25", rules), {
    checkIn: "2026-11-25",
    checkOut: null,
  });
});

test("stayProblems says what to change", () => {
  assert.deepEqual(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-20", guests: 2 }, rules), {});
  assert.match(stayProblems({ checkIn: "", checkOut: "", guests: "" }, rules).check_in, /first night/);
  assert.match(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-18", guests: 2 }, rules).check_out, /2 nights/);
  assert.match(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-17", guests: 2 }, rules).check_out, /after/);
  assert.match(stayProblems({ checkIn: "2026-11-18", checkOut: "2026-11-22", guests: 2 }, rules).check_in, /20 Nov 2026 is not available/);
  assert.match(stayProblems({ checkIn: "2026-11-10", checkOut: "2026-11-13", guests: 2 }, rules).check_in, /past/);
  assert.match(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-20", guests: 5 }, rules).guests, /at most 4/);
  assert.match(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-20", guests: 0 }, rules).guests, /how many/);
  assert.equal(stayProblems({ checkIn: "2026-11-17", checkOut: "2026-11-20", guests: 9 }, { ...rules, maxGuests: null }).guests, undefined);
});

test("stayEstimate multiplies exactly", () => {
  assert.equal(stayEstimate("185.00", 3), "555.00");
  assert.equal(stayEstimate("0.10", 3), "0.30");
  assert.equal(stayEstimate("8500", 90), "765000.00");
  assert.equal(stayEstimate("19.99", 7), "139.93");
  assert.equal(stayEstimate("abc", 3), null);
  assert.equal(stayEstimate("185.00", 0), null);
});

test("changeFieldOf reads the API's field paths", () => {
  assert.deepEqual(changeFieldOf("changes[1].to"), { index: 1, field: "to" });
  assert.deepEqual(changeFieldOf("changes[0].note"), { index: 0, field: "note" });
  assert.equal(changeFieldOf("changes"), null);
  assert.equal(changeFieldOf("min_nights"), null);
});
