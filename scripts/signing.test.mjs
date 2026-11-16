// Checks the leases and signing rules: messages per code, recipient order,
// the field editor's geometry, the file checks, dates, lease and template
// checks, and the dashboard's new targets. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { counterHref, targetHref } from "../src/lib/portal.ts";
import {
  amountProblem,
  assignOrders,
  base64Bytes,
  boxAt,
  clampBox,
  cleanReference,
  AGREEMENT_REFERENCE,
  eventLabel,
  expiryProblem,
  initialsOf,
  isSampleReview,
  isSequential,
  leaseDatesProblems,
  move,
  noticeProblem,
  paymentDayProblem,
  pdfFileProblem,
  placeholderProblem,
  recipientColour,
  RECIPIENT_COLOURS,
  signatureDimensionsProblem,
  signatureImageProblem,
  signersWithoutSignature,
  signingMessage,
  statusOf,
  AGREEMENT_STATUS,
  toPoints,
  cleanStamp,
  fieldMin,
  isSignerOnly,
  ORG_TEMPLATE_STATUS,
  stampFieldErrors,
  stampProblems,
} from "../src/lib/signing.ts";

test("known codes get plain words, unknown ones keep the API's message", () => {
  assert.match(signingMessage({ code: "SIGNING_LINK_EXPIRED", message: "x" }), /expired/);
  assert.equal(signingMessage({ code: "SOMETHING_NEW", message: "From the API." }), "From the API.");
  assert.equal(statusOf(AGREEMENT_STATUS, "OUT_FOR_SIGNATURE").label, "Out for signature");
  assert.equal(statusOf(AGREEMENT_STATUS, "BRAND_NEW").label, "Brand new");
  assert.equal(eventLabel("AGREEMENT_SIGNED"), "Signed");
  assert.equal(eventLabel("SOMETHING_ELSE"), "Something else");
});

