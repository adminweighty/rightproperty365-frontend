/**
 * The rules behind the Marketing section of the communication preferences
 * (API 0.37.1, BR-017, FR-003): a tolerant reader for the API's answer, the
 * "Last changed" sentence, the words for where and how a choice was made,
 * the short history, the PUT body and the stale-wording check. Pure
 * functions with no imports, so `npm test` can run them directly.
 *
 * The opt-in wording itself is never written here: it is always the API's
 * `consent_text.text`.
 */

export type ConsentText = { version: string; text: string; status: string };

export type MarketingConsentRecord = {
  marketing_opt_in: boolean;
  changed_at: string;
  source: string | null;
  context: string | null;
  consent_text_version: string | null;
};

export type MarketingPreferences = {
  marketing_opt_in: boolean;
  /** These four are null when the account never chose (the value is the default, off). */
  changed_at: string | null;
  source: string | null;
  context: string | null;
  consent_text_version: string | null;
  current_consent_text_version: string | null;
  /** The wording to show now; null when the API sent none usable (then marketing can only be switched off). */
  consent_text: ConsentText | null;
  /** Newest first, at most 20. */
  history: MarketingConsentRecord[];
};

/* ------------------------------------------------------- reading answers */

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

/** `{version, text, status}`, from GET/PUT `consent_text` or the public texts route. Null unless version and text are there. */
export function readConsentText(value: unknown): ConsentText | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const version = text(raw.version);
  const wording = text(raw.text);
  if (!version || !wording) return null;
  return { version, text: wording, status: text(raw.status) ?? "" };
}

function readRecord(value: unknown): MarketingConsentRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const changedAt = text(raw.changed_at);
  if (typeof raw.marketing_opt_in !== "boolean" || !changedAt) return null;
  return {
    marketing_opt_in: raw.marketing_opt_in,
    changed_at: changedAt,
    source: text(raw.source),
    context: text(raw.context),
    consent_text_version: text(raw.consent_text_version),
  };
}

/**
 * The answer of GET and PUT `/v1/me/marketing-preferences`. Null when
 * `marketing_opt_in` is missing or not a boolean (the page shows its error
 * state); anything else that is missing or malformed reads as null or empty.
 */
export function readMarketingPreferences(value: unknown): MarketingPreferences | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.marketing_opt_in !== "boolean") return null;
  const history = Array.isArray(raw.history)
    ? raw.history.map(readRecord).filter((item): item is MarketingConsentRecord => item !== null)
    : [];
  return {
    marketing_opt_in: raw.marketing_opt_in,
    changed_at: text(raw.changed_at),
    source: text(raw.source),
    context: text(raw.context),
    consent_text_version: text(raw.consent_text_version),
    current_consent_text_version: text(raw.current_consent_text_version),
    consent_text: readConsentText(raw.consent_text),
    history,
  };
}

/* ------------------------------------------------------------------ words */

/** "15 Nov 2026, 14:05", in the viewer's time zone unless one is given (tests pass "UTC"). */
export function formatChangedAt(iso: string, timeZone?: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(at);
}

/** Where a choice was made, after "from": "the website", "the mobile app". Null for a source we have no words for. */
export function sourceLabel(source: string | null | undefined): string | null {
  switch (source) {
    case "web":
      return "the website";
    case "app":
      return "the mobile app";
    case "api":
      return "RightProperty365's own systems";
    default:
      return null;
  }
}

/** How a choice was made: "when you registered", "in your preferences". Null for a context we have no words for. */
export function contextLabel(context: string | null | undefined): string | null {
  switch (context) {
    case "REGISTRATION":
      return "when you registered";
    case "PREFERENCES":
      return "in your preferences";
    case "MIGRATION":
      return "carried over from your earlier choice";
    case "ADMIN":
      return "corrected by our support team";
    case "UNSUBSCRIBE":
      return "with an unsubscribe link";
    default:
      return null;
  }
}

/**
 * The line under the switch. "Last changed 19 Nov 2026, 06:10 from the
 * mobile app." A choice carried over from before this setting existed says
 * so instead of naming a source. An account that never chose: "You have not
 * made a choice yet, so marketing is off."
 */
export function lastChangedText(
  prefs: Pick<MarketingPreferences, "changed_at" | "source" | "context">,
  timeZone?: string,
): string {
  if (!prefs.changed_at) return "You have not made a choice yet, so marketing is off.";
  const when = formatChangedAt(prefs.changed_at, timeZone);
  if (prefs.context === "MIGRATION") return `Last changed ${when}, carried over from your earlier choice.`;
  const from = sourceLabel(prefs.source);
  return from ? `Last changed ${when} from ${from}.` : `Last changed ${when}.`;
}

export type HistoryLine = { key: string; title: string; when: string; dateTime: string; detail: string | null };

/** How many changes the history disclosure shows. */
export const HISTORY_LIMIT = 5;

/**
 * The last few changes, newest first, in words: "Switched on" or "Switched
 * off", the time, and "from the website, in your preferences".
 */
export function historyLines(history: MarketingConsentRecord[], limit: number = HISTORY_LIMIT, timeZone?: string): HistoryLine[] {
  return history.slice(0, Math.max(0, limit)).map((record, index) => {
    const how = contextLabel(record.context);
    const from = record.context === "MIGRATION" ? null : sourceLabel(record.source);
    const parts = [from && `from ${from}`, how].filter(Boolean) as string[];
    const detail = parts.length > 0 ? parts.join(", ") : null;
    return {
      key: `${record.changed_at}-${index}`,
      title: record.marketing_opt_in ? "Switched on" : "Switched off",
      when: formatChangedAt(record.changed_at, timeZone),
      dateTime: record.changed_at,
      detail: detail && detail.charAt(0).toUpperCase() + detail.slice(1),
    };
  });
}

/* ----------------------------------------------------------------- saving */

export type MarketingPutBody = { marketing_opt_in: boolean; consent_text_version?: string };

/**
 * The PUT body. The wording's version goes only with an opt-in, and is the
 * version of the wording the person was shown; an opt-out sends the value
 * alone.
 */
export function marketingPutBody(optIn: boolean, shownVersion: string | null | undefined): MarketingPutBody {
  if (optIn && typeof shownVersion === "string" && shownVersion.trim() !== "") {
    return { marketing_opt_in: true, consent_text_version: shownVersion };
  }
  return { marketing_opt_in: optIn };
}

/** Switching on needs wording to agree to; switching off never does. */
export function canSwitchOn(prefs: Pick<MarketingPreferences, "consent_text">): boolean {
  return prefs.consent_text !== null;
}

/** A 400 on `consent_text_version`: the wording changed while it was on screen, so it is read again and the person asked again. */
export function isStaleWording(failure: { status: number; fields?: Record<string, string> } | null | undefined): boolean {
  return Boolean(failure && failure.status === 400 && failure.fields && "consent_text_version" in failure.fields);
}
