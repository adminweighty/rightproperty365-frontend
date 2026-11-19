// Checks the rules of maintenance requests (src/lib/maintenance.ts, API
// 0.36.2): the status and priority words, the status flow and the moves
// allowed, photo checks, the forms and their bodies, the filters in the
// address and the API query, the board's columns, the timeline and the
// tolerant readers of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountProblem } from "../src/lib/ledger.ts";
import {
  actorWords,
  allowedFromConflict,
  allowedTransitions,
  assignBody,
  assignedEnquiry,
  assignProblems,
  boardColumns,
  canMoveTo,
  canWriteMaintenance,
  categoryLabel,
  choicesOr,
  commentProblem,
  costBody,
  costFormProblems,
  createdRequestId,
  DEFAULT_PHOTO_RULES,
  DEFAULT_PRIORITIES,
  defaultPriority,
  emptyCostForm,
  emptyRequestForm,
  hasProblems,
  isFinalStatus,
  maintenanceActions,
  maintenanceApiQuery,
  maintenanceHref,
  maintenanceListHref,
  maintenancePhotoProblem,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  maintenanceTimeline,
  MAINTENANCE_STATUSES,
  moveNeedsNote,
  moveNoteProblem,
  moveWords,
  newRequestHref,
  normaliseOptions,
  normaliseProviders,
  normaliseRequest,
  normaliseRequestPage,
  normaliseTimelineItem,
  parseMaintenanceFilters,
  photoAccept,
  photoCountWords,
  photoTypeWords,
  priorityLabel,
  priorityRank,
  priorityTone,
  providerHref,
  requestApiProblems,
  requestBody,
  requestFormProblems,
  requestPlace,
  sortPhotos,
  statusBody,
  timelineWords,
  TRANSITIONS,
} from "../src/lib/maintenance.ts";

test("status labels and tones", () => {
  assert.equal(maintenanceStatusLabel("IN_PROGRESS"), "In progress");
  assert.equal(maintenanceStatusLabel("NEW"), "New");
  assert.equal(maintenanceStatusLabel("CANCELLED"), "Cancelled");
  assert.equal(maintenanceStatusLabel("NEW", "Just in"), "Just in", "the API's label wins");
  assert.equal(maintenanceStatusLabel("ON_HOLD"), "On hold", "an unknown code in words");
  assert.equal(maintenanceStatusTone("RESOLVED"), "success");
  assert.equal(maintenanceStatusTone("ON_HOLD"), "neutral");
  for (const status of MAINTENANCE_STATUSES) assert.ok(maintenanceStatusLabel(status).length > 0);
});

test("priority and category labels (lower-case reference codes)", () => {
  assert.equal(priorityLabel("urgent"), "Urgent (safety, no water or power)");
  assert.equal(priorityLabel("low"), "Low");
  assert.equal(priorityLabel("same-day"), "Same day", "a row added by an admin");
  assert.equal(priorityLabel("high", "High (48 hours)"), "High (48 hours)", "the API's label wins");
  assert.equal(priorityTone("urgent"), "danger");
  assert.equal(priorityTone("HIGH"), "warning");
  assert.equal(priorityTone("odd"), "neutral");
  assert.ok(priorityRank("urgent") < priorityRank("high"));
  assert.ok(priorityRank("high") < priorityRank("normal"));
  assert.ok(priorityRank("low") < priorityRank("odd"));
  assert.equal(categoryLabel("doors-windows"), "Doors, windows and locks");
  assert.equal(categoryLabel("roof_gutters"), "Roof gutters");
  assert.deepEqual(choicesOr([], DEFAULT_PRIORITIES).map((item) => item.code), ["low", "normal", "high", "urgent"]);
  assert.deepEqual(choicesOr([{ code: "p1", label: "P1" }], DEFAULT_PRIORITIES), [{ code: "p1", label: "P1" }]);
  assert.equal(defaultPriority(DEFAULT_PRIORITIES), "normal");
  assert.equal(defaultPriority([{ code: "p2", label: "P2" }]), "p2");
});

