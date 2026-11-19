// Checks the malware scanning rules (API 0.41.0): the words for a document's
// scan status and the scanning errors, when a page polls, and the numbers of
// the administrators' "Upload scanning" page. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCount,
  formatScanBytes,
  isFileOpenable,
  isScanErrorCode,
  pendingAge,
  PENDING_ALERT_MINUTES,
  processCountLabel,
  readFileScanReport,
  readScanStatus,
  SCAN_MESSAGES,
  SCAN_POLL_INTERVAL_MS,
  SCAN_POLL_LIMIT_MS,
  scanErrorMessage,
  scanKindLabel,
  scannerIsOff,
  scannerName,
  scanNotice,
  shouldPollScans,
} from "../src/lib/file-scan.ts";

test("readScanStatus keeps the four statuses and drops anything else", () => {
  for (const status of ["PENDING", "CLEAN", "INFECTED", "LEGACY_UNSCANNED"]) assert.equal(readScanStatus(status), status);
  assert.equal(readScanStatus(undefined), null);
  assert.equal(readScanStatus(null), null);
  assert.equal(readScanStatus("pending"), null);
  assert.equal(readScanStatus(3), null);
});

test("a file without a status (scanning off) behaves as before", () => {
  assert.equal(isFileOpenable(undefined), true);
  assert.equal(isFileOpenable(null), true);
  assert.equal(scanNotice(undefined), null);
  assert.equal(scanNotice(null, true), null);
});

test("only PENDING and INFECTED block opening and show a notice", () => {
  assert.equal(isFileOpenable("CLEAN"), true);
  assert.equal(isFileOpenable("LEGACY_UNSCANNED"), true);
  assert.equal(isFileOpenable("PENDING"), false);
  assert.equal(isFileOpenable("INFECTED"), false);
  assert.equal(scanNotice("CLEAN"), null);
  assert.equal(scanNotice("LEGACY_UNSCANNED"), null);

  const pending = scanNotice("PENDING");
  assert.equal(pending.kind, "pending");
  assert.equal(pending.label, "Being checked for viruses");
  assert.match(pending.text, /updates by itself/);

  const infected = scanNotice("INFECTED", true);
  assert.equal(infected.kind, "infected");
  assert.equal(infected.label, "Removed: this file looked unsafe");
  assert.match(infected.text, /upload a clean copy/);
  // Someone who cannot upload here is not told to.
  assert.doesNotMatch(scanNotice("INFECTED", false).text, /Please upload/);
});

test("scanErrorMessage puts the scanning errors in plain words", () => {
  assert.equal(scanErrorMessage({ code: "FILE_INFECTED", status: 422 }), "This file looks unsafe and was not uploaded.");
  assert.equal(scanErrorMessage({ code: "SCANNER_UNAVAILABLE", status: 503 }), "We could not check this file just now; try again in a minute.");
  assert.equal(scanErrorMessage({ code: "FILE_TOO_LARGE_TO_SCAN", status: 413 }), "This file is too large to check.");
  // On a download or a send, FILE_INFECTED means the stored file was removed.
  assert.equal(scanErrorMessage({ code: "FILE_INFECTED", status: 409 }), SCAN_MESSAGES.removed);
  assert.equal(scanErrorMessage({ code: "FILE_SCAN_PENDING", status: 409 }), SCAN_MESSAGES.pending);
  // Anything else keeps its own message.
  assert.equal(scanErrorMessage({ code: "FILE_TOO_LARGE", status: 413 }), null);
  assert.equal(scanErrorMessage({ code: "HTTP_503", status: 503 }), null);
  assert.equal(isScanErrorCode("FILE_SCAN_PENDING"), true);
  assert.equal(isScanErrorCode("FILE_TOO_LARGE"), false);
});

test("shouldPollScans polls while anything is pending, and stops after the limit", () => {
  assert.ok(SCAN_POLL_INTERVAL_MS >= 10_000 && SCAN_POLL_INTERVAL_MS <= 15_000);
  assert.equal(shouldPollScans([]), false);
  assert.equal(shouldPollScans([undefined, null, "CLEAN", "LEGACY_UNSCANNED", "INFECTED"]), false);
  assert.equal(shouldPollScans(["CLEAN", "PENDING"]), true);
  assert.equal(shouldPollScans(new Set(["PENDING"]), SCAN_POLL_LIMIT_MS - 1), true);
  assert.equal(shouldPollScans(["PENDING"], SCAN_POLL_LIMIT_MS), false);
});

test("scanKindLabel names each kind", () => {
  assert.equal(scanKindLabel("APPLICATION_FILE"), "Application file");
  assert.equal(scanKindLabel("AGREEMENT_DOCUMENT"), "Agreement PDF");
  assert.equal(scanKindLabel("SOMETHING_NEW"), "Something new");
  assert.equal(scanKindLabel(""), "File");
});

