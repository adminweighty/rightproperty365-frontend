// Checks the books' own rules (src/lib/ledger.ts): amounts per currency's
// minor units, exact formatting, per-currency grouping that never adds two
// currencies together, the status words, the list's filters in the address
// and the API query, permissions, entry links, the form body and the tolerant
// readers of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDecimals,
  ageingWords,
  categoriesFor,
  entryHistory,
  normaliseCategories,
  normaliseEntryDetail,
  normaliseOptions,
  normaliseStatement,
  paymentFormFor,
  amountProblem,
  canCorrectEntry,
  canExportBooks,
  canReconcileEntry,
  canWriteBooks,
  currencyMinorUnits,
  entryBody,
  entryFormProblems,
  entryMarkers,
  entryRelations,
  emptyEntryForm,
  fileNameFrom,
  fixedDirection,
  FORBIDDEN_STATUS_WORDS,
  formatLedgerAmount,
  formFromEntry,
  groupByCurrency,
  hasLedgerFilters,
  ledgerFilterChips,
  ledgerFiltersApiQuery,
  ledgerFiltersSearch,
  normaliseAmount,
  normaliseCashbook,
  normaliseCategoriesReport,
  normaliseEntry,
  normaliseEntryPage,
  normaliseReceivables,
  parseLedgerFilters,
  primaryEntryId,
  RECONCILED_WORDS,
  signedLedgerAmount,
  statusBadge,
  toMinorUnits,
  totalsByCurrency,
  UNVERIFIED_WORDS,
} from "../src/lib/ledger.ts";

const params = (query) => new URLSearchParams(query);
const CONTACT = "0b8e2f4c-1d2a-4c3b-9e8f-7a6b5c4d3e2f";
const LISTING = "1c9f3a5d-2e3b-4d4c-8f9a-8b7c6d5e4f3a";
const ME = "2d0a4b6e-3f4c-4e5d-9a0b-9c8d7e6f5a4b";

test("minor units per currency: JPY none, USD two, KWD three", () => {
  assert.equal(currencyMinorUnits("JPY"), 0);
  assert.equal(currencyMinorUnits("USD"), 2);
  assert.equal(currencyMinorUnits("ZAR"), 2);
  assert.equal(currencyMinorUnits("KWD"), 3);
  assert.equal(currencyMinorUnits("BHD"), 3);
  assert.equal(currencyMinorUnits("CLF"), 4);
  assert.equal(currencyMinorUnits("ZWG"), 2);
});

test("amounts are checked against the currency's minor units", () => {
  assert.equal(amountProblem("1500", "JPY"), null);
  assert.match(amountProblem("1500.5", "JPY"), /JPY has no decimal places/);
  assert.equal(amountProblem("12.345", "KWD"), null);
  assert.match(amountProblem("12.3456", "KWD"), /at most 3 decimal places/);
  assert.equal(amountProblem("12.34", "USD"), null);
  assert.match(amountProblem("12.345", "USD"), /at most 2 decimal places/);
  assert.equal(amountProblem(" 1 250.50 ", "USD"), null);
  assert.match(amountProblem("", "USD"), /Enter the amount/);
  assert.match(amountProblem("0", "USD"), /above zero/);
  assert.match(amountProblem("0.00", "USD"), /above zero/);
  assert.match(amountProblem("-5", "USD"), /minus/);
  assert.match(amountProblem("1,250.50", "USD"), /without commas/);
  assert.match(amountProblem("12a", "USD"), /in figures/);
  assert.match(amountProblem("1e5", "USD"), /in figures/);
  assert.match(amountProblem("12345678901234567", "USD"), /too large/);
  assert.equal(amountProblem("1234567890123456", "USD"), null);
  assert.equal(normaliseAmount("0012.50"), "12.50");
  assert.equal(normaliseAmount("0.5"), "0.5");
});

