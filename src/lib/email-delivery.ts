/**
 * Email bounces and complaints (API 0.59.0, FR-065): the administrators'
 * figures, spikes, problems and suppressions. Pure helpers here, so
 * `npm test` checks them (scripts/email-delivery.test.mjs); the calls are in
 * `src/lib/api/email-delivery.ts`.
 */

export type EmailCounts = {
  accepted: number;
  delivered: number;
  delayed: number;
  bounced: number;
  complained: number;
  suppressed: number;
  failed: number;
  /** "0.0123", or null with nothing accepted. */
  bounce_rate: string | null;
  complaint_rate: string | null;
};

export type EmailAlert = {
  id: string;
  kind: "BOUNCE_SPIKE" | "COMPLAINT_SPIKE";
  window_start: string;
  window_end: string;
  events: number;
  accepted: number;
  created_at: string;
};

export type EmailProblem = {
  kind: string;
  status: string;
  delivery_state: "DELIVERED" | "DELAYED" | "BOUNCED" | "COMPLAINED" | null;
  bounce_type: string | null;
  reason: string | null;
  /** The first 12 characters of the address's SHA-256. */
  recipient: string;
  created_at: string;
  updated_at: string;
};

export type EmailDeliveryOverview = {
  webhook_configured: boolean;
  last_24h: EmailCounts;
  last_7d: EmailCounts;
  alerts: EmailAlert[];
  problems: EmailProblem[];
};

export type EmailSuppression = { hash: string; reason: "HARD_BOUNCE" | "COMPLAINT"; created_at: string; updated_at: string };

/** "1.2%" for "0.0123"; "–" for none. */
export function formatEmailRate(rate: string | null | undefined): string {
  if (rate === null || rate === undefined) return "–";
  const value = Number(rate);
  if (!Number.isFinite(value)) return "–";
  const percent = value * 100;
  return `${percent >= 10 || percent === 0 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

/** What happened to a problem message, in plain words. */
export function problemLabel(p: Pick<EmailProblem, "status" | "delivery_state" | "bounce_type" | "reason">): string {
  if (p.delivery_state === "COMPLAINED") return "Marked as spam";
  if (p.delivery_state === "BOUNCED") return p.bounce_type && /^(permanent|hard)$/i.test(p.bounce_type) ? "Bounced (permanent)" : "Bounced (temporary)";
  if (p.reason === "suppressed") return "Not sent: address suppressed";
  return "Refused by the provider";
}

export const alertLabel = (kind: EmailAlert["kind"]) => (kind === "COMPLAINT_SPIKE" ? "Spam complaints spike" : "Bounce spike");

export const suppressionReasonLabel = (reason: EmailSuppression["reason"]) =>
  reason === "COMPLAINT" ? "Marked our email as spam" : "Address bounced permanently";

/** Template names as people read them: "saved-search-alert" -> "Saved search alert". */
export function emailKindLabel(kind: string): string {
  const words = kind.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : kind;
}

/** A reason to clear a suppression: 5 to 500 characters. */
export function clearReasonProblem(reason: string): string | undefined {
  const n = [...reason.trim()].length;
  if (n < 5) return "Say why, in at least 5 characters.";
  if (n > 500) return "Keep it to 500 characters.";
  return undefined;
}
