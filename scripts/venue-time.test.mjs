// Checks the time-zone helpers and the slot and duration choices of venues let by the hour. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clockOf,
  dateText,
  durationChoices,
  durationText,
  durationsFrom,
  localDateOf,
  normaliseAvailability,
  offsetMinutes,
  openDates,
  readInstant,
  rulesOf,
  spanText,
  startChoices,
  startTimes,
  venueSpanText,
  visitorTimeNote,
  wallToUtc,
} from "../src/lib/venue-time.ts";

const H = 3_600_000;
const M = 60_000;
const utc = (iso) => Date.parse(iso);

test("wallToUtc reads a wall clock in the venue's zone", () => {
  assert.equal(wallToUtc("2026-11-20", "10:00", "Africa/Harare"), utc("2026-11-20T08:00:00Z"));
  assert.equal(wallToUtc("2026-07-01", "10:00", "Europe/London"), utc("2026-07-01T09:00:00Z"));
  assert.equal(wallToUtc("2026-12-01", "10:00", "Europe/London"), utc("2026-12-01T10:00:00Z"));
  assert.equal(wallToUtc("2026-11-20", "24:00", "Africa/Harare"), utc("2026-11-20T22:00:00Z"));
  assert.equal(wallToUtc("2026-02-30", "10:00", "Africa/Harare"), wallToUtc("2026-03-02", "10:00", "Africa/Harare"));
  assert.equal(wallToUtc("not a date", "10:00", "UTC"), null);
  assert.equal(wallToUtc("2026-11-20", "25:00", "UTC"), null);
});

test("wallToUtc on the days the clocks change in London", () => {
  // 29 March 2026: 01:00 GMT becomes 02:00 BST; 01:30 does not exist and lands after the gap.
  assert.equal(wallToUtc("2026-03-29", "00:30", "Europe/London"), utc("2026-03-29T00:30:00Z"));
  assert.equal(wallToUtc("2026-03-29", "01:30", "Europe/London"), utc("2026-03-29T01:30:00Z"));
  assert.equal(clockOf(utc("2026-03-29T01:30:00Z"), "Europe/London"), "02:30");
  assert.equal(wallToUtc("2026-03-29", "03:00", "Europe/London"), utc("2026-03-29T02:00:00Z"));
  // 25 October 2026: 02:00 BST becomes 01:00 GMT; 01:30 happens twice and is the first.
  assert.equal(wallToUtc("2026-10-25", "01:30", "Europe/London"), utc("2026-10-25T00:30:00Z"));
  assert.equal(wallToUtc("2026-10-25", "03:00", "Europe/London"), utc("2026-10-25T03:00:00Z"));
  assert.equal(offsetMinutes(utc("2026-10-25T00:30:00Z"), "Europe/London"), 60);
  assert.equal(offsetMinutes(utc("2026-10-25T01:30:00Z"), "Europe/London"), 0);
});

test("readInstant takes instants, local date-times and clock times", () => {
  assert.equal(readInstant("2026-11-20T08:00:00Z", "Africa/Harare"), utc("2026-11-20T08:00:00Z"));
  assert.equal(readInstant("2026-11-20T10:00:00+02:00", "Europe/London"), utc("2026-11-20T08:00:00Z"));
  assert.equal(readInstant("2026-11-20T10:00", "Africa/Harare"), utc("2026-11-20T08:00:00Z"));
  assert.equal(readInstant("10:00", "Africa/Harare", "2026-11-20"), utc("2026-11-20T08:00:00Z"));
  assert.equal(readInstant("10:00", "Africa/Harare"), null);
  assert.equal(readInstant("", "UTC"), null);
});

