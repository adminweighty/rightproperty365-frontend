// Checks the rules of inspections (src/lib/inspections.ts, API 0.36.3): the
// type, status and finding words, the scheduled time sent as UTC, the
// checklist editor, completion readiness, photo checks, the forms and their
// bodies, the filters in the address and the API query, and the tolerant
// readers of the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addArea,
  addItem,
  adoptIds,
  areaNameProblem,
  cancelReasonProblem,
  changedFindings,
  checklistBody,
  checklistProblems,
  completeBody,
  dayBefore,
  incompleteFromConflict,
  inspectionActions,
  normaliseInspection,
  normaliseInspectionOptions,
  normaliseInspectionPage,
  structureSignature,
  checklistSignature,
  completeProblems,
  completionReadiness,
  emptyInspectionForm,
  findingLabel,
  findingTone,
  findingWords,
  hasProblems,
  inspectionApiProblems,
  inspectionApiQuery,
  inspectionBody,
  inspectionFormProblems,
  inspectionListHref,
  inspectionPhotoProblem,
  inspectionStatusLabel,
  inspectionStatusTone,
  inspectionTypeLabel,
  isEditableStatus,
  isOverdue,
  isRealDay,
  isUpcoming,
  itemLabelProblem,
  localToUtc,
  missingWords,
  moveArea,
  newInspectionHref,
  parseInspectionFilters,
  progressWords,
  removeArea,
  removeItem,
  renameArea,
  sortInspectionPhotos,
  suggestedType,
  updateItem,
  utcToLocal,
} from "../src/lib/inspections.ts";

const params = (text) => new URLSearchParams(text);

test("type, status and finding words", () => {
  assert.equal(inspectionTypeLabel("MOVE_IN"), "Move-in");
  assert.equal(inspectionTypeLabel("MOVE_OUT"), "Move-out");
  assert.equal(inspectionTypeLabel("ROUTINE"), "Routine");
  assert.equal(inspectionTypeLabel("ANNUAL_SAFETY"), "Annual safety");
  assert.equal(inspectionTypeLabel("ROUTINE", "Routine check"), "Routine check");

  assert.equal(inspectionStatusLabel("SCHEDULED"), "Scheduled");
  assert.equal(inspectionStatusLabel("IN_PROGRESS"), "In progress");
  assert.equal(inspectionStatusLabel("COMPLETED"), "Completed");
  assert.equal(inspectionStatusLabel("ON_HOLD"), "On hold");
  assert.equal(inspectionStatusLabel("COMPLETED", "Done"), "Done");
  assert.equal(inspectionStatusTone("COMPLETED"), "success");
  assert.equal(inspectionStatusTone("UNKNOWN"), "neutral");
  assert.equal(isEditableStatus("SCHEDULED"), true);
  assert.equal(isEditableStatus("IN_PROGRESS"), true);
  assert.equal(isEditableStatus("COMPLETED"), false);
  assert.equal(isEditableStatus("CANCELLED"), false);

  assert.equal(findingLabel("OK"), "OK");
  assert.equal(findingLabel("ATTENTION"), "Attention");
  assert.equal(findingLabel("DAMAGED"), "Damaged");
  assert.equal(findingLabel("NA"), "N/A");
  assert.equal(findingLabel(""), "Not checked");
  assert.equal(findingLabel(null), "Not checked");
  assert.equal(findingWords("NA"), "Not applicable");
  assert.equal(findingWords("ATTENTION"), "Needs attention");
  assert.equal(findingWords(""), "Not checked yet");
  assert.equal(findingTone("DAMAGED"), "danger");
  assert.equal(findingTone("OK"), "success");
  assert.equal(findingTone(""), "neutral");
});