test("amounts are formatted exactly, with their currency, to minor units", () => {
  assert.equal(formatLedgerAmount("1234.5", "USD"), "USD 1,234.50");
  assert.equal(formatLedgerAmount("123.4500", "USD"), "USD 123.45");
  assert.equal(formatLedgerAmount("1500.0000", "JPY"), "JPY 1,500");
  assert.equal(formatLedgerAmount("1000", "KWD"), "KWD 1,000.000");
  assert.equal(formatLedgerAmount("0.1234", "USD"), "USD 0.1234");
  assert.equal(formatLedgerAmount("-10", "ZAR"), "-ZAR 10.00");
  assert.equal(formatLedgerAmount("99999999999999.99", "USD"), "USD 99,999,999,999,999.99");
  assert.equal(signedLedgerAmount("100", "USD", "IN"), "+USD 100.00");
  assert.equal(signedLedgerAmount("100", "USD", "OUT"), "−USD 100.00");
  assert.equal(toMinorUnits("5.1000", "KWD"), "5.100");
});

test("grouping by currency keeps every currency apart and never sums across them", () => {
  const rows = [
    { currency: "USD", amount: "100.00", direction: "IN" },
    { currency: "ZAR", amount: "1800.00", direction: "IN" },
    { currency: "USD", amount: "40.50", direction: "OUT" },
    { currency: "ZAR", amount: "200.00", direction: "OUT" },
  ];
  const groups = groupByCurrency(rows);
  assert.deepEqual(groups.map((group) => group.currency), ["USD", "ZAR"]);
  assert.equal(groups[0].rows.length, 2);
  const totals = totalsByCurrency(rows);
  assert.equal(totals.length, 2);
  assert.deepEqual(totals[0], { currency: "USD", moneyIn: "100.0000", moneyOut: "40.5000", net: "59.5000", count: 2 });
  assert.deepEqual(totals[1], { currency: "ZAR", moneyIn: "1800.0000", moneyOut: "200.0000", net: "1600.0000", count: 2 });
  // No total anywhere equals the cross-currency sum.
  const crossIn = "1900.0000";
  for (const total of totals) assert.notEqual(total.moneyIn, crossIn);
  assert.ok(!("total" in totals));
});

test("exact decimal sums: no floating point drift", () => {
  assert.equal(addDecimals(["0.1", "0.2"]), "0.3000");
  assert.equal(addDecimals(["10", "-12.5"]), "-2.5000");
  assert.equal(addDecimals(["99999999999999.9999", "0.0001"]), "100000000000000.0000");
  assert.equal(addDecimals(["abc"]), null);
});

test("the status badge has exactly two wordings and never claims verification", () => {
  assert.equal(UNVERIFIED_WORDS, "Recorded by you, not verified");
  assert.equal(RECONCILED_WORDS, "Marked reconciled by your team");
  assert.equal(statusBadge("USER_RECORDED_UNVERIFIED").words, UNVERIFIED_WORDS);
  assert.equal(statusBadge("RECONCILED").words, RECONCILED_WORDS);
  // A reserved or unknown status never reads as more than the organisation said.
  assert.equal(statusBadge("GATEWAY_CONFIRMED").words, UNVERIFIED_WORDS);
  assert.equal(statusBadge("BANK_VERIFIED").words, UNVERIFIED_WORDS);
  assert.equal(statusBadge(undefined).words, UNVERIFIED_WORDS);
  for (const status of ["USER_RECORDED_UNVERIFIED", "RECONCILED", "GATEWAY_CONFIRMED", "X"]) {
    for (const pattern of FORBIDDEN_STATUS_WORDS) assert.doesNotMatch(statusBadge(status).words, pattern);
  }
});

