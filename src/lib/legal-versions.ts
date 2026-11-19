/**
 * Per-market legal document versions (BR-001, API 0.43.0): the words, checks
 * and small rules shared by the admin "Legal documents" pages, the
 * re-acceptance banner and its review page. Pure functions with no imports,
 * so `npm test` (scripts/legal-versions.test.mjs) runs them directly.
 *
 * The API's document bodies are DRAFT placeholders awaiting the lawyers. The
 * site's own pages (src/content/legal, src/lib/legal.ts) stay the text people
 * read at /legal until the reviewed text is published through the API.
 */

// ---- Kinds and statuses ---------------------------------------------------------------------

/** Every kind the API accepts. COOKIES and AGENT_TERMS have no version until an administrator publishes one. */
export const LEGAL_KINDS = ["TERMS", "PRIVACY", "REFUND", "EULA", "COOKIES", "AGENT_TERMS"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

/** Used only when the API sends no `title` (it comes from the API's message catalogue). */
export const LEGAL_KIND_LABELS: Record<LegalKind, string> = {
  TERMS: "Terms and Conditions",
  PRIVACY: "Privacy Policy",
  REFUND: "Refund Policy",
  EULA: "End User Licence Agreement",
  COOKIES: "Cookie Policy",
  AGENT_TERMS: "Agent Terms",
};

export const legalKindLabel = (kind: string) => LEGAL_KIND_LABELS[kind as LegalKind] ?? kind;

export const LEGAL_STATUSES = ["DRAFT", "PUBLISHED", "RETIRED"] as const;
export type LegalVersionStatus = (typeof LEGAL_STATUSES)[number];

export type StatusTone = "neutral" | "success" | "warning" | "info";

export type VersionStatusLabel = { label: string; tone: StatusTone; hint: string };

/**
 * What a version's status means, in words. A PUBLISHED version whose
 * `effective_from` is still ahead is "Scheduled": it is not current until then.
 */
export function versionStatusLabel(
  version: { status: string; effective_from: string },
  now: number = Date.now(),
): VersionStatusLabel {
  switch (version.status) {
    case "DRAFT":
      return { label: "Draft", tone: "warning", hint: "Not shown to anyone. It can still be changed or deleted." };
    case "PUBLISHED": {
      const from = Date.parse(version.effective_from);
      if (Number.isFinite(from) && from > now) {
        return { label: "Scheduled", tone: "info", hint: "Published, and takes effect on its effective date. It can no longer be changed." };
      }
      return { label: "Published", tone: "success", hint: "Published. It can no longer be changed: a change is a new version." };
    }
    case "RETIRED":
      return { label: "Retired", tone: "neutral", hint: "No longer current. Kept in the history; it can no longer be changed." };
    default:
      return { label: version.status, tone: "neutral", hint: "" };
  }
}

/** Only a DRAFT may be changed, deleted or published; only a PUBLISHED version may be retired. */
export const canEditVersion = (status: string) => status === "DRAFT";
export const canRetireVersion = (status: string) => status === "PUBLISHED";

// ---- Markets an administrator may work on ---------------------------------------------------

/**
 * The markets an administrator may create or change versions for: null means
 * every market and GLOBAL (SUPER_ADMIN, CONTENT_ADMIN). A MARKET_ADMIN gets
 * its own countries only, never GLOBAL. The API enforces the same rule.
 */
export function legalMarketScope(roles: readonly { role: string; market_code: string | null }[]): string[] | null {
  if (roles.some(({ role }) => role === "SUPER_ADMIN" || role === "CONTENT_ADMIN")) return null;
  const codes = roles
    .filter(({ role, market_code }) => role === "MARKET_ADMIN" && market_code && market_code !== "GLOBAL")
    .map(({ market_code }) => (market_code as string).toUpperCase());
  return [...new Set(codes)].sort();
}

/** "Every country (GLOBAL)" for GLOBAL, else the code. */
export const marketLabel = (code: string | null | undefined, names: Record<string, string> = {}) =>
  !code || code === "GLOBAL" ? "Every country (GLOBAL)" : names[code] ? `${names[code]} (${code})` : code;

// ---- The list's filters ---------------------------------------------------------------------

export type LegalFilters = { kind?: string; market?: string; status?: string; lang?: string };

/** The query of `GET /v1/admin/legal`, in a fixed order, leaving out empty filters. "" when there are none. */
export function legalFilterQuery(filters: LegalFilters): string {
  const query = new URLSearchParams();
  if (filters.kind) query.set("kind", filters.kind.toUpperCase());
  if (filters.market) query.set("market", filters.market.toUpperCase());
  if (filters.lang) query.set("lang", filters.lang);
  if (filters.status) query.set("status", filters.status.toUpperCase());
  const text = query.toString();
  return text ? `?${text}` : "";
}

// ---- Times (UTC) ----------------------------------------------------------------------------

/** "2027-01-01T00:00" for a `datetime-local` field showing UTC, from an RFC 3339 time. "" when unreadable. */
export function toUtcInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toISOString().slice(0, 16);
}

/** "2027-01-01T00:00:00Z" from a `datetime-local` value read as UTC. Null when it is not a time. */
export function fromUtcInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}Z`;
  const at = new Date(iso);
  // Rejects 2027-02-30 and 25:00, which Date would roll over.
  return Number.isNaN(at.getTime()) || at.toISOString().slice(0, 19) !== iso.slice(0, 19) ? null : iso;
}

/** "1 January 2027, 00:00 UTC". */
export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(at)} UTC`;
}