test("the inspector's clock is sent as UTC", () => {
  // Harare is UTC+2 all year: getTimezoneOffset() is -120.
  assert.equal(localToUtc("2026-12-01", "09:30", -120), "2026-12-01T07:30:00Z");
  // New York in winter is UTC-5: 300.
  assert.equal(localToUtc("2026-12-01", "21:15", 300), "2026-12-02T02:15:00Z");
  // A day boundary backwards (Auckland in summer, UTC+13).
  assert.equal(localToUtc("2027-01-01", "08:00", -780), "2026-12-31T19:00:00Z");
  // UTC itself.
  assert.equal(localToUtc("2026-11-19", "00:00", 0), "2026-11-19T00:00:00Z");
  // Without an offset, the zone of the machine decides: same instant as Date.
  assert.equal(localToUtc("2026-06-15", "14:45"), new Date(2026, 5, 15, 14, 45).toISOString().replace(/\.000Z$/, "Z"));
  // Invalid input.
  assert.equal(localToUtc("2026-02-30", "09:00", 0), null);
  assert.equal(localToUtc("2026-12-01", "24:00", 0), null);
  assert.equal(localToUtc("2026-12-01", "9:30", 0), null);
  assert.equal(localToUtc("", "09:30", 0), null);

  assert.deepEqual(utcToLocal("2026-12-01T07:30:00Z", -120), { date: "2026-12-01", time: "09:30" });
  assert.deepEqual(utcToLocal("2026-12-02T02:15:00Z", 300), { date: "2026-12-01", time: "21:15" });
  assert.equal(utcToLocal("not a date", 0), null);
  assert.equal(utcToLocal(null), null);
  // A round trip in the machine's zone.
  const there = localToUtc("2026-03-10", "07:05");
  assert.deepEqual(utcToLocal(there), { date: "2026-03-10", time: "07:05" });

  assert.equal(isRealDay("2028-02-29"), true);
  assert.equal(isRealDay("2027-02-29"), false);
  assert.equal(isRealDay("2026-13-01"), false);
});

test("upcoming and overdue", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(isUpcoming({ status: "SCHEDULED", scheduledFor: "2026-11-20T08:00:00Z" }, now), true);
  assert.equal(isUpcoming({ status: "SCHEDULED", scheduledFor: "2026-11-18T08:00:00Z" }, now), false);
  assert.equal(isUpcoming({ status: "COMPLETED", scheduledFor: "2026-11-20T08:00:00Z" }, now), false);
  assert.equal(isOverdue({ status: "SCHEDULED", scheduledFor: "2026-11-18T08:00:00Z" }, now), true);
  assert.equal(isOverdue({ status: "COMPLETED", scheduledFor: "2026-11-18T08:00:00Z" }, now), false);
  assert.equal(isOverdue({ status: "SCHEDULED", scheduledFor: null }, now), false);
});

const item = (key, label, status = "", note = "") => ({ key, id: null, label, status, note, photos: [], baseline: null });

test("the checklist editor", () => {
  let list = addArea([], "  Kitchen ", "a1");
  list = addItem(list, "a1", " Walls ", "i1");
  list = addItem(list, "a1", "Oven", "i2");
  list = addArea(list, "Bathroom", "a2");
  assert.equal(list[0].name, "Kitchen");
  assert.deepEqual(
    list[0].items.map((i) => i.label),
    ["Walls", "Oven"],
  );
  list = updateItem(list, "a1", "i2", { status: "DAMAGED", note: "Door hinge broken" });
  assert.equal(list[0].items[1].status, "DAMAGED");
  assert.equal(list[0].items[0].status, "");
  list = renameArea(list, "a2", "Main bathroom");
  assert.equal(list[1].name, "Main bathroom");
  list = moveArea(list, "a2", -1);
  assert.deepEqual(
    list.map((a) => a.key),
    ["a2", "a1"],
  );
  assert.equal(moveArea(list, "a2", -1), list);
  list = removeItem(list, "a1", "i1");
  assert.deepEqual(
    list[1].items.map((i) => i.key),
    ["i2"],
  );
  list = removeArea(list, "a2");
  assert.deepEqual(
    list.map((a) => a.key),
    ["a1"],
  );

  assert.match(areaNameProblem(""), /Name the area/);
  assert.match(areaNameProblem("kitchen", ["Kitchen"]), /already/);
  assert.equal(areaNameProblem("Garden", ["Kitchen"]), null);
  assert.match(areaNameProblem("x".repeat(121)), /at most 120/);
  assert.match(itemLabelProblem(""), /Name the item/);
  assert.match(itemLabelProblem("WALLS", ["walls"]), /already/);
  assert.equal(itemLabelProblem("Ceiling", ["Walls"]), null);

  const bad = [
    { key: "a", id: null, name: "Kitchen", items: [item("1", "Walls"), item("2", "walls")] },
    { key: "b", id: null, name: "kitchen", items: [] },
    { key: "c", id: null, name: "", items: [item("3", "")] },
  ];
  const problems = checklistProblems(bad);
  assert.equal(problems.length, 4, problems.join("\n"));
  assert.ok(problems.some((p) => p.startsWith("Kitchen, walls")));
  assert.ok(problems.some((p) => p.startsWith("kitchen:")));
  assert.ok(problems.some((p) => p.startsWith("Area 3:")));
  assert.deepEqual(checklistProblems(list), []);
  assert.deepEqual(checklistProblems([]), ["Keep at least one area in the checklist."]);
  assert.deepEqual(checklistProblems([{ key: "a", id: null, name: "Kitchen", items: [] }]), ["Keep at least one item in the checklist."]);
});

