// Checks the rules of properties, units and tenancies (src/lib/tenancies.ts):
// rent frequency and due-day words, the date checks, the form checks and
// request bodies, the filters in the address and the API query, the status
// timeline and the tolerant readers of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountProblem } from "../src/lib/ledger.ts";
import {
  addChosen,
  canActivate,
  canEnd,
  canWriteTenancies,
  cleanAmount,
  createdId,
  dueDayOptions,
  dueDayProblem,
  dueDayWords,
  emptyPropertyForm,
  emptyTenancyForm,
  endProblems,
  frequencyLabel,
  frequencyPer,
  hasProblems,
  isDay,
  normaliseProperty,
  normalisePropertyPage,
  normaliseTenancy,
  normaliseTenancyPage,
  ordinal,
  parseTenancyFilters,
  partyNames,
  propertyBody,
  propertyFormProblems,
  propertyPatch,
  removeChosen,
  tenancyApiProblems,
  tenancyApiQuery,
  tenancyBody,
  tenancyDateProblems,
  tenancyFormProblems,
  tenancyHref,
  tenancyListHref,
  tenancyStatusLabel,
  tenancyStatusTone,
  tenancyTimeline,
  occupancyWords,
  occupyingTenancyId,
  tenancyActions,
  unitLabelProblem,
} from "../src/lib/tenancies.ts";

const check = (value, currency) => amountProblem(value, currency);

test("rent frequency labels", () => {
  assert.equal(frequencyLabel("WEEKLY"), "Weekly");
  assert.equal(frequencyLabel("MONTHLY"), "Monthly");
  assert.equal(frequencyLabel("QUARTERLY"), "Quarterly (every three months)");
  assert.equal(frequencyLabel("ANNUALLY"), "Annually (once a year)");
  assert.equal(frequencyLabel("SIX_MONTHLY"), "Six monthly");
  assert.equal(frequencyPer("MONTHLY"), "a month");
  assert.equal(frequencyPer("WEEKLY"), "a week");
  assert.equal(frequencyPer("ANNUALLY"), "a year");
});

test("due days per frequency", () => {
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(2), "2nd");
  assert.equal(ordinal(3), "3rd");
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(12), "12th");
  assert.equal(ordinal(13), "13th");
  assert.equal(ordinal(21), "21st");
  assert.equal(ordinal(23), "23rd");
  assert.equal(dueDayOptions("WEEKLY").length, 7);
  assert.deepEqual(dueDayOptions("WEEKLY")[0], { value: "1", label: "Monday" });
  assert.equal(dueDayOptions("MONTHLY").length, 31);
  assert.match(dueDayOptions("MONTHLY")[30].label, /31st \(the last day in shorter months\)/);
  assert.equal(dueDayWords("WEEKLY", 5), "due every Friday");
  assert.equal(dueDayWords("MONTHLY", 1), "due on the 1st of each month");
  assert.equal(dueDayWords("QUARTERLY", 15), "due every three months, on the 15th");
  assert.equal(dueDayWords("ANNUALLY", 2), "due once a year, on the 2nd");
  assert.equal(dueDayWords("WEEKLY", 8), "");
  assert.equal(dueDayWords("MONTHLY", null), "");
  assert.equal(dueDayProblem("WEEKLY", "7"), null);
  assert.match(dueDayProblem("WEEKLY", "8"), /Monday to Sunday/);
  assert.equal(dueDayProblem("MONTHLY", "31"), null);
  assert.match(dueDayProblem("MONTHLY", "0"), /1 to 31/);
  assert.match(dueDayProblem("MONTHLY", "1.5"), /1 to 31/);
  assert.match(dueDayProblem("MONTHLY", ""), /day of the month/);
});

