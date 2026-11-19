// Checks the rules of a tenancy's rent (src/lib/rent.ts): exact decimals in
// one currency, due status words, oldest-first allocation and the checks on a
// chosen allocation (decimals included), the receipt form and body, arrears
// ageing grouped per currency, the statement query and the tolerant readers
// of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountProblem } from "../src/lib/ledger.ts";
import {
  ageDues,
  ageingBucket,
  allocationProblems,
  arrearsHref,
  canRecordReceipt,
  compareAmounts,
  createdReceipt,
  daysBetween,
  dueBadge,
  dueStatusLabel,
  emptyReceiptForm,
  fromUnits,
  groupArrears,
  hasAllocationProblems,
  hasReceiptProblems,
  isOverdue,
  normaliseArrears,
  normaliseDueList,
  normaliseDues,
  normaliseReceipts,
  normaliseStatement,
  oldestFirst,
  receiptApiProblems,
  receiptBody,
  receiptProblems,
  rentSummary,
  reverseReasonProblem,
  statementQuery,
  subtractAmounts,
  sumAmounts,
  toUnits,
  waiveReasonProblem,
} from "../src/lib/rent.ts";

const due = (id, dueDate, outstanding, extra = {}) => ({
  id,
  dueDate,
  periodStart: null,
  periodEnd: null,
  amount: extra.amount ?? "950.00",
  paid: null,
  outstanding,
  currency: extra.currency ?? "USD",
  minorUnit: 2,
  status: extra.status ?? "DUE",
  statusLabel: null,
  waivedReason: null,
  waivedAt: null,
  waivedBy: null,
  can: null,
});

const TODAY = "2026-11-19";

test("decimals are exact, at four places, never floats", () => {
  assert.equal(toUnits("0.1"), 1000n);
  assert.equal(toUnits("1.00001"), null);
  assert.equal(toUnits("12,5"), null);
  assert.equal(sumAmounts(["0.10", "0.20"], 2), "0.30");
  assert.equal(sumAmounts(["9999999999999999.99", "0.01"], 2), "10000000000000000.00");
  assert.equal(sumAmounts(["5000", "1"], 0), "5001");
  assert.equal(sumAmounts(["1.234", "0.001"], 3), "1.235");
  assert.equal(sumAmounts(["1", "x"]), null);
  assert.equal(subtractAmounts("950.00", "300.5", 2), "649.50");
  assert.equal(subtractAmounts("1", "2", 2), "-1.00");
  assert.equal(compareAmounts("1.10", "1.1"), 0);
  assert.equal(compareAmounts("1.01", "1.1"), -1);
  assert.equal(compareAmounts("x", "1"), null);
  assert.equal(fromUnits(12345n, 2), "1.2345", "a non-zero digit past the minor units is kept, not rounded");
});

test("due status words never rely on colour alone and say overdue", () => {
  assert.deepEqual(dueBadge({ status: "PAID", dueDate: "2026-10-01", outstanding: "0.00" }, TODAY), { words: "Paid in full", tone: "success" });
  assert.deepEqual(dueBadge({ status: "WAIVED", dueDate: "2026-10-01", outstanding: "0" }, TODAY), { words: "Waived", tone: "info" });
  assert.equal(dueBadge({ status: "DUE", dueDate: "2026-12-01", outstanding: "950.00" }, TODAY).words, "Due");
  assert.equal(dueBadge({ status: "DUE", dueDate: "2026-11-01", outstanding: "950.00" }, TODAY).words, "Overdue");
  assert.equal(dueBadge({ status: "PART_PAID", dueDate: "2026-12-01", outstanding: "50.00" }, TODAY).words, "Part paid");
  assert.equal(dueBadge({ status: "PART_PAID", dueDate: "2026-11-01", outstanding: "50.00" }, TODAY).words, "Part paid, overdue");
  assert.equal(dueBadge({ status: "DUE", dueDate: TODAY, outstanding: "950.00" }, TODAY).words, "Due", "due today is not yet overdue");
  assert.equal(dueBadge({ status: "SOMETHING_NEW", dueDate: null, outstanding: null }, TODAY).words, "Something new");
  for (const status of ["DUE", "PART_PAID", "PAID", "WAIVED"]) assert.ok(dueBadge({ status, dueDate: "2026-01-01", outstanding: "1" }, TODAY).words.length > 0);
  assert.equal(dueStatusLabel("PART_PAID"), "Part paid");
  assert.equal(dueStatusLabel("DUE", "Owed"), "Owed");
  assert.equal(isOverdue({ status: "PAID", dueDate: "2026-01-01", outstanding: "0.00" }, TODAY), false);
});