test("completion readiness", () => {
  assert.equal(completionReadiness([]).ready, false);
  assert.equal(completionReadiness([]).total, 0);

  const list = [
    { key: "a", id: "A", name: "Kitchen", items: [item("1", "Walls", "OK"), item("2", "Oven", ""), item("3", "Sink", "NA")] },
    { key: "b", id: "B", name: "Bathroom", items: [item("4", "Taps", "ATTENTION"), item("5", "Tiles", "")] },
    { key: "c", id: "C", name: "Garage", items: [] },
  ];
  const readiness = completionReadiness(list);
  assert.equal(readiness.total, 5);
  assert.equal(readiness.done, 3);
  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.missing.map((m) => `${m.area}/${m.item}`),
    ["Kitchen/Oven", "Bathroom/Tiles"],
  );
  assert.deepEqual(readiness.counts, { OK: 1, ATTENTION: 1, DAMAGED: 0, NA: 1 });
  assert.deepEqual(readiness.emptyAreas, ["Garage"]);
  assert.equal(missingWords(readiness.missing), "Kitchen: Oven; Bathroom: Tiles");
  assert.equal(missingWords(readiness.missing, 1), "Kitchen: Oven; and 1 more");
  assert.equal(progressWords(readiness.done, readiness.total), "3 of 5 items checked");
  assert.equal(progressWords(1, 1), "1 of 1 item checked");

  const done = updateItem(updateItem(list, "a", "2", { status: "DAMAGED" }), "b", "5", { status: "OK" });
  const ready = completionReadiness(done);
  assert.equal(ready.ready, true);
  assert.equal(ready.done, 5);
  assert.equal(ready.missing.length, 0);

  // A note that is too long stops completion.
  const long = updateItem(done, "a", "1", { note: "x".repeat(1001) });
  assert.equal(completionReadiness(long).ready, false);
  assert.equal(completionReadiness(long).longNotes.length, 1);
});

test("unsaved changes are told by the signature", () => {
  const list = [{ key: "a", id: "A", name: "Kitchen", items: [item("1", "Walls", "OK", "Fine")] }];
  const same = [{ key: "a", id: "A", name: "Kitchen ", items: [{ ...item("1", "Walls", "OK", "Fine "), photos: [{ id: "p" }] }] }];
  assert.equal(checklistSignature(list), checklistSignature(same));
  assert.notEqual(checklistSignature(list), checklistSignature(updateItem(list, "a", "1", { status: "DAMAGED" })));
  assert.notEqual(checklistSignature(list), checklistSignature(addItem(list, "a", "Ceiling", "x")));
});

