// Checks the rules of online payment of subscription invoices
// (src/lib/online-payment.ts, API 0.42.0): when "Pay online" shows, the
// payment status words, the return page's state and polling, and the
// refundable amount in exact decimals. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPayOnline,
  compareDecimals,
  isFullRefund,
  moneyText,
  normaliseRefundAmount,
  paymentMessage,
  paymentStatusLabel,
  paymentStatusText,
  pickPayment,
  refundableAmount,
  refundAmountProblem,
  refundReasonProblem,
  refundTarget,
  RETURN_POLL_LIMIT_MS,
  RETURN_WORDS,
  returnState,
  safeHostedUrl,
  shouldPoll,
  subtractDecimals,
} from "../src/lib/online-payment.ts";

test("Pay online shows exactly when the API offers it on a PENDING_PAYMENT subscription", () => {
  assert.equal(canPayOnline({ status: "PENDING_PAYMENT", online_payment_available: true }), true);
  // PAYMENT_GATEWAY=none: the flag is false, or absent from an older API.
  assert.equal(canPayOnline({ status: "PENDING_PAYMENT", online_payment_available: false }), false);
  assert.equal(canPayOnline({ status: "PENDING_PAYMENT" }), false);
  assert.equal(canPayOnline({ status: "PENDING_PAYMENT", online_payment_available: null }), false);
  // Never on another status, even if the flag were wrongly true.
  for (const status of ["ACTIVE", "EXPIRED", "REJECTED", "CANCELLED"]) {
    assert.equal(canPayOnline({ status, online_payment_available: true }), false, status);
  }
  assert.equal(canPayOnline(null), false);
  assert.equal(canPayOnline(undefined), false);
});

test("only http(s) hosted pages are followed", () => {
  assert.equal(safeHostedUrl("https://api.example.test/v1/payments/fake/checkout/fake_cs_1"), "https://api.example.test/v1/payments/fake/checkout/fake_cs_1");
  assert.equal(safeHostedUrl("http://localhost:8080/v1/payments/fake/checkout/x"), "http://localhost:8080/v1/payments/fake/checkout/x");
  assert.equal(safeHostedUrl("javascript:alert(1)"), null);
  assert.equal(safeHostedUrl("data:text/html,hi"), null);
  assert.equal(safeHostedUrl("/relative"), null);
  assert.equal(safeHostedUrl(null), null);
  assert.equal(safeHostedUrl(""), null);
});

test("decimal maths is exact", () => {
  assert.equal(subtractDecimals("30.00", "10.00"), "20.00");
  assert.equal(subtractDecimals("0.30", "0.10", "0.20"), "0.00");
  assert.equal(subtractDecimals("30", "0.01"), "29.99");
  assert.equal(subtractDecimals("9007199254740993.00", "0.01"), "9007199254740992.99");
  assert.equal(subtractDecimals("10.00", "12.50"), "-2.50");
  assert.equal(subtractDecimals("abc", "1"), null);
  assert.equal(subtractDecimals("1", "1.00001"), null);
  assert.equal(compareDecimals("30.00", "30"), 0);
  assert.equal(compareDecimals("30.01", "30"), 1);
  assert.equal(compareDecimals("0.1", "0.10"), 0);
  assert.equal(compareDecimals("x", "1"), null);
  assert.equal(moneyText("1250.5", "USD"), "USD 1,250.50");
  assert.equal(moneyText("30.00", "USD"), "USD 30.00");
  assert.equal(moneyText("bad", "USD"), "USD bad");
});

test("payment status labels follow the contract and never call an unknown status paid", () => {
  assert.deepEqual(paymentStatusLabel({ status: "SUCCEEDED" }), { label: "Paid", tone: "success" });
  assert.equal(paymentStatusLabel({ status: "OPEN" }).label, "Waiting for the payment provider");
  assert.equal(paymentStatusLabel({ status: "REFUNDED" }).label, "Refunded");
  assert.equal(paymentStatusLabel({ status: "PARTIALLY_REFUNDED", refunded_amount: "10.00", currency_code: "USD" }).label, "Partly refunded (USD 10.00)");
  assert.equal(paymentStatusLabel({ status: "REVIEW" }, "admin").label, "Needs review");
  assert.equal(paymentStatusLabel({ status: "OPEN" }, "admin").label, "Open");
  const unknown = paymentStatusLabel({ status: "SOMETHING_NEW" });
  assert.equal(unknown.label, "Something new");
  assert.notEqual(unknown.tone, "success");
  assert.match(paymentStatusText({ status: "FAILED" }), /did not go through/);
  assert.match(paymentStatusText({ status: "EXPIRED" }), /expired/);
  assert.match(paymentStatusText({ status: "REVIEW" }), /finance team/);
  assert.equal(paymentStatusText({ status: "PARTIALLY_REFUNDED", refunded_amount: "10", currency_code: "USD" }), "USD 10.00 of this payment was refunded.");
});