test("oldest first takes each due's outstanding in date order", () => {
  const dues = [due("c", "2026-12-01", "950.00"), due("a", "2026-10-01", "100.00", { status: "PART_PAID" }), due("b", "2026-11-01", "950.00"), due("p", "2026-09-01", "0.00", { status: "PAID" })];
  assert.deepEqual(oldestFirst(dues, "1000.50"), {
    allocations: [
      { dueId: "a", amount: "100.00" },
      { dueId: "b", amount: "900.50" },
    ],
    left: "0.00",
  });
  assert.deepEqual(oldestFirst(dues, "3000.00")?.left, "1000.00");
  assert.equal(oldestFirst(dues, "abc"), null);
  assert.deepEqual(oldestFirst([due("j", "2026-11-01", "5000", { currency: "JPY", amount: "5000" })], "7000", 0), { allocations: [{ dueId: "j", amount: "5000" }], left: "2000" });
});

test("a chosen allocation must add up to the receipt exactly and stay within each due", () => {
  const dues = [due("a", "2026-10-01", "100.00", { status: "PART_PAID" }), due("b", "2026-11-01", "950.00"), due("p", "2026-09-01", "0.00", { status: "PAID" })];
  assert.deepEqual(allocationProblems("1050.00", "USD", { a: "100", b: "950.00" }, dues, amountProblem), { rows: {} });
  assert.equal(hasAllocationProblems(allocationProblems("0.30", "USD", { a: "0.10", b: "0.20" }, dues, amountProblem)), false, "0.10 + 0.20 is exactly 0.30");
  const short = allocationProblems("1000.00", "USD", { a: "100.00", b: "899.99" }, dues, amountProblem);
  assert.match(short.total, /USD 999\.99, USD 0\.01 less than the receipt/);
  const over = allocationProblems("1000.00", "USD", { a: "100.00", b: "900.01" }, dues, amountProblem);
  assert.match(over.total, /USD 0\.01 more than the receipt/);
  const tooMuch = allocationProblems("200.00", "USD", { a: "100.01", b: "99.99" }, dues, amountProblem);
  assert.match(tooMuch.rows.a, /More than the USD 100\.00 still outstanding/);
  const decimals = allocationProblems("100.00", "USD", { a: "99.995", b: "0.005" }, dues, amountProblem);
  assert.match(decimals.rows.a, /at most 2 decimal places/);
  const yen = allocationProblems("5000", "JPY", { j: "4999.5" }, [due("j", "2026-11-01", "5000", { currency: "JPY" })], amountProblem, 0);
  assert.match(yen.rows.j, /no decimal places/);
  assert.match(allocationProblems("10.00", "USD", { p: "10.00" }, dues, amountProblem).rows.p, /no longer open/);
  assert.match(allocationProblems("10.00", "USD", { a: "", b: " " }, dues, amountProblem).total, /at least one due/);
  assert.match(allocationProblems("10.00", "USD", { a: "-5" }, dues, amountProblem).rows.a, /minus/);
});

test("the receipt form checks the amount, method, date, reference and allocation", () => {
  const dues = [due("a", "2026-10-01", "950.00"), due("b", "2026-11-01", "950.00")];
  const form = { ...emptyReceiptForm(TODAY), amount: "950.00", method: "BANK" };
  assert.equal(hasReceiptProblems(receiptProblems(form, "USD", dues, TODAY, amountProblem)), false);
  const empty = receiptProblems(emptyReceiptForm(TODAY), "USD", dues, TODAY, amountProblem);
  assert.ok(empty.amount && empty.method);
  assert.match(receiptProblems({ ...form, receivedOn: "2026-11-20" }, "USD", dues, TODAY, amountProblem).receivedOn, /future/);
  assert.match(receiptProblems({ ...form, receivedOn: "2026-02-30" }, "USD", dues, TODAY, amountProblem).receivedOn, /real date/);
  assert.match(receiptProblems({ ...form, receivedOn: "2026-09-30" }, "USD", dues, TODAY, amountProblem, 2, "2026-10-01").receivedOn, /before the tenancy started/);
  assert.match(receiptProblems({ ...form, reference: "x".repeat(121) }, "USD", dues, TODAY, amountProblem).reference, /120/);
  assert.match(receiptProblems({ ...form, amount: "2000.00" }, "USD", dues, TODAY, amountProblem).allocation.total, /more than the USD 1900\.00 outstanding/);
  assert.match(receiptProblems(form, "USD", [], TODAY, amountProblem).allocation.total, /Nothing is outstanding/);
  assert.match(receiptProblems({ ...form, mode: "CHOSEN", chosen: { b: "900.00" } }, "USD", dues, TODAY, amountProblem).allocation.total, /less than the receipt/);
  assert.equal(hasReceiptProblems(receiptProblems({ ...form, mode: "CHOSEN", chosen: { b: "950" } }, "USD", dues, TODAY, amountProblem)), false);
});

