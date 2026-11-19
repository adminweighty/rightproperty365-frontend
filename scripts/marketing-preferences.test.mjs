// Checks the marketing preference rules (API 0.37.1): the tolerant reader,
// the "Last changed" sentence, the source and context words, the short
// history, the PUT body and the stale-wording check. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSwitchOn,
  contextLabel,
  formatChangedAt,
  HISTORY_LIMIT,
  historyLines,
  isStaleWording,
  lastChangedText,
  marketingPutBody,
  readConsentText,
  readMarketingPreferences,
  sourceLabel,
} from "../src/lib/marketing-preferences.ts";

const wording = { version: "marketing-2026-01", text: "Wording from the API.", status: "DRAFT" };

const answer = {
  marketing_opt_in: false,
  changed_at: "2026-11-19T06:10:00Z",
  source: "app",
  context: "PREFERENCES",
  consent_text_version: null,
  current_consent_text_version: "marketing-2026-01",
  consent_text: wording,
  history: [
    { marketing_opt_in: false, changed_at: "2026-11-19T06:10:00Z", source: "app", context: "PREFERENCES", consent_text_version: null },
    { marketing_opt_in: true, changed_at: "2026-10-01T09:00:00Z", source: "web", context: "REGISTRATION", consent_text_version: "marketing-2026-01" },
  ],
};

test("readMarketingPreferences reads the contract's answer", () => {
  const prefs = readMarketingPreferences(answer);
  assert.equal(prefs.marketing_opt_in, false);
  assert.equal(prefs.source, "app");
  assert.deepEqual(prefs.consent_text, wording);
  assert.equal(prefs.history.length, 2);
  assert.equal(prefs.history[1].consent_text_version, "marketing-2026-01");
});

test("readMarketingPreferences: an account that never chose", () => {
  const prefs = readMarketingPreferences({
    marketing_opt_in: false,
    changed_at: null,
    source: null,
    context: null,
    consent_text_version: null,
    current_consent_text_version: "marketing-2026-01",
    consent_text: wording,
    history: [],
  });
  assert.equal(prefs.changed_at, null);
  assert.deepEqual(prefs.history, []);
});

test("readMarketingPreferences is tolerant, but needs a boolean choice", () => {
  assert.equal(readMarketingPreferences(null), null);
  assert.equal(readMarketingPreferences({}), null);
  assert.equal(readMarketingPreferences({ marketing_opt_in: "true" }), null);
  const sparse = readMarketingPreferences({ marketing_opt_in: true, history: [{ changed_at: "x" }, null, "x"], consent_text: { version: "v" } });
  assert.equal(sparse.marketing_opt_in, true);
  assert.deepEqual(sparse.history, []);
  assert.equal(sparse.consent_text, null);
  assert.equal(sparse.changed_at, null);
});

test("readConsentText needs a version and a text", () => {
  assert.deepEqual(readConsentText(wording), wording);
  assert.deepEqual(readConsentText({ version: "v", text: "t" }), { version: "v", text: "t", status: "" });
  assert.equal(readConsentText({ version: "v", text: " " }), null);
  assert.equal(readConsentText({ text: "t" }), null);
  assert.equal(readConsentText("t"), null);
});

test("sourceLabel and contextLabel are plain words", () => {
  assert.equal(sourceLabel("web"), "the website");
  assert.equal(sourceLabel("app"), "the mobile app");
  assert.equal(sourceLabel("api"), "RightProperty365's own systems");
  assert.equal(sourceLabel("fax"), null);
  assert.equal(sourceLabel(null), null);
  assert.equal(contextLabel("REGISTRATION"), "when you registered");
  assert.equal(contextLabel("PREFERENCES"), "in your preferences");
  assert.equal(contextLabel("MIGRATION"), "carried over from your earlier choice");
  assert.equal(contextLabel("ADMIN"), "corrected by our support team");
  assert.equal(contextLabel("UNSUBSCRIBE"), "with an unsubscribe link");
  assert.equal(contextLabel("OTHER"), null);
});

