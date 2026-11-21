// Appointment availability helpers (API 0.51.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  channelLabel,
  dayLabel,
  firstOpenDay,
  hoursErrors,
  hoursSummary,
  leadTimeText,
  minutesText,
  nextDate,
  settingsBody,
  slotTime,
  zoneName,
} from "../src/lib/appointment-availability.ts";

test("durations and notice", () => {
  assert.equal(minutesText(30), "30 minutes");
  assert.equal(minutesText(60), "1 hour");
  assert.equal(minutesText(90), "1 hour 30 minutes");
  assert.equal(leadTimeText(0), "No notice");
  assert.equal(leadTimeText(48), "2 days");
  assert.equal(leadTimeText(168), "1 week");
  assert.equal(leadTimeText(4), "4 hours");
  assert.equal(channelLabel("VIDEO"), "Video call");
});

test("hours checks and summary", () => {
  const ranges = [
    { weekday: 1, opens: "09:00", closes: "12:00" },
    { weekday: 1, opens: "11:00", closes: "13:00" },
    { weekday: 2, opens: "10:00", closes: "09:00" },
  ];
  const errors = hoursErrors(ranges);
  assert.match(errors[0], /overlaps 11:00 to 13:00 on Monday/);
  assert.match(errors[2], /end after/);
  assert.deepEqual(hoursSummary([{ weekday: 3, opens: "14:00", closes: "16:00" }, { weekday: 3, opens: "08:00", closes: "12:00" }]), [
    "Wednesday 08:00 to 12:00, 14:00 to 16:00",
  ]);
});

test("settings body drops hours of closed days and empty notes", () => {
  const body = settingsBody({
    enabled: true,
    timezone: "Africa/Harare",
    working_hours: [{ weekday: 2, opens: "09:00", closes: "10:00" }, { weekday: 1, opens: "09:00", closes: "10:00" }],
    exceptions: [{ date: "2026-12-25", closed: true, opens: "09:00", closes: "10:00", note: " " }, { date: "2026-12-24", closed: false, opens: "09:00", closes: "12:00", note: "Half day" }],
    slot_minutes: 30, buffer_minutes: 0, lead_time_hours: 24, horizon_days: 30, max_per_day: 0, updated_at: "x",
  });
  assert.equal(body.working_hours[0].weekday, 1);
  assert.deepEqual(body.exceptions[0], { date: "2026-12-25", closed: true });
  assert.deepEqual(body.exceptions[1], { date: "2026-12-24", closed: false, opens: "09:00", closes: "12:00", note: "Half day" });
  assert.equal("updated_at" in body, false);
});

test("slots in the market's zone", () => {
  assert.equal(slotTime("2026-11-02T07:00:00Z", "Africa/Harare"), "09:00");
  assert.equal(slotTime("2026-03-29T08:00:00Z", "Europe/London"), "09:00");
  assert.equal(dayLabel("2026-11-02"), "Mon 2 Nov");
  assert.equal(nextDate("2026-12-31"), "2027-01-01");
  assert.equal(nextDate("2026-11-02", 14), "2026-11-16");
  assert.equal(zoneName("Africa/Harare", new Date("2026-11-02T07:00:00Z")), "Central Africa Time");
  assert.equal(firstOpenDay([{ date: "a", slots: [] }, { date: "b", slots: [{ start_utc: "", end_utc: "" }] }]), "b");
  assert.equal(firstOpenDay([{ date: "a", slots: [] }]), "a");
  assert.equal(firstOpenDay([]), null);
});