test("filters: read from the address, validated, and the dates put in order", () => {
  const filters = parseLedgerFilters(
    params(`currency=usd&type=RENT_RECEIVED&category=rent&method=BANK&status=RECONCILED&from=2026-11-30&to=2026-11-01&contact=${CONTACT}&listing=${LISTING}&q=%20Flat%204%20&page=2&hide_reversed=1`),
  );
  assert.deepEqual(filters, {
    page: 2,
    currency: "USD",
    type: "RENT_RECEIVED",
    category: "rent",
    method: "BANK",
    status: "RECONCILED",
    from: "2026-11-01",
    to: "2026-11-30",
    contact: CONTACT,
    listing: LISTING,
    q: "Flat 4",
    hideReversed: true,
  });
  const junk = parseLedgerFilters(params("currency=DOLLARS&method=CHEQUE&status=GATEWAY_CONFIRMED&from=2026-02-30&contact=nope&page=-3&type=a%20b"));
  assert.deepEqual(junk, { page: 1 });
  assert.ok(!hasLedgerFilters(junk));
  assert.ok(hasLedgerFilters({ page: 1, currency: "ZAR" }));
});

test("filters: the page address and the API query", () => {
  const filters = { page: 3, currency: "ZAR", contact: CONTACT, listing: LISTING, from: "2026-11-01", q: "rent", hideReversed: true };
  assert.equal(ledgerFiltersSearch(filters, "org1"), `?org=org1&currency=ZAR&from=2026-11-01&contact=${CONTACT}&listing=${LISTING}&q=rent&hide_reversed=1&page=3`);
  assert.equal(ledgerFiltersSearch({ page: 1 }), "");
  assert.equal(
    ledgerFiltersApiQuery(filters),
    `?currency=ZAR&from=2026-11-01&contact_id=${CONTACT}&listing_id=${LISTING}&q=rent&include_reversed=false&page=3&page_size=25`,
  );
  assert.equal(ledgerFiltersApiQuery({ page: 1 }, 10), "?page=1&page_size=10");
  // Round trip.
  assert.deepEqual(parseLedgerFilters(params(ledgerFiltersSearch(filters, "org1").slice(1))), filters);
});

test("filter chips remove one filter each, the dates together", () => {
  const hrefFor = (next) => ledgerFiltersSearch(next);
  const chips = ledgerFilterChips({ page: 2, status: "RECONCILED", from: "2026-11-01", to: "2026-11-30", contact: CONTACT }, { contact: () => "Rudo Moyo" }, hrefFor);
  assert.deepEqual(
    chips.map((chip) => chip.label),
    [RECONCILED_WORDS, "2026-11-01 to 2026-11-30", "Contact: Rudo Moyo"],
  );
  assert.equal(chips[1].href, `?status=RECONCILED&contact=${CONTACT}`);
});

test("who sees which controls", () => {
  assert.ok(canWriteBooks("AGENT"));
  assert.ok(!canWriteBooks("STAFF"));
  assert.ok(canExportBooks("OWNER") && canExportBooks("MANAGER"));
  assert.ok(!canExportBooks("AGENT") && !canExportBooks("STAFF"));
  const mine = { author_user_id: ME, status: "USER_RECORDED_UNVERIFIED", type: "INCOME", reversed_by: null };
  assert.ok(canCorrectEntry("AGENT", mine, ME));
  assert.ok(!canCorrectEntry("AGENT", { ...mine, status: "RECONCILED" }, ME));
  assert.ok(!canCorrectEntry("AGENT", { ...mine, author_user_id: CONTACT }, ME));
  assert.ok(canCorrectEntry("MANAGER", { ...mine, author_user_id: CONTACT, status: "RECONCILED" }, ME));
  assert.ok(!canCorrectEntry("OWNER", { ...mine, reversed_by: CONTACT }, ME));
  assert.ok(!canCorrectEntry("STAFF", mine, ME));
  assert.ok(!canCorrectEntry("OWNER", { ...mine, can_correct: false }, ME));
  assert.ok(canReconcileEntry("OWNER", mine));
  assert.ok(!canReconcileEntry("AGENT", mine));
  assert.ok(canReconcileEntry("AGENT", { ...mine, can_reconcile: true }));
});