test("the status flow is the contract's table", () => {
  assert.deepEqual(allowedTransitions("NEW"), ["TRIAGED", "CANCELLED"]);
  assert.deepEqual(allowedTransitions("TRIAGED"), ["IN_PROGRESS", "CANCELLED"]);
  assert.deepEqual(allowedTransitions("ASSIGNED"), ["IN_PROGRESS", "CANCELLED"]);
  assert.deepEqual(allowedTransitions("IN_PROGRESS"), ["RESOLVED", "CANCELLED"]);
  assert.deepEqual(allowedTransitions("RESOLVED"), ["IN_PROGRESS", "CLOSED"]);
  assert.deepEqual(allowedTransitions("CLOSED"), []);
  assert.deepEqual(allowedTransitions("CANCELLED"), []);
  assert.deepEqual(allowedTransitions("WHATEVER"), []);
  for (const status of MAINTENANCE_STATUSES) {
    const moves = allowedTransitions(status);
    assert.ok(!moves.includes(status), "never to itself");
    assert.ok(!moves.includes("ASSIGNED"), "assigned only by assigning a provider");
    assert.deepEqual([...moves].sort(), [...TRANSITIONS[status]].sort());
  }
  assert.ok(isFinalStatus("CLOSED") && isFinalStatus("CANCELLED") && !isFinalStatus("RESOLVED"));
});

test("the API's own list of moves wins, in flow order, without ASSIGNED, unknown codes or the current status", () => {
  assert.deepEqual(allowedTransitions("NEW", ["CANCELLED", "TRIAGED", "BOGUS", "NEW", "ASSIGNED"]), ["TRIAGED", "CANCELLED"]);
  assert.deepEqual(allowedTransitions("NEW", []), [], "STAFF: none");
  assert.ok(canMoveTo("IN_PROGRESS", "RESOLVED"));
  assert.ok(!canMoveTo("NEW", "CLOSED"));
  assert.ok(!canMoveTo("NEW", "IN_PROGRESS"), "NEW must be triaged first");
  assert.ok(canMoveTo("NEW", "CLOSED", ["CLOSED"]));
  assert.deepEqual(allowedFromConflict({ error: { code: "MAINTENANCE_INVALID_TRANSITION", details: { status: "NEW", allowed: ["TRIAGED", "CANCELLED"] } } }), ["TRIAGED", "CANCELLED"]);
  assert.equal(allowedFromConflict({ error: { code: "X" } }), null);
});

test("move words and notes", () => {
  assert.equal(moveWords("NEW", "TRIAGED"), "Move to triaged");
  assert.equal(moveWords("NEW", "CANCELLED"), "Cancel the request");
  assert.equal(moveWords("RESOLVED", "IN_PROGRESS"), "Reopen (back to in progress)");
  assert.equal(moveWords("RESOLVED", "CLOSED"), "Close the request");
  assert.ok(moveNeedsNote("NEW", "CANCELLED") && !moveNeedsNote("RESOLVED", "IN_PROGRESS"));
  assert.equal(moveNoteProblem("NEW", "CANCELLED", " "), "Say why it is cancelled.");
  assert.equal(moveNoteProblem("RESOLVED", "IN_PROGRESS", ""), null);
  assert.match(moveNoteProblem("NEW", "TRIAGED", "x".repeat(501)), /at most 500/);
  assert.deepEqual(statusBody("TRIAGED", "  "), { status: "TRIAGED" });
  assert.deepEqual(statusBody("CANCELLED", " Duplicate "), { status: "CANCELLED", note: "Duplicate" });
});