test("words for durations, days and spans", () => {
  assert.equal(durationText(30), "30 min");
  assert.equal(durationText(120), "2 h");
  assert.equal(durationText(150), "2 h 30 min");
  assert.equal(dateText("2026-11-20"), "Friday 20 November 2026");
  const start = utc("2026-11-20T08:00:00Z");
  assert.equal(spanText(start, start + 2 * H, "Africa/Harare"), "Friday 20 November 2026, 10:00 to 12:00");
  assert.equal(venueSpanText(start, start + 2 * H, "Africa/Harare"), "Friday 20 November 2026, 10:00 to 12:00 (Africa/Harare time)");
  assert.equal(spanText(utc("2026-11-20T18:00:00Z"), utc("2026-11-20T22:00:00Z"), "Africa/Harare"), "Friday 20 November 2026, 20:00 to 24:00");
  assert.equal(
    spanText(utc("2026-11-20T20:00:00Z"), utc("2026-11-20T23:00:00Z"), "Africa/Harare"),
    "Friday 20 November 2026, 22:00 to Saturday 21 November 2026, 01:00",
  );
  assert.equal(localDateOf(utc("2026-11-20T23:00:00Z"), "Africa/Harare"), "2026-11-21");
});

test("the visitor's own time is noted only when their clock reads differently", () => {
  const start = utc("2026-11-20T08:00:00Z");
  assert.equal(visitorTimeNote(start, start + 2 * H, "Africa/Harare", "Africa/Harare"), null);
  // Johannesburg keeps the same clock as Harare.
  assert.equal(visitorTimeNote(start, start + 2 * H, "Africa/Harare", "Africa/Johannesburg"), null);
  assert.equal(visitorTimeNote(start, start + 2 * H, "Africa/Harare", "Europe/London"), "08:00 to 10:00 your time (Europe/London)");
  assert.equal(visitorTimeNote(start, start + 2 * H, "Africa/Harare", null), null);
  // Late in Harare is another day in Los Angeles.
  assert.match(visitorTimeNote(utc("2026-11-20T06:00:00Z"), utc("2026-11-20T08:00:00Z"), "Africa/Harare", "America/Los_Angeles"), /^Thursday 19 November 2026, 22:00 to 24:00 your time/);
});

test("the visitor note follows a DST change: London is 2 h behind Harare in March, 1 h after the change", () => {
  const before = utc("2026-03-28T08:00:00Z");
  const after = utc("2026-03-30T08:00:00Z");
  assert.equal(visitorTimeNote(before, before + H, "Africa/Harare", "Europe/London"), "08:00 to 09:00 your time (Europe/London)");
  assert.equal(visitorTimeNote(after, after + H, "Africa/Harare", "Europe/London"), "09:00 to 10:00 your time (Europe/London)");
});

const raw = {
  time_zone: "Africa/Harare",
  increment_minutes: 30,
  days: [
    {
      date: "2026-11-20",
      open_ranges: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
      // 10:00 to 11:00 is taken; with its 30-minute buffer the API sends 10:00 to 11:30.
      booked: [{ start: "10:00", end: "11:30" }],
    },
    { date: "2026-11-22", open_ranges: [], booked: [] },
    { date: "2026-11-21", open_ranges: [{ start_utc: "2026-11-21T06:00:00Z", end_utc: "2026-11-21T08:00:00Z", start: "08:00", end: "10:00" }], booked: [] },
  ],
};