// ---- The draft form -------------------------------------------------------------------------

export const VERSION_MAX = 32;
export const BODY_MAX = 200_000;
export const SUMMARY_MAX = 2000;

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
/** An HTML tag or comment: the API refuses raw HTML in a body. */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>|<!--/;

export type LegalDraft = {
  kind: string;
  market: string;
  version: string;
  /** A `datetime-local` value read as UTC. */
  effectiveFrom: string;
  body: string;
  summary: string;
  requiresReacceptance: boolean;
  draftNotice: boolean;
};

export type LegalVersionInput = {
  kind: string;
  market_code: string;
  lang: "en";
  version: string;
  effective_from: string;
  body_markdown: string;
  summary_of_changes: string;
  requires_reacceptance: boolean;
  draft_notice: boolean;
};

export type LegalDraftErrors = Partial<Record<"kind" | "market_code" | "version" | "effective_from" | "body_markdown" | "summary_of_changes", string>>;

/** The body for `POST`/`PATCH /v1/admin/legal`, or the problems to fix first (keyed as the API's `fields`). */
export function validateLegalDraft(draft: LegalDraft): { input: LegalVersionInput; errors: LegalDraftErrors } {
  const errors: LegalDraftErrors = {};
  if (!LEGAL_KINDS.includes(draft.kind as LegalKind)) errors.kind = "Choose which document this is.";
  const market = draft.market.trim().toUpperCase();
  if (market !== "GLOBAL" && !/^[A-Z]{2}$/.test(market)) errors.market_code = "Choose GLOBAL or a country.";

  const version = draft.version.trim();
  if (!version) errors.version = "Enter a version, for example the date it takes effect: 2027-01-01.";
  else if (version.length > VERSION_MAX) errors.version = `Use ${VERSION_MAX} characters or fewer.`;
  else if (!PRINTABLE_ASCII.test(version)) errors.version = "Use letters, digits and simple punctuation only.";

  const effective = fromUtcInput(draft.effectiveFrom);
  if (!draft.effectiveFrom.trim()) errors.effective_from = "Enter when this version takes effect.";
  else if (!effective) errors.effective_from = "Enter a date and time.";

  const body = draft.body.trim();
  if (!body) errors.body_markdown = "Enter the text of the document.";
  else if (body.length > BODY_MAX) errors.body_markdown = `Use ${BODY_MAX.toLocaleString("en-GB")} characters or fewer.`;
  else if (HTML_TAG.test(body)) errors.body_markdown = "Remove the HTML tags: use Markdown only.";

  const summary = draft.summary.trim();
  if (summary.length > SUMMARY_MAX) errors.summary_of_changes = `Use ${SUMMARY_MAX} characters or fewer.`;

  return {
    input: {
      kind: draft.kind,
      market_code: market,
      lang: "en",
      version,
      effective_from: effective ?? "",
      body_markdown: body,
      summary_of_changes: summary,
      requires_reacceptance: draft.requiresReacceptance,
      draft_notice: draft.draftNotice,
    },
    errors,
  };
}

// ---- Showing a body -------------------------------------------------------------------------

/**
 * The body as paragraphs of plain text, split on blank lines. The site has no
 * Markdown renderer, so a body is shown as the text it is (React escapes it;
 * line breaks are kept with `white-space: pre-wrap`). Nothing in it is ever
 * read as HTML.
 */
export function bodyParagraphs(markdown: string): string[] {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/^\n+|\s+$/g, ""))
    .filter((paragraph) => paragraph.trim().length > 0);
}

// ---- Re-acceptance --------------------------------------------------------------------------

export type PendingLegalAcceptance = {
  kind: string;
  title: string;
  version: string;
  market_code: string;
  effective_from: string;
  summary_of_changes: string | null;
};

/** Where the banner leads: the published versions waiting, with Accept. */
export const LEGAL_UPDATES_PATH = "/account/legal-updates";

/**
 * Whether the signed-in shell shows "We've updated our …". Only for a
 * signed-in person with something pending, and not on the review page
 * itself. An API before 0.43.0 sends no list: then nothing shows.
 */
export function showReacceptanceBanner(input: {
  status: string;
  pending: readonly unknown[] | null | undefined;
  pathname: string | null;
}): boolean {
  if (input.status !== "authenticated") return false;
  if (!Array.isArray(input.pending) || input.pending.length === 0) return false;
  return !(input.pathname ?? "").startsWith(LEGAL_UPDATES_PATH);
}

/** "We've updated our Terms and Conditions" for one document, "…our terms and policies" for several. */
export function reacceptanceHeadline(pending: readonly { title?: string | null; kind: string }[]): string {
  if (pending.length === 1) return `We've updated our ${pending[0].title || legalKindLabel(pending[0].kind)}`;
  return "We've updated our terms and policies";
}

/** The query of `GET /v1/legal/{kind}` for the exact version waiting to be accepted. */
export function pendingDocumentPath(item: Pick<PendingLegalAcceptance, "kind" | "version" | "market_code">): string {
  const query = new URLSearchParams({ market: item.market_code || "GLOBAL", lang: "en", version: item.version });
  return `/v1/legal/${encodeURIComponent(item.kind.toLowerCase())}?${query.toString()}`;
}