test("reversals and corrections are linked both ways", () => {
  const relations = entryRelations({ reversal_of: null, reversed_by: "r1", correction_of: "o1", corrected_by: null, transfer_pair: "t1" });
  assert.deepEqual(relations.map((item) => item.kind), ["REVERSED_BY", "CORRECTS", "TRANSFER_PAIR"]);
  assert.deepEqual(entryMarkers({ type: "REVERSAL", reversal_of: "o1", reversed_by: null, correction_of: null }), ["Reversal"]);
  assert.deepEqual(entryMarkers({ type: "INCOME", reversal_of: null, reversed_by: "r1", correction_of: "o0" }), ["Reversed", "Correction"]);
});

test("the entry form: checks and the body it sends", () => {
  const form = { ...emptyEntryForm("entry", "2026-11-19", "JPY"), type: "EXPENSE", direction: "IN", category: "maintenance", amount: "1500.5", description: "Plumber" };
  assert.match(entryFormProblems(form).amount, /JPY/);
  const ok = { ...form, amount: "001500" };
  assert.deepEqual(entryFormProblems(ok), {});
  const body = entryBody(ok);
  assert.equal(body.direction, "OUT", "an expense is always money out");
  assert.equal(body.amount, "1500");
  assert.equal(body.contact_id, null);
  assert.equal(fixedDirection("INCOME"), "IN");
  assert.equal(fixedDirection("OPENING_BALANCE"), null);

  const transfer = { ...emptyEntryForm("transfer", "2026-11-19"), amount: "50", description: "Banking the cash", transferToMethod: "CASH" };
  assert.match(entryFormProblems(transfer).transfer_to, /somewhere else/);
  const transferOk = { ...transfer, transferToMethod: "BANK" };
  assert.deepEqual(entryFormProblems(transferOk), {});
  assert.deepEqual(entryBody(transferOk).transfer_to, { method: "BANK" });
  assert.equal(entryBody(transferOk).type, "TRANSFER");

  const opening = { ...emptyEntryForm("opening", "2026-11-01", "ZAR"), amount: "2500" };
  assert.deepEqual(entryFormProblems(opening), {});
  assert.equal(entryBody(opening).type, "OPENING_BALANCE");

  const correcting = { ...ok };
  assert.match(entryFormProblems(correcting, "correct").reason, /why/);
  assert.equal(entryBody({ ...correcting, reason: " Wrong amount " }, "correct").reason, "Wrong amount");
});

test("an entry is read tolerantly and pre-fills the correction form", () => {
  const entry = normaliseEntry({
    entry: {
      id: "e1",
      type: "RENT_RECEIVED",
      direction: "IN",
      category: { code: "rent", label: "Rent" },
      method: "BANK",
      amount: "450.0000",
      currency: "USD",
      effective_date: "2026-11-02",
      recorded_at: "2026-11-02T08:00:00Z",
      author: { user_id: ME, name: "Tendai" },
      status: "GATEWAY_CONFIRMED",
      contact_id: CONTACT,
      contact_name: "Rudo Moyo",
      reversed_by: "r1",
    },
  });
  assert.equal(entry.categoryLabel, "Rent");
  assert.equal(entry.author_user_id, ME);
  assert.deepEqual(entry.contact, { id: CONTACT, label: "Rudo Moyo", reference: null });
  assert.equal(statusBadge(entry.status).words, UNVERIFIED_WORDS);
  const form = formFromEntry(entry);
  assert.equal(form.amount, "450.00");
  assert.equal(form.contactId, CONTACT);
  assert.equal(normaliseEntry({ id: "x" }), null);
  const negative = normaliseEntry({ id: "r", amount: "-10.00", currency: "ZAR", type: "REVERSAL" });
  assert.equal(negative.direction, "OUT");
  assert.equal(negative.amount, "10.00");
  const page = normaliseEntryPage({ items: [{ id: "a", amount: "1", currency: "USD" }], total: 30, page_size: 25 });
  assert.equal(page.totalPages, 2);
  assert.equal(primaryEntryId({ original: { id: "o", amount: "1", currency: "USD" }, reversal: { id: "r", amount: "1", currency: "USD" }, corrected: { id: "c", amount: "2", currency: "USD" } }), "c");
  assert.equal(primaryEntryId({ entry: { id: "n", amount: "1", currency: "USD" } }), "n");
});

