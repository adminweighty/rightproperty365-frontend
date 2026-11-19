// Checks the listing packages' own rules (src/lib/packages.ts): exact price
// formatting, typed price checks, billing terms, the usage meter's words and
// the quota error messages. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignmentDates,
  assignmentDatesProblem,
  billingTermLabel,
  billingTermPer,
  currencyDecimals,
  formatPrice,
  normalisePrice,
  PACKAGE_CODE,
  packageMessage,
  priceProblem,
  priceWithTerm,
  pricingPath,
  quotaDetails,
  quotaReachedMessage,
  quotaReachedReviewerMessage,
  usageBasisText,
  usageMeter,
} from "../src/lib/packages.ts";

test("formatPrice keeps the API's digits exactly, grouped, with the currency code", () => {
  assert.equal(formatPrice("25.00", "USD"), "USD 25.00");
  assert.equal(formatPrice("1250.00", "USD"), "USD 1,250.00");
  assert.equal(formatPrice("1234567.89", "GBP"), "GBP 1,234,567.89");
  assert.equal(formatPrice("2500", "JPY", 0), "JPY 2,500");
  assert.equal(formatPrice("1.250", "KWD", 3), "KWD 1.250");
  // Never rounded, never float: 0.1 + 0.2 style values stay as given.
  assert.equal(formatPrice("0.30", "USD"), "USD 0.30");
  assert.equal(formatPrice("19.999", "USD"), "USD 19.999");
  assert.equal(formatPrice("9007199254740993.00", "USD"), "USD 9,007,199,254,740,993.00");
});

test("formatPrice pads to the minor unit and copes with odd input", () => {
  assert.equal(formatPrice("25", "USD"), "USD 25.00");
  assert.equal(formatPrice("25.5", "usd"), "USD 25.50");
  assert.equal(formatPrice("0025.00", "USD"), "USD 25.00");
  assert.equal(formatPrice("", "USD"), "USD —");
  assert.equal(formatPrice(null, "USD"), "USD —");
  assert.equal(formatPrice("n/a", "USD"), "USD n/a");
  assert.equal(formatPrice("25.00", "USD", 2), "USD 25.00");
});

test("currencyDecimals prefers the API's minor unit", () => {
  assert.equal(currencyDecimals("USD"), 2);
  assert.equal(currencyDecimals("JPY"), 0);
  assert.equal(currencyDecimals("USD", 3), 3);
  assert.equal(currencyDecimals("XXXX"), 2);
});

test("priceProblem checks a typed price against the currency", () => {
  assert.equal(priceProblem("25.00", "USD"), null);
  assert.equal(priceProblem(" 25 ", "USD"), null);
  assert.match(priceProblem("", "USD"), /Enter the price/);
  assert.match(priceProblem("1,250", "USD"), /without commas/);
  assert.match(priceProblem("-5", "USD"), /above zero/);
  assert.match(priceProblem("0", "USD"), /above zero/);
  assert.match(priceProblem("0.00", "USD"), /above zero/);
  assert.match(priceProblem("abc", "USD"), /in figures/);
  assert.match(priceProblem("25.001", "USD"), /at most 2 decimal places/);
  assert.match(priceProblem("25.5", "JPY", 0), /no decimal places/);
  assert.equal(priceProblem("1.125", "KWD", 3), null);
  assert.match(priceProblem("123456789012345", "USD"), /too large/);
});

test("normalisePrice sends a clean decimal string", () => {
  assert.equal(normalisePrice("0012.50"), "12.50");
  assert.equal(normalisePrice(" 25 "), "25");
  assert.equal(normalisePrice("0.5"), "0.5");
  assert.equal(normalisePrice("25."), "25");
});

test("billing terms read in words", () => {
  assert.equal(billingTermLabel("MONTHLY"), "Monthly");
  assert.equal(billingTermLabel("ANNUAL"), "Annual");
  assert.equal(billingTermLabel("ANNUAL", "Yearly"), "Yearly");
  assert.equal(billingTermLabel("TWO_YEARS"), "Two years");
  assert.equal(billingTermPer("QUARTERLY"), "every 3 months");
  assert.equal(billingTermPer("SIX", 6), "every 6 months");
  assert.equal(
    priceWithTerm({ amount: "250.00", currency: "USD", billing_term: "ANNUAL", minor_unit: 2 }),
    "USD 250.00 a year",
  );
});

test("usageMeter: within the limit", () => {
  const meter = usageMeter({ basis: "ASSIGNED", package: { name: "Business" }, limit: 40, used: 12 });
  assert.equal(meter.state, "ok");
  assert.equal(meter.percent, 30);
  assert.equal(meter.remaining, 28);
  assert.equal(meter.usedText, "12 of 40 active listings used");
  assert.equal(meter.remainingText, "28 left");
  assert.equal(meter.accessibleText, "12 of 40 active listings used on the Business package. 28 left.");
  assert.equal(meter.explanation, null);
  assert.equal(meter.tone, "success");
});

test("usageMeter: near and at the limit", () => {
  const near = usageMeter({ basis: "DEFAULT", package: { name: "Starter" }, limit: 20, used: 16 });
  assert.equal(near.state, "near");
  assert.equal(near.tone, "warning");
  const full = usageMeter({ basis: "DEFAULT", package: { name: "Starter" }, limit: 20, used: 20 });
  assert.equal(full.state, "full");
  assert.equal(full.percent, 100);
  assert.equal(full.remainingText, "None left");
  assert.match(full.accessibleText, /None left\.$/);
  assert.match(full.explanation, /still submit listings/);
  const one = usageMeter({ basis: "ASSIGNED", package: { name: "Solo" }, limit: 1, used: 0 });
  assert.equal(one.usedText, "0 of 1 active listing used");
});