test("tenancy statuses and permissions", () => {
  assert.equal(tenancyStatusLabel("ACTIVE"), "Active");
  assert.equal(tenancyStatusLabel("TERMINATED"), "Terminated early");
  assert.equal(tenancyStatusLabel("ACTIVE", "Running"), "Running");
  assert.equal(tenancyStatusLabel("ON_HOLD"), "On hold");
  assert.equal(tenancyStatusTone("ACTIVE"), "success");
  assert.equal(tenancyStatusTone("UNKNOWN"), "neutral");
  assert.ok(canWriteTenancies("OWNER"));
  assert.ok(canWriteTenancies("AGENT"));
  assert.ok(!canWriteTenancies("STAFF"));
  assert.ok(!canWriteTenancies(undefined));
  assert.ok(canActivate("DRAFT") && !canActivate("ACTIVE"));
  assert.ok(canEnd("ACTIVE") && !canEnd("DRAFT") && !canEnd("ENDED"));
});

test("date validation", () => {
  assert.ok(isDay("2026-02-28"));
  assert.ok(isDay("2028-02-29"));
  assert.ok(!isDay("2026-02-29"));
  assert.ok(!isDay("2026-13-01"));
  assert.ok(!isDay("1/12/2026"));
  assert.deepEqual(tenancyDateProblems("2026-12-01", ""), {});
  assert.deepEqual(tenancyDateProblems("2026-12-01", "2027-11-30"), {});
  assert.match(tenancyDateProblems("", "").start, /starts/);
  assert.match(tenancyDateProblems("2026-02-30", "").start, /real date/);
  assert.match(tenancyDateProblems("2026-12-01", "2026-12-01").end, /after the start/);
  assert.match(tenancyDateProblems("2026-12-01", "2026-11-01").end, /after the start/);
  assert.match(tenancyDateProblems("2026-12-01", "soon").end, /real date/);
  assert.deepEqual(endProblems("2027-01-31", "The tenant gave notice.", "2026-12-01"), {});
  assert.deepEqual(endProblems("2026-12-01", "Same day.", "2026-12-01"), {});
  assert.match(endProblems("2026-11-30", "Too early.", "2026-12-01").endDate, /before it started/);
  assert.match(endProblems("", "x").endDate, /Enter the date/);
  assert.match(endProblems("2027-01-31", "  ").reason, /Say why/);
  assert.match(endProblems("2027-01-31", "x".repeat(501)).reason, /500/);
});

test("property form: checks and body", () => {
  const form = { ...emptyPropertyForm("ZW"), name: " Sunset Court ", address: "12 Fife Avenue, Harare", units: ["Flat 1", " Flat 2 "] };
  assert.equal(hasProblems(propertyFormProblems(form)), false);
  assert.deepEqual(propertyBody(form), {
    name: "Sunset Court",
    address: "12 Fife Avenue, Harare",
    market_code: "ZW",
    notes: "",
    units: [{ label: "Flat 1" }, { label: "Flat 2" }],
  });
  assert.deepEqual(propertyBody({ ...form, units: [], listingId: "l1" }).units, []);
  assert.equal(propertyBody({ ...form, listingId: "l1" }).listing_id, "l1");
  const bad = propertyFormProblems({ name: "", address: "", marketCode: "", listingId: "", notes: "x".repeat(5001), units: ["Flat 1", "flat 1", ""] });
  assert.ok(bad.name && bad.address && bad.marketCode && bad.notes);
  assert.deepEqual(Object.keys(bad.units), ["1", "2"]);
  assert.match(bad.units[1], /already has that name/);
  assert.deepEqual(propertyPatch({ name: " A ", address: " B ", marketCode: "ZA", listingId: "", notes: " n " }), { name: "A", address: "B", market_code: "ZA", listing_id: null, notes: "n" });
});