const payments = [
  { id: "new", status: "OPEN", created_at: "2026-11-19T10:05:00Z" },
  { id: "old", status: "FAILED", created_at: "2026-11-19T10:00:00Z" },
];

test("the return page picks the named payment only among the API's own, else the newest", () => {
  assert.equal(pickPayment(payments, "old")?.id, "old");
  assert.equal(pickPayment(payments, "not-theirs")?.id, "new");
  assert.equal(pickPayment(payments, null)?.id, "new");
  assert.equal(pickPayment([...payments].reverse())?.id, "new");
  assert.equal(pickPayment([], "new"), null);
});

test("the return page state comes from the API only", () => {
  const pending = { status: "PENDING_PAYMENT" };
  const active = { status: "ACTIVE" };
  const at = (status) => ({ id: "p", status });
  assert.equal(returnState({ subscription: active, payment: at("SUCCEEDED"), elapsedMs: 0 }), "paid");
  // Paid at the provider but the subscription not ACTIVE yet: still confirming, never "paid".
  assert.equal(returnState({ subscription: pending, payment: at("SUCCEEDED"), elapsedMs: 0 }), "confirming");
  assert.equal(returnState({ subscription: pending, payment: at("OPEN"), elapsedMs: 5000 }), "confirming");
  assert.equal(returnState({ subscription: pending, payment: at("OPEN"), elapsedMs: RETURN_POLL_LIMIT_MS }), "slow");
  assert.equal(returnState({ subscription: pending, payment: at("FAILED"), elapsedMs: 0 }), "failed");
  assert.equal(returnState({ subscription: pending, payment: at("EXPIRED"), elapsedMs: 0 }), "failed");
  assert.equal(returnState({ subscription: pending, payment: at("REVIEW"), elapsedMs: 0 }), "review");
  // REVIEW is never shown as paid, even if the subscription is active for another reason.
  assert.equal(returnState({ subscription: active, payment: at("REVIEW"), elapsedMs: 0 }), "review");
  assert.equal(returnState({ subscription: { status: "CANCELLED" }, payment: at("REFUNDED"), elapsedMs: 0 }), "refunded");
  assert.equal(returnState({ subscription: pending, payment: null, elapsedMs: 0 }), "missing");
  assert.equal(returnState({ subscription: active, payment: null, elapsedMs: 0 }), "paid");
  assert.equal(returnState({ subscription: null, payment: null, elapsedMs: 0 }), "missing");
});

test("result=cancelled only changes the words for an OPEN payment", () => {
  const pending = { status: "PENDING_PAYMENT" };
  assert.equal(returnState({ subscription: pending, payment: { id: "p", status: "OPEN" }, left: true, elapsedMs: 0 }), "cancelled");
  // The address can never make a payment paid or failed.
  assert.equal(returnState({ subscription: { status: "ACTIVE" }, payment: { id: "p", status: "SUCCEEDED" }, left: true, elapsedMs: 0 }), "paid");
  assert.equal(returnState({ subscription: pending, payment: { id: "p", status: "SUCCEEDED" }, left: true, elapsedMs: 0 }), "confirming");
  assert.equal(returnState({ subscription: pending, payment: { id: "p", status: "FAILED" }, left: false, elapsedMs: 0 }), "failed");
});

test("the return page polls only while the outcome can change, for at most about two minutes", () => {
  assert.equal(shouldPoll("confirming", 0), true);
  assert.equal(shouldPoll("cancelled", 1000), true);
  assert.equal(shouldPoll("confirming", RETURN_POLL_LIMIT_MS - 1), true);
  assert.equal(shouldPoll("confirming", RETURN_POLL_LIMIT_MS), false);
  for (const state of ["paid", "failed", "review", "refunded", "missing", "slow"]) assert.equal(shouldPoll(state, 0), false, state);
  assert.ok(RETURN_POLL_LIMIT_MS >= 60_000 && RETURN_POLL_LIMIT_MS <= 150_000);
  assert.equal(RETURN_WORDS.paid.title, "Payment received — your subscription is active");
  assert.equal(RETURN_WORDS.confirming.title, "Still confirming…");
  assert.equal(RETURN_WORDS.failed.title, "Payment failed or cancelled — try again");
});

