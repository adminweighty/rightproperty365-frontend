// Checks how a venue's hourly quote is read and itemised. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_PAYMENT_NOTICE, expiryText, formatAmount, groupDigits, isZero, normaliseQuote, quoteRows } from "../src/lib/venue-quote.ts";

const contractQuote = {
  quote_id: "q_1",
  expires_at: "2026-11-20T08:30:00Z",
  currency: "USD",
  lines: [
    { code: "RATE", label: "4 h × USD 50.00", amount: "200.00" },
    { code: "TAX", label: "VAT 15%", amount: "30.00" },
    { code: "CLEANING", label: "Cleaning", amount: "25.00" },
  ],
  subtotal: "255.00",
  deposit: "100.00",
  total_excluding_deposit: "255.00",
  start: "2026-11-20T08:00:00Z",
  end: "2026-11-20T12:00:00Z",
  time_zone: "Africa/Harare",
  local_start: "2026-11-20T10:00",
  local_end: "2026-11-20T14:00",
  mode: "ENQUIRY",
  notice: "This is an estimate. No payment is taken on RightProperty365; the host confirms and arranges payment with you.",
};

test("amounts keep every digit the API sent and always show the currency", () => {
  assert.equal(groupDigits("1234567.50"), "1,234,567.50");
  assert.equal(groupDigits("200"), "200");
  assert.equal(groupDigits("0.125"), "0.125");
  assert.equal(groupDigits("abc"), "abc");
  assert.equal(formatAmount("1234.5", "USD"), "USD 1,234.5");
  assert.equal(formatAmount("-10.00", "USD"), "-USD 10.00");
  assert.equal(formatAmount("50000", "ZWG"), "ZWG 50,000");
  assert.ok(isZero("0.00"));
  assert.ok(!isZero("0.01"));
  assert.ok(!isZero(null));
});

test("the contract's quote is read as sent", () => {
  const quote = normaliseQuote(contractQuote);
  assert.equal(quote.id, "q_1");
  assert.equal(quote.currency, "USD");
  assert.equal(quote.lines.length, 3);
  assert.equal(quote.lines[0].label, "4 h × USD 50.00");
  assert.equal(quote.deposit, "100.00");
  assert.equal(quote.totalExcludingDeposit, "255.00");
  assert.equal(quote.timeZone, "Africa/Harare");
  assert.equal(quote.mode, "ENQUIRY");
  assert.equal(quote.notice, NO_PAYMENT_NOTICE);
  assert.equal(quote.mixedCurrency, false);
});

test("quote rows itemise each line, the total and the deposit apart", () => {
  const rows = quoteRows(normaliseQuote(contractQuote));
  assert.deepEqual(
    rows.map(({ label, value }) => [label, value]),
    [
      ["4 h × USD 50.00", "USD 200.00"],
      ["VAT 15%", "USD 30.00"],
      ["Cleaning", "USD 25.00"],
      ["Estimated total", "USD 255.00"],
      ["Deposit, payable to the host if confirmed", "USD 100.00"],
    ],
  );
  assert.equal(rows.find((row) => row.key === "total").total, true);
  assert.equal(rows.find((row) => row.key === "deposit").aside, true);
});

test("a subtotal is shown only when it differs from the total; a zero or missing deposit is left out", () => {
  const quote = normaliseQuote({ ...contractQuote, subtotal: "230.00", deposit: "0.00" });
  const labels = quoteRows(quote).map((row) => row.label);
  assert.ok(labels.includes("Subtotal"));
  assert.ok(!labels.some((label) => label.startsWith("Deposit")));
  assert.ok(!quoteRows(normaliseQuote({ ...contractQuote, deposit: null })).some((row) => row.key === "deposit"));
});

test("amounts as numbers or {amount, currency} are read; another currency marks the quote mixed", () => {
  const quote = normaliseQuote({ quote: { ...contractQuote, deposit: { amount: "100.00", currency: "USD" }, total_excluding_deposit: 255 } });
  assert.equal(quote.deposit, "100.00");
  assert.equal(quote.totalExcludingDeposit, "255");
  assert.equal(quote.mixedCurrency, false);
  const mixed = normaliseQuote({ ...contractQuote, lines: [...contractQuote.lines, { code: "X", label: "X", amount: "1.00", currency: "ZWG" }] });
  assert.equal(mixed.mixedCurrency, true);
  assert.equal(normaliseQuote({ ...contractQuote, deposit: { amount: "1", currency: "EUR" } }).mixedCurrency, true);
});

test("a quote without an id or a currency is not a quote; the notice falls back to the contract's text", () => {
  assert.equal(normaliseQuote({ ...contractQuote, quote_id: undefined, id: undefined }), null);
  assert.equal(normaliseQuote({ ...contractQuote, currency: "dollars" }), null);
  assert.equal(normaliseQuote({ ...contractQuote, notice: undefined }).notice, NO_PAYMENT_NOTICE);
  assert.equal(normaliseQuote({ ...contractQuote, quote_id: undefined, id: "q_2" }).id, "q_2");
});

test("expiry is said on the visitor's clock, and once passed asks for a new estimate", () => {
  const now = Date.parse("2026-11-20T08:00:00Z");
  assert.match(expiryText("2026-11-20T08:30:00Z", now), /^This estimate is held for your request until \d{2}:\d{2} your time\.$/);
  assert.equal(expiryText("2026-11-20T07:59:00Z", now), "This estimate has expired. Choose the time again for a new one.");
  assert.equal(expiryText(null, now), null);
});