test("unit labels and occupancy words", () => {
  assert.equal(unitLabelProblem("Flat 3", ["Flat 1"]), null);
  assert.match(unitLabelProblem("  ", []), /Enter/);
  assert.equal(unitLabelProblem("x".repeat(80), []), null);
  assert.match(unitLabelProblem("x".repeat(81), []), /80/);
  assert.match(unitLabelProblem("FLAT 1", ["Flat 1"]), /already/);
  assert.equal(occupancyWords(1, 1), "Let");
  assert.equal(occupancyWords(0, 1), "Not let");
  assert.equal(occupancyWords(1, 3), "1 of 3 units let");
});

const filled = () => ({
  ...emptyTenancyForm("USD"),
  propertyId: "p1",
  unitId: "u1",
  tenants: [{ id: "c1", label: "Rudo Moyo" }],
  landlords: [{ id: "c2", label: "Tendai Moyo" }],
  rentAmount: "0450.50",
  frequency: "MONTHLY",
  dueDay: "1",
  startDate: "2026-12-01",
});

test("tenancy form: checks", () => {
  assert.deepEqual(tenancyFormProblems(filled(), check, { unitRequired: true }), {});
  const empty = tenancyFormProblems(emptyTenancyForm("USD"), check, { unitRequired: true });
  assert.ok(empty.propertyId && empty.unitId && empty.tenants && empty.rentAmount && empty.startDate);
  assert.equal(tenancyFormProblems({ ...filled(), unitId: "" }, check).unitId, undefined);
  assert.match(tenancyFormProblems({ ...filled(), rentCurrency: "JPY", rentAmount: "100.5" }, check).rentAmount, /no decimal places/);
  assert.match(tenancyFormProblems({ ...filled(), rentAmount: "1,200" }, check).rentAmount, /without commas/);
  assert.match(tenancyFormProblems({ ...filled(), frequency: "WEEKLY", dueDay: "9" }, check).dueDay, /Monday to Sunday/);
  assert.match(tenancyFormProblems({ ...filled(), frequency: "DAILY" }, check).frequency, /how often/);
  assert.match(tenancyFormProblems({ ...filled(), depositAmount: "10.123" }, check).depositAmount, /2 decimal places/);
  assert.equal(tenancyFormProblems({ ...filled(), rentCurrency: "KWD", rentAmount: "500", depositAmount: "1000.000" }, check).depositAmount, undefined);
  assert.match(tenancyFormProblems({ ...filled(), endDate: "2026-11-01" }, check).endDate, /after the start/);
  const many = Array.from({ length: 11 }, (_, i) => ({ id: `c${i + 10}`, label: `T${i}` }));
  assert.match(tenancyFormProblems({ ...filled(), tenants: many }, check).tenants, /at most 10/);
  assert.match(tenancyFormProblems({ ...filled(), landlords: many }, check).landlords, /at most 10/);
  assert.match(tenancyFormProblems({ ...filled(), landlords: [{ id: "c1", label: "Rudo Moyo" }] }, check).landlords, /cannot be tenant and landlord/);
});

test("tenancy form to the contract's body", () => {
  assert.deepEqual(tenancyBody(filled()), {
    property_id: "p1",
    unit_id: "u1",
    tenants: ["c1"],
    landlords: ["c2"],
    rent: { amount: "450.50", currency: "USD", frequency: "MONTHLY", due_day: 1 },
    start_date: "2026-12-01",
    notes: "",
  });
  const full = tenancyBody({ ...filled(), unitId: "", landlords: [], leaseId: "l9", rentCurrency: "ZAR", depositAmount: " 900 ", endDate: "2027-11-30", notes: " Pays by bank " });
  assert.equal(full.unit_id, undefined);
  assert.equal(full.landlords, undefined);
  assert.equal(full.lease_id, "l9");
  assert.deepEqual(full.deposit, { amount: "900", currency: "ZAR" }, "the deposit is in the rent currency");
  assert.equal(full.end_date, "2027-11-30");
  assert.equal(full.notes, "Pays by bank");
  assert.equal(cleanAmount("0012.50"), "12.50");
  assert.equal(cleanAmount("0"), "0");
});