test("the API's field errors land under the right controls", () => {
  const body = { amount: "950.00", allocations: [{ due_id: "a", amount: "500.00" }, { due_id: "b", amount: "450.00" }] };
  const problems = receiptApiProblems(
    {
      currency: "must be the rent currency (USD)",
      "allocations[1].amount": "is more than the 400.00 outstanding on this due",
      allocations: "must add up to the amount (950.00)",
      "ledger.category": "is not active",
    },
    body,
  );
  assert.equal(problems.amount, "must be the rent currency (USD)");
  assert.deepEqual(problems.allocation, { rows: { b: "is more than the 400.00 outstanding on this due" }, total: "must add up to the amount (950.00)" });
  assert.deepEqual(problems.other, ["is not active"]);
  assert.deepEqual(receiptApiProblems(undefined, {}), { other: [] });
});

test("the receipt body: rent currency, oldest first sends no allocations, chosen ones in due order", () => {
  const dues = [due("a", "2026-10-01", "950.00"), due("b", "2026-11-01", "950.00")];
  const form = { ...emptyReceiptForm(TODAY), amount: " 0950.50", method: "CASH", reference: "  RCPT-1 " };
  assert.deepEqual(receiptBody(form, "USD", dues), { amount: "950.50", currency: "USD", method: "CASH", received_on: TODAY, reference: "RCPT-1" });
  assert.equal(receiptBody({ ...form, tenantContactId: "c2" }, "USD", dues).tenant_contact_id, "c2");
  assert.deepEqual(receiptBody({ ...form, reference: "", mode: "CHOSEN", chosen: { b: "900.50", a: "50", x: "" } }, "USD", dues), {
    amount: "950.50",
    currency: "USD",
    method: "CASH",
    received_on: TODAY,
    allocations: [
      { due_id: "a", amount: "50" },
      { due_id: "b", amount: "900.50" },
    ],
  });
});

test("waive and undo need a reason", () => {
  assert.match(waiveReasonProblem("  "), /Say why/);
  assert.match(waiveReasonProblem("x".repeat(501)), /500/);
  assert.equal(waiveReasonProblem("Rent-free month for repairs"), null);
  assert.match(reverseReasonProblem(""), /Say why/);
  assert.equal(reverseReasonProblem("Recorded twice"), null);
});

test("ageing buckets are 0-30, 31-60, 61-90 and 90+", () => {
  assert.equal(ageingBucket(1), "0-30");
  assert.equal(ageingBucket(30), "0-30");
  assert.equal(ageingBucket(31), "31-60");
  assert.equal(ageingBucket(60), "31-60");
  assert.equal(ageingBucket(61), "61-90");
  assert.equal(ageingBucket(90), "61-90");
  assert.equal(ageingBucket(91), "90+");
  assert.equal(daysBetween("2026-10-20", TODAY), 30);
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2, "a leap day counts");
});

