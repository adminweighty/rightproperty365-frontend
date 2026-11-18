// Checks the contact book's own rules (src/lib/contacts.ts): stage words,
// the list's filters in the address and the API query, the filter chips,
// duplicates in a 409, the merge preview, the CSV check before an import and
// where timeline entries link. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canExportContacts,
  canReassignOwner,
  canWriteContacts,
  checkContactCsv,
  cleanList,
  CONTACT_STAGES,
  contactFilterChips,
  contactFiltersApiQuery,
  contactFiltersSearch,
  contactHref,
  contactIdFrom,
  contactsPath,
  duplicateIdsFrom,
  emailProblem,
  hasNarrowingContactFilters,
  isReminderDue,
  linkedItemHref,
  localDateTimeToIso,
  mergePreview,
  normalisePhone,
  parseContactFilters,
  parseCsv,
  phoneProblem,
  stageLabel,
  stageOptions,
  stageTone,
} from "../src/lib/contacts.ts";

const params = (query) => new URLSearchParams(query);
const OWNER = "0b8e2f4c-1d2a-4c3b-9e8f-7a6b5c4d3e2f";

test("the stages are the FSD's, in pipeline order", () => {
  assert.deepEqual(
    [...CONTACT_STAGES],
    ["NEW", "CONTACTED", "VIEWING_REQUESTED", "VIEWING_CONFIRMED", "NEGOTIATING", "CLOSED", "UNSUCCESSFUL"],
  );
});

test("stage words come from the API, then the reference set, then the fallback", () => {
  assert.equal(stageLabel("NEGOTIATING", { NEGOTIATING: "In negotiation" }, "Offer made"), "Offer made");
  assert.equal(stageLabel("NEGOTIATING", { NEGOTIATING: "In negotiation" }), "In negotiation");
  assert.equal(stageLabel("VIEWING_CONFIRMED"), "Viewing confirmed");
  assert.equal(stageLabel("SOMETHING_NEW"), "Something new");
  assert.equal(stageOptions().length, 7);
  assert.deepEqual(stageOptions({ NEW: "Fresh" })[0], { value: "NEW", label: "Fresh" });
  assert.equal(stageTone("NEW"), "primary");
  assert.equal(stageTone("UNKNOWN"), "neutral");
});

test("who sees which controls", () => {
  assert.ok(canWriteContacts("AGENT"));
  assert.ok(!canWriteContacts("STAFF"));
  assert.ok(canExportContacts("MANAGER"));
  assert.ok(!canExportContacts("AGENT"));
  assert.ok(canReassignOwner("OWNER", null, "me"));
  assert.ok(canReassignOwner("AGENT", "me", "me"));
  assert.ok(!canReassignOwner("AGENT", "someone", "me"));
  assert.ok(!canReassignOwner("STAFF", "me", "me"));
});

test("filters are read from the address, and anything the API would refuse is dropped", () => {
  assert.deepEqual(parseContactFilters(params("")), { page: 1 });
  assert.deepEqual(
    parseContactFilters(params(`q=+Rudo+&type=buyer&stage=NEGOTIATING&tag=cash&owner=${OWNER}&due=1&sort=name&page=3`)),
    { q: "Rudo", type: "buyer", stage: "NEGOTIATING", tag: "cash", owner: OWNER, due: true, sort: "name", page: 3 },
  );
  assert.deepEqual(parseContactFilters(params("stage=NEW_ENQUIRY&owner=nope&type=a%20b&sort=price&page=-1&due=yes")), { page: 1 });
  // The default order is left out of the address.
  assert.deepEqual(parseContactFilters(params("sort=last_contact")), { page: 1 });
  assert.equal(parseContactFilters(params(`q=${"x".repeat(150)}`)).q.length, 100);
});

test("the address keeps the organisation first and leaves page 1 out", () => {
  assert.equal(contactFiltersSearch({ page: 1 }), "");
  assert.equal(contactFiltersSearch({ page: 1 }, "org-1"), "?org=org-1");
  assert.equal(
    contactFiltersSearch({ q: "a b", stage: "NEW", due: true, sort: "name", page: 2 }, "org-1"),
    "?org=org-1&q=a+b&stage=NEW&due=1&sort=name&page=2",
  );
  assert.ok(!hasNarrowingContactFilters({ stage: "NEW", sort: "name", page: 2 }));
  assert.ok(hasNarrowingContactFilters({ due: true, page: 1 }));
});

test("the API query uses the contract's names", () => {
  assert.equal(contactFiltersApiQuery({ page: 1 }), "?page=1&page_size=20");
  assert.equal(
    contactFiltersApiQuery({ q: "077", type: "tenant", stage: "CLOSED", tag: "vip", owner: OWNER, due: true, sort: "created", page: 4 }, 50),
    `?q=077&type=tenant&stage=CLOSED&tag=vip&owner=${OWNER}&has_reminder_due=true&sort=created&page=4&page_size=50`,
  );
});