test("ids given by the API are adopted after a save", () => {
  const draft = [
    { key: "a", id: "A", name: "Kitchen", items: [item("k1", "Walls", "OK"), item("k2", "Oven", "DAMAGED", "typed meanwhile")] },
    { key: "b", id: null, name: "Garden", items: [item("g1", "Fence")] },
  ];
  draft[0].items[0] = { ...draft[0].items[0], id: "I1" };
  const saved = [
    { key: "A", id: "A", name: "Kitchen", items: [{ ...item("I1", "Walls", "OK"), id: "I1", photos: [{ id: "p1" }] }, { ...item("I9", "oven", "DAMAGED"), id: "I9" }] },
    { key: "B", id: "B", name: "garden", items: [{ ...item("I7", "Fence"), id: "I7" }] },
  ];
  const adopted = adoptIds(draft, saved);
  assert.equal(adopted[0].items[0].photos.length, 1);
  assert.equal(adopted[0].items[1].id, "I9");
  assert.equal(adopted[0].items[1].note, "typed meanwhile");
  assert.equal(adopted[0].items[1].key, "k2");
  assert.equal(adopted[1].id, "B");
  assert.equal(adopted[1].items[0].id, "I7");
  // Nothing to match: left as it is.
  assert.deepEqual(adoptIds(draft, []), draft);
});

test("photo checks", () => {
  assert.equal(inspectionPhotoProblem({ name: "a.jpg", type: "image/jpeg", size: 1000 }), null);
  assert.equal(inspectionPhotoProblem({ name: "a.webp", type: "", size: 1000 }), null);
  assert.match(inspectionPhotoProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }), /not a photo we accept\. Choose a JPEG, PNG or WebP image/);
  assert.match(inspectionPhotoProblem({ name: "a.heic", type: "image/heic", size: 1000 }), /not a photo/);
  assert.match(inspectionPhotoProblem({ name: "a.png", type: "image/png", size: 0 }), /empty/);
  assert.match(inspectionPhotoProblem({ name: "big.png", type: "image/png", size: 11 * 1024 * 1024 }), /larger than 10 MB/);
  const rules = { maxPhotos: 2, maxBytes: 1024, types: ["image/jpeg"] };
  assert.match(inspectionPhotoProblem({ name: "a.png", type: "image/png", size: 10 }, rules), /Choose a JPEG image/);

  const files = [
    { name: "1.jpg", type: "image/jpeg", size: 10 },
    { name: "bad.gif", type: "image/gif", size: 10 },
    { name: "2.jpg", type: "image/jpeg", size: 10 },
    { name: "3.jpg", type: "image/jpeg", size: 10 },
  ];
  const sorted = sortInspectionPhotos(files, 0, rules);
  assert.deepEqual(
    sorted.accepted.map((f) => f.name),
    ["1.jpg", "2.jpg"],
  );
  assert.equal(sorted.problems.length, 2);
  assert.match(sorted.problems[1], /up to 2 photos/);
  assert.equal(sortInspectionPhotos(files.slice(0, 1), 2, rules).accepted.length, 0);
});

