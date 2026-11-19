// Checks the per-market legal versions' own rules (src/lib/legal-versions.ts):
// the status labels, the market scope, the draft checks, the UTC times, the
// plain-text body and the re-acceptance banner. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyParagraphs,
  canEditVersion,
  canRetireVersion,
  fromUtcInput,
  LEGAL_UPDATES_PATH,
  legalFilterQuery,
  legalMarketScope,
  pendingDocumentPath,
  reacceptanceHeadline,
  showReacceptanceBanner,
  toUtcInput,
  validateLegalDraft,
  versionStatusLabel,
} from "../src/lib/legal-versions.ts";

const NOW = Date.parse("2026-11-19T12:00:00Z");

test("versionStatusLabel names each status, and a published version still ahead is Scheduled", () => {
  assert.equal(versionStatusLabel({ status: "DRAFT", effective_from: "2026-01-01T00:00:00Z" }, NOW).label, "Draft");
  assert.equal(versionStatusLabel({ status: "DRAFT", effective_from: "2026-01-01T00:00:00Z" }, NOW).tone, "warning");
  assert.equal(versionStatusLabel({ status: "PUBLISHED", effective_from: "2026-11-14T00:00:00Z" }, NOW).label, "Published");
  assert.equal(versionStatusLabel({ status: "PUBLISHED", effective_from: "2026-11-14T00:00:00Z" }, NOW).tone, "success");
  assert.equal(versionStatusLabel({ status: "PUBLISHED", effective_from: "2027-01-01T00:00:00Z" }, NOW).label, "Scheduled");
  assert.equal(versionStatusLabel({ status: "PUBLISHED", effective_from: "2026-11-19T12:00:00Z" }, NOW).label, "Published");
  assert.equal(versionStatusLabel({ status: "RETIRED", effective_from: "2026-01-01T00:00:00Z" }, NOW).label, "Retired");
  assert.equal(versionStatusLabel({ status: "ARCHIVED", effective_from: "" }, NOW).label, "ARCHIVED");
  assert.match(versionStatusLabel({ status: "PUBLISHED", effective_from: "2026-01-01T00:00:00Z" }, NOW).hint, /can no longer be changed/);
});

test("only a draft is edited, only a published version is retired", () => {
  assert.equal(canEditVersion("DRAFT"), true);
  assert.equal(canEditVersion("PUBLISHED"), false);
  assert.equal(canEditVersion("RETIRED"), false);
  assert.equal(canRetireVersion("PUBLISHED"), true);
  assert.equal(canRetireVersion("DRAFT"), false);
  assert.equal(canRetireVersion("RETIRED"), false);
});

test("legalMarketScope: every market for super and content administrators, own countries (never GLOBAL) for a market administrator", () => {
  assert.equal(legalMarketScope([{ role: "SUPER_ADMIN", market_code: null }]), null);
  assert.equal(legalMarketScope([{ role: "CONTENT_ADMIN", market_code: null }, { role: "MARKET_ADMIN", market_code: "ZW" }]), null);
  assert.deepEqual(
    legalMarketScope([
      { role: "MARKET_ADMIN", market_code: "zw" },
      { role: "MARKET_ADMIN", market_code: "GB" },
      { role: "MARKET_ADMIN", market_code: "ZW" },
      { role: "MARKET_ADMIN", market_code: "GLOBAL" },
      { role: "MARKET_ADMIN", market_code: null },
    ]),
    ["GB", "ZW"],
  );
  assert.deepEqual(legalMarketScope([{ role: "SUPPORT", market_code: null }]), []);
});

test("legalFilterQuery leaves out empty filters and upper-cases codes", () => {
  assert.equal(legalFilterQuery({}), "");
  assert.equal(legalFilterQuery({ kind: "", market: "", status: "" }), "");
  assert.equal(legalFilterQuery({ kind: "terms", market: "zw", status: "draft" }), "?kind=TERMS&market=ZW&status=DRAFT");
  assert.equal(legalFilterQuery({ market: "GLOBAL" }), "?market=GLOBAL");
});

test("UTC times round-trip through a datetime-local field and reject impossible ones", () => {
  assert.equal(toUtcInput("2027-01-01T00:00:00Z"), "2027-01-01T00:00");
  assert.equal(toUtcInput("2027-01-01T02:30:00+02:00"), "2027-01-01T00:30");
  assert.equal(toUtcInput(null), "");
  assert.equal(toUtcInput("nonsense"), "");
  assert.equal(fromUtcInput("2027-01-01T00:00"), "2027-01-01T00:00:00Z");
  assert.equal(fromUtcInput("2027-01-01T09:15:30"), "2027-01-01T09:15:30Z");
  assert.equal(fromUtcInput("2027-02-30T00:00"), null);
  assert.equal(fromUtcInput("2027-01-01T25:00"), null);
  assert.equal(fromUtcInput("2027-01-01"), null);
  assert.equal(fromUtcInput(""), null);
});