test("arrears are grouped per currency and never added across currencies", () => {
  const row = (tenancyId, currency, buckets, total, oldest = null) => ({
    tenancyId,
    currency,
    tenants: tenancyId,
    property: "P",
    unit: null,
    buckets: { "0-30": "0", "31-60": "0", "61-90": "0", "90+": "0", ...buckets },
    total,
    oldestDueDate: oldest,
    daysOverdue: null,
    dues: null,
  });
  const blocks = groupArrears(
    [row("t1", "USD", { "0-30": "950.00" }, "950.00"), row("t2", "ZWG", { "90+": "1000.10" }, "1000.10"), row("t3", "USD", { "31-60": "0.10", "90+": "0.20" }, "0.30"), row("t4", "USD", { "0-30": "950" }, "950", "2026-09-01")],
    (currency) => (currency === "JPY" ? 0 : 2),
  );
  assert.deepEqual(
    blocks.map((block) => block.currency),
    ["USD", "ZWG"],
  );
  const usd = blocks[0];
  assert.deepEqual(usd.buckets, { "0-30": "1900.00", "31-60": "0.10", "61-90": "0.00", "90+": "0.20" });
  assert.equal(usd.total, "1900.30");
  assert.deepEqual(
    usd.rows.map((item) => item.tenancyId),
    ["t4", "t1", "t3"],
    "largest first, then the oldest debt",
  );
  assert.equal(blocks[1].total, "1000.10");
  assert.equal(blocks[1].rows.length, 1);
});

test("a tenancy's overdue dues are aged on today, per currency", () => {
  const dues = [
    due("a", "2026-07-01", "950.00"),
    due("b", "2026-09-01", "950.00"),
    due("c", "2026-11-01", "100.00", { status: "PART_PAID" }),
    due("d", "2026-12-01", "950.00"),
    due("w", "2026-08-01", "0", { status: "WAIVED" }),
    due("z", "2026-11-10", "50", { currency: "ZAR" }),
  ];
  const rows = ageDues(dues, TODAY, { tenancyId: "t", tenants: "K", property: "P", unit: null });
  assert.equal(rows.length, 2);
  const usd = rows.find((item) => item.currency === "USD");
  assert.deepEqual(usd.buckets, { "0-30": "100.00", "31-60": "0.00", "61-90": "950.00", "90+": "950.00" });
  assert.equal(usd.total, "2000.00");
  assert.equal(usd.oldestDueDate, "2026-07-01");
  assert.equal(usd.dues, 3);
  assert.equal(rows.find((item) => item.currency === "ZAR").total, "50.00");
  const summary = rentSummary(dues, TODAY);
  const usdSummary = summary.find((item) => item.currency === "USD");
  assert.equal(usdSummary.charged, "3800.00", "dues dated today or earlier, the waived one included");
  assert.equal(usdSummary.outstanding, "2000.00", "rent not yet due is not outstanding to date");
  assert.equal(usdSummary.overdue, "2000.00");
  assert.equal(usdSummary.overdueCount, 3);
  assert.equal(usdSummary.nextDue.id, "d");
  assert.equal(summary.find((item) => item.currency === "ZAR").overdue, "50.00", "each currency has its own summary");
  assert.equal(isOverdue({ status: "DUE", dueDate: "2026-11-18", outstanding: "1.00", overdue: false }, TODAY), false, "the API's flag wins");
});

test("the statement query and the arrears address", () => {
  assert.equal(statementQuery({ from: "2026-01-01", to: "2026-11-19" }), "?from=2026-01-01&to=2026-11-19");
  assert.equal(statementQuery({ from: "nope" }, "csv"), "?format=csv");
  assert.equal(statementQuery({}, "pdf"), "?format=pdf");
  assert.equal(statementQuery({}), "");
  assert.equal(arrearsHref("org-1"), "/agent/arrears?org=org-1");
  assert.equal(arrearsHref(), "/agent/arrears");
});

test("receipts can be recorded on an active tenancy, or on an ended one with rent open", () => {
  assert.equal(canRecordReceipt("ACTIVE", []), true);
  assert.equal(canRecordReceipt("ENDED", [due("a", "2026-10-01", "1.00")]), true);
  assert.equal(canRecordReceipt("ENDED", [due("a", "2026-10-01", "0.00", { status: "PAID" })]), false);
  assert.equal(canRecordReceipt("DRAFT", []), false);
  assert.equal(canRecordReceipt("DRAFT", [due("a", "2026-10-01", "1.00")]), false);
  assert.equal(canRecordReceipt("TERMINATED", [due("a", "2026-10-01", "1.00")]), true);
});