test("in order: 1..n; in parallel: all 1", () => {
  assert.deepEqual(assignOrders(3, true), [1, 2, 3]);
  assert.deepEqual(assignOrders(3, false), [1, 1, 1]);
  assert.equal(isSequential([1, 2]), true);
  assert.equal(isSequential([1, 1, 1]), false);
  assert.deepEqual(move(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(move(["a", "b"], 0, 5), ["a", "b"]);
});

test("every signer needs a signature field; approvers and copies do not", () => {
  const recipients = [
    { id: "1", name: "Ann", role: "SIGNER" },
    { id: "2", name: "Ben", role: "APPROVER" },
    { id: "3", name: "Cy", role: "SIGNER" },
    { id: "4", name: "Di", role: "CC" },
  ];
  assert.deepEqual(signersWithoutSignature(recipients, [{ recipient_id: "1", type: "SIGNATURE" }, { recipient_id: "3", type: "INITIALS" }]), ["Cy"]);
  assert.deepEqual(signersWithoutSignature(recipients, [{ recipient_id: "1", type: "SIGNATURE" }, { recipient_id: "3", type: "SIGNATURE" }]), []);
});

test("fields stay on the page, at least 6 x 6 points, in PDF points from the top-left", () => {
  const page = { width: 595.28, height: 841.89 };
  assert.deepEqual(clampBox({ x: -10, y: -5, w: 2, h: 2 }, page), { x: 0, y: 0, w: 6, h: 6 });
  assert.deepEqual(clampBox({ x: 590, y: 840, w: 100, h: 20 }, page), { x: 495.28, y: 821.89, w: 100, h: 20 });
  assert.deepEqual(boxAt({ x: 100, y: 100 }, { w: 180, h: 40 }, page), { x: 10, y: 80, w: 180, h: 40 });
  assert.deepEqual(toPoints({ x: 150, y: 300 }, 1.5), { x: 100, y: 200 });
});

test("colours and initials", () => {
  assert.equal(recipientColour(0), RECIPIENT_COLOURS[0]);
  assert.equal(recipientColour(RECIPIENT_COLOURS.length), RECIPIENT_COLOURS[0]);
  assert.equal(initialsOf("Jane van der Berg"), "JB");
  assert.equal(initialsOf("  tendai "), "T");
  assert.equal(initialsOf(""), "");
});

test("the document must be a PDF of at most 20 MB; signature images PNG or JPEG of at most 500 KB", () => {
  assert.equal(pdfFileProblem({ name: "lease.pdf", type: "application/pdf", size: 1000 }), undefined);
  assert.match(pdfFileProblem({ name: "lease.docx", type: "application/msword", size: 1000 }), /PDF/);
  assert.match(pdfFileProblem({ name: "big.pdf", type: "application/pdf", size: 21 * 1024 * 1024 }), /20 MB/);
  assert.match(pdfFileProblem({ name: "empty.pdf", type: "", size: 0 }), /empty/);
  assert.equal(signatureImageProblem({ type: "image/png", size: 1000 }), undefined);
  assert.match(signatureImageProblem({ type: "image/gif", size: 1000 }), /PNG or JPEG/);
  assert.match(signatureImageProblem({ type: "image/jpeg", size: 600 * 1024 }), /500 KB/);
  assert.equal(signatureDimensionsProblem(600, 200), undefined);
  assert.match(signatureDimensionsProblem(10, 5), /too small/);
  assert.match(signatureDimensionsProblem(3000, 200), /too large/);
  assert.equal(base64Bytes("data:image/png;base64,AAAA"), 3);
  assert.equal(base64Bytes("AAA="), 2);
});

test("expiry from tomorrow to a year; lease dates and money", () => {
  const now = Date.parse("2026-11-15T10:00:00");
  assert.equal(expiryProblem("2026-12-15", now), undefined);
  assert.match(expiryProblem("2026-11-14", now), /after today/);
  assert.match(expiryProblem("2028-01-01", now), /within a year/);
  assert.match(expiryProblem("2026-02-30", now), /like/);
  assert.deepEqual(leaseDatesProblems("2026-12-01", "2027-11-30", false), {});
  assert.match(leaseDatesProblems("2026-12-01", "2026-11-30", false).end_date, /after the start/);
  assert.deepEqual(leaseDatesProblems("2026-12-01", "", true), {});
  assert.equal(amountProblem("1200.50", "rent"), undefined);
  assert.match(amountProblem("1,200", "rent"), /without commas/);
  assert.match(amountProblem("0", "rent"), /more than 0/);
  assert.equal(amountProblem("", "deposit", true), undefined);
  assert.equal(paymentDayProblem(7, "WEEKLY"), undefined);
  assert.match(paymentDayProblem(8, "WEEKLY"), /day of the week/);
  assert.equal(paymentDayProblem(31, "MONTHLY"), undefined);
  assert.equal(noticeProblem(30), undefined);
  assert.match(noticeProblem(400), /1 to 365/);
});

test("a template uses only the allowed {{variables}}", () => {
  const allowed = new Set(["tenant_names", "rent_amount"]);
  assert.equal(placeholderProblem("Rent of {{rent_amount}} paid by {{ tenant_names }}.", allowed), undefined);
  assert.match(placeholderProblem("Pay {{rent}} now", allowed), /\{\{rent\}\} is not a variable/);
  assert.match(placeholderProblem("A stray {{ here", allowed), /stray|not part/);
  assert.match(placeholderProblem("No <b>markup</b>", allowed), /plain text/);
});

test("a sample legal review is recognised", () => {
  assert.equal(isSampleReview(null), true);
  assert.equal(isSampleReview({ reviewer_name: "SAMPLE — not reviewed by a lawyer", organisation: "RightProperty365 sample data" }), true);
  assert.equal(isSampleReview({ reviewer_name: "T. Moyo", organisation: "Moyo & Partners", note: "Reviewed for Zimbabwe." }), false);
});

test("references are cleaned before they are checked", () => {
  assert.equal(cleanReference(" rpa-2026-000123 "), "RPA-2026-000123");
  assert.equal(AGREEMENT_REFERENCE.test("RPA-2026-000123"), true);
  assert.equal(AGREEMENT_REFERENCE.test("RPL-2026-000123"), false);
});

test("the dashboard's lease and signing targets have pages", () => {
  assert.equal(targetHref("leases"), "/agent/leases");
  assert.equal(targetHref("agreements"), "/agent/agreements");
  assert.equal(targetHref("signing_requests"), "/account/signing");
  assert.equal(counterHref({ key: "leases.drafts", target: "leases" }), "/agent/leases?status=DRAFT");
  assert.equal(counterHref({ key: "leases.awaiting_signatures", target: "leases" }), "/agent/leases?status=SENT_FOR_SIGNING");
  assert.equal(counterHref({ key: "agreements.waiting_for_you", target: "signing_requests" }), "/account/signing");
});

test("a stamp field is signer-only, starts 113 points square and is at least 57", () => {
  assert.equal(isSignerOnly("STAMP"), true);
  assert.equal(isSignerOnly("TEXT"), false);
  assert.equal(fieldMin("STAMP"), 57);
  assert.equal(fieldMin("TEXT"), 6);
  assert.deepEqual(clampBox({ x: 0, y: 0, w: 20, h: 20 }, { width: 600, height: 800 }, fieldMin("STAMP")), { x: 0, y: 0, w: 57, h: 57 });
});

test("stamp text follows the limits of the API", () => {
  const ok = { top_text: "ACME PROPERTIES", centre_lines: ["HARARE"], bottom_text: "" };
  assert.equal(Object.values(stampProblems(ok)).some(Boolean), false);
  assert.ok(stampProblems({ ...ok, top_text: "  " }).top_text);
  assert.ok(stampProblems({ ...ok, top_text: "x".repeat(61) }).top_text);
  assert.ok(stampProblems({ ...ok, centre_lines: ["a", "b", "c", "d"] }).centre_lines);
  assert.ok(stampProblems({ ...ok, centre_lines: ["x".repeat(31)] })["centre_lines[0]"]);
  assert.ok(stampProblems({ ...ok, bottom_text: "x".repeat(61) }).bottom_text);
  assert.deepEqual(cleanStamp({ top_text: " A ", centre_lines: [" B ", "  "], bottom_text: " C " }), { top_text: "A", centre_lines: ["B"], bottom_text: "C" });
  assert.deepEqual(stampFieldErrors({ "stamp.top_text": "too long", "centre_lines[1]": "too long", code: "x" }), { top_text: "too long", "centre_lines[1]": "too long" });
});

test("an organisation's approved template reads Published", () => {
  assert.equal(statusOf(ORG_TEMPLATE_STATUS, "APPROVED").label, "Published");
});