test("the new inspection form and its body", () => {
  const form = emptyInspectionForm();
  const problems = inspectionFormProblems(form);
  assert.ok(problems.propertyId);
  assert.ok(problems.date);
  assert.equal(problems.time, undefined);
  assert.equal(problems.type, undefined);
  assert.ok(inspectionFormProblems({ ...form, time: "25:00" }).time);
  assert.ok(inspectionFormProblems({ ...form, date: "2026-02-31" }).date);
  assert.ok(inspectionFormProblems({ ...form, type: "OTHER" }).type);
  assert.ok(inspectionFormProblems(form, { templateRequired: true }).template);

  const filled = { propertyId: "p1", unitId: "", tenancyId: "t1", type: "MOVE_IN", date: "2026-12-01", time: "09:30", template: "standard", inspectorId: "" };
  assert.equal(hasProblems(inspectionFormProblems(filled)), false);
  assert.deepEqual(inspectionBody(filled, -120), {
    property_id: "p1",
    unit_id: null,
    tenancy_id: "t1",
    type: "MOVE_IN",
    scheduled_for: "2026-12-01T07:30:00Z",
    checklist_template: "standard",
  });
  assert.equal("checklist_template" in inspectionBody({ ...filled, template: "" }, 0), false);

  const mapped = inspectionApiProblems({ scheduled_for: "must be a timestamp", property_id: "is not a property", other_thing: "nope" });
  assert.equal(mapped.date, "must be a timestamp");
  assert.equal(mapped.propertyId, "is not a property");
  assert.deepEqual(mapped.other, ["nope"]);

  assert.deepEqual(completeProblems({ summary: "", agent: "", tenant: "" }), {});
  assert.deepEqual(completeProblems({ summary: "All good", agent: "Chipo Dube", tenant: "" }), {});
  assert.ok(completeProblems({ summary: "", agent: "A", tenant: "x".repeat(201) }).tenant);
  assert.ok(completeProblems({ summary: "x".repeat(5001), agent: "", tenant: "" }).summary);
  assert.deepEqual(completeBody({ summary: "  Fine overall ", agent: " Chipo Dube ", tenant: " " }), {
    summary: "Fine overall",
    tenant_sign_off_name: null,
    agent_sign_off_name: "Chipo Dube",
  });
  assert.match(cancelReasonProblem(" "), /Say why/);
  assert.equal(cancelReasonProblem("Tenant away"), null);
  assert.match(cancelReasonProblem("x".repeat(501)), /500/);
  assert.equal(inspectionBody({ ...filled, inspectorId: "u1" }, 0).inspector_user_id, "u1");
  assert.equal("inspector_user_id" in inspectionBody(filled, 0), false);
});

test("filters, queries and addresses", () => {
  const filters = parseInspectionFilters(params("status=completed&type=move_in&property=p-1&when=past&page=2&org=o"));
  assert.deepEqual(filters, { page: 2, status: "COMPLETED", type: "MOVE_IN", property: "p-1", when: "past" });
  assert.deepEqual(parseInspectionFilters(params("status=nope&type=x&property=a%20b&when=later&page=-1")), { page: 1 });
  assert.equal(inspectionListHref(filters, "o"), "/agent/inspections?org=o&when=past&status=COMPLETED&type=MOVE_IN&property=p-1&page=2");
  assert.equal(inspectionListHref({}, ""), "/agent/inspections");
  assert.equal(inspectionApiQuery(filters, 25, "2026-11-19"), "?status=COMPLETED&type=MOVE_IN&property_id=p-1&to=2026-11-18&page=2&page_size=25");
  assert.equal(inspectionApiQuery({ page: 1, when: "upcoming" }, 25, "2026-11-19"), "?from=2026-11-19&page=1&page_size=25");
  assert.equal(inspectionApiQuery({ page: 1, tenancy: "t" }, 10), "?tenancy_id=t&page=1&page_size=10");
  assert.equal(dayBefore("2027-01-01"), "2026-12-31");
  assert.equal(dayBefore("2028-03-01"), "2028-02-29");
  assert.equal(newInspectionHref("o", { property: "p", tenancy: "t", type: "MOVE_IN" }), "/agent/inspections/new?org=o&property=p&tenancy=t&type=MOVE_IN");

  assert.equal(suggestedType({ status: "ACTIVE" }, false), "MOVE_IN");
  assert.equal(suggestedType({ status: "ACTIVE" }, true), "ROUTINE");
  assert.equal(suggestedType({ status: "ENDED" }, true), "MOVE_OUT");
  assert.equal(suggestedType({ status: "DRAFT" }, false), "MOVE_IN");
});

