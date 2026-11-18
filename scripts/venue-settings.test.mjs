// Checks the hourly booking settings form of a venue: the opening-hours editor and the whole form. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blankForm,
  checkHourlyForm,
  clockOptions,
  formFromSettings,
  formKeyOf,
  lengthOptions,
  minutesText,
  openingHoursErrors,
  openingHoursSummary,
  sortedRanges,
} from "../src/lib/venue-settings.ts";

const valid = () => ({
  ...blankForm("USD"),
  enabled: true,
  rate_per_hour: "50.00",
  min_minutes: 120,
  max_minutes: 480,
  cleaning_buffer_minutes: 30,
  deposit: "100",
  cancellation_policy: "Free until 48 hours before. After that the deposit is kept.",
});

test("opening hours: real times, closing after opening", () => {
  assert.deepEqual(openingHoursErrors([{ weekday: 1, opens: "08:00", closes: "18:00" }]), {});
  assert.equal(openingHoursErrors([{ weekday: 1, opens: "", closes: "18:00" }])[0], "Choose when it opens.");
  assert.equal(openingHoursErrors([{ weekday: 1, opens: "08:00", closes: "25:00" }])[0], "Choose when it closes.");
  assert.equal(openingHoursErrors([{ weekday: 1, opens: "18:00", closes: "08:00" }])[0], "It must close after it opens at 18:00.");
  assert.equal(openingHoursErrors([{ weekday: 1, opens: "08:00", closes: "08:00" }])[0], "It must close after it opens at 08:00.");
  assert.equal(openingHoursErrors([{ weekday: 8, opens: "08:00", closes: "18:00" }])[0], "Choose the day.");
  // Open until midnight.
  assert.deepEqual(openingHoursErrors([{ weekday: 5, opens: "18:00", closes: "24:00" }]), {});
  assert.equal(openingHoursErrors([{ weekday: 5, opens: "24:00", closes: "24:00" }])[0], "Choose when it opens.");
});

test("opening hours: several ranges a day, but none overlapping", () => {
  const split = [
    { weekday: 1, opens: "08:00", closes: "12:00" },
    { weekday: 1, opens: "13:00", closes: "18:00" },
    { weekday: 2, opens: "08:00", closes: "18:00" },
  ];
  assert.deepEqual(openingHoursErrors(split), {});
  // Touching ranges do not overlap.
  assert.deepEqual(openingHoursErrors([{ weekday: 1, opens: "08:00", closes: "12:00" }, { weekday: 1, opens: "12:00", closes: "14:00" }]), {});
  const clash = openingHoursErrors([...split, { weekday: 1, opens: "11:00", closes: "14:00" }]);
  assert.equal(clash[3], "It overlaps 08:00 to 12:00 on Monday.");
  assert.equal(clash[0], "It overlaps 11:00 to 14:00 on Monday.");
  assert.equal(clash[2], undefined);
});

test("opening hours: on the increment's grid", () => {
  assert.deepEqual(openingHoursErrors([{ weekday: 1, opens: "08:30", closes: "17:30" }], 30), {});
  assert.match(openingHoursErrors([{ weekday: 1, opens: "08:15", closes: "17:00" }], 30)[0], /30-minute grid/);
  assert.match(openingHoursErrors([{ weekday: 1, opens: "08:30", closes: "17:00" }], 60)[0], /60-minute grid/);
  assert.deepEqual(openingHoursErrors([{ weekday: 1, opens: "08:15", closes: "17:45" }], 15), {});
});

test("ranges are sorted and summarised Monday first", () => {
  const ranges = [
    { weekday: 6, opens: "09:00", closes: "13:00" },
    { weekday: 1, opens: "13:00", closes: "18:00" },
    { weekday: 1, opens: "08:00", closes: "12:00" },
  ];
  assert.deepEqual(sortedRanges(ranges).map((range) => `${range.weekday} ${range.opens}`), ["1 08:00", "1 13:00", "6 09:00"]);
  assert.deepEqual(openingHoursSummary(ranges), ["Monday 08:00 to 12:00, 13:00 to 18:00", "Saturday 09:00 to 13:00"]);
});

