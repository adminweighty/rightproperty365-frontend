// Checks the "Add to calendar" routes and when the link is shown (API 0.39.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_NOTE, calendarFileName, calendarPath, showCalendarLink } from "../src/lib/calendar.ts";

test("each list downloads through the route that mirrors its JSON read", () => {
  assert.equal(calendarPath({ kind: "my-appointment", id: "a1" }), "/v1/me/appointments/a1/calendar.ics");
  assert.equal(calendarPath({ kind: "inbox-appointment", id: "a1" }), "/v1/inbox/appointments/a1/calendar.ics");
  assert.equal(calendarPath({ kind: "my-venue-booking", id: "b1" }), "/v1/me/venue-bookings/b1/calendar.ics");
  assert.equal(calendarPath({ kind: "hosted-venue-booking", scope: { kind: "owner" }, id: "b1" }), "/v1/me/hosted-venue-bookings/b1/calendar.ics");
  assert.equal(
    calendarPath({ kind: "hosted-venue-booking", scope: { kind: "organisation", orgId: "o1" }, id: "b1" }),
    "/v1/agent/organisations/o1/venue-bookings/b1/calendar.ics",
  );
});

test("ids are escaped, never able to change the path", () => {
  assert.equal(calendarPath({ kind: "my-appointment", id: "../x?y" }), "/v1/me/appointments/..%2Fx%3Fy/calendar.ics");
  assert.equal(
    calendarPath({ kind: "hosted-venue-booking", scope: { kind: "organisation", orgId: "o/1" }, id: "b#1" }),
    "/v1/agent/organisations/o%2F1/venue-bookings/b%231/calendar.ics",
  );
});

const now = Date.parse("2026-11-19T10:00:00Z");
const slot = { start: "2026-11-25T08:00:00Z", end: "2026-11-25T09:00:00Z" };

test("shown for a confirmed time still to come", () => {
  assert.equal(showCalendarLink({ status: "CONFIRMED", ...slot }, now), true);
  assert.equal(showCalendarLink({ status: "confirmed", ...slot }, now), true);
});

test("shown while a confirmed time is under way, hidden once it has ended", () => {
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: "2026-11-19T09:30:00Z", end: "2026-11-19T10:30:00Z" }, now), true);
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: "2026-11-19T08:00:00Z", end: "2026-11-19T10:00:00Z" }, now), false);
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: "2026-11-18T08:00:00Z", end: "2026-11-18T09:00:00Z" }, now), false);
});

test("hidden for any status other than confirmed", () => {
  for (const status of ["REQUESTED", "RESCHEDULE_REQUESTED", "DECLINED", "CANCELLED", "COMPLETED", "NO_SHOW", ""]) {
    assert.equal(showCalendarLink({ status, ...slot }, now), false, status);
  }
});

test("hidden when the time cannot be read; the start decides when the end is missing", () => {
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: null, end: slot.end }, now), false);
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: "not a date", end: slot.end }, now), false);
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: slot.start, end: null }, now), true);
  assert.equal(showCalendarLink({ status: "CONFIRMED", start: "2026-11-18T08:00:00Z", end: null }, now), false);
});

test("a fallback file name like the API's", () => {
  assert.equal(calendarFileName("appointment", "RPA-123"), "appointment-RPA-123.ics");
  assert.equal(calendarFileName("venue-booking", " RPV 9/1 "), "venue-booking-RPV-9-1.ics");
  assert.equal(calendarFileName("appointment", ""), "appointment.ics");
});

test("the note names the apps and the update email", () => {
  assert.match(CALENDAR_NOTE, /Google Calendar, Apple Calendar or Outlook/);
  assert.match(CALENDAR_NOTE, /email an update/);
});