test("what is saved: the structure and the changed findings", () => {
  const saved = [{ key: "A", id: "A", name: "Kitchen", items: [{ ...item("I1", "Walls", "OK", "Fine"), id: "I1" }, { ...item("I2", "Oven"), id: "I2" }] }];
  let draft = updateItem(saved, "A", "I2", { status: "DAMAGED", note: " Hinge broken " });
  assert.equal(structureSignature(draft), structureSignature(saved));
  assert.deepEqual(changedFindings(draft, saved), [{ item_id: "I2", status: "DAMAGED", note: "Hinge broken" }]);
  // Clearing a finding sends null.
  draft = updateItem(saved, "A", "I1", { status: "" });
  assert.deepEqual(changedFindings(draft, saved), [{ item_id: "I1", status: null, note: "Fine" }]);
  // A new item changes the structure; its finding waits for its id.
  draft = updateItem(addItem(saved, "A", "Sink", "new1"), "A", "new1", { status: "OK" });
  assert.notEqual(structureSignature(draft), structureSignature(saved));
  assert.deepEqual(changedFindings(draft, saved), []);
  // Renaming an item changes the structure but not the findings.
  assert.notEqual(structureSignature(updateItem(saved, "A", "I1", { label: "Walls and ceiling" })), structureSignature(saved));

  assert.deepEqual(checklistBody(addArea(draft, " Garden ", "g")), {
    areas: [
      { id: "A", label: "Kitchen", items: [{ id: "I1", label: "Walls" }, { id: "I2", label: "Oven" }, { id: null, label: "Sink" }] },
      { id: null, label: "Garden", items: [] },
    ],
  });
});

const sample = {
  inspection: {
    id: "i-1",
    reference: "RPI-2026-900003",
    type: "MOVE_OUT",
    type_label: "Move-out",
    status: "IN_PROGRESS",
    status_label: "In progress",
    property: { id: "p-1", name: "Avondale Court", address: "12 King George Road", market_code: "ZW", archived: false },
    unit: { id: "u-1", label: "Flat 1", archived: false },
    tenancy_id: "t-1",
    tenancy: { id: "t-1", status: "ENDED", status_label: "Ended", property: { id: "p-1", name: "Avondale Court" }, unit: null, tenants: [{ id: "c", name: "Kudzai Sithole", live: true }] },
    scheduled_for: "2026-12-01T07:00:00Z",
    inspector: { user_id: "u", name: "Chipo Dube" },
    template: { code: "residential", label: "Standard residential" },
    progress: { items: 3, done: 2, ok: 1, attention: 0, damaged: 1, na: 0 },
    photo_count: 1,
    started_at: "2026-12-01T07:05:00Z",
    completed_at: null,
    cancelled_at: null,
    areas: [
      {
        id: "a-1",
        label: "Kitchen",
        position: 1,
        items: [
          {
            id: "it-1",
            label: "Sink and taps",
            position: 1,
            status: "DAMAGED",
            status_label: "Damaged",
            note: "Tap broken",
            photos: [{ id: "ph-1", item_id: "it-1", url: "/v1/agent/organisations/o/inspections/i-1/photos/ph-1", width: 1600, height: 1200, uploaded_at: "2026-12-01T07:10:00Z", can: { delete: true } }],
            baseline: { status: "ATTENTION", status_label: "Needs attention", note: "Cold tap drips slightly" },
          },
          { id: "it-2", label: "Worktops", position: 2, status: "OK", status_label: "OK", note: "", photos: [], baseline: null },
          { id: "it-3", label: "Stove and oven", position: 3, status: null, status_label: null, note: "", photos: [], baseline: null },
        ],
      },
    ],
    summary: "",
    sign_off: { tenant_name: null, agent_name: null },
    cancel_reason: null,
    baseline: { id: "b-1", reference: "RPI-2026-900001", completed_at: "2026-10-01T09:00:00Z" },
    created_by: { user_id: "u", name: "Chipo Dube" },
    completed_by: null,
    cancelled_by: null,
    report_url: "/v1/agent/organisations/o/inspections/i-1/report.pdf",
    can: { edit: true, edit_checklist: true, record_findings: true, add_photo: true, start: false, complete: true, cancel: true },
  },
};