test("reports are read per currency and never combined", () => {
  const cashbook = normaliseCashbook({
    from: "2026-11-01",
    to: "2026-11-30",
    currencies: [
      { currency: "USD", opening_balance: "1000.00", total_in: "500.00", total_out: "200.00", closing_balance: "1300.00", entries: [] },
      { currency: "ZAR", opening_balance: "5000.00", total_in: "0", total_out: "0", closing_balance: "5000.00", entries: [] },
    ],
  });
  assert.deepEqual(cashbook.map((block) => block.currency), ["USD", "ZAR"]);
  assert.equal(cashbook[0].closing, "1300.00");
  // A map keyed by currency is read the same way.
  assert.equal(normaliseCashbook({ by_currency: { USD: { opening: "1", in: "2", out: "1", closing: "2" } } })[0].moneyIn, "2");

  const flat = normaliseCategoriesReport({
    items: [
      { currency: "USD", category: "rent", in: "400.00", out: "0" },
      { currency: "ZAR", category: "rent", in: "1800.00", out: "0" },
      { currency: "USD", category: "maintenance", in: "0", out: "75.25" },
    ],
  });
  assert.equal(flat.length, 2);
  assert.equal(flat[0].moneyIn, "400.0000");
  assert.equal(flat[0].moneyOut, "75.2500");
  assert.equal(flat[1].moneyIn, "1800.0000");

  const ageing = normaliseReceivables({
    currencies: [{ currency: "USD", buckets: { "0_30": "100.00", "31_60": "50.00", "61_90": "0", "90_plus": "25.00" }, total: "175.00" }],
  });
  assert.deepEqual(ageing[0].buckets.map((bucket) => bucket.amount), ["100.00", "50.00", "0", "25.00"]);
  const listed = normaliseReceivables({ currencies: [{ currency: "ZAR", buckets: [{ bucket: "90+", amount: "9.00" }] }] });
  assert.equal(listed[0].buckets[3].amount, "9.00");
});

test("export file names come from Content-Disposition", () => {
  assert.equal(fileNameFrom('attachment; filename="cashbook-2026-11.csv"', "x.csv"), "cashbook-2026-11.csv");
  assert.equal(fileNameFrom("attachment; filename*=UTF-8''books%20nov.csv", "x.csv"), "books nov.csv");
  assert.equal(fileNameFrom(null, "x.csv"), "x.csv");
});

// ---- The contract's response shapes (API 0.34.0) ----------------------------------------------

const contractEntry = (over = {}) => ({
  id: "e-rent",
  type: "RENT_RECEIVED",
  type_label: "Rent received",
  direction: "IN",
  category: "rent",
  category_label: "Rent",
  method: "BANK",
  method_label: "Bank",
  amount: "700.00",
  signed_amount: "700.00",
  currency: "USD",
  minor_unit: 2,
  effective_date: "2026-11-01",
  recorded_at: "2026-11-01T09:00:00Z",
  author: { user_id: ME, name: "Rudo Moyo" },
  status: "USER_RECORDED_UNVERIFIED",
  status_label: "Recorded by you, not verified",
  reconciliation: null,
  description: "November rent, flat 4",
  reference: "RCPT-0012",
  branch: null,
  contact: { id: CONTACT, name: "Tariro Moyo" },
  listing: { id: LISTING, title: "Two-bedroom flat", reference: "RP-1" },
  lease: { id: "lease-1", reference: "LS-1" },
  tenancy_id: null,
  reversal_of: null,
  reversed_by: null,
  correction_of: null,
  corrected_by: null,
  transfer_pair: null,
  settles: null,
  reason: null,
  is_reversed: false,
  cash: true,
  note_count: 1,
  attachment_count: 1,
  can: { reverse: true, correct: false, reconcile: true, note: true, attach: false },
  ...over,
});