const good = {
  kind: "TERMS",
  market: "zw",
  version: " 2027-01-01 ",
  effectiveFrom: "2027-01-01T00:00",
  body: "# Terms\n\nText.\n",
  summary: " Clearer refunds. ",
  requiresReacceptance: true,
  draftNotice: true,
};

test("validateLegalDraft builds the API body from a good draft", () => {
  const { input, errors } = validateLegalDraft(good);
  assert.deepEqual(errors, {});
  assert.deepEqual(input, {
    kind: "TERMS",
    market_code: "ZW",
    lang: "en",
    version: "2027-01-01",
    effective_from: "2027-01-01T00:00:00Z",
    body_markdown: "# Terms\n\nText.",
    summary_of_changes: "Clearer refunds.",
    requires_reacceptance: true,
    draft_notice: true,
  });
  assert.deepEqual(validateLegalDraft({ ...good, market: "GLOBAL" }).errors, {});
});

test("validateLegalDraft refuses what the API refuses", () => {
  const errors = (change) => validateLegalDraft({ ...good, ...change }).errors;
  assert.ok(errors({ kind: "COOKIE" }).kind);
  assert.ok(errors({ market: "ZWE" }).market_code);
  assert.ok(errors({ market: "" }).market_code);
  assert.ok(errors({ version: "" }).version);
  assert.ok(errors({ version: "x".repeat(33) }).version);
  assert.equal(errors({ version: "x".repeat(32) }).version, undefined);
  assert.ok(errors({ version: "versión" }).version);
  assert.ok(errors({ effectiveFrom: "" }).effective_from);
  assert.ok(errors({ effectiveFrom: "2027-13-01T00:00" }).effective_from);
  assert.ok(errors({ body: "   " }).body_markdown);
  assert.ok(errors({ body: "x".repeat(200_001) }).body_markdown);
  assert.match(errors({ body: "Hello <script>alert(1)</script>" }).body_markdown, /HTML/);
  assert.match(errors({ body: "A <b>bold</b> word" }).body_markdown, /HTML/);
  assert.equal(errors({ body: "Prices < 10 and 5 > 3 are fine" }).body_markdown, undefined);
  assert.ok(errors({ summary: "x".repeat(2001) }).summary_of_changes);
});

test("bodyParagraphs splits on blank lines, keeps line breaks and never interprets markup", () => {
  assert.deepEqual(bodyParagraphs("# Title\n\nFirst line\nsecond line\n\n\n  \nLast"), ["# Title", "First line\nsecond line", "Last"]);
  assert.deepEqual(bodyParagraphs("a\r\n\r\nb"), ["a", "b"]);
  assert.deepEqual(bodyParagraphs("  \n\n"), []);
  assert.deepEqual(bodyParagraphs("<img src=x onerror=alert(1)>"), ["<img src=x onerror=alert(1)>"]);
});

const pending = [{ kind: "TERMS", title: "Terms and Conditions", version: "2027-01-01", market_code: "GLOBAL", effective_from: "2027-01-01T00:00:00Z", summary_of_changes: null }];

test("showReacceptanceBanner: only signed in, only with something pending, never on the review page", () => {
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending, pathname: "/dashboard" }), true);
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending: [], pathname: "/dashboard" }), false);
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending: undefined, pathname: "/" }), false);
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending: null, pathname: "/" }), false);
  assert.equal(showReacceptanceBanner({ status: "anonymous", pending, pathname: "/" }), false);
  assert.equal(showReacceptanceBanner({ status: "loading", pending, pathname: "/" }), false);
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending, pathname: LEGAL_UPDATES_PATH }), false);
  assert.equal(showReacceptanceBanner({ status: "authenticated", pending, pathname: null }), true);
});

test("reacceptanceHeadline names one document, or says terms and policies for several", () => {
  assert.equal(reacceptanceHeadline(pending), "We've updated our Terms and Conditions");
  assert.equal(reacceptanceHeadline([{ kind: "PRIVACY", title: "" }]), "We've updated our Privacy Policy");
  assert.equal(reacceptanceHeadline([...pending, { kind: "PRIVACY", title: "Privacy Policy" }]), "We've updated our terms and policies");
});

test("pendingDocumentPath asks for the exact published version of that market", () => {
  assert.equal(pendingDocumentPath(pending[0]), "/v1/legal/terms?market=GLOBAL&lang=en&version=2027-01-01");
  assert.equal(
    pendingDocumentPath({ kind: "AGENT_TERMS", version: "v 2", market_code: "" }),
    "/v1/legal/agent_terms?market=GLOBAL&lang=en&version=v+2",
  );
});
