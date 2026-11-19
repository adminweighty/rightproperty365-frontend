/**
 * Malware scanning of uploads (API 0.41.0, item F), as pure rules: the plain
 * words for a document's `scan_status` and for the scanning errors, when a
 * page should read a list again while a file is being checked, and the
 * numbers of the administrators' "Upload scanning" page.
 *
 * Scanning is off unless the server turns it on. Then no `scan_status` is
 * sent and none of the errors happen, so everything here must leave a file
 * without a status exactly as it was: openable, with nothing extra shown.
 *
 * No runtime imports: `npm test` (scripts/file-scan.test.mjs) loads this file
 * directly.
 */

export const SCAN_STATUSES = ["PENDING", "CLEAN", "INFECTED", "LEGACY_UNSCANNED"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** A known `scan_status`, or null (absent, scanning off, or a value this page does not know). */
export function readScanStatus(value: unknown): ScanStatus | null {
  return typeof value === "string" && (SCAN_STATUSES as readonly string[]).includes(value) ? (value as ScanStatus) : null;
}

/** False only while a file is being checked or after it was removed: the API refuses to serve it then. */
export const isFileOpenable = (status: ScanStatus | null | undefined) => status !== "PENDING" && status !== "INFECTED";

export type ScanNotice = {
  kind: "pending" | "infected";
  /** The badge. */
  label: string;
  /** One or two sentences under it. */
  text: string;
};

/**
 * What to show beside a document, or null for nothing (clean, never scanned,
 * or scanning off). `canReplace`: the viewer can upload another copy here.
 */
export function scanNotice(status: ScanStatus | null | undefined, canReplace = false): ScanNotice | null {
  if (status === "PENDING") {
    return {
      kind: "pending",
      label: "Being checked for viruses",
      text: "It can be opened once the check is done, usually within a minute. This page updates by itself.",
    };
  }
  if (status === "INFECTED") {
    return {
      kind: "infected",
      label: "Removed: this file looked unsafe",
      text: canReplace
        ? "It failed our virus check and was deleted. Please upload a clean copy."
        : "It failed our virus check and was deleted, so it cannot be opened. A clean copy has to be uploaded again.",
    };
  }
  return null;
}

/** The scanning error codes the API sends (API 0.41.0). */
export const SCAN_ERROR_CODES = ["FILE_INFECTED", "SCANNER_UNAVAILABLE", "FILE_TOO_LARGE_TO_SCAN", "FILE_SCAN_PENDING"] as const;

export const isScanErrorCode = (code: string) => (SCAN_ERROR_CODES as readonly string[]).includes(code);

export const SCAN_MESSAGES = {
  uploadInfected: "This file looks unsafe and was not uploaded.",
  scannerUnavailable: "We could not check this file just now; try again in a minute.",
  tooLargeToScan: "This file is too large to check.",
  pending: "This file is still being checked for viruses. Please try again in a minute.",
  removed: "This file looked unsafe and was removed. Please upload a clean copy.",
} as const;

/**
 * The plain words for a scanning error, or null for any other failure.
 * `FILE_INFECTED` means two things: 422 on an image upload (nothing was
 * saved), 409 on a download or an agreement send (the stored file was removed).
 */
export function scanErrorMessage(failure: { code: string; status: number }): string | null {
  switch (failure.code) {
    case "FILE_INFECTED":
      return failure.status === 409 ? SCAN_MESSAGES.removed : SCAN_MESSAGES.uploadInfected;
    case "SCANNER_UNAVAILABLE":
      return SCAN_MESSAGES.scannerUnavailable;
    case "FILE_TOO_LARGE_TO_SCAN":
      return SCAN_MESSAGES.tooLargeToScan;
    case "FILE_SCAN_PENDING":
      return SCAN_MESSAGES.pending;
    default:
      return null;
  }
}

// ---- Polling while a file is being checked ------------------------------------------------------

/** How often a page reads its files again while one is being checked. */
export const SCAN_POLL_INTERVAL_MS = 12_000;
/** After this long the page stops asking (the scanner may be down); a reload starts again. */
export const SCAN_POLL_LIMIT_MS = 10 * 60_000;

/** True while any of the statuses is PENDING and the page has not been asking for too long. */
export function shouldPollScans(statuses: Iterable<ScanStatus | null | undefined>, elapsedMs = 0): boolean {
  if (elapsedMs >= SCAN_POLL_LIMIT_MS) return false;
  for (const status of statuses) if (status === "PENDING") return true;
  return false;
}

// ---- The administrators' page ---------------------------------------------------------------------

export const SCAN_KINDS: Record<string, string> = {
  ONBOARDING_DOCUMENT: "Verification document",
  APPLICATION_FILE: "Application file",
  LEDGER_ATTACHMENT: "Books attachment",
  AGREEMENT_DOCUMENT: "Agreement PDF",
};

/** "Application file"; an unknown kind in sentence case. */
export function scanKindLabel(kind: string): string {
  if (SCAN_KINDS[kind]) return SCAN_KINDS[kind];
  const words = kind.toLowerCase().replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "File";
}

export type FileScanItem = {
  id: string;
  kind: string;
  status: string;
  signature: string | null;
  sizeBytes: number | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  uploadedAt: string | null;
  scannedAt: string | null;
  /** Who uploaded it, when the API says (the 0.41.0 answer does not). */
  uploadedBy: string | null;
};

export type FileScanReport = {
  /** "none" when scanning is off. */
  scanner: string;
  counts: Record<ScanStatus, number>;
  oldestPendingAt: string | null;
  pending: FileScanItem[];
  infected: FileScanItem[];
  /** This API process's image scans since it started, as rows. */
  processCounts: { key: string; label: string; count: number }[];
};

const obj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
const size = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

function personName(value: unknown): string | null {
  const raw = obj(value);
  if (raw) return str(raw.name) ?? str(raw.email);
  return str(value);
}

function readItem(value: unknown): FileScanItem | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    kind: str(raw.kind) ?? "",
    status: str(raw.status) ?? "",
    signature: str(raw.signature),
    sizeBytes: size(raw.size_bytes),
    attempts: count(raw.attempts),
    lastError: str(raw.last_error),
    nextAttemptAt: str(raw.next_attempt_at),
    uploadedAt: str(raw.uploaded_at),
    scannedAt: str(raw.scanned_at),
    uploadedBy: personName(raw.uploaded_by) ?? personName(raw.uploader),
  };
}