test("GET /entries/{id}: the entry, its notes, attachments and related entries", () => {
  const detail = normaliseEntryDetail({
    entry: contractEntry({ reversed_by: "e-rev", is_reversed: true }),
    notes: [{ id: "n1", text: "Paid at the office.", author: { user_id: ME, name: "Rudo Moyo" }, created_at: "2026-11-01T10:00:00Z" }],
    attachments: [
      { id: "a1", file_name: "receipt.pdf", content_type: "application/pdf", size: 48213, uploaded_by: { user_id: ME, name: "Rudo Moyo" }, uploaded_at: "2026-11-01T11:00:00Z", download_path: "/v1/x" },
    ],
    related: [contractEntry({ id: "e-rev", type: "REVERSAL", direction: "OUT", reversal_of: "e-rent", reason: "Entered twice", recorded_at: "2026-11-02T08:00:00Z" })],
  });
  const { entry, related } = detail;
  assert.equal(entry.contact.label, "Tariro Moyo");
  assert.equal(entry.listing.label, "Two-bedroom flat");
  assert.equal(entry.leaseId, "lease-1");
  assert.equal(entry.can_reverse, true);
  assert.equal(entry.can_correct, false);
  assert.equal(entry.can_attach, false);
  assert.equal(entry.notes[0].text, "Paid at the office.");
  assert.equal(entry.attachments[0].name, "receipt.pdf");
  assert.equal(entry.attachments[0].size, 48213);
  assert.equal(related.length, 1);
  const history = entryHistory(entry, related);
  assert.deepEqual(history.map((event) => event.label), ["Reversed", "Attachment added: receipt.pdf", "Note added", "Recorded"]);
  assert.equal(history[0].text, "Entered twice");
  assert.equal(history[0].relatedId, "e-rev");
  assert.equal(normaliseEntryDetail({ nothing: true }), null);
});

test("a reconciled entry: who marked it and the note, in the team's words", () => {
  const entry = normaliseEntry({
    entry: contractEntry({ status: "RECONCILED", reconciliation: { at: "2026-11-05T08:00:00Z", by: { user_id: ME, name: "Tendai" }, note: "Matched to the November statement" } }),
  });
  assert.equal(statusBadge(entry.status).words, RECONCILED_WORDS);
  assert.equal(entry.reconciledBy.name, "Tendai");
  assert.equal(entry.reconciledNote, "Matched to the November statement");
  assert.ok(entryHistory(entry).some((event) => event.label === RECONCILED_WORDS));
});

test("POST answers open the right entry: the new one, the correction, the reversal", () => {
  const created = { entry: contractEntry({ id: "out" }), created: [contractEntry({ id: "out" }), contractEntry({ id: "in" })] };
  assert.equal(primaryEntryId(created), "out");
  const corrected = { entry: contractEntry({ id: "new" }), created: [contractEntry({ id: "rev" }), contractEntry({ id: "new" })], updated: [contractEntry({ id: "old" })] };
  assert.equal(primaryEntryId(corrected), "new");
});

test("GET /options: types with fixed directions, minor units, permissions", () => {
  const options = normaliseOptions({
    types: [
      { code: "RENT_RECEIVED", label: "Rent received", direction: "IN", cash: true, category: "rent" },
      { code: "OPENING_BALANCE", label: "Opening balance", direction: null, cash: true, category: null },
      { code: "RECEIVABLE", label: "Receivable", direction: "IN", cash: false, category: null },
      { code: "REVERSAL", label: "Reversal", direction: null },
    ],
    methods: [{ code: "CASH", label: "Cash" }],
    currencies: [
      { code: "JPY", minor_unit: 0 },
      { code: "KWD", minor_unit: 3 },
    ],
    categories: [{ code: "rent", label: "Rent", kind: "IN", active: true, default: true, used: true, sort_order: 10 }],
    branches: ["Harare"],
    permissions: { write: true, manage: false, export: false },
  });
  assert.deepEqual(options.types.map((item) => item.code), ["RENT_RECEIVED", "OPENING_BALANCE", "RECEIVABLE"]);
  assert.equal(fixedDirection("OPENING_BALANCE", options.types), null);
  assert.equal(fixedDirection("RENT_RECEIVED", options.types), "IN");
  assert.deepEqual(options.minorUnits, { JPY: 0, KWD: 3 });
  assert.equal(options.categories[0].direction, "IN");
  assert.equal(options.permissions.export, false);
  assert.match(amountProblem("1.5", "JPY", options.minorUnits.JPY), /no decimal places/);
  assert.equal(amountProblem("1.250", "KWD", options.minorUnits.KWD), null);
  assert.match(amountProblem("1.2345", "KWD", options.minorUnits.KWD), /at most 3/);
});

