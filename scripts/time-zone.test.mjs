// Checks the personal time zone helpers (API 0.62.0): the reader of
// user.time_zone, the viewer's zone, the zone names and offsets (DST
// included), the four display classes, and the picker. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayIn,
  formatCalendarDate,
  formatInstant,
  formatMarketDay,
  formatPlaceTime,
  HOME_MARKET_ZONE,
  isKnownZone,
  offsetLabel,
  offsetMinutes,
  readTimeZoneSetting,
  supportedZones,
  timeZonePutBody,
  viewerZone,
  zoneLabel,
  zoneMatches,
  zoneOptionLabel,
} from "../src/lib/time-zone.ts";

const market = { mode: "MARKET", zone: null, market_code: "ZW", market_zone: "Africa/Harare" };

test("the reader is tolerant: an older API reads as Harare market time", () => {
  assert.deepEqual(readTimeZoneSetting(undefined), { mode: "MARKET", zone: null, market_code: "ZW", market_zone: HOME_MARKET_ZONE });
  assert.deepEqual(readTimeZoneSetting(market), market);
  assert.equal(readTimeZoneSetting({ ...market, mode: "ZONE", zone: "Europe/London" }).zone, "Europe/London");
  // A named mode without a usable zone falls back to market time.
  assert.equal(readTimeZoneSetting({ ...market, mode: "ZONE", zone: "Mars/Olympus" }).mode, "MARKET");
  assert.equal(readTimeZoneSetting({ ...market, mode: "WHATEVER" }).mode, "MARKET");
  assert.equal(readTimeZoneSetting({ ...market, mode: "DEVICE", zone: "Europe/London" }).zone, null);
  assert.equal(readTimeZoneSetting({ ...market, market_zone: "nope" }).market_zone, HOME_MARKET_ZONE);
});

test("the viewer's zone: market by default, the device's, or the named one", () => {
  assert.equal(viewerZone(null, "Europe/London"), "Africa/Harare");
  assert.equal(viewerZone(market, "Europe/London"), "Africa/Harare");
  assert.equal(viewerZone({ ...market, mode: "DEVICE" }, "Europe/London"), "Europe/London");
  assert.equal(viewerZone({ ...market, mode: "DEVICE" }, null), "Africa/Harare");
  assert.equal(viewerZone({ ...market, mode: "ZONE", zone: "Pacific/Kiritimati" }, "Europe/London"), "Pacific/Kiritimati");
  assert.equal(viewerZone({ ...market, market_code: "GB", market_zone: "Europe/London" }, null), "Europe/London");
});

test("the PUT body", () => {
  assert.deepEqual(timeZonePutBody("ZONE", "Europe/London"), { mode: "ZONE", zone: "Europe/London" });
  assert.deepEqual(timeZonePutBody("DEVICE", "Europe/London"), { mode: "DEVICE" });
  assert.deepEqual(timeZonePutBody("MARKET"), { mode: "MARKET" });
});

test("zone names and offsets, with daylight saving time", () => {
  assert.equal(zoneLabel("Africa/Harare"), "Harare time");
  assert.equal(zoneLabel("America/New_York"), "New York time");
  assert.equal(zoneLabel("America/Argentina/Buenos_Aires"), "Buenos Aires time");
  assert.equal(zoneLabel("UTC"), "UTC");
  const winter = new Date("2026-01-15T12:00:00Z");
  const summer = new Date("2026-07-15T12:00:00Z");
  assert.equal(offsetLabel("Europe/London", winter), "UTC");
  assert.equal(offsetLabel("Europe/London", summer), "UTC+01:00");
  assert.equal(offsetLabel("Africa/Harare", summer), "UTC+02:00");
  assert.equal(offsetLabel("America/New_York", winter), "UTC−05:00");
  assert.equal(offsetLabel("Asia/Kolkata", winter), "UTC+05:30");
  assert.equal(offsetMinutes("Pacific/Kiritimati", winter), 14 * 60);
  assert.equal(offsetMinutes("Pacific/Pago_Pago", winter), -11 * 60);
  assert.equal(zoneLabel("Etc/GMT+12", winter), "UTC−12:00");
  // The London clocks go forward at 01:00 UTC on 29 March 2026.
  assert.equal(offsetMinutes("Europe/London", new Date("2026-03-29T00:59:00Z")), 0);
  assert.equal(offsetMinutes("Europe/London", new Date("2026-03-29T01:00:00Z")), 60);
});