const PROCESS_WORDS: Record<string, string> = { CLEAN: "clean", INFECTED: "unsafe, refused", ERROR: "could not be checked" };
const PROCESS_ORDER = ["sync.CLEAN", "sync.INFECTED", "sync.ERROR", "async.CLEAN", "async.INFECTED", "async.ERROR"];

/** "Images checked on upload: clean" for `sync.CLEAN`. */
export function processCountLabel(key: string): string {
  const [mode, outcome] = key.split(".");
  const where = mode === "sync" ? "Images checked on upload" : mode === "async" ? "Documents checked by this process" : mode || "Checks";
  return `${where}: ${PROCESS_WORDS[outcome ?? ""] ?? (outcome ? outcome.toLowerCase() : "other")}`;
}

/** The answer of `GET /v1/admin/file-scans`, read tolerantly. A missing `scanner` reads as off. */
export function readFileScanReport(value: unknown): FileScanReport {
  const raw = obj(value) ?? {};
  const counts = obj(raw.counts) ?? {};
  const processRaw = obj(raw.process_counts) ?? {};
  const keys = [...PROCESS_ORDER.filter((key) => key in processRaw), ...Object.keys(processRaw).filter((key) => !PROCESS_ORDER.includes(key)).sort()];
  const list = (items: unknown) => (Array.isArray(items) ? items.map(readItem).filter((item): item is FileScanItem => item !== null) : []);
  return {
    scanner: str(raw.scanner)?.toLowerCase() ?? "none",
    counts: {
      PENDING: count(counts.PENDING),
      CLEAN: count(counts.CLEAN),
      INFECTED: count(counts.INFECTED),
      LEGACY_UNSCANNED: count(counts.LEGACY_UNSCANNED),
    },
    oldestPendingAt: str(raw.oldest_pending_at),
    pending: list(raw.pending),
    infected: list(raw.infected),
    processCounts: keys.map((key) => ({ key, label: processCountLabel(key), count: count(processRaw[key]) })),
  };
}

/** True when the API process does not scan uploads. */
export const scannerIsOff = (report: Pick<FileScanReport, "scanner">) => report.scanner === "none" || report.scanner === "";

/** "ClamAV" for clamav; other names as sent. */
export const scannerName = (scanner: string) => (scanner === "clamav" ? "ClamAV" : scanner);

/** "1,204". */
export const formatCount = (value: number) => new Intl.NumberFormat("en-GB").format(value);

/** "68 bytes", "178 KB", "4.2 MB"; "Unknown size" without one. */
export function formatScanBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown size";
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** When the oldest pending file is older than this, the page warns that the scanner may be down. */
export const PENDING_ALERT_MINUTES = 15;

const plural = (value: number, word: string) => `${value} ${word}${value === 1 ? "" : "s"}`;

/**
 * How long the oldest pending file has waited: "under a minute", "12 minutes",
 * "2 hours 5 minutes", "3 days 4 hours". Null without a time (nothing pending).
 */
export function pendingAge(oldestIso: string | null, nowMs: number): { text: string; minutes: number; alert: boolean } | null {
  if (!oldestIso) return null;
  const at = Date.parse(oldestIso);
  if (Number.isNaN(at)) return null;
  const minutes = Math.max(0, Math.floor((nowMs - at) / 60_000));
  let text: string;
  if (minutes < 1) text = "under a minute";
  else if (minutes < 60) text = plural(minutes, "minute");
  else if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    text = rest ? `${plural(hours, "hour")} ${plural(rest, "minute")}` : plural(hours, "hour");
  } else {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    text = hours ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  }
  return { text, minutes, alert: minutes >= PENDING_ALERT_MINUTES };
}
