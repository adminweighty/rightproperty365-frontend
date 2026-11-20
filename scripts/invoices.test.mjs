// Wording of the renewal invoices (API 0.47.0). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionLabel,
  eventLabel,
  INVOICE_STATUS_TONES,
  INVOICE_TABS,
  invoiceErrorText,
  lastDay,
  payerStatusText,
  rateText,
  taxLabel,
} from "../src/lib/invoices.ts";

test("the service period ends the day before its exclusive end", () => {
  assert.equal(lastDay("2027-03-01"), "2027-02-28");
  assert.equal(lastDay("2026-12-01"), "2026-11-30");
  assert.equal(lastDay("2028-03-01"), "2028-02-29");
  assert.equal(lastDay("nonsense"), "nonsense");
});

test("tax rates and labels", () => {
  assert.equal(rateText("15.0000"), "15");
  assert.equal(rateText("12.5000"), "12.5");
  assert.equal(rateText("10"), "10");
  assert.equal(taxLabel({ name: "VAT", rate: "15.0000", inclusive: false }), "VAT 15%");
  assert.equal(taxLabel({ name: "VAT", rate: "15", inclusive: true }), "VAT 15% (included)");
});

test("every status has a tone, and the unpaid tab lists the payable ones", () => {
  for (const s of ["DRAFT", "ISSUED", "PART_PAID", "PAID", "OVERDUE", "VOID", "DISPUTED"]) assert.ok(INVOICE_STATUS_TONES[s], s);
  assert.equal(INVOICE_TABS[0].status, "ISSUED,PART_PAID,OVERDUE");
  assert.equal(INVOICE_TABS.at(-1).status, undefined);
});

test("actions, history and errors in plain language", () => {
  assert.equal(actionLabel("record_payment"), "Record a payment");
  assert.equal(eventLabel("PAID"), "Paid in full");
  assert.match(invoiceErrorText("INVOICE_HAS_PAYMENTS"), /credit note/);
  assert.match(invoiceErrorText("RENEWAL_EXISTS"), /already has a renewal/);
  assert.equal(invoiceErrorText("SOMETHING_ELSE"), null);
});

test("the payer's status line", () => {
  const day = (iso) => `[${iso}]`;
  assert.equal(payerStatusText("ISSUED", "2026-12-04", day), "Due on [2026-12-04].");
  assert.match(payerStatusText("OVERDUE", "2026-12-04", day), /^Overdue/);
  assert.equal(payerStatusText("PAID", "2026-12-04", day), "Paid. Thank you.");
});