test("API field errors land under their controls", () => {
  const problems = tenancyApiProblems({ "rent.amount": "Too large", "tenants[0]": "Not in this book", lease_id: "Not this organisation's", start_date: "Bad", weird: "Something else" });
  assert.equal(problems.rentAmount, "Too large");
  assert.equal(problems.tenants, "Not in this book");
  assert.equal(problems.leaseId, "Not this organisation's");
  assert.equal(problems.startDate, "Bad");
  assert.deepEqual(problems.other, ["Something else"]);
  assert.deepEqual(tenancyApiProblems(undefined), {});
});

test("chosen contacts", () => {
  const one = addChosen([], { id: "c1", label: "A" });
  assert.deepEqual(addChosen(one, { id: "c1", label: "A" }), one);
  assert.equal(addChosen(one, { id: "c2", label: "B" }).length, 2);
  assert.deepEqual(removeChosen(one, "c1"), []);
  assert.equal(partyNames([]), "");
  assert.equal(partyNames([{ name: "A" }, { name: "B" }]), "A and B");
  assert.equal(partyNames([{ name: "A" }, { name: "B" }, { name: "C" }]), "A and 2 others");
});

test("filters in the address and the API query", () => {
  const filters = parseTenancyFilters(new URLSearchParams("status=active&property=p_1&contact=c-9&page=2"));
  assert.deepEqual(filters, { page: 2, status: "ACTIVE", property: "p_1", contact: "c-9" });
  assert.deepEqual(parseTenancyFilters(new URLSearchParams("status=GONE&property=..%2Fx&page=-1")), { page: 1 });
  assert.equal(tenancyApiQuery(filters), "?status=ACTIVE&property_id=p_1&contact_id=c-9&page=2&page_size=20");
  assert.equal(tenancyListHref({ status: "DRAFT", page: 1 }, "org1"), "/agent/tenancies?org=org1&status=DRAFT");
  assert.equal(tenancyHref("t 1", "o"), "/agent/tenancies/t%201?org=o");
});

// Fixtures in the shapes of the contract's "Response shapes (a)" (API 0.36.0).
const PROPERTY = {
  id: "p1",
  name: "Avondale Court",
  address: "12 King George Road, Avondale, Harare",
  market_code: "ZW",
  listing: { id: "l1", title: "Two-bedroom garden apartment", reference: "RP-ZW-10002" },
  notes: "",
  units: [
    { id: "u2", label: "Flat 2", position: 2, active_tenancy_id: null },
    { id: "u1", label: "Flat 1", position: 1, active_tenancy_id: "t1" },
  ],
  unit_count: 2,
  lettable_units: 2,
  occupied_units: 1,
  active_tenancy_id: null,
  open_tenancies: 1,
  created_by: { user_id: "x", name: "Rudo Moyo" },
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  can: { edit: true, delete: false },
};

const TENANCY = {
  id: "t1",
  status: "TERMINATED",
  status_label: "Terminated early",
  property: { id: "p1", name: "Avondale Court", address: "12 King George Road", market_code: "ZW", archived: false },
  unit: { id: "u1", label: "Flat 1", archived: false },
  tenants: [{ id: "c1", name: "Kudzai Sithole", live: true }],
  landlords: [{ id: "c2", name: "Tapiwa Chirwa", live: false }],
  lease: { id: "le1", reference: "RPL-2026-900001" },
  rent: { amount: "950.00", currency: "USD", minor_unit: 2, frequency: "MONTHLY", frequency_label: "Monthly", due_day: 1 },
  deposit: { amount: "950.00", currency: "USD", minor_unit: 2 },
  start_date: "2026-10-01",
  end_date: "2027-09-30",
  ended_on: "2027-06-30",
  end_reason: "The tenant moved abroad.",
  notes: "Pays by bank transfer",
  activated_at: "2026-10-01T08:00:00Z",
  activated_by: { user_id: "a", name: "Ana" },
  ended_at: "2027-06-01T10:00:00Z",
  ended_by: { user_id: "b", name: "Ben" },
  created_by: { user_id: "a", name: "Ana" },
  created_at: "2026-09-20T12:00:00Z",
  updated_at: "2027-06-01T10:00:00Z",
  can: { edit: true, activate: false, end: false, delete: false },
};