test("formatChangedAt", () => {
  assert.equal(formatChangedAt("2026-11-19T06:10:00Z", "UTC"), "19 Nov 2026, 06:10");
  assert.equal(formatChangedAt("not a date", "UTC"), "not a date");
});

test("lastChangedText", () => {
  assert.equal(lastChangedText(answer, "UTC"), "Last changed 19 Nov 2026, 06:10 from the mobile app.");
  assert.equal(lastChangedText({ ...answer, source: "web" }, "UTC"), "Last changed 19 Nov 2026, 06:10 from the website.");
  assert.equal(lastChangedText({ ...answer, source: "other" }, "UTC"), "Last changed 19 Nov 2026, 06:10.");
  assert.equal(
    lastChangedText({ changed_at: "2026-01-02T03:04:00Z", source: "api", context: "MIGRATION" }, "UTC"),
    "Last changed 2 Jan 2026, 03:04, carried over from your earlier choice.",
  );
  assert.equal(lastChangedText({ changed_at: null, source: null, context: null }), "You have not made a choice yet, so marketing is off.");
});

test("historyLines: newest first, in words", () => {
  const lines = historyLines(readMarketingPreferences(answer).history, HISTORY_LIMIT, "UTC");
  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map(({ title, when, dateTime, detail }) => ({ title, when, dateTime, detail })),
    [
      { title: "Switched off", when: "19 Nov 2026, 06:10", dateTime: "2026-11-19T06:10:00Z", detail: "From the mobile app, in your preferences" },
      { title: "Switched on", when: "1 Oct 2026, 09:00", dateTime: "2026-10-01T09:00:00Z", detail: "From the website, when you registered" },
    ],
  );
  assert.notEqual(lines[0].key, lines[1].key);
});

test("historyLines: migration names no source; unknown words are left out; the limit applies", () => {
  const record = (opt, context, source) => ({ marketing_opt_in: opt, changed_at: "2026-01-01T00:00:00Z", source, context, consent_text_version: null });
  assert.equal(historyLines([record(true, "MIGRATION", "api")], 5, "UTC")[0].detail, "Carried over from your earlier choice");
  assert.equal(historyLines([record(true, null, null)], 5, "UTC")[0].detail, null);
  assert.equal(historyLines([record(true, "X", "api")], 5, "UTC")[0].detail, "From RightProperty365's own systems");
  const many = Array.from({ length: 20 }, (_, i) => record(i % 2 === 0, "PREFERENCES", "web"));
  assert.equal(historyLines(many).length, HISTORY_LIMIT);
  assert.equal(historyLines(many, 3).length, 3);
  assert.equal(historyLines(many, -1).length, 0);
  assert.deepEqual(historyLines([]), []);
});

test("marketingPutBody sends the wording's version only when opting in", () => {
  assert.deepEqual(marketingPutBody(true, "marketing-2026-01"), { marketing_opt_in: true, consent_text_version: "marketing-2026-01" });
  assert.deepEqual(marketingPutBody(false, "marketing-2026-01"), { marketing_opt_in: false });
  assert.deepEqual(marketingPutBody(false, null), { marketing_opt_in: false });
  // Without a version the API uses the current one; an empty one is never sent.
  assert.deepEqual(marketingPutBody(true, null), { marketing_opt_in: true });
  assert.deepEqual(marketingPutBody(true, "  "), { marketing_opt_in: true });
  assert.equal("consent_text_version" in marketingPutBody(false, "v"), false);
});

test("canSwitchOn needs wording to agree to", () => {
  assert.equal(canSwitchOn({ consent_text: wording }), true);
  assert.equal(canSwitchOn({ consent_text: null }), false);
});

test("isStaleWording: a 400 on consent_text_version only", () => {
  const message = "The consent wording has changed; show the current wording and try again.";
  assert.equal(isStaleWording({ status: 400, fields: { consent_text_version: message } }), true);
  assert.equal(isStaleWording({ status: 400, fields: { marketing_opt_in: "required" } }), false);
  assert.equal(isStaleWording({ status: 400 }), false);
  assert.equal(isStaleWording({ status: 429, fields: { consent_text_version: message } }), false);
  assert.equal(isStaleWording(null), false);
});