test("amounts owed: no method, and a payment against them settles them", () => {
  const owed = { ...emptyEntryForm("entry", "2026-11-19"), type: "RECEIVABLE", method: "", category: "rent", amount: "250", description: "December rent" };
  assert.deepEqual(entryFormProblems(owed), {});
  const body = entryBody(owed);
  assert.equal(body.method, null);
  assert.equal(body.direction, "IN");
  const receivable = normaliseEntry({
    entry: contractEntry({ id: "r1", type: "RECEIVABLE", method: null, method_label: null, cash: false, amount: "250.00", description: "December rent" }),
  });
  assert.equal(receivable.cash, false);
  const payment = paymentFormFor(receivable, "2026-12-03");
  assert.equal(payment.settles, "r1");
  assert.equal(payment.type, "INCOME");
  assert.equal(payment.contactId, CONTACT);
  assert.equal(entryBody(payment).settles, "r1");
  assert.equal(entryBody(payment).lease_id, "lease-1");
  // An empty category is left out, so the type's default applies.
  assert.ok(!("category" in entryBody({ ...payment, category: "" })));
});

test("the cashbook: one block per currency, rows with their columns and running balance", () => {
  const cashbook = normaliseCashbook({
    from: "2026-11-01",
    to: "2026-11-30",
    by: "method",
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        opening_balance: "500.00",
        in: "1200.00",
        out: "300.00",
        net: "900.00",
        closing_balance: "1400.00",
        entry_count: 5,
        groups: [
          { currency: "USD", minor_unit: 2, key: "CASH", label: "Cash", opening_balance: "200.00", in: "500.00", out: "0.00", net: "500.00", closing_balance: "700.00", entry_count: 2 },
        ],
        entries: [
          { entry: contractEntry(), in: "700.00", out: "0.00", running_balance: "1200.00" },
          { entry: contractEntry({ id: "rev", type: "REVERSAL", direction: "OUT", reversal_of: "e-rent" }), in: "-700.00", out: "0.00", running_balance: "500.00" },
        ],
      },
      { currency: "ZAR", minor_unit: 2, opening_balance: "5000.00", in: "0.00", out: "0.00", net: "0.00", closing_balance: "5000.00", entry_count: 0, groups: null, entries: [] },
    ],
  });
  assert.deepEqual(cashbook.map((block) => block.currency), ["USD", "ZAR"]);
  const usd = cashbook[0];
  assert.equal(usd.moneyIn, "1200.00");
  assert.equal(usd.closing, "1400.00");
  assert.equal(usd.groups[0].label, "Cash");
  assert.equal(usd.rows[0].moneyIn, "700.00");
  assert.equal(usd.rows[0].moneyOut, null, "a zero column is empty");
  assert.equal(usd.rows[1].moneyIn, "-700.00", "a reversal sits in the column of the entry it reverses");
  assert.equal(usd.rows[0].runningBalance, "1200.00");
  assert.equal(cashbook[1].rows.length, 0);
});

