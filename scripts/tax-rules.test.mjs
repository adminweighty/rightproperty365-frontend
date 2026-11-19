// Checks the tax rules' own rules (src/lib/tax-rules.ts): exact decimal rates,
// UTC days, the form checks, the list filters and the lookup query. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatRate,
  fromDateInput,
  lookupQuery,
  normaliseRate,
  periodText,
  rateProblem,
  taxRuleFilterQuery,
  toDateInput,
  validateTaxRule,
} from "../src/lib/tax-rules.ts";

test("rateProblem accepts percents from 0 to 100 with at most 4 decimals", () => {
  for (const ok of ["0", "15", "12.5", "7.25", "0.0001", "99.9999", "100", "100.0", "100.0000", " 15 ", "015"]) {
    assert.equal(rateProblem(ok), null, ok);
  }
});

test("rateProblem refuses anything else, without reading it as a float", () => {
  assert.match(rateProblem(""), /Enter the rate/);
  assert.match(rateProblem("12.34567"), /4 decimal/);
  assert.match(rateProblem("100.0001"), /0 to 100/);
  assert.match(rateProblem("101"), /0 to 100/);
  assert.match(rateProblem("1000"), /0 to 100/);
  for (const bad of ["15%", "-1", "1e1", "12,5", ".5", "15.", "abc", "0x10", "1 5"]) {
    assert.ok(rateProblem(bad), bad);
  }
});

test("normaliseRate keeps the typed decimals exactly and drops leading zeros", () => {
  assert.equal(normaliseRate("15"), "15");
  assert.equal(normaliseRate(" 12.50 "), "12.50");
  assert.equal(normaliseRate("015.5"), "15.5");
  assert.equal(normaliseRate("0"), "0");
  assert.equal(normaliseRate("00.0001"), "0.0001");
  assert.equal(formatRate("12.5"), "12.5%");
});

test("dates are whole UTC days", () => {
  assert.equal(fromDateInput("2026-01-01"), "2026-01-01T00:00:00Z");
  assert.equal(fromDateInput("2026-02-29"), null);
  assert.equal(fromDateInput("2026-1-1"), null);
  assert.equal(fromDateInput(""), null);
  assert.equal(toDateInput("2026-01-01T00:00:00Z"), "2026-01-01");
  assert.equal(toDateInput(null), "");
  assert.equal(periodText("2026-01-01T00:00:00Z", null), "From 1 Jan 2026, open-ended");
  assert.equal(periodText("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"), "1 Jan 2026 to 31 Dec 2026");
});

const good = {
  market: "zw",
  taxName: " VAT ",
  rate: "015",
  appliesTo: "SUBSCRIPTIONS",
  inclusive: false,
  effectiveFrom: "2026-01-01",
  effectiveTo: "",
  registrationLabel: " VAT registration number ",
  notes: "",
  isSample: true,
};

test("validateTaxRule builds the API body with the rate as a string", () => {
  const { input, errors } = validateTaxRule(good);
  assert.deepEqual(errors, {});
  assert.deepEqual(input, {
    market_code: "ZW",
    tax_name: "VAT",
    rate: "15",
    applies_to: "SUBSCRIPTIONS",
    inclusive: false,
    effective_from: "2026-01-01T00:00:00Z",
    effective_to: null,
    registration_number_label: "VAT registration number",
    notes: "",
    is_sample: true,
  });
  assert.equal(validateTaxRule({ ...good, effectiveTo: "2027-01-01" }).input.effective_to, "2027-01-01T00:00:00Z");
});

test("validateTaxRule refuses what the API refuses", () => {
  const errors = (change) => validateTaxRule({ ...good, ...change }).errors;
  assert.ok(errors({ market: "" }).market_code);
  assert.ok(errors({ market: "GLOBAL" }).market_code);
  assert.ok(errors({ taxName: "  " }).tax_name);
  assert.ok(errors({ rate: "12.34567" }).rate);
  assert.ok(errors({ appliesTo: "RENT" }).applies_to);
  assert.ok(errors({ effectiveFrom: "" }).effective_from);
  assert.ok(errors({ effectiveTo: "2025-12-31" }).effective_to);
  assert.ok(errors({ effectiveTo: "2026-01-01" }).effective_to);
  assert.ok(errors({ effectiveTo: "not a date" }).effective_to);
});

test("taxRuleFilterQuery leaves out empty filters", () => {
  assert.equal(taxRuleFilterQuery({}), "");
  assert.equal(taxRuleFilterQuery({ market: "", applies_to: "", status: "" }), "");
  assert.equal(taxRuleFilterQuery({ market: "gb", applies_to: "subscriptions", status: "active" }), "?market=GB&applies_to=SUBSCRIPTIONS&status=ACTIVE");
});

test("lookupQuery asks for the start of the chosen UTC day, or for now without a date", () => {
  assert.deepEqual(lookupQuery({ market: "zw", appliesTo: "SUBSCRIPTIONS", date: "2026-11-19" }), {
    ok: true,
    query: "?market=ZW&applies_to=SUBSCRIPTIONS&at=2026-11-19T00%3A00%3A00Z",
  });
  assert.deepEqual(lookupQuery({ market: "GB", appliesTo: "VENUE_BOOKINGS", date: "" }), {
    ok: true,
    query: "?market=GB&applies_to=VENUE_BOOKINGS",
  });
  const bad = lookupQuery({ market: "", appliesTo: "RENT", date: "2026-02-30" });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["applies_to", "at", "market"]);
});