test("readFileScanReport reads the contract's example", () => {
  const report = readFileScanReport({
    scanner: "clamav",
    counts: { PENDING: 1, CLEAN: 120, INFECTED: 1, LEGACY_UNSCANNED: 340 },
    oldest_pending_at: "2026-11-19T10:00:00Z",
    pending: [
      { id: "a", kind: "APPLICATION_FILE", status: "PENDING", signature: null, size_bytes: 182344, attempts: 2, last_error: "scanner unavailable", next_attempt_at: "2026-11-19T10:01:00Z", uploaded_at: "2026-11-19T10:00:00Z", scanned_at: null },
    ],
    infected: [
      { id: "b", kind: "LEDGER_ATTACHMENT", status: "INFECTED", signature: "Eicar-Test-Signature", size_bytes: 68, attempts: 1, last_error: null, next_attempt_at: null, uploaded_at: "2026-11-19T09:58:00Z", scanned_at: "2026-11-19T09:58:03Z" },
      { kind: "no id, dropped" },
    ],
    process_counts: { "async.ERROR": 0, "sync.CLEAN": 40, "sync.ERROR": 2, "worker.EXTRA": 1 },
  });
  assert.equal(report.scanner, "clamav");
  assert.equal(scannerIsOff(report), false);
  assert.deepEqual(report.counts, { PENDING: 1, CLEAN: 120, INFECTED: 1, LEGACY_UNSCANNED: 340 });
  assert.equal(report.pending.length, 1);
  assert.equal(report.pending[0].attempts, 2);
  assert.equal(report.pending[0].lastError, "scanner unavailable");
  assert.equal(report.pending[0].uploadedBy, null);
  assert.equal(report.infected.length, 1);
  assert.equal(report.infected[0].signature, "Eicar-Test-Signature");
  assert.equal(report.infected[0].sizeBytes, 68);
  // Known counters first, in a fixed order, then the rest by name.
  assert.deepEqual(report.processCounts.map((row) => row.key), ["sync.CLEAN", "sync.ERROR", "async.ERROR", "worker.EXTRA"]);
  assert.equal(report.processCounts[0].label, "Images checked on upload: clean");
  assert.equal(report.processCounts[0].count, 40);
});

test("readFileScanReport treats an empty or odd answer as scanning off", () => {
  const empty = readFileScanReport(null);
  assert.equal(empty.scanner, "none");
  assert.equal(scannerIsOff(empty), true);
  assert.deepEqual(empty.counts, { PENDING: 0, CLEAN: 0, INFECTED: 0, LEGACY_UNSCANNED: 0 });
  assert.deepEqual(empty.pending, []);
  assert.deepEqual(empty.processCounts, []);
  assert.equal(scannerIsOff(readFileScanReport({ scanner: "NONE" })), true);
  assert.equal(readFileScanReport({ counts: { PENDING: -3, CLEAN: "7" } }).counts.PENDING, 0);
  assert.equal(scannerName("clamav"), "ClamAV");
  assert.equal(scannerName("other"), "other");
});

test("processCountLabel words each counter", () => {
  assert.equal(processCountLabel("sync.INFECTED"), "Images checked on upload: unsafe, refused");
  assert.equal(processCountLabel("sync.ERROR"), "Images checked on upload: could not be checked");
  assert.equal(processCountLabel("async.CLEAN"), "Documents checked by this process: clean");
});

test("formatCount and formatScanBytes", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1204), "1,204");
  assert.equal(formatScanBytes(null), "Unknown size");
  assert.equal(formatScanBytes(1), "1 byte");
  assert.equal(formatScanBytes(68), "68 bytes");
  assert.equal(formatScanBytes(182344), "178 KB");
  assert.equal(formatScanBytes(4.2 * 1024 * 1024), "4.2 MB");
  assert.equal(formatScanBytes(20 * 1024 * 1024), "20 MB");
});

test("pendingAge says how long the oldest file has waited, and warns when it grows", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(pendingAge(null, now), null);
  assert.equal(pendingAge("not a time", now), null);
  assert.deepEqual(pendingAge("2026-11-19T11:59:30Z", now), { text: "under a minute", minutes: 0, alert: false });
  assert.equal(pendingAge("2026-11-19T11:59:00Z", now).text, "1 minute");
  assert.equal(pendingAge("2026-11-19T11:48:00Z", now).text, "12 minutes");
  assert.equal(pendingAge("2026-11-19T11:48:00Z", now).alert, false);
  const atLimit = new Date(now - PENDING_ALERT_MINUTES * 60_000).toISOString();
  assert.equal(pendingAge(atLimit, now).alert, true);
  assert.equal(pendingAge("2026-11-19T10:00:00Z", now).text, "2 hours");
  assert.equal(pendingAge("2026-11-19T09:55:00Z", now).text, "2 hours 5 minutes");
  assert.equal(pendingAge("2026-11-16T08:00:00Z", now).text, "3 days 4 hours");
  assert.equal(pendingAge("2026-11-18T12:00:00Z", now).text, "1 day");
  // A clock a little ahead of the server's never reads as negative.
  assert.equal(pendingAge("2026-11-19T12:05:00Z", now).minutes, 0);
});
