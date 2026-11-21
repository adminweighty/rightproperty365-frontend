/**
 * The pure rules of the first-party listing tracker (API 0.30.0): which events
 * may be sent, how a visit's source and device are classed, the session
 * pseudonym and when it rotates, and the queue that batches and de-duplicates
 * events. Nothing here touches the browser, so `npm test` checks it in Node
 * (scripts/analytics.test.mjs). The browser side is `src/lib/analytics/tracker.ts`.
 *
 * No third-party code, no cross-site identifier and never the raw referrer.
 */

/** The event schema this site sends (`{ "schema": 1, "events": [...] }`). */
export const ANALYTICS_SCHEMA = 1;

/** The API takes 1 to 50 events per request. */
export const MAX_BATCH = 50;

/** Events kept waiting at most; the oldest are dropped beyond this (a long offline spell). */
export const MAX_QUEUED = 200;

/** The event types a browser may send. The others are recorded by the API itself. */
export const BROWSER_EVENT_TYPES = [
  "property_card_impression",
  "listing_detail_view",
  "contact_click",
  "youtube_play_intent",
] as const;
export type BrowserEventType = (typeof BROWSER_EVENT_TYPES)[number];

/** Where a card was shown. */
export const PLACEMENTS = ["search", "rail", "similar", "home", "saved"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export type Source = "direct" | "search_engine" | "social" | "internal" | "email" | "other";
export type Device = "mobile" | "tablet" | "desktop";

export const isPlacement = (value: unknown): value is Placement =>
  typeof value === "string" && (PLACEMENTS as readonly string[]).includes(value);

/** One event as the API receives it. */
export type AnalyticsEvent = {
  event_id: string;
  type: BrowserEventType;
  /** UTC, ISO 8601. */
  occurred_at: string;
  listing_id: string;
  placement?: Placement;
  rank?: number;
  source: Source;
  device: Device;
  /** The session pseudonym; filled in when the batch is sent. */
  session: string | null;
  consent: { analytics: true };
  /** The campaign the visit came from (API 0.58.0); omitted when there is none. */
  campaign?: { source: string; medium: string; campaign: string };
};

// ---- Do Not Track and Global Privacy Control ---------------------------------

type PrivacySignals = { doNotTrack?: string | null; globalPrivacyControl?: boolean };

/**
 * False when the browser asks not to be tracked: Do Not Track "1" or Global
 * Privacy Control on. Then nothing is sent and no pseudonym is kept.
 */
export function trackingAllowed(navigator: PrivacySignals | undefined | null): boolean {
  if (!navigator) return false;
  if (navigator.doNotTrack === "1") return false;
  if (navigator.globalPrivacyControl === true) return false;
  return true;
}

// ---- Device class from the viewport -----------------------------------------

/** The layout widths the site itself uses: phones below 768px, tablets below 1024px. */
export function deviceClass(viewportWidth: number): Device {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return "desktop";
  if (viewportWidth < 768) return "mobile";
  if (viewportWidth < 1024) return "tablet";
  return "desktop";
}

// ---- Source class from the referrer ------------------------------------------

/** A host without "www.", lower case; for an Android app referrer, its package name. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const host = url.protocol === "android-app:" ? url.host || url.pathname.replace(/^\/+/, "").split("/")[0] : url.hostname;
    return host ? host.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** Matches a host that is `domain` or one of its subdomains. */
const onDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Web mail and mail apps. Checked before search engines: mail.google.com is mail, not search. */
const EMAIL_HOSTS = [
  "mail.google.com",
  "inbox.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "mail.yahoo.com",
  "mail.proton.me",
  "mail.aol.com",
  "mail.yandex.ru",
  "com.google.android.gm",
  "com.microsoft.office.outlook",
];

/** Search engines whose country domains vary (google.co.zw, yandex.ru): matched by name. */
const SEARCH_NAMES = /(^|\.)(google|bing|yahoo|yandex|baidu|ecosia|duckduckgo|qwant|startpage|naver|seznam|ask)\.[a-z.]+$/;
const SEARCH_HOSTS = ["search.brave.com", "com.google.android.googlequicksearchbox"];

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "messenger.com",
  "instagram.com",
  "t.co",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "lnkd.in",
  "whatsapp.com",
  "wa.me",
  "pinterest.com",
  "reddit.com",
  "tiktok.com",
  "youtube.com",
  "t.me",
  "telegram.org",
  "threads.net",
  "snapchat.com",
  "com.facebook.katana",
  "com.instagram.android",
  "com.linkedin.android",
  "com.twitter.android",
  "com.whatsapp",
];

/**
 * The class of where a visit came from, worked out from `document.referrer`
 * and this site's own host. Only the class leaves the browser, never the
 * referrer. After a navigation inside the site (`navigatedInApp`) the page
 * was reached from this site, whatever `document.referrer` still says.
 */
export function classifySource({
  referrer,
  ownHost,
  navigatedInApp = false,
}: {
  referrer: string | null | undefined;
  ownHost: string;
  navigatedInApp?: boolean;
}): Source {
  if (navigatedInApp) return "internal";
  const host = referrerHost(referrer);
  if (!host) return "direct";
  const own = ownHost.toLowerCase().replace(/^www\./, "");
  if (own && host === own) return "internal";
  if (EMAIL_HOSTS.some((domain) => onDomain(host, domain)) || /^(web)?mail\./.test(host)) return "email";
  if (SEARCH_NAMES.test(host) || SEARCH_HOSTS.some((domain) => onDomain(host, domain))) return "search_engine";
  if (SOCIAL_HOSTS.some((domain) => onDomain(host, domain))) return "social";
  return "other";
}