test("categories, statement and receivables in the contract's shapes", () => {
  const categories = normaliseCategoriesReport({
    from: "2026-11-01",
    to: "2026-11-30",
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        categories: [
          { currency: "USD", minor_unit: 2, category: "rent", label: "Rent", in: "1400.00", out: "0.00", net: "1400.00", entry_count: 2 },
          { currency: "USD", minor_unit: 2, category: null, label: "Uncategorised", in: "0.00", out: "50.00", net: "-50.00", entry_count: 1 },
        ],
        total: { currency: "USD", minor_unit: 2, in: "1400.00", out: "50.00", net: "1350.00", entry_count: 3 },
      },
    ],
  });
  assert.equal(categories[0].moneyIn, "1400.00");
  assert.equal(categories[0].net, "1350.00");
  assert.equal(categories[0].rows[1].label, "Uncategorised");

  const statement = normaliseStatement({
    from: "2026-11-01",
    to: "2026-11-30",
    contact: { id: CONTACT, name: "Tariro Moyo" },
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        opening_balance: "0.00",
        in: "700.00",
        out: "0.00",
        net: "700.00",
        closing_balance: "700.00",
        entry_count: 1,
        receivable_outstanding: "250.00",
        payable_outstanding: "0.00",
        entries: [{ entry: contractEntry(), in: "700.00", out: "0.00", running_balance: "700.00" }],
      },
    ],
  });
  assert.equal(statement.contact.label, "Tariro Moyo");
  assert.equal(statement.currencies[0].balance, "700.00");
  assert.equal(statement.currencies[0].receivableOutstanding, "250.00");
  assert.equal(statement.currencies[0].rows[0].runningBalance, "700.00");

  const receivables = normaliseReceivables({
    as_of: "2026-11-30",
    side: "RECEIVABLE",
    currencies: [
      {
        currency: "USD",
        minor_unit: 2,
        outstanding: "450.00",
        count: 2,
        buckets: [
          { currency: "USD", minor_unit: 2, bucket: "0-30", outstanding: "200.00", count: 1 },
          { currency: "USD", minor_unit: 2, bucket: "31-60", outstanding: "250.00", count: 1 },
          { currency: "USD", minor_unit: 2, bucket: "61-90", outstanding: "0.00", count: 0 },
          { currency: "USD", minor_unit: 2, bucket: "90+", outstanding: "0.00", count: 0 },
        ],
        items: [
          { entry: contractEntry({ id: "r1", type: "RECEIVABLE" }), currency: "USD", minor_unit: 2, amount: "250.00", settled: "0.00", outstanding: "250.00", days_overdue: 45, bucket: "31-60" },
        ],
      },
    ],
  });
  assert.deepEqual(receivables[0].buckets.map((bucket) => bucket.amount), ["200.00", "250.00", "0.00", "0.00"]);
  assert.deepEqual(receivables[0].buckets.map((bucket) => bucket.words), ["0 to 30 days", "31 to 60 days", "61 to 90 days", "Over 90 days"]);
  assert.equal(receivables[0].total, "450.00");
  assert.equal(receivables[0].items[0].daysOverdue, 45);
  assert.equal(ageingWords(receivables[0].items[0].bucket), "31 to 60 days");
});

test("no report block ever mixes currencies", () => {
  const blocks = normaliseCashbook({ currencies: [{ currency: "USD", in: "1" }, { currency: "ZAR", in: "2" }, { currency: "usd", in: "3" }] });
  // A lower-case code is not a currency: it is dropped, never merged into USD.
  assert.deepEqual(blocks.map((block) => [block.currency, block.moneyIn]), [["USD", "1"], ["ZAR", "2"]]);
});

test("categories list: kind IN, OUT or ANY", () => {
  const items = normaliseCategories({
    items: [
      { code: "deposit", label: "Deposit", kind: "ANY", active: true, default: true, used: false },
      { code: "salaries", label: "Salaries", kind: "OUT", active: false },
    ],
  });
  assert.equal(items[0].direction, null);
  assert.equal(items[0].isDefault, true);
  assert.equal(items[1].active, false);
  assert.deepEqual(categoriesFor(items, "IN").map((item) => item.code), ["deposit"]);
  assert.deepEqual(categoriesFor(items, "OUT").map((item) => item.code), ["deposit", "salaries"]);
});