test("who may change requests", () => {
  assert.ok(canWriteMaintenance("OWNER") && canWriteMaintenance("MANAGER") && canWriteMaintenance("AGENT"));
  assert.ok(!canWriteMaintenance("STAFF") && !canWriteMaintenance(null));
  const staff = maintenanceActions({ status: "NEW", can: null }, "STAFF");
  assert.deepEqual(staff.moves, []);
  assert.equal(staff.assign || staff.addCost || staff.comment || staff.addPhoto, false);
  const agent = maintenanceActions({ status: "TRIAGED", can: null }, "AGENT");
  assert.deepEqual(agent.moves, ["IN_PROGRESS", "CANCELLED"]);
  assert.equal(agent.assign, true);
  assert.equal(maintenanceActions({ status: "IN_PROGRESS", can: null }, "AGENT").assign, false, "assign from NEW, TRIAGED or ASSIGNED only");
  assert.equal(maintenanceActions({ status: "CLOSED", can: null }, "AGENT").addPhoto, false);
  assert.equal(maintenanceActions({ status: "CLOSED", can: null }, "AGENT").addCost, true, "costs in any status");
  const fromApi = maintenanceActions({ status: "NEW", can: { edit: true, transitions: ["TRIAGED"], assign: false, addCost: true, comment: true, addPhoto: true } }, "AGENT");
  assert.deepEqual(fromApi.moves, ["TRIAGED"]);
  assert.equal(fromApi.assign, false);
});