test("readers: dues, receipts, statement and arrears", () => {
  const dues = normaliseDues({
    items: [
      { id: "d2", due_date: "2026-12-01", amount: "950.00", currency: "USD", paid: "0.00", outstanding: "950.00", status: "DUE" },
      { id: "d1", due_date: "2026-11-01", amount: { amount: "950.00", currency: "usd", minor_unit: 2 }, paid: { amount: "300.00", currency: "USD" }, status: "PART_PAID", can: { waive: true } },
      { id: "w", due_date: "2026-10-01", amount: "950.00", currency: "USD", status: "WAIVED", waive_reason: "Repairs", waived_by: { name: "Rudo" } },
      { id: "bad", amount: "x" },
    ],
  });
  assert.deepEqual(
    dues.map((item) => item.id),
    ["w", "d1", "d2"],
  );
  assert.equal(dues[1].currency, "USD");
  assert.equal(dues[1].outstanding, "650.0000");
  assert.deepEqual(dues[1].can, { waive: true });
  assert.equal(dues[0].outstanding, "0");
  assert.equal(dues[0].waivedReason, "Repairs");
  assert.equal(dues[0].waivedBy, "Rudo");

  const receipts = normaliseReceipts({
    receipts: [
      { id: "r1", amount: "950.00", currency: "USD", method: "BANK", received_on: "2026-10-02", ledger_entry: { id: "e1", status: "USER_RECORDED_UNVERIFIED" }, allocations: [{ due_id: "d1", amount: "950.00" }] },
      { id: "r2", amount: { amount: "10.00", currency: "USD" }, method: "CASH", received_on: "2026-11-02", ledger_entry_id: "e2", reversed: true, reversal_entry_id: "e3" },
    ],
  });
  assert.deepEqual(
    receipts.map((item) => item.id),
    ["r2", "r1"],
  );
  assert.equal(receipts[1].ledgerEntryId, "e1");
  assert.equal(receipts[1].reversed, false);
  assert.equal(receipts[0].reversed, true);
  assert.equal(receipts[0].reversalEntryId, "e3");
  assert.deepEqual(receipts[1].allocations, [{ dueId: "d1", dueDate: null, amount: "950.00" }]);
  assert.deepEqual(createdReceipt({ receipt: { id: "r9", amount: "1.00", currency: "USD", ledger_entry_id: "e9" } }), { id: "r9", ledgerEntryId: "e9" });

  const statement = normaliseStatement({
    currencies: [
      {
        currency: "USD",
        opening_balance: "0.00",
        closing_balance: "950.00",
        totals: { charged: "1900.00", received: "950.00", waived: "0.00" },
        lines: [
          { kind: "DUE", date: "2026-10-01", amount: "950.00", balance: "950.00" },
          { kind: "RECEIPT", date: "2026-10-02", amount: "-950.00", balance: "0.00", receipt_id: "r1" },
        ],
      },
    ],
  });
  assert.equal(statement.length, 1);
  assert.equal(statement[0].closing, "950.00");
  assert.equal(statement[0].charged, "1900.00");
  assert.equal(statement[0].lines[0].charge, "950.00");
  assert.equal(statement[0].lines[1].credit, "950.00");
  assert.equal(statement[0].lines[1].description, "Payment received");
  assert.equal(normaliseStatement({ statement: { USD: { lines: [] }, ZWG: { lines: [] } } }).length, 2);

  const blocks = normaliseArrears({
    currencies: [
      {
        currency: "USD",
        buckets: { "0-30": "950.00", "31-60": "0.00", "61-90": "0.00", "90+": "700.00" },
        total: "1650.00",
        tenancies: [
          { tenancy_id: "t1", tenants: [{ name: "Kudzai Sithole" }], property: { name: "Avondale Court" }, unit: { label: "Flat 1" }, buckets: { "0-30": "950.00" }, total: "950.00" },
          { tenancy_id: "t2", tenants: [{ name: "Tariro Moyo" }], property: { name: "Borrowdale Cottage" }, buckets: [{ bucket: "90+", amount: "700.00" }], total: "700.00" },
        ],
      },
    ],
  });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].total, "1650.00");
  assert.equal(blocks[0].rows[0].tenants, "Kudzai Sithole");
  assert.equal(blocks[0].rows[0].unit, "Flat 1");
  assert.equal(blocks[0].rows[1].buckets["90+"], "700.00");
  const flat = normaliseArrears({ items: [{ tenancy_id: "a", currency: "USD", buckets: { "0-30": "1.00" }, total: "1.00" }, { tenancy_id: "b", currency: "ZAR", buckets: { "0-30": "2.00" }, total: "2.00" }] });
  assert.deepEqual(
    flat.map((block) => [block.currency, block.total]),
    [
      ["USD", "1.00"],
      ["ZAR", "2.00"],
    ],
  );
  assert.deepEqual(normaliseArrears({ currencies: [] }), []);
});