test("reading an inspection", () => {
  const inspection = normaliseInspection(sample);
  assert.equal(inspection.reference, "RPI-2026-900003");
  assert.equal(inspection.typeLabel, "Move-out");
  assert.equal(inspection.tenancy.id, "t-1");
  assert.deepEqual(inspection.tenancy.tenants, ["Kudzai Sithole"]);
  assert.equal(inspection.inspector, "Chipo Dube");
  assert.deepEqual(inspection.template, { code: "residential", label: "Standard residential" });
  assert.deepEqual(inspection.progress, { done: 2, total: 3, counts: { OK: 1, ATTENTION: 0, DAMAGED: 1, NA: 0 } });
  assert.equal(inspection.checklist[0].name, "Kitchen");
  const [sink, , oven] = inspection.checklist[0].items;
  assert.equal(sink.status, "DAMAGED");
  assert.equal(sink.photos[0].canDelete, true);
  assert.deepEqual(sink.baseline, { status: "ATTENTION", label: "Needs attention", note: "Cold tap drips slightly" });
  assert.equal(oven.status, "");
  assert.equal(inspection.baseline.reference, "RPI-2026-900001");
  assert.equal(inspection.can.complete, true);
  assert.equal(inspection.can.start, false);
  assert.equal(completionReadiness(inspection.checklist).missing[0].item, "Stove and oven");

  // The tenant's view: no ids on the property, no can.
  const mine = normaliseInspection({ id: "i-2", status: "COMPLETED", property: { name: "Avondale Court" }, unit: null, template: { label: "Standard residential" }, inspector: { name: "Chipo Dube" }, areas: [] });
  assert.equal(mine.property.id, null);
  assert.equal(mine.can, null);
  assert.equal(mine.template.label, "Standard residential");
  assert.equal(normaliseInspection({}), null);

  const page = normaliseInspectionPage({ items: [sample.inspection], total: 30, page: 2, page_size: 25, status_counts: { SCHEDULED: 1, COMPLETED: 2 } });
  assert.equal(page.totalPages, 2);
  assert.deepEqual(page.statusCounts, [
    { status: "SCHEDULED", count: 1 },
    { status: "COMPLETED", count: 2 },
  ]);

  assert.deepEqual(incompleteFromConflict({ error: { code: "INSPECTION_INCOMPLETE", details: { missing: 2, item_ids: ["a", "b"] } } }), { missing: 2, itemIds: ["a", "b"] });
  assert.equal(incompleteFromConflict(null), null);

  const staff = inspectionActions({ status: "IN_PROGRESS", can: null }, "STAFF");
  assert.equal(staff.edit || staff.complete || staff.addPhoto, false);
  const agent = inspectionActions({ status: "SCHEDULED", can: null }, "AGENT");
  assert.equal(agent.start, true);
  assert.equal(agent.complete, false);
  assert.equal(inspectionActions({ status: "COMPLETED", can: null }, "OWNER").edit, false);
});

test("reading the options", () => {
  const options = normaliseInspectionOptions({
    types: [{ code: "MOVE_IN", label: "Move-in" }],
    templates: [
      { code: "residential", label: "Standard residential", areas: [{ code: "k", label: "Kitchen", items: [{ code: "s", label: "Sink" }, { code: "w", label: "Walls" }] }] },
    ],
    inspectors: [{ user_id: "u1", name: "Chipo Dube" }, { name: "No id" }],
    photo_rules: { max_photos_per_item: 6, max_photos: 200, max_bytes: 10485760, types: ["image/jpeg"] },
    limits: { max_areas: 40, max_items_per_area: 60, max_items: 400, max_label: 120, max_note: 1000, max_summary: 5000, max_sign_off: 200 },
    permissions: { write: true },
  });
  assert.deepEqual(options.types, [{ code: "MOVE_IN", label: "Move-in" }]);
  assert.deepEqual(options.templates, [{ code: "residential", label: "Standard residential", areas: 1, items: 2 }]);
  assert.deepEqual(options.inspectors, [{ userId: "u1", name: "Chipo Dube" }]);
  assert.equal(options.photoRules.maxPhotos, 6);
  assert.equal(options.photoRules.maxPerInspection, 200);
  assert.deepEqual(options.photoRules.types, ["image/jpeg"]);
  assert.equal(options.limits.maxNote, 1000);
  assert.equal(options.write, true);
  const fallback = normaliseInspectionOptions(null);
  assert.equal(fallback.types.length, 3);
  assert.equal(fallback.findingStatuses.length, 4);
  assert.equal(fallback.templates.length, 0);
  assert.equal(fallback.photoRules.maxPhotos, 6);
});