test("reading properties", () => {
  const property = normaliseProperty({ property: PROPERTY });
  assert.equal(property.name, "Avondale Court");
  assert.equal(property.listing.reference, "RP-ZW-10002");
  assert.deepEqual(property.units.map((unit) => unit.label), ["Flat 1", "Flat 2"], "in position order");
  assert.equal(property.units[0].occupied, true);
  assert.equal(property.units[0].activeTenancyId, "t1");
  assert.equal(property.units[1].occupied, false);
  assert.equal(property.occupiedUnits, 1);
  assert.equal(property.lettableUnits, 2);
  assert.equal(property.openTenancies, 1);
  assert.deepEqual(property.can, { edit: true, delete: false });
  assert.equal(property.createdBy, "Rudo Moyo");
  const whole = normaliseProperty({ id: "p2", name: "Borrowdale Cottage", units: [], unit_count: 0 });
  assert.equal(whole.unitCount, 0);
  assert.equal(whole.lettableUnits, 1, "a property with no units counts as one");
  assert.equal(whole.can, null);
  assert.equal(normaliseProperty({ name: "no id" }), null);
  const page = normalisePropertyPage({ items: [PROPERTY, { id: "b" }], total: 41, page: 2, page_size: 20 });
  assert.equal(page.items.length, 2);
  assert.equal(page.totalPages, 3);
  assert.equal(normalisePropertyPage({ items: [{ id: "a" }] }).total, 1);
});

test("reading an agent's tenancy", () => {
  const tenancy = normaliseTenancy({ tenancy: TENANCY });
  assert.equal(tenancy.statusLabel, "Terminated early");
  assert.equal(tenancy.rent.amount, "950.00", "the API's digits are kept");
  assert.equal(tenancy.rent.frequencyLabel, "Monthly");
  assert.equal(tenancy.rent.dueDay, 1);
  assert.deepEqual(tenancy.deposit, { amount: "950.00", currency: "USD" });
  assert.equal(tenancy.endDate, "2027-09-30", "the agreed end stays");
  assert.equal(tenancy.endedOn, "2027-06-30");
  assert.equal(tenancy.tenants[0].live, true);
  assert.equal(tenancy.landlords[0].live, false);
  assert.equal(tenancy.lease.reference, "RPL-2026-900001");
  assert.equal(tenancy.property.archived, false);
  assert.deepEqual(tenancy.can, { edit: true, activate: false, end: false, delete: false });
  const flat = normaliseTenancy({ id: "t2", property_id: "p1", property_name: "X", rent_amount: "100", rent_currency: "ZAR", rent_frequency: "WEEKLY", due_day: "3" });
  assert.equal(flat.property.name, "X");
  assert.equal(flat.rent.dueDay, 3);
  assert.equal(flat.status, "DRAFT");
  assert.equal(normaliseTenancy({}), null);
  const page = normaliseTenancyPage({ items: [TENANCY], total: 3, page: 1, page_size: 25, status_counts: { DRAFT: 0, ACTIVE: 2, ENDED: 1, TERMINATED: 0 } });
  assert.equal(page.statusCounts.find((item) => item.status === "ACTIVE").count, 2);
  assert.equal(page.statusCounts.length, 4);
  assert.equal(createdId({ tenancy: { id: "t9" } }), "t9");
  assert.equal(createdId({ property: { id: "p9" } }), "p9");
  assert.equal(createdId(null), null);
});