test("readers follow the published shapes (API 0.36.1)", () => {
  const list = normaliseDueList({
    items: [
      {
        id: "d1",
        tenancy_id: "t",
        sequence: 1,
        due_date: "2026-11-01",
        period: { from: "2026-11-01", to: "2026-11-30" },
        amount: "950.00",
        currency: "USD",
        minor_unit: 2,
        paid: "500.00",
        waived: "0.00",
        outstanding: "450.00",
        status: "PART_PAID",
        status_label: "Part paid",
        overdue: true,
        days_overdue: 18,
        waiver: null,
        can: { waive: true },
      },
      {
        id: "d0",
        due_date: "2026-10-01",
        amount: "950.00",
        currency: "USD",
        paid: "0.00",
        waived: "950.00",
        outstanding: "0.00",
        status: "WAIVED",
        overdue: false,
        days_overdue: 0,
        waiver: { at: "2026-10-03T08:00:00Z", by: { user_id: null, name: "Chipo Dube" }, reason: "Storm damage" },
      },
    ],
    summary: { currency: "USD", minor_unit: 2, charged: "1900.00", paid: "500.00", waived: "950.00", outstanding: "450.00", overdue: "450.00", overdue_count: 1, paid_in_advance: "0.00", next_due: null },
    schedule: { rolling: true, through: "2027-11-30", count: 14, rule: "Monthly on day 1" },
  });
  assert.deepEqual(
    list.dues.map((item) => item.id),
    ["d0", "d1"],
  );
  assert.equal(list.dues[1].periodEnd, "2026-11-30");
  assert.equal(list.dues[1].overdue, true);
  assert.equal(list.dues[1].daysOverdue, 18);
  assert.equal(list.dues[0].waivedBy, "Chipo Dube");
  assert.equal(list.dues[0].waivedReason, "Storm damage");
  assert.equal(list.dues[0].waived, "950.00");
  assert.equal(dueBadge(list.dues[1], "2026-11-01", list.dues[1].statusLabel).words, "Part paid, overdue", "the API's overdue flag decides");
  assert.equal(list.summary.outstanding, "450.00");
  assert.equal(list.summary.overdueCount, 1);
  assert.equal(list.summary.nextDue, null);
  assert.deepEqual(list.schedule, { rolling: true, through: "2027-11-30", count: 14, rule: "Monthly on day 1" });
  assert.deepEqual(normaliseDueList({ items: [], summary: null, schedule: null }), { dues: [], summary: null, schedule: null });

  const [reversed, live] = normaliseReceipts({
    items: [
      {
        id: "r1",
        amount: "950.00",
        currency: "USD",
        minor_unit: 2,
        method: "BANK",
        method_label: "Bank",
        received_on: "2026-10-01",
        reference: "FNB 4471",
        tenant: { id: "c", name: "Kudzai Sithole", live: true },
        status: "RECORDED",
        allocations: [{ due_id: "d0", due_date: "2026-10-01", amount: "950.00", currency: "USD", minor_unit: 2 }],
        ledger_entry_id: "e1",
        ledger_status: "USER_RECORDED_UNVERIFIED",
        reversal: null,
        recorded_by: { name: "Chipo Dube" },
        recorded_at: "2026-10-01T09:00:00Z",
        can: { reverse: true },
      },
      {
        id: "r2",
        amount: "10.00",
        currency: "USD",
        method: "CASH",
        received_on: "2026-11-02",
        status: "REVERSED",
        allocations: [],
        ledger_entry_id: "e2",
        reversal: { ledger_entry_id: "e3", reversed_on: "2026-11-05", at: "2026-11-05T10:00:00Z" },
        can: { reverse: false },
      },
    ],
  });
  assert.equal(live.reversed, false);
  assert.equal(live.tenant, "Kudzai Sithole");
  assert.equal(live.ledgerEntryId, "e1");
  assert.equal(live.ledgerStatus, "USER_RECORDED_UNVERIFIED");
  assert.deepEqual(live.can, { reverse: true });
  assert.equal(live.allocations[0].dueDate, "2026-10-01");
  assert.equal(reversed.reversed, true);
  assert.equal(reversed.reversalEntryId, "e3");
  assert.equal(reversed.reversedOn, "2026-11-05");
  const mine = normaliseReceipts({ items: [{ id: "m", amount: "950.00", currency: "USD", method: "BANK", received_on: "2026-11-02", status: "REVERSED", allocations: [], reversed_on: "2026-11-05" }] })[0];
  assert.equal(mine.reversed, true);
  assert.equal(mine.ledgerEntryId, null, "the tenant's view has no ledger ids");
  assert.deepEqual(createdReceipt({ receipt: { id: "r9", amount: "1.00", currency: "USD", ledger_entry_id: "e9" }, dues: [] }), { id: "r9", ledgerEntryId: "e9" });

  const [usd] = normaliseStatement({
    tenancy: { id: "t" },
    from: "2026-09-19",
    to: "2026-11-19",
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        opening_balance: "0.00",
        charged: "1900.00",
        paid: "950.00",
        reversed: "10.00",
        waived: "0.00",
        closing_balance: "960.00",
        overdue: "950.00",
        lines: [
          { date: "2026-10-01", type: "CHARGE", description: "Rent 2026-10-01 to 2026-10-31", reference: "", currency: "USD", debit: "950.00", credit: "0.00", balance: "950.00", due_id: "d", receipt_id: null },
          { date: "2026-10-01", type: "PAYMENT", description: "Payment (Bank)", reference: "FNB 4471", currency: "USD", debit: "0.00", credit: "950.00", balance: "0.00", due_id: null, receipt_id: "r" },
          { date: "2026-11-05", type: "PAYMENT_REVERSED", description: "", currency: "USD", debit: "10.00", credit: "0.00", balance: "10.00" },
        ],
      },
    ],
  });
  assert.equal(usd.received, "950.00");
  assert.equal(usd.reversed, "10.00");
  assert.equal(usd.overdue, "950.00");
  assert.equal(usd.closing, "960.00");
  assert.equal(usd.lines[0].charge, "950.00");
  assert.equal(usd.lines[0].credit, null, "a zero credit is left empty");
  assert.equal(usd.lines[1].credit, "950.00");
  assert.equal(usd.lines[1].reference, "FNB 4471");
  assert.equal(usd.lines[2].description, "Payment undone (reversed)");
  assert.deepEqual(normaliseStatement({ currencies: [] }), []);

  const bucket = (key, amount, count = 0) => ({ bucket: key, currency: "USD", minor_unit: 2, outstanding: amount, count });
  const empty = (overrides) => [bucket("0-30", "0.00"), bucket("31-60", "0.00"), bucket("61-90", "0.00"), bucket("90+", "0.00")].map((item) => (overrides[item.bucket] ? bucket(item.bucket, overrides[item.bucket], 1) : item));
  const blocks = normaliseArrears({
    as_of: "2026-11-19",
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        outstanding: "1100.00",
        count: 2,
        buckets: empty({ "0-30": "400.00", "31-60": "700.00" }),
        tenancies: [
          {
            tenancy: { id: "t1", status: "ACTIVE", property: { id: "p", name: "Avondale Court" }, unit: { id: "u", label: "Flat 1" }, tenants: [{ id: "c", name: "Kudzai Sithole", live: true }] },
            currency: "USD",
            outstanding: "400.00",
            count: 1,
            oldest_due_date: "2026-11-02",
            days_overdue: 17,
            buckets: empty({ "0-30": "400.00" }),
          },
          {
            tenancy: { id: "t2", status: "ACTIVE", property: { id: "q", name: "Borrowdale Cottage" }, unit: null, tenants: [{ id: "d", name: "Tariro Moyo", live: true }] },
            currency: "USD",
            outstanding: "700.00",
            count: 1,
            oldest_due_date: "2026-10-05",
            days_overdue: 45,
            buckets: empty({ "31-60": "700.00" }),
          },
        ],
      },
    ],
  });
  assert.equal(blocks[0].total, "1100.00");
  assert.equal(blocks[0].buckets["31-60"], "700.00");
  assert.deepEqual(
    blocks[0].rows.map((row) => row.tenancyId),
    ["t2", "t1"],
    "most overdue first",
  );
  assert.equal(blocks[0].rows[0].tenants, "Tariro Moyo");
  assert.equal(blocks[0].rows[0].property, "Borrowdale Cottage");
  assert.equal(blocks[0].rows[0].unit, null);
  assert.equal(blocks[0].rows[0].daysOverdue, 45);
  assert.equal(blocks[0].rows[0].dues, 1);
  assert.equal(blocks[0].rows[1].unit, "Flat 1");
});