test("normaliseAvailability reads ranges, sorts days and keeps the zone", () => {
  const availability = normaliseAvailability(raw);
  assert.equal(availability.timeZone, "Africa/Harare");
  assert.equal(availability.incrementMinutes, 30);
  assert.deepEqual(availability.days.map((day) => day.date), ["2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.deepEqual(availability.days[0].open[0], { start: utc("2026-11-20T06:00:00Z"), end: utc("2026-11-20T10:00:00Z") });
  assert.deepEqual(availability.days[1].open[0], { start: utc("2026-11-21T06:00:00Z"), end: utc("2026-11-21T08:00:00Z") });
  assert.equal(availability.minMinutes, null);
  assert.equal(normaliseAvailability({ days: [] }), null);
  assert.equal(normaliseAvailability({ time_zone: "Not/AZone", days: [] }), null);
  assert.equal(normaliseAvailability({ availability: raw }).days.length, 3);
});

test("start times skip what is taken and what cannot fit the shortest booking", () => {
  const availability = normaliseAvailability(raw);
  const rules = { incrementMinutes: 30, minMinutes: 60, maxMinutes: 240 };
  const labels = startChoices(availability.days[0], rules, "Africa/Harare").map((choice) => choice.label);
  // 09:30 would run into the booking at 10:00; 11:30 is the first free start after it; 11:30 + 1 h ends at 12:30, past closing.
  assert.deepEqual(labels, ["08:00", "08:30", "09:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]);
  // Values are UTC instants.
  assert.equal(startChoices(availability.days[0], rules, "Africa/Harare")[0].value, "2026-11-20T06:00:00.000Z");
});

test("the cleaning buffer after a new booking must not run into the next one", () => {
  const availability = normaliseAvailability(raw);
  const rules = { incrementMinutes: 30, minMinutes: 60, maxMinutes: 240, bufferMinutes: 30 };
  const labels = startChoices(availability.days[0], rules, "Africa/Harare").map((choice) => choice.label);
  assert.deepEqual(labels.slice(0, 3), ["08:00", "08:30", "13:00"]);
  const nine = wallToUtc("2026-11-20", "08:00", "Africa/Harare");
  assert.deepEqual(durationsFrom(availability.days[0], nine, rules), [60, 90]);
});

test("capacity above one lets a start overlap fewer bookings than it holds", () => {
  const availability = normaliseAvailability(raw);
  const rules = { incrementMinutes: 30, minMinutes: 60, maxMinutes: 240, capacity: 2 };
  assert.ok(startChoices(availability.days[0], rules, "Africa/Harare").some((choice) => choice.label === "10:00"));
});

test("the earliest start (lead time) removes earlier starts", () => {
  const availability = normaliseAvailability(raw);
  const rules = { incrementMinutes: 30, minMinutes: 60, maxMinutes: 240, earliestStart: utc("2026-11-20T11:15:00Z") };
  assert.equal(startChoices(availability.days[0], rules, "Africa/Harare")[0].label, "13:30");
});

test("durations run from the shortest to the longest that fits and is free", () => {
  const availability = normaliseAvailability(raw);
  const rules = { incrementMinutes: 30, minMinutes: 60, maxMinutes: 240 };
  const eight = wallToUtc("2026-11-20", "08:00", "Africa/Harare");
  assert.deepEqual(durationsFrom(availability.days[0], eight, rules), [60, 90, 120]);
  const one = wallToUtc("2026-11-20", "13:00", "Africa/Harare");
  assert.deepEqual(durationsFrom(availability.days[0], one, rules), [60, 90, 120, 150, 180, 210, 240]);
  assert.deepEqual(
    durationChoices(availability.days[0], eight, rules, "Africa/Harare").map((choice) => choice.label),
    ["1 h, until 09:00", "1 h 30 min, until 09:30", "2 h, until 10:00"],
  );
  // Not a start inside an open range.
  assert.deepEqual(durationsFrom(availability.days[0], wallToUtc("2026-11-20", "12:30", "Africa/Harare"), rules), []);
});

test("open dates are the days with a start; rulesOf fills in what the answer leaves out", () => {
  const availability = normaliseAvailability(raw);
  const rules = rulesOf(availability);
  assert.equal(rules.minMinutes, 30);
  assert.equal(rules.maxMinutes, 1440);
  assert.deepEqual(openDates(availability.days, rules), ["2026-11-20", "2026-11-21"]);
  const later = rulesOf({ ...availability, minMinutes: 120, maxMinutes: 480 }, utc("2026-11-21T07:00:00Z"));
  assert.deepEqual(openDates(availability.days, later), []);
});

test("a day when the clocks go forward has one hour less, and no start in the gap", () => {
  const availability = normaliseAvailability({
    time_zone: "Europe/London",
    increment_minutes: 60,
    days: [{ date: "2026-03-29", open_ranges: [{ start: "00:00", end: "04:00" }], booked: [] }],
  });
  const day = availability.days[0];
  // 00:00 GMT to 04:00 BST is three real hours.
  assert.equal(day.open[0].end - day.open[0].start, 3 * H);
  const rules = { incrementMinutes: 60, minMinutes: 60, maxMinutes: 240 };
  assert.deepEqual(startChoices(day, rules, "Europe/London").map((choice) => choice.label), ["00:00", "02:00", "03:00"]);
  assert.deepEqual(durationsFrom(day, day.open[0].start, rules), [60, 120, 180]);
  assert.equal(durationChoices(day, day.open[0].start, rules, "Europe/London").at(-1).label, "3 h, until 04:00");
});

test("a day when the clocks go back has one hour more", () => {
  const availability = normaliseAvailability({
    time_zone: "Europe/London",
    increment_minutes: 60,
    days: [{ date: "2026-10-25", open_ranges: [{ start: "00:00", end: "04:00" }], booked: [] }],
  });
  const day = availability.days[0];
  assert.equal(day.open[0].end - day.open[0].start, 5 * H);
  const labels = startChoices(day, { incrementMinutes: 60, minMinutes: 60, maxMinutes: 300 }, "Europe/London").map((choice) => choice.label);
  // 01:00 happens twice: the choices say which.
  assert.deepEqual(labels, ["00:00", "01:00 (UTC+01:00)", "01:00 (UTC+00:00)", "02:00", "03:00"]);
  assert.equal(durationsFrom(day, day.open[0].start, { incrementMinutes: 60, minMinutes: 60, maxMinutes: 600 }).at(-1), 300);
  assert.equal(durationChoices(day, day.open[0].start, { incrementMinutes: 60, minMinutes: 30 * 2, maxMinutes: 120 }, "Europe/London").at(-1).label, `2 h, until ${clockOf(day.open[0].start + 120 * M, "Europe/London")}`);
});

test("the API's binding shape: instants with local times beside them, rules at the root", () => {
  const availability = normaliseAvailability({
    listing_id: "l1",
    time_zone: "Africa/Harare",
    currency: "USD",
    rate_per_hour: "50.00",
    deposit: "100.00",
    increment_minutes: 30,
    min_minutes: 120,
    max_minutes: 480,
    cleaning_buffer_minutes: 30,
    capacity: 1,
    lead_time_hours: 24,
    horizon_days: 90,
    bookable_from: "2026-12-05T07:00:00Z",
    bookable_until: "2027-03-05T00:00:00Z",
    cancellation_policy: "Free until 48 hours before.",
    free_cancellation_hours: 48,
    mode: "ENQUIRY",
    notice: "This is an estimate.",
    days: [
      {
        date: "2026-12-05",
        weekday: 6,
        closed: false,
        note: null,
        open_ranges: [{ start: "2026-12-05T07:00:00Z", end: "2026-12-05T16:00:00Z", local_start: "2026-12-05T09:00:00+02:00", local_end: "2026-12-05T18:00:00+02:00" }],
        booked: [{ start: "2026-12-05T10:00:00Z", end: "2026-12-05T12:30:00Z", local_start: "2026-12-05T12:00:00+02:00", local_end: "2026-12-05T14:30:00+02:00" }],
      },
      { date: "2026-12-06", weekday: 7, closed: true, note: "Closed on Sundays", open_ranges: [], booked: [] },
    ],
  });
  assert.equal(availability.minMinutes, 120);
  assert.equal(availability.ratePerHour, "50.00");
  assert.equal(availability.freeCancellationHours, 48);
  assert.equal(availability.earliestStart, utc("2026-12-05T07:00:00Z"));
  assert.equal(availability.days[1].note, "Closed on Sundays");
  const rules = rulesOf(availability);
  // The booked range already holds the buffers: free means inside an open range and touching no booked one.
  assert.equal(rules.bufferMinutes, 0);
  const labels = startChoices(availability.days[0], rules, availability.timeZone).map((choice) => choice.label);
  assert.deepEqual(labels, ["09:00", "09:30", "10:00", "14:30", "15:00", "15:30", "16:00"]);
  assert.equal(startTimes(availability.days[0], rules).length, labels.length);
  assert.deepEqual(durationsFrom(availability.days[0], utc("2026-12-05T07:00:00Z"), rules), [120, 150, 180]);
  assert.deepEqual(openDates(availability.days, rules), ["2026-12-05"]);
});