const paid = {
  status: "SUCCEEDED",
  amount: "30.00",
  currency_code: "USD",
  refunded_amount: "0.00",
  paid_amount: "30.00",
  paid_currency_code: "USD",
  created_at: "2026-11-19T10:00:00Z",
  refunds: [],
};

test("the refundable amount is what was paid minus refunded and pending refunds, exactly", () => {
  assert.deepEqual(refundableAmount(paid), { amount: "30.00", currency: "USD" });
  assert.deepEqual(refundableAmount({ ...paid, status: "PARTIALLY_REFUNDED", refunded_amount: "10.10" }), { amount: "19.90", currency: "USD" });
  assert.deepEqual(
    refundableAmount({ ...paid, status: "PARTIALLY_REFUNDED", refunded_amount: "0.10", refunds: [{ amount: "0.20", status: "PENDING" }, { amount: "5.00", status: "FAILED" }] }),
    { amount: "29.70", currency: "USD" },
  );
  // What was actually paid counts, not the invoice amount.
  assert.deepEqual(refundableAmount({ ...paid, status: "REVIEW", paid_amount: "25.50" }), { amount: "25.50", currency: "USD" });
  assert.deepEqual(refundableAmount({ ...paid, paid_amount: null }), { amount: "30.00", currency: "USD" });
  assert.equal(refundableAmount({ ...paid, status: "REFUNDED", refunded_amount: "30.00" }), null);
  assert.equal(refundableAmount({ ...paid, status: "PARTIALLY_REFUNDED", refunded_amount: "30.00" }), null);
  for (const status of ["OPEN", "FAILED", "EXPIRED"]) assert.equal(refundableAmount({ ...paid, status }), null, status);
});

test("the refund applies to the paid payment first, then one under review", () => {
  const review = { ...paid, status: "REVIEW", created_at: "2026-11-19T11:00:00Z", paid_amount: "5.00" };
  assert.equal(refundTarget([review, paid])?.status, "SUCCEEDED");
  assert.equal(refundTarget([review, { ...paid, status: "REFUNDED", refunded_amount: "30.00" }])?.refundable.amount, "5.00");
  assert.equal(refundTarget([{ ...paid, status: "OPEN" }]), null);
  assert.equal(refundTarget([]), null);
});

test("refund amounts are checked exactly", () => {
  assert.equal(refundAmountProblem("30.00", "30.00", "USD"), null);
  assert.equal(refundAmountProblem("0.01", "30.00", "USD"), null);
  assert.equal(refundAmountProblem("30.01", "30.00", "USD"), "The most that can be refunded is USD 30.00.");
  assert.match(refundAmountProblem("", "30.00", "USD"), /Enter the amount/);
  assert.match(refundAmountProblem("0", "30.00", "USD"), /above zero/);
  assert.match(refundAmountProblem("1,5", "30.00", "USD"), /without commas/);
  assert.match(refundAmountProblem("1.234", "30.00", "USD"), /two decimals/);
  assert.match(refundAmountProblem("-1", "30.00", "USD"), /two decimals/);
  assert.equal(normaliseRefundAmount("030.5"), "30.50");
  assert.equal(normaliseRefundAmount("7"), "7.00");
  assert.equal(isFullRefund("30", "30.00"), true);
  assert.equal(isFullRefund("29.99", "30.00"), false);
  assert.match(refundReasonProblem("ok"), /at least 3/);
  assert.equal(refundReasonProblem("  Customer asked  "), null);
  assert.match(refundReasonProblem("x".repeat(1001)), /1000/);
});

test("payment errors have plain words", () => {
  assert.match(paymentMessage({ code: "PAYMENT_PROVIDER_ERROR", message: "x" }), /Nothing was charged/);
  assert.match(paymentMessage({ code: "ONLINE_PAYMENT_NOT_OFFERED", message: "x" }), /bank transfer/);
  assert.equal(paymentMessage({ code: "OTHER", message: "From the API" }), "From the API");
});