test("each filter chip is the list without that filter, back at page 1", () => {
  const filters = { q: "rudo", type: "buyer", tag: "cash", owner: OWNER, due: true, stage: "NEW", page: 3 };
  const chips = contactFilterChips(filters, { type: () => "Buyer", owner: () => "Tendai" }, (next) => contactFiltersSearch(next, "o"));
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["“rudo”", "Buyer", "Tag: cash", "Owner: Tendai", "Reminder due"],
  );
  assert.equal(chips[1].href, `?org=o&q=rudo&stage=NEW&tag=cash&owner=${OWNER}&due=1`);
  assert.equal(chips[4].href, `?org=o&q=rudo&type=buyer&stage=NEW&tag=cash&owner=${OWNER}`);
  assert.deepEqual(contactFilterChips({ stage: "NEW", page: 1 }, {}, () => ""), []);
});

test("emails, phones and tags are cleaned and checked", () => {
  assert.deepEqual(cleanList([" a@x.com ", "", "A@x.com", "b@x.com"]), ["a@x.com", "b@x.com"]);
  assert.equal(emailProblem("rudo@example.com"), null);
  assert.ok(emailProblem("rudo@"));
  assert.equal(phoneProblem("+263 77 123 4567"), null);
  assert.ok(phoneProblem("077 123 4567"));
  assert.ok(phoneProblem("+12"));
  assert.equal(normalisePhone(" +263 (77) 123-4567 "), "+263771234567");
});

test("duplicate ids are found wherever the 409 puts them", () => {
  assert.deepEqual(duplicateIdsFrom({ duplicates: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(duplicateIdsFrom({ error: { code: "CONTACT_DUPLICATE", duplicates: ["c"] } }), ["c"]);
  assert.deepEqual(duplicateIdsFrom({ error: { details: { duplicates: [{ id: "d" }, 4] } } }), ["d"]);
  assert.deepEqual(duplicateIdsFrom(null), []);
  assert.equal(contactIdFrom({ contact: { id: "x" } }), "x");
  assert.equal(contactIdFrom({ id: "y" }), "y");
  assert.equal(contactIdFrom({}), null);
});

test("the merge preview counts only what is new to the contact kept", () => {
  const keep = { id: "k", emails: ["Rudo@Example.com"], phones: ["+263 77 123 4567"], tags: ["Cash"], notes: [1] };
  const other = {
    id: "o",
    emails: ["rudo@example.com", "r.moyo@work.co.zw"],
    phones: ["+263771234567", "+44 7700 900123"],
    tags: ["cash", "Harare"],
    notes: [1, 2],
    reminders: [1],
    listings: [1],
    links: [1, 2, 3],
  };
  assert.deepEqual(mergePreview(keep, [other, keep]), {
    emails: ["r.moyo@work.co.zw"],
    phones: ["+44 7700 900123"],
    tags: ["Harare"],
    notes: 2,
    reminders: 1,
    listings: 1,
    links: 3,
  });
});

test("CSV is split as RFC 4180 says", () => {
  assert.deepEqual(parseCsv('﻿name,email\r\n"Moyo, Rudo","a@x.com"\n\n"Say ""hi""\nthere",b\n'), [
    ["name", "email"],
    ["Moyo, Rudo", "a@x.com"],
    ['Say "hi"\nthere', "b"],
  ]);
  assert.deepEqual(parseCsv("a,b"), [["a", "b"]]);
  assert.deepEqual(parseCsv(""), []);
});

test("a CSV is checked before it is sent for the API's preview", () => {
  assert.deepEqual(checkContactCsv("Name,Email\nRudo,r@x.com\nTendai,"), { ok: true, headers: ["Name", "Email"], rows: 2 });
  assert.equal(checkContactCsv("").ok, false);
  assert.match(checkContactCsv("email\na@x.com").problem, /name/);
  assert.match(checkContactCsv("name\n").problem, /no contacts/);
  const many = `name\n${"x\n".repeat(6)}`;
  assert.match(checkContactCsv(many, 5).problem, /at most 5/);
});

test("timeline entries link to their own pages, or to none", () => {
  assert.equal(linkedItemHref("PROPERTY_REQUEST", "r1"), "/agent/requests/r1");
  assert.equal(linkedItemHref("business_enquiry", "e1"), "/agent/requests#business-enquiries");
  assert.equal(linkedItemHref("APPOINTMENT", "a1"), "/agent/appointments");
  assert.equal(linkedItemHref("CONTACT", "c1", "o 1"), "/agent/contacts/c1?org=o%201");
  assert.equal(linkedItemHref("APPLICATION", "x"), null);
  assert.equal(linkedItemHref(null, "x"), null);
  assert.equal(contactHref("c1"), "/agent/contacts/c1");
  assert.equal(contactsPath("/merge", "o", { keep: "c1", none: undefined }), "/agent/contacts/merge?org=o&keep=c1");
});

test("reminder times", () => {
  const iso = localDateTimeToIso("2026-11-18T09:30");
  assert.equal(new Date(iso).getMinutes(), 30);
  assert.equal(localDateTimeToIso("2026-02-30T09:30"), null);
  assert.equal(localDateTimeToIso("tomorrow"), null);
  const now = Date.parse("2026-11-18T10:00:00Z");
  assert.ok(isReminderDue({ due_at: "2026-11-18T09:00:00Z", done: false }, now));
  assert.ok(!isReminderDue({ due_at: "2026-11-18T09:00:00Z", done: true }, now));
  assert.ok(!isReminderDue({ due_at: "2026-11-19T09:00:00Z", done: false }, now));
});