test("choices for the selects", () => {
  assert.deepEqual(clockOptions(60).slice(0, 3), ["00:00", "01:00", "02:00"]);
  assert.equal(clockOptions(60).at(-1), "23:00");
  assert.equal(clockOptions(60, { closing: true })[0], "01:00");
  assert.equal(clockOptions(30, { closing: true }).at(-1), "24:00");
  assert.equal(clockOptions(15).length, 96);
  assert.deepEqual(lengthOptions(60).slice(0, 2), [60, 120]);
  assert.equal(lengthOptions(30).length, 48);
  assert.equal(minutesText(0), "None");
  assert.equal(minutesText(90), "1 h 30 min");
});

test("a valid form becomes the body the API takes", () => {
  const form = valid();
  form.fees = [{ code: "tax", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-01-01", effective_to: "" }];
  form.exceptions = [{ date: "2026-12-25", closed: true, opens: "", closes: "", note: " Christmas " }];
  const { errors, body } = checkHourlyForm(form, ["USD", "ZWG"]);
  assert.deepEqual(errors, {});
  assert.equal(body.rate_per_hour, "50.00");
  assert.equal(body.capacity, 1);
  assert.equal(body.deposit, "100");
  assert.deepEqual(body.fees[0], { code: "TAX", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-01-01" });
  assert.deepEqual(body.exceptions[0], { date: "2026-12-25", closed: true, note: "Christmas" });
  assert.equal(body.free_cancellation_hours, 48);
  assert.equal(body.horizon_days, 90);
  assert.equal(checkHourlyForm({ ...form, deposit: "" }, ["USD"]).body.deposit, null);
});

test("the form is checked as the API checks it", () => {
  const form = {
    ...valid(),
    currency: "EUR",
    rate_per_hour: "fifty",
    min_minutes: 90,
    max_minutes: 60,
    capacity: "0",
    deposit: "1,00",
    horizon_days: "400",
    lead_time_hours: "-1",
    free_cancellation_hours: "",
    cancellation_policy: "",
    opening_hours: [{ weekday: 1, opens: "10:00", closes: "09:00" }],
  };
  const { errors, body } = checkHourlyForm({ ...form, increment_minutes: 60 }, ["USD"]);
  assert.equal(body, null);
  assert.ok(errors.currency);
  assert.ok(errors.rate_per_hour);
  assert.equal(errors.min_minutes, "Choose a multiple of 60 minutes.");
  assert.ok(errors.capacity);
  assert.ok(errors.deposit);
  assert.ok(errors.horizon_days);
  assert.ok(errors.lead_time_hours);
  assert.ok(errors.free_cancellation_hours);
  assert.equal(errors.cancellation_policy, "Say what happens when a customer cancels.");
  assert.equal(errors["opening_hours[0]"], "It must close after it opens at 10:00.");
  assert.equal(checkHourlyForm({ ...valid(), min_minutes: 240, max_minutes: 120 }, ["USD"]).errors.max_minutes, "The longest booking cannot be shorter than the shortest.");
  assert.ok(checkHourlyForm({ ...valid(), opening_hours: [] }, ["USD"]).errors.opening_hours);
  // Switched off, an empty policy and no hours are fine.
  assert.deepEqual(checkHourlyForm({ ...valid(), enabled: false, opening_hours: [], cancellation_policy: "" }, ["USD"]).errors, {});
});

test("exceptions and fees are checked one by one", () => {
  const form = valid();
  form.exceptions = [
    { date: "2026-12-24", closed: false, opens: "10:00", closes: "09:00", note: "" },
    { date: "2026-12-24", closed: true, opens: "", closes: "", note: "" },
    { date: "", closed: false, opens: "", closes: "", note: "" },
  ];
  form.fees = [
    { code: "TAX", label: "VAT", kind: "PERCENT", amount: "150", effective_from: "2026-01-01", effective_to: "" },
    { code: "TAX", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-06-01", effective_to: "2026-05-01" },
    { code: "TAX", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-06-01", effective_to: "" },
    { code: "clean-up", label: "", kind: "FLAT", amount: "0", effective_from: "", effective_to: "" },
  ];
  const { errors } = checkHourlyForm(form, ["USD"]);
  assert.equal(errors["exceptions[0].closes"], "It must close after it opens.");
  assert.equal(errors["exceptions[1].date"], "This date already has its own hours.");
  assert.equal(errors["exceptions[2].date"], "Choose the date.");
  assert.equal(errors["exceptions[2].opens"], "Choose when it opens, or mark the day closed.");
  assert.equal(errors["fees[0].amount"], "Enter a percentage above 0, up to 100.");
  assert.equal(errors["fees[1].effective_to"], "The last day cannot be before the first.");
  assert.equal(errors["fees[2].effective_from"], "Its dates overlap the other TAX charge.");
  assert.ok(errors["fees[3].code"]);
  assert.ok(errors["fees[3].label"]);
  assert.ok(errors["fees[3].kind"]);
  assert.ok(errors["fees[3].amount"]);
  assert.ok(errors["fees[3].effective_from"]);
  // A tax that ends before the next begins is fine.
  const ok = valid();
  ok.fees = [
    { code: "TAX", label: "VAT", kind: "PERCENT", amount: "14.5", effective_from: "2026-01-01", effective_to: "2026-06-30" },
    { code: "TAX", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-07-01", effective_to: "" },
    { code: "SETUP", label: "Set-up", kind: "PER_HOUR", amount: "5.00", effective_from: "2026-01-01", effective_to: "" },
  ];
  assert.deepEqual(checkHourlyForm(ok, ["USD"]).errors, {});
});

test("formFromSettings reads the API's settings, flat or nested", () => {
  const form = formFromSettings(
    {
      settings: {
        enabled: true,
        currency: "USD",
        rate_per_hour: "50.00",
        increment_minutes: 30,
        min_minutes: 120,
        max_minutes: 480,
        cleaning_buffer_minutes: 30,
        capacity: 1,
        deposit: "100.00",
        opening_hours: [{ weekday: 1, opens: "08:00:00", closes: "18:00" }],
        exceptions: [{ date: "2026-12-25", closed: true }],
        fees: [{ code: "TAX", label: "VAT", kind: "PERCENT", amount: "15", effective_from: "2026-01-01", effective_to: null }],
        cancellation_policy: { text: "Free until 48 h before.", free_cancellation_hours: 48 },
        lead_time_hours: 24,
        horizon_days: 90,
      },
    },
    "ZWG",
  );
  assert.equal(form.currency, "USD");
  assert.equal(form.opening_hours[0].opens, "08:00");
  assert.equal(form.exceptions[0].opens, "");
  assert.equal(form.fees[0].effective_to, "");
  assert.equal(form.cancellation_policy, "Free until 48 h before.");
  assert.equal(form.free_cancellation_hours, "48");
  assert.equal(form.capacity, "1");
  const flat = formFromSettings({ enabled: false, rate_per_hour: null, cancellation_policy: "Text", free_cancellation_hours: 12, deposit: null }, "USD");
  assert.equal(flat.cancellation_policy, "Text");
  assert.equal(flat.free_cancellation_hours, "12");
  assert.equal(flat.deposit, "");
  assert.equal(formFromSettings({}, "USD"), null);
  assert.equal(formFromSettings(null, "USD"), null);
});

test("formKeyOf puts the API's field errors where the form shows them", () => {
  assert.equal(formKeyOf("opening_hours[2].closes"), "opening_hours[2]");
  assert.equal(formKeyOf("fees[0].amount"), "fees[0].amount");
  assert.equal(formKeyOf("fees.0.amount"), "fees[0].amount");
  assert.equal(formKeyOf("cancellation_policy.text"), "cancellation_policy");
  assert.equal(formKeyOf("cancellation_policy.free_cancellation_hours"), "free_cancellation_hours");
  assert.equal(formKeyOf("currency"), "currency");
});