// ---- The session pseudonym ---------------------------------------------------

/** Name of the first-party cookie, and of the `sessionStorage` key. */
export const SESSION_COOKIE = "rp_as";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An opaque random 128-bit id (32 hex characters) and when it was made (ms since 1970). */
export type SessionRecord = { id: string; created: number };

const SESSION_VALUE = /^([0-9a-f]{32})\.(\d{1,16})$/;

/** The next local midnight after `ms`, in the browser's own time zone (daylight saving included). */
export function nextLocalMidnight(ms: number): number {
  const at = new Date(ms);
  at.setHours(24, 0, 0, 0);
  return at.getTime();
}

/** When a pseudonym made at `created` stops being used: the next local midnight, and never more than 24 hours on. */
export function sessionExpiry(created: number): number {
  return Math.min(nextLocalMidnight(created), created + DAY_MS);
}

/** True while `record` may still be used at `now`. A clock that went backwards rotates it too. */
export function sessionValid(record: SessionRecord | null, now: number): record is SessionRecord {
  if (!record) return false;
  return now >= record.created && now < sessionExpiry(record.created);
}

export const formatSession = ({ id, created }: SessionRecord) => `${id}.${created}`;

export function parseSession(value: string | null | undefined): SessionRecord | null {
  const match = SESSION_VALUE.exec(value ?? "");
  if (!match) return null;
  return { id: match[1], created: Number(match[2]) };
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** A new pseudonym from 16 random bytes. */
export function newSession(randomBytes: Uint8Array, now: number): SessionRecord {
  if (randomBytes.length !== 16) throw new Error("A session pseudonym needs 16 random bytes.");
  return { id: hex(randomBytes), created: now };
}

/** A version 4 UUID from 16 random bytes (for browsers without `crypto.randomUUID`). */
export function uuidFromBytes(randomBytes: Uint8Array): string {
  if (randomBytes.length !== 16) throw new Error("A UUID needs 16 random bytes.");
  const bytes = Uint8Array.from(randomBytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const text = hex(bytes);
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

/** The `Set-Cookie`-style string for `document.cookie`: first party, SameSite=Lax, gone when the pseudonym rotates. */
export function sessionCookie(record: SessionRecord, secure: boolean): string {
  const expires = new Date(sessionExpiry(record.created)).toUTCString();
  return `${SESSION_COOKIE}=${formatSession(record)}; Path=/; Expires=${expires}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** One cookie's value from `document.cookie`. */
export function readCookie(cookies: string, name: string): string | null {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/**
 * The pseudonym to use at `now`: the tab's own (`sessionStorage`), else the
 * one the site's cookie holds (another tab of the same visit), else a new one.
 * `fresh` is true when it must be written back to both.
 */
export function resolveSession(
  stored: string | null,
  cookie: string | null,
  now: number,
  randomBytes: () => Uint8Array,
): { record: SessionRecord; fresh: boolean } {
  const own = parseSession(stored);
  if (sessionValid(own, now)) return { record: own, fresh: false };
  const shared = parseSession(cookie);
  if (sessionValid(shared, now)) return { record: shared, fresh: true };
  return { record: newSession(randomBytes(), now), fresh: true };
}

// ---- Page views and de-duplication -------------------------------------------

/**
 * Counts page views: a new one whenever the address (path and query, not the
 * hash) changes. Events are de-duplicated per page view, so a re-render never
 * sends one twice and a route change starts again.
 */
export class PageViews {
  private href: string | null = null;
  private seq = 0;

  /** The current page view's number for this address. */
  current(href: string): number {
    const plain = href.split("#")[0];
    if (plain !== this.href) {
      this.href = plain;
      this.seq += 1;
    }
    return this.seq;
  }

  /** A page restored from the back-forward cache is a new view of it. */
  restart(): void {
    this.href = null;
  }

  /** True once the visitor has moved inside the site (the second page view and later). */
  get navigated(): boolean {
    return this.seq > 1;
  }
}

/** The key an event is de-duplicated on: once per page view, per listing, per kind (and per placement for a card). */
export function dedupKey(pageView: number, type: BrowserEventType, listingId: string, placement?: Placement): string {
  return type === "property_card_impression"
    ? `${pageView}|${type}|${placement ?? ""}|${listingId}`
    : `${pageView}|${type}|${listingId}`;
}

/**
 * Events waiting to be sent. `add` refuses a key it has seen; `take` hands
 * out at most one batch; `putBack` returns a batch that could not be sent
 * (the API is idempotent on `event_id`, so a resend never counts twice).
 */
export class EventQueue {
  private readonly items: AnalyticsEvent[] = [];
  private readonly seen = new Set<string>();
  private readonly limit: number;

  constructor(limit = MAX_QUEUED) {
    this.limit = limit;
  }

  get size(): number {
    return this.items.length;
  }

  add(event: AnalyticsEvent, key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.items.push(event);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
    return true;
  }

  take(max = MAX_BATCH): AnalyticsEvent[] {
    return this.items.splice(0, Math.min(max, MAX_BATCH));
  }

  putBack(events: AnalyticsEvent[]): void {
    this.items.unshift(...events);
    if (this.items.length > this.limit) this.items.splice(this.limit);
  }

  /** Drops everything waiting (an administrator session). Keys stay seen. */
  clear(): void {
    this.items.length = 0;
  }
}

/** The request body for one batch. */
export function batchBody(events: AnalyticsEvent[], session: string | null): string {
  return JSON.stringify({ schema: ANALYTICS_SCHEMA, events: events.map((event) => ({ ...event, session })) });
}