test("reading the tenant's own tenancy, which carries no ids", () => {
  const mine = normaliseTenancy({
    tenancy: {
      id: "t1",
      status: "ACTIVE",
      status_label: "Active",
      managed_by: { kind: "ORGANISATION", name: "Sample Estates" },
      property: { name: "Avondale Court", address: "12 King George Road", market_code: "ZW" },
      unit: { label: "Flat 1" },
      tenants: [{ name: "Kudzai Sithole" }],
      landlords: [{ name: "Tapiwa Chirwa" }],
      lease: null,
      rent: { amount: "950.00", currency: "USD", minor_unit: 2, frequency: "MONTHLY", frequency_label: "Monthly", due_day: 1 },
      deposit: null,
      start_date: "2026-10-01",
      end_date: null,
      ended_on: null,
    },
  });
  assert.equal(mine.property.id, null);
  assert.equal(mine.property.name, "Avondale Court");
  assert.equal(mine.unit.label, "Flat 1");
  assert.equal(mine.tenants[0].id, null, "never linked");
  assert.equal(mine.tenants[0].name, "Kudzai Sithole");
  assert.equal(mine.managedBy.name, "Sample Estates");
  assert.equal(mine.notes, "");
  assert.equal(mine.can, null);
  const list = normaliseTenancyPage({ items: [{ id: "a" }, { id: "b" }] });
  assert.equal(list.total, 2);
  assert.equal(list.totalPages, 1);
});

test("what the agent may do: the API's can, else role and status", () => {
  assert.deepEqual(tenancyActions({ status: "DRAFT", can: null }, "AGENT"), { activate: true, end: false, delete: true });
  assert.deepEqual(tenancyActions({ status: "ACTIVE", can: null }, "MANAGER"), { activate: false, end: true, delete: false });
  assert.deepEqual(tenancyActions({ status: "DRAFT", can: null }, "STAFF"), { activate: false, end: false, delete: false });
  assert.deepEqual(tenancyActions({ status: "DRAFT", can: { edit: true, activate: false, end: false, delete: true } }, "OWNER"), { activate: false, end: false, delete: true });
  assert.deepEqual(tenancyActions({ status: "ACTIVE", can: { edit: true, activate: false, end: true, delete: false } }, "STAFF"), { activate: false, end: false, delete: false });
  assert.equal(occupyingTenancyId({ error: { code: "UNIT_OCCUPIED", message: "…", details: { tenancy_id: "t7" } } }), "t7");
  assert.equal(occupyingTenancyId({ error: { code: "UNIT_OCCUPIED", details: { tenancy_id: null } } }), null);
  assert.equal(occupyingTenancyId(undefined), null);
});

test("status timeline: the API's events, or made from its dates, never invented", () => {
  const fromEvents = tenancyTimeline(
    normaliseTenancy({ id: "t", events: [{ kind: "ENDED", at: "2027-02-01T10:00:00Z", reason: "Notice" }, { kind: "TENANCY_ACTIVATED", at: "2026-12-01T08:00:00Z", actor: { name: "Ana" } }] }),
  );
  assert.deepEqual(fromEvents.map((step) => step.words), ["Activated", "Ended"]);
  assert.equal(fromEvents[0].actor, "Ana");
  assert.equal(fromEvents[1].text, "Notice");
  const fromDates = tenancyTimeline(normaliseTenancy(TENANCY));
  assert.deepEqual(fromDates.map((step) => step.key), ["created", "activated", "ended"]);
  assert.deepEqual(fromDates.map((step) => step.actor), ["Ana", "Ana", "Ben"]);
  assert.equal(fromDates[2].words, "Ended early (terminated)");
  assert.equal(fromDates[2].day, "2027-06-30", "the day it ended, not the agreed end");
  assert.equal(fromDates[2].text, "The tenant moved abroad.");
  assert.deepEqual(tenancyTimeline(normaliseTenancy({ id: "t", status: "DRAFT" })), []);
  assert.deepEqual(tenancyTimeline(normaliseTenancy({ id: "t", status: "ACTIVE", start_date: "2026-10-01" })), [], "the tenant's view has no history dates");
});