test("usageMeter: over the limit explains the grace rule with its date", () => {
  const meter = usageMeter({
    basis: "DEFAULT",
    package: { name: "Starter" },
    limit: 20,
    used: 23,
    grace_until: "2027-01-15T10:00:00Z",
  });
  assert.equal(meter.state, "over");
  assert.equal(meter.percent, 100);
  assert.equal(meter.remaining, 0);
  assert.equal(meter.remainingText, "3 over the limit");
  assert.match(meter.accessibleText, /23 active listings on the Starter package, which allows 20: 3 over the limit\./);
  assert.match(meter.explanation, /already live stay live/);
  assert.match(meter.explanation, /fewer than 20 are live/);
  assert.match(meter.explanation, /by 15 Jan 2027/);
  const noDate = usageMeter({ basis: "DEFAULT", package: { name: "Starter" }, limit: 20, used: 21 });
  assert.doesNotMatch(noDate.explanation, / by /);
});

test("usageMeter: no limit, and a zero limit", () => {
  const none = usageMeter({ basis: "NONE", package: null, limit: null, used: 4 });
  assert.equal(none.state, "unlimited");
  assert.equal(none.remaining, null);
  assert.equal(none.remainingText, "No limit");
  assert.equal(none.usedText, "4 active listings, no limit");
  assert.equal(usageMeter({ basis: "NONE", package: null, limit: null, used: 1 }).usedText, "1 active listing, no limit");
  const zero = usageMeter({ basis: "ASSIGNED", package: { name: "Paused" }, limit: 0, used: 0 });
  assert.equal(zero.state, "full");
  assert.equal(zero.percent, 100);
});

test("usageBasisText", () => {
  assert.equal(usageBasisText("ASSIGNED"), "Assigned to you");
  assert.match(usageBasisText("DEFAULT"), /standard package/);
  assert.equal(usageBasisText("NONE"), "No package");
});

test("quotaDetails reads the 409 details with care", () => {
  const body = {
    error: {
      code: "LISTING_QUOTA_REACHED",
      message: "…",
      details: { limit: 20, used: 20, market_code: "ZW", package: { name: "Starter" }, account: { name: "Sample Estates" } },
    },
  };
  assert.deepEqual(quotaDetails(body), { used: 20, limit: 20, packageName: "Starter", marketCode: "ZW", accountName: "Sample Estates" });
  assert.deepEqual(quotaDetails(null), { used: null, limit: null, packageName: null, marketCode: null, accountName: null });
  assert.deepEqual(quotaDetails({ error: { details: { used: "20" } } }).used, null);
});

test("quotaReachedMessage says the figures, the package and what to do", () => {
  assert.equal(
    quotaReachedMessage({ used: 20, limit: 20, packageName: "Starter" }),
    "You have used 20 of 20 published listings on the Starter package. Archive (unpublish) one of your live listings, or ask us about a bigger package.",
  );
  assert.match(quotaReachedMessage({ used: 1, limit: 1, packageName: "Solo" }), /1 of 1 published listing on/);
  assert.match(quotaReachedMessage({}), /^You have used every published listing on your package\./);
  assert.match(quotaReachedMessage({ used: 3, limit: null, packageName: " " }), /your package/);
});

test("quotaReachedReviewerMessage names the advertiser and says nothing changed", () => {
  const text = quotaReachedReviewerMessage({ used: 20, limit: 20, packageName: "Starter", accountName: "Sample Estates" });
  assert.match(text, /^Sample Estates has used 20 of 20 published listings on the Starter package/);
  assert.match(text, /stays waiting for review/);
  assert.match(quotaReachedReviewerMessage({}), /^The advertiser has used every published listing on their package/);
});

test("admin helpers", () => {
  assert.ok(PACKAGE_CODE.test("STARTER"));
  assert.ok(PACKAGE_CODE.test("PRO_60"));
  assert.ok(!PACKAGE_CODE.test("starter"));
  assert.ok(!PACKAGE_CODE.test("1PRO"));
  assert.ok(!PACKAGE_CODE.test("S"));
  assert.match(packageMessage({ code: "PACKAGE_IN_USE", message: "x" }), /Deactivate it instead/);
  assert.equal(packageMessage({ code: "OTHER", message: "From the API" }), "From the API");
  assert.equal(assignmentDates("2026-11-19", "2027-11-18"), "19 Nov 2026 to 18 Nov 2027");
  assert.equal(assignmentDates("2026-11-19", null), "From 19 Nov 2026, open-ended");
  assert.equal(assignmentDatesProblem("2026-11-19", "", "2026-11-19"), null);
  assert.equal(assignmentDatesProblem("", "", "2026-11-19"), null);
  assert.equal(assignmentDatesProblem("2026-11-18", "", "2026-11-19").field, "starts_on");
  assert.equal(assignmentDatesProblem("2026-11-20", "2026-11-19", "2026-11-19").field, "ends_on");
  assert.equal(assignmentDatesProblem("", "2026-11-18", "2026-11-19").field, "ends_on");
  assert.equal(pricingPath("ZW"), "/pricing/zw");
});

test("usageMeter speaks of the advertiser to an administrator", () => {
  const full = usageMeter({ basis: "DEFAULT", package: { name: "Starter" }, limit: 20, used: 20 }, "admin");
  assert.match(full.explanation, /^They are at the limit of the Starter package\. They can still submit/);
  const over = usageMeter({ basis: "DEFAULT", package: null, limit: 2, used: 3 }, "admin");
  assert.match(over.explanation, /^They have more live listings than their package allows/);
  assert.match(over.explanation, /they archive them/);
});