test("class A: an instant in the viewer's zone, always labelled", () => {
  const at = "2026-11-22T12:05:00Z";
  assert.equal(formatInstant(at, "Africa/Harare"), "22 Nov 2026, 14:05 Harare time");
  assert.equal(formatInstant(at, "Europe/London"), "22 Nov 2026, 12:05 London time");
  assert.equal(formatInstant(at, "Africa/Harare", { style: "time" }), "14:05 Harare time");
  assert.equal(formatInstant(at, "Africa/Harare", { label: false }), "22 Nov 2026, 14:05");
  // A day ahead and a day behind: the same instant is another date there.
  assert.equal(formatInstant("2026-11-22T22:30:00Z", "Pacific/Kiritimati", { style: "date" }), "23 Nov 2026 (Kiritimati time)");
  assert.equal(formatInstant("2026-11-22T05:00:00Z", "Pacific/Pago_Pago", { style: "date" }), "21 Nov 2026 (Pago Pago time)");
  // Summer time in London.
  assert.equal(formatInstant("2026-07-01T12:00:00Z", "Europe/London", { style: "time" }), "13:00 London time");
  assert.equal(formatInstant("not a date", "Africa/Harare"), "not a date");
});

test("class B: the place's time first, the viewer's alongside when it differs", () => {
  const at = "2026-11-23T08:00:00Z"; // 10:00 in Harare
  assert.equal(formatPlaceTime(at, "Africa/Harare", "Africa/Harare"), "Mon, 23 Nov 2026, 10:00 Harare time");
  assert.equal(formatPlaceTime(at, "Africa/Harare", "Africa/Johannesburg"), "Mon, 23 Nov 2026, 10:00 Harare time"); // same offset
  assert.equal(formatPlaceTime(at, "Africa/Harare", "Europe/London", { date: false }), "10:00 Harare time (08:00 your time)");
  // Another day for the viewer: both dates are shown.
  assert.equal(
    formatPlaceTime("2026-11-22T23:00:00Z", "Africa/Harare", "Pacific/Pago_Pago"),
    "Mon, 23 Nov 2026, 01:00 Harare time (Sun, 22 Nov 2026, 12:00 your time)",
  );
  assert.equal(
    formatPlaceTime("2026-11-23T11:00:00Z", "Africa/Harare", "Pacific/Kiritimati", { date: false }),
    "13:00 Harare time (Tue, 24 Nov 2026, 01:00 your time)",
  );
  // DST: in July London is UTC+1, one hour behind Harare.
  assert.equal(formatPlaceTime("2026-07-06T08:00:00Z", "Africa/Harare", "Europe/London", { date: false }), "10:00 Harare time (09:00 your time)");
  // An unknown place zone falls back to UTC rather than throwing.
  assert.match(formatPlaceTime(at, "Mars/Olympus", "Africa/Harare"), /08:00 UTC/);
});

test("class C: calendar dates never shift, whatever the viewer's zone", () => {
  assert.equal(formatCalendarDate("2026-11-30"), "30 Nov 2026");
  assert.equal(formatCalendarDate("2026-01-01", { long: true }), "1 January 2026");
  assert.equal(formatCalendarDate("2026-13-01"), "2026-13-01");
  assert.equal(formatCalendarDate("soon"), "soon");
});

test("classes C and D for an instant: the day in the market zone", () => {
  // 22:30 UTC on 30 November is already 1 December in Harare.
  assert.equal(formatMarketDay("2026-11-30T22:30:00Z", "Africa/Harare"), "1 Dec 2026");
  assert.equal(formatMarketDay("2026-11-30T22:30:00Z", "Europe/London"), "30 Nov 2026");
  assert.equal(formatMarketDay("2026-11-30T22:30:00Z", "bad"), "1 Dec 2026"); // home market
  assert.equal(dayIn("2026-11-30T22:30:00Z", "Pacific/Pago_Pago"), "2026-11-30");
});

test("the picker: every zone the browser knows, searchable", () => {
  const zones = supportedZones();
  assert.equal(zones[0], "UTC");
  assert.ok(zones.includes("Africa/Harare") && zones.includes("Europe/London"));
  assert.ok(zones.every(isKnownZone));
  const winter = new Date("2026-01-15T12:00:00Z");
  assert.equal(zoneOptionLabel("Africa/Harare", winter), "Harare time (UTC+02:00) — Africa/Harare");
  assert.equal(zoneOptionLabel("UTC", winter), "UTC — UTC");
  assert.ok(zoneMatches("America/New_York", "new york", winter));
  assert.ok(zoneMatches("Africa/Harare", "+02:00", winter));
  assert.ok(!zoneMatches("Africa/Harare", "london", winter));
});