test("photo checks", () => {
  assert.equal(maintenancePhotoProblem({ name: "leak.jpg", type: "image/jpeg", size: 1000 }), null);
  assert.equal(maintenancePhotoProblem({ name: "leak.PNG", type: "", size: 1000 }), null, "no type: the name decides");
  assert.match(maintenancePhotoProblem({ name: "invoice.pdf", type: "application/pdf", size: 1000 }), /not a photo/);
  assert.match(maintenancePhotoProblem({ name: "x.heic", type: "image/heic", size: 1000 }), /JPEG, PNG or WebP/);
  assert.match(maintenancePhotoProblem({ name: "x.gif", type: "", size: 1000 }), /not a photo/);
  assert.match(maintenancePhotoProblem({ name: "empty.jpg", type: "image/jpeg", size: 0 }), /empty/);
  assert.match(maintenancePhotoProblem({ name: "big.jpg", type: "image/jpeg", size: DEFAULT_PHOTO_RULES.maxBytes + 1 }), /larger than 10 MB/);
  const strict = { maxPhotos: 2, maxBytes: 1024 * 1024, types: ["image/jpeg"] };
  assert.match(maintenancePhotoProblem({ name: "a.png", type: "image/png", size: 10 }, strict), /Choose a JPEG image/);
  assert.match(maintenancePhotoProblem({ name: "a.jpg", type: "image/jpeg", size: 2 * 1024 * 1024 }, strict), /larger than 1 MB/);
  const files = [
    { name: "a.jpg", type: "image/jpeg", size: 10 },
    { name: "b.pdf", type: "application/pdf", size: 10 },
    { name: "c.png", type: "image/png", size: 10 },
    { name: "d.webp", type: "image/webp", size: 10 },
  ];
  const sorted = sortPhotos(files, 8);
  assert.deepEqual(sorted.accepted.map((file) => file.name), ["a.jpg", "c.png"]);
  assert.equal(sorted.problems.length, 2);
  assert.match(sorted.problems[1], /up to 10 photos/);
  assert.equal(photoCountWords(3), "3 of 10 photos");
  assert.equal(photoTypeWords(), "JPEG, PNG or WebP");
  assert.equal(photoAccept(), ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp");
});

test("the new-request form", () => {
  const empty = emptyRequestForm();
  const problems = requestFormProblems(empty);
  assert.ok(problems.propertyId && problems.category && problems.title);
  assert.equal(problems.unitId, undefined, "a unit is optional: the whole property");
  assert.equal(problems.description, undefined, "details are optional");
  assert.equal(problems.priority, undefined, "normal by default");
  const tenant = requestFormProblems(empty, { tenant: true });
  assert.equal(tenant.propertyId, undefined);
  assert.ok(tenant.title);
  const form = { ...empty, propertyId: "p1", unitId: "", tenancyId: "t1", category: "plumbing", title: "  Leaking tap ", description: " Kitchen tap drips. " };
  assert.ok(!hasProblems(requestFormProblems(form)));
  assert.match(requestFormProblems({ ...form, title: "x".repeat(201) }).title, /200/);
  assert.match(requestFormProblems({ ...form, description: "x".repeat(5001) }).description, /5000/);
  assert.deepEqual(requestBody(form), {
    property_id: "p1",
    unit_id: null,
    tenancy_id: "t1",
    category: "plumbing",
    priority: "normal",
    title: "Leaking tap",
    description: "Kitchen tap drips.",
  });
  assert.deepEqual(requestBody(form, true), { category: "plumbing", priority: "normal", title: "Leaking tap", description: "Kitchen tap drips." });
  assert.deepEqual(requestApiProblems({ property_id: "is not a property of this book", other: "too many" }), {
    propertyId: "is not a property of this book",
    other: ["too many"],
  });
});

test("comments, assignment and costs", () => {
  assert.equal(commentProblem("  "), "Write a comment first.");
  assert.equal(commentProblem("Fixed?"), null);
  assert.match(commentProblem("x".repeat(2001)), /2000/);
  assert.deepEqual(assignProblems("", ""), { provider: "Choose a service provider." });
  assert.match(assignProblems("dp1", "x".repeat(1501)).message, /1500/);
  assert.deepEqual(assignBody("dp1", "  "), { directory_profile_id: "dp1", message: null });
  assert.deepEqual(assignBody("dp1", " Gate code 4471 "), { directory_profile_id: "dp1", message: "Gate code 4471" });
  const form = { ...emptyCostForm("USD", "2026-11-19"), amount: "85.00", description: "Replace kitchen tap washer", method: "BANK" };
  assert.ok(!hasProblems(costFormProblems(form, amountProblem, "2026-11-19")));
  const bad = costFormProblems({ amount: "12.345", currency: "", description: "", method: "OTHER", incurredOn: "2026-11-20" }, amountProblem, "2026-11-19");
  assert.ok(bad.amount && bad.currency && bad.description && bad.incurredOn);
  assert.ok(costFormProblems({ ...form, amount: "50.5", currency: "JPY" }, amountProblem).amount, "JPY has no decimals");
  assert.deepEqual(costBody({ ...form, amount: " 1 200.00 ", description: " Parts " }), {
    amount: "1200.00",
    currency: "USD",
    description: "Parts",
    method: "BANK",
    incurred_on: "2026-11-19",
  });
  assert.equal(costBody({ ...form, incurredOn: "" }).incurred_on, undefined, "the API's default: today");
});

test("filters in the address and the API query", () => {
  const filters = parseMaintenanceFilters(new URLSearchParams("status=in_progress&priority=URGENT&category=doors-windows&property=abc-1&page=2&view=board&tenancy=bad id&q=+tap+"));
  assert.deepEqual(filters, { view: "board", page: 2, status: "IN_PROGRESS", priority: "urgent", category: "doors-windows", property: "abc-1", q: "tap" });
  assert.deepEqual(parseMaintenanceFilters(new URLSearchParams("status=DONE&page=-1&category=<x>")), { view: "list", page: 1 });
  assert.equal(maintenanceListHref({ status: "NEW", page: 3 }, "org1"), "/agent/maintenance?org=org1&status=NEW&page=3");
  assert.equal(maintenanceListHref({ view: "board", status: "NEW", priority: "high", page: 3 }, "org1"), "/agent/maintenance?org=org1&view=board&priority=high");
  assert.equal(
    maintenanceApiQuery({ status: "NEW", property: "p1", tenancy: "t1", q: "tap", page: 1 }, 10),
    "?status=NEW&property_id=p1&tenancy_id=t1&q=tap&page=1&page_size=10",
  );
  assert.equal(maintenanceHref("r 1", "o"), "/agent/maintenance/r%201?org=o");
  assert.equal(newRequestHref("o", { property: "p", unit: null, tenancy: "t" }), "/agent/maintenance/new?org=o&property=p&tenancy=t");
  assert.equal(providerHref({ kind: "service-providers", slug: "sample-plumbers" }), "/directory/service-providers/sample-plumbers");
  assert.equal(providerHref({ kind: null, slug: "x" }), null);
});

test("the board's columns", () => {
  const items = [
    { id: "1", status: "NEW", priority: "low", createdAt: "2026-11-01T00:00:00Z" },
    { id: "2", status: "NEW", priority: "urgent", createdAt: "2026-11-03T00:00:00Z" },
    { id: "3", status: "IN_PROGRESS", priority: "high", createdAt: "2026-11-02T00:00:00Z" },
    { id: "4", status: "NEW", priority: "urgent", createdAt: "2026-11-02T00:00:00Z" },
    { id: "5", status: "ON_HOLD", priority: "high", createdAt: null },
  ];
  const columns = boardColumns(items);
  assert.deepEqual(columns.map((column) => column.status), [...MAINTENANCE_STATUSES]);
  assert.deepEqual(columns[0].items.map((item) => item.id), ["4", "2", "1"], "most urgent, then oldest");
  assert.deepEqual(columns[3].items.map((item) => item.id), ["3"]);
  assert.equal(columns.reduce((sum, column) => sum + column.items.length, 0), 4);
});

const sample = {
  request: {
    id: "r1",
    reference: "RPM-2026-900001",
    status: "ASSIGNED",
    status_label: "Assigned",
    category: { code: "plumbing", label: "Plumbing" },
    priority: { code: "high", label: "High" },
    title: "Kitchen tap leaking",
    description: "Drips all night.",
    property: { id: "p1", name: "Avondale Court", address: "12 King George Road", market_code: "ZW", archived: false },
    unit: { id: "u1", label: "Flat 1", archived: false },
    tenancy_id: "t1",
    tenancy: { id: "t1", status: "ACTIVE", status_label: "Active", tenants: [{ id: "c1", name: "Kudzai Sithole", live: true }] },
    raised_by: { kind: "TENANT", user_id: "u9", name: "Kudzai Sithole" },
    provider: { id: "dp1", kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers" },
    assignment: {
      provider: { id: "dp1", kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers" },
      enquiry: { id: "e1", reference: "BE-7K3M9QXD" },
      assigned_at: "2026-11-02T10:00:00Z",
      assigned_by: { user_id: "m1", name: "Chipo Dube" },
    },
    photo_count: 1,
    comment_count: 2,
    photos: [{ id: "ph1", url: "/v1/agent/organisations/o/maintenance/r1/photos/ph1", content_type: "image/jpeg", width: 1600, height: 1200, uploaded_by: { kind: "TENANT", name: "Kudzai Sithole" }, uploaded_at: "2026-11-01T10:01:00Z" }, { nope: true }],
    costs: [
      { id: "c1", amount: "85.00", currency: "usd", minor_unit: 2, description: "Replace kitchen tap washer", method: "BANK", method_label: "Bank", incurred_on: "2026-11-18", ledger_entry_id: "le1", ledger_status_label: "Recorded by you, not verified", reversed: false, recorded_by: { name: "Chipo Dube" }, recorded_at: "2026-11-18T09:00:00Z" },
      { id: "c2", amount: 5, currency: "USD" },
    ],
    cost_totals: [{ currency: "USD", minor_unit: 2, amount: "85.00", count: 1 }],
    timeline: [
      { id: "ev2", type: "STATUS_CHANGED", from_status: "NEW", to_status: "TRIAGED", at: "2026-11-01T11:00:00Z", actor: { kind: "MANAGER", name: "Chipo Dube" }, text: null, internal: false, details: null },
      { id: "ev1", type: "CREATED", at: "2026-11-01T10:00:00Z", actor: { kind: "TENANT", name: "Kudzai Sithole" } },
      { id: "ev3", type: "COMMENT", text: "Plumber on Monday.", internal: true, at: "2026-11-01T12:00:00Z", actor: { kind: "MANAGER", name: "Chipo Dube" } },
      { id: "ev4", type: "ASSIGNED", at: "2026-11-02T10:00:00Z", details: { provider: { name: "Sample Plumbers" }, enquiry_reference: "BE-7K3M9QXD" } },
      { id: "ev5", type: "COST_ADDED", at: "2026-11-18T09:00:00Z", details: { cost_id: "c1", amount: "85.00", currency: "USD", description: "Washer" } },
      { id: "ev6", type: "UPDATED", at: "2026-11-18T10:00:00Z", details: { fields: ["priority", "category"] } },
    ],
    created_at: "2026-11-01T10:00:00Z",
    can: { edit: true, transitions: ["IN_PROGRESS", "CANCELLED"], assign: true, add_cost: true, comment: true, add_photo: true },
  },
};

test("reading a request", () => {
  const request = normaliseRequest(sample);
  assert.ok(request);
  assert.equal(createdRequestId(sample), "r1");
  assert.equal(request.reference, "RPM-2026-900001");
  assert.equal(request.status, "ASSIGNED");
  assert.equal(request.priority, "high");
  assert.equal(request.priorityLabel, "High");
  assert.equal(request.categoryLabel, "Plumbing");
  assert.equal(requestPlace(request), "Avondale Court, Flat 1");
  assert.deepEqual(request.tenancy, { id: "t1", status: "ACTIVE", tenants: ["Kudzai Sithole"] });
  assert.equal(request.raisedBy?.kind, "TENANT");
  assert.equal(request.photos.length, 1);
  assert.equal(request.photos[0].uploadedBy, "Kudzai Sithole");
  assert.equal(request.provider?.name, "Sample Plumbers");
  assert.equal(request.assignment?.enquiry?.reference, "BE-7K3M9QXD");
  assert.equal(request.assignment?.by, "Chipo Dube");
  assert.equal(request.costs.length, 2);
  assert.equal(request.costs[0].currency, "USD");
  assert.equal(request.costs[0].ledgerEntryId, "le1");
  assert.deepEqual(request.costTotals, [{ currency: "USD", amount: "85.00", count: 1 }]);
  assert.deepEqual(request.can?.transitions, ["IN_PROGRESS", "CANCELLED"]);
  assert.equal(request.can?.addCost, true);
  const timeline = maintenanceTimeline(request);
  assert.deepEqual(timeline.map((item) => item.id), ["ev1", "ev2", "ev3", "ev4", "ev5", "ev6"], "oldest first");
  assert.deepEqual(timeline.map(timelineWords), [
    "Reported",
    "Moved from new to triaged",
    "Internal comment",
    "Assigned to Sample Plumbers",
    "Cost recorded: USD 85.00",
    "Changed the priority and category",
  ]);
  assert.equal(timeline[3].details?.enquiryReference, "BE-7K3M9QXD");
  assert.equal(normaliseRequest({ request: { title: "no id" } }), null);
  assert.equal(normaliseRequest(null), null);
});

test("the tenant's view, and a reopening", () => {
  const mine = normaliseRequest({
    request: {
      id: "r3",
      reference: "RPM-2026-900003",
      status: "NEW",
      category: { code: "appliances", label: "Appliances" },
      priority: { code: "normal", label: "Normal" },
      title: "Oven door hinge broken",
      property: { name: "Avondale Court" },
      unit: { label: "Flat 1" },
      raised_by: { kind: "TENANT", you: true },
      provider: { name: "Sample Plumbers" },
      photos: [],
      timeline: [{ id: "t1", type: "CREATED", at: "2026-11-01T10:00:00Z", actor: { kind: "TENANT", name: "Kudzai Sithole", you: true } }],
      can: { comment: true, add_photo: true },
    },
  });
  assert.equal(mine.property?.id, null, "no ids in the tenant's view");
  assert.equal(mine.provider?.name, "Sample Plumbers");
  assert.equal(mine.provider?.id, null);
  assert.equal(actorWords(mine.raisedBy), "You");
  assert.equal(actorWords({ kind: "MANAGER", name: "Sample Estates", you: false }), "Sample Estates");
  assert.equal(actorWords({ kind: "TENANT", name: "Kudzai Sithole", you: false }, true), "Kudzai Sithole (tenant)");
  assert.equal(actorWords({ kind: "SYSTEM", name: null, you: false }), "RightProperty365");
  assert.equal(mine.can?.comment, true);
  assert.deepEqual(mine.can?.transitions, null);
  const reopened = normaliseTimelineItem({ item: { id: "x", type: "STATUS_CHANGED", from_status: "RESOLVED", to_status: "IN_PROGRESS", text: "Still dripping" } });
  assert.equal(timelineWords(reopened), "Reopened");
  assert.equal(reopened.text, "Still dripping");
});

test("a bare request falls back to sensible words", () => {
  const request = normaliseRequest({ id: "r2", status: "NEW", priority: "urgent", category: "pests", created_at: "2026-11-01T00:00:00Z", raised_by: { kind: "MANAGER", name: "Chipo Dube" } });
  assert.equal(request.priorityLabel, "Urgent (safety, no water or power)");
  assert.equal(request.categoryLabel, "Pests");
  assert.equal(request.title, "Maintenance request");
  assert.deepEqual(maintenanceTimeline(request).map(timelineWords), ["Reported"]);
});

test("reading a page, the options, providers and an assignment", () => {
  const page = normaliseRequestPage({ items: [sample.request, { bad: 1 }], total: 41, page: 2, page_size: 20, status_counts: { NEW: 3, ASSIGNED: 1, CLOSED: "x" } });
  assert.equal(page.items.length, 1);
  assert.equal(page.totalPages, 3);
  assert.deepEqual(page.statusCounts, [
    { status: "NEW", count: 3 },
    { status: "ASSIGNED", count: 1 },
  ]);
  assert.equal(normaliseRequestPage({ items: [sample.request] }).totalPages, 1, "the tenant's list is never paged");
  const options = normaliseOptions({
    categories: [{ code: "plumbing", label: "Plumbing" }],
    priorities: [],
    transitions: { NEW: ["TRIAGED", "CANCELLED"] },
    currencies: [{ code: "USD", minor_unit: 2 }],
    methods: [{ code: "BANK", label: "Bank" }],
    photo_rules: { max_photos: 5, max_bytes: 1048576, types: ["image/jpeg", "text/plain"] },
    permissions: { write: false },
  });
  assert.deepEqual(options.categories, [{ code: "plumbing", label: "Plumbing" }]);
  assert.equal(options.priorities.length, 4, "the defaults when none are sent");
  assert.deepEqual(options.transitions, { NEW: ["TRIAGED", "CANCELLED"] });
  assert.deepEqual(options.currencies, [{ code: "USD", minorUnit: 2 }]);
  assert.deepEqual(options.methods, [{ code: "BANK", label: "Bank" }]);
  assert.deepEqual(options.photoRules, { maxPhotos: 5, maxBytes: 1048576, types: ["image/jpeg"] });
  assert.equal(options.write, false);
  const defaults = normaliseOptions(null);
  assert.deepEqual(defaults.photoRules, DEFAULT_PHOTO_RULES);
  assert.equal(defaults.methods.find((item) => item.code === "MOBILE_MONEY")?.label, "Mobile money");
  const providers = normaliseProviders({ items: [{ id: "dp1", kind: "service-providers", slug: "sample-plumbers", name: "Sample Plumbers", trade: { code: "plumber", label: "Plumber" }, city: "Harare", verified: true }, { name: "No id" }] });
  assert.deepEqual(providers.map((item) => [item.id, item.trade, item.city, item.verified]), [["dp1", "Plumber", "Harare", true]]);
  assert.deepEqual(assignedEnquiry({ request: sample.request, enquiry: { id: "e1", reference: "BE-1", replayed: true } }), { reference: "BE-1", replayed: true });
  assert.equal(assignedEnquiry({}), null);
});
