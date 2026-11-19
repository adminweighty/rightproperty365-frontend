/**
 * The rules behind the header bell, the notification list and the
 * notification preferences (API 0.35.0): which links may be followed, the
 * badge and its words, how often the unread count is read, relative times,
 * and tolerant readers for the API's answers. Pure functions with no
 * imports, so `npm test` can run them directly.
 */

/* ------------------------------------------------------------------ links */

/**
 * The link of a notification, when it is a path on this site; null
 * otherwise. Only a relative path that starts with one "/" is kept: never an
 * absolute URL (`https://…`), a protocol-relative one (`//host`), a scheme
 * (`javascript:`), a backslash or a control character, which some browsers
 * read as a slash or drop. The API sends paths such as `/agent/requests/123`;
 * anything else is shown as plain text, never followed.
 */
export function safeNotificationLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const link = value.trim();
  if (!link || link.length > 2000) return null;
  if (!link.startsWith("/") || link.startsWith("//")) return null;
  const unsafeChar = (char: string) => char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127;
  if (Array.from(link).some(unsafeChar)) return null;
  let url: URL;
  try {
    url = new URL(link, "https://site.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://site.invalid") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Links the API sends (contract 0.35.0, "Links per type") whose page this
 * site does not have one by one yet, and the page that lists them. Anything
 * not listed here is used as it is.
 */
const PAGE_FOR_API_LINK: { pattern: RegExp; page: string }[] = [
  { pattern: /^\/agent\/enquiries(\/[^/?#]+)?\/?$/, page: "/agent/requests#business-enquiries" },
  { pattern: /^\/agent\/appointments\/[^/?#]+\/?$/, page: "/agent/appointments" },
  { pattern: /^\/account\/appointments\/[^/?#]+\/?$/, page: "/account/appointments" },
  { pattern: /^\/agent\/venue-bookings\/[^/?#]+\/?$/, page: "/agent/venue-bookings" },
  { pattern: /^\/account\/(hourly-bookings|venue-bookings)(\/[^/?#]+)?\/?$/, page: "/account/venue-bookings" },
  { pattern: /^\/account\/subscriptions?(\/[^/?#]+)?\/?$/, page: "/account/subscription" },
  // A maintenance notification to a tenant (API 0.36.2) links to their tenancy area.
  { pattern: /^\/account\/tenancy\/?$/, page: "/account/tenancies" },
];

/**
 * Where a notification's link goes on this site: `safeNotificationLink`, then
 * an API path with no page of its own here is sent to the list it belongs
 * to (`/account/appointments/{id}` opens "Your appointments"). Null when the
 * link is not a path on this site.
 */
export function notificationHref(value: unknown): string | null {
  const safe = safeNotificationLink(value);
  if (!safe) return null;
  const path = safe.split(/[?#]/, 1)[0];
  const known = PAGE_FOR_API_LINK.find(({ pattern }) => pattern.test(path));
  return known ? known.page : safe;
}

/* ------------------------------------------------------------ the badge */

/** The number drawn on the bell: nothing for none, "99+" above 99. */
export function unreadBadgeText(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 1) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** The bell's accessible name: "Notifications, 3 unread". Before the count is known: "Notifications". */
export function bellLabel(count: number | null | undefined): string {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return "Notifications";
  return `Notifications, ${Math.floor(count)} unread`;
}

/**
 * What the polite live region says when the count changes: only when it goes
 * up from a count already known ("You have 4 unread notifications"). Reading
 * notifications, the first count of a page and a count that stays the same
 * say nothing.
 */
export function unreadAnnouncement(previous: number | null | undefined, next: number | null | undefined): string | null {
  if (typeof previous !== "number" || typeof next !== "number") return null;
  if (!(next > previous)) return null;
  return next === 1 ? "You have 1 unread notification" : `You have ${next} unread notifications`;
}

/* --------------------------------------------------------------- polling */

/** How often the unread count is read while the tab is visible. */
export const POLL_INTERVAL_MS = 60_000;
/** The longest wait after repeated failures. */
export const MAX_POLL_INTERVAL_MS = 15 * 60_000;

/**
 * How long to wait before the next read of the unread count. Every minute
 * while it works; after failures in a row, 2, 4, 8 then 15 minutes at most.
 * A Retry-After from a 429 is honoured when it asks for longer.
 */
export function pollDelay(failures: number, retryAfterSeconds?: number): number {
  const count = Number.isFinite(failures) && failures > 0 ? Math.floor(failures) : 0;
  const backoff = Math.min(POLL_INTERVAL_MS * 2 ** Math.min(count, 10), MAX_POLL_INTERVAL_MS);
  const asked = typeof retryAfterSeconds === "number" && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 0;
  return Math.min(Math.max(backoff, asked), MAX_POLL_INTERVAL_MS * 4);
}

/** A failure after which polling stops until the session changes: signed out (401) or not allowed (403). */
export function stopsPolling(status: number): boolean {
  return status === 401 || status === 403;
}

/* ----------------------------------------------------------------- times */

/**
 * "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago",
 * "2 weeks ago", then the date alone is left to the absolute time beside it
 * (null). A time a little in the future (a clock out of step) is "just now".
 */
export function relativeTime(iso: string, now: number = Date.now()): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks <= 4) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  return null;
}

/* ------------------------------------------------------- reading answers */

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  /** Already checked with `notificationHref`: a page of this site, or null. */
  link: string | null;
  reference: string | null;
  created_at: string;
  read_at: string | null;
};

export type NotificationPage = {
  items: AppNotification[];
  unread_count: number;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type NotificationPreference = {
  type: string;
  label: string;
  essential: boolean;
  /** Why it cannot be switched off, when the API says. */
  essential_reason: string | null;
  email: boolean;
  push: boolean;
  in_app: boolean;
};

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");
const optionalText = (value: unknown): string | null => {
  const trimmed = text(value).trim();
  return trimmed ? trimmed : null;
};
const whole = (value: unknown, fallback: number): number => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
};

/** The count from `{ unread_count }`; null when the answer has none. */
export function readUnreadCount(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  const value = raw.unread_count ?? raw.count ?? raw.unread;
  const count = whole(value, -1);
  return count >= 0 ? count : null;
}

/** "SUBSCRIPTION_INVOICE_ISSUED" -> "Subscription invoice issued", for a type the API gave no label. */
export function labelFromType(type: string): string {
  const words = type.toLowerCase().replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Notification";
}

function readNotification(raw: unknown): AppNotification | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  if (!id) return null;
  const type = text(raw.type) || "NOTIFICATION";
  return {
    id,
    type,
    title: text(raw.title).trim() || labelFromType(type),
    body: text(raw.body).trim(),
    link: notificationHref(raw.link),
    reference: optionalText(raw.reference),
    created_at: text(raw.created_at),
    read_at: optionalText(raw.read_at),
  };
}

/**
 * A page of `GET /v1/me/notifications`, whatever is missing: `items` is
 * always a list, links are already made safe, and `total_pages` is worked
 * out from `total` and `page_size` when the API does not send it.
 */
export function readNotificationPage(raw: unknown, requestedPage = 1): NotificationPage {
  const body = isRecord(raw) ? raw : {};
  const list = Array.isArray(body.items) ? body.items : Array.isArray(body.notifications) ? body.notifications : [];
  const items = list.map(readNotification).filter((item): item is AppNotification => item !== null);
  const pageSize = whole(body.page_size, 0) || Math.max(items.length, 20);
  const total = whole(body.total, items.length);
  const totalPages = whole(body.total_pages, 0) || Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    unread_count: readUnreadCount(body) ?? items.filter((item) => !item.read_at).length,
    page: whole(body.page, 0) || requestedPage,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  };
}

/** `GET /v1/me/notification-preferences`, with every flag a boolean and in-app always on. */
export function readPreferences(raw: unknown): NotificationPreference[] {
  const body = isRecord(raw) ? raw : {};
  const list = Array.isArray(body.items) ? body.items : Array.isArray(body.preferences) ? body.preferences : [];
  return list.flatMap((item): NotificationPreference[] => {
    if (!isRecord(item)) return [];
    const type = text(item.type);
    if (!type) return [];
    const essential = item.essential === true;
    return [
      {
        type,
        label: text(item.label).trim() || labelFromType(type),
        essential,
        essential_reason: optionalText(item.essential_reason ?? item.reason ?? item.locked_reason),
        // An essential type is always sent on every channel it has.
        email: essential || item.email === true,
        push: essential || item.push === true,
        in_app: true,
      },
    ];
  });
}

/** The words beside an essential type when the API gives no reason of its own. */
export const ESSENTIAL_REASON = "Always on. Needed for your account's security and contracts.";

/**
 * Why an essential type cannot be switched off: the API's reason when it
 * sends one, otherwise words for the essential types of API 0.35.0
 * (`ACCOUNT`, `SECURITY`, `SUBSCRIPTION_INVOICE`), otherwise `ESSENTIAL_REASON`.
 */
export function essentialReason(item: Pick<NotificationPreference, "type" | "essential_reason">): string {
  if (item.essential_reason) return item.essential_reason;
  if (item.type === "ACCOUNT" || item.type === "SECURITY") return "Always on. Needed for your account's security.";
  if (item.type.startsWith("SUBSCRIPTION_INVOICE")) return "Always on. Invoices for your subscription are always sent.";
  return ESSENTIAL_REASON;
}

/**
 * The items `PUT /v1/me/notification-preferences` needs: only the types
 * whose Email or Push changed, and never an essential type.
 */
export function changedPreferences(
  saved: readonly NotificationPreference[],
  draft: readonly NotificationPreference[],
): { type: string; email: boolean; push: boolean }[] {
  const before = new Map(saved.map((item) => [item.type, item]));
  return draft.flatMap((item) => {
    const was = before.get(item.type);
    if (!was || item.essential || was.essential) return [];
    if (was.email === item.email && was.push === item.push) return [];
    return [{ type: item.type, email: item.email, push: item.push }];
  });
}

/**
 * A refused save's field errors, by type. The API keys them by the position
 * in the request (`items[2].push`), so `sent` is the list that was sent. A
 * code before the words (`PREFERENCE_ESSENTIAL: …`) is left out.
 */
export function preferenceErrorsByType(
  fields: Record<string, string> | undefined,
  sent: readonly { type: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const index = /^items\[(\d+)\]/.exec(key)?.[1];
    const type = index === undefined ? undefined : sent[Number(index)]?.type;
    if (!type || result[type]) continue;
    const words = message.replace(/^[A-Z][A-Z_]+:\s*/, "").trim();
    result[type] = words || "This change cannot be saved.";
  }
  return result;
}

/* ------------------------------------------------------------- addresses */

/** A page of the notification list. Page 1 of all notifications is the plain address. */
export function notificationsPageHref(page: number, unreadOnly = false): string {
  const search = new URLSearchParams();
  if (unreadOnly) search.set("unread", "1");
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/account/notifications?${query}` : "/account/notifications";
}

/** "12 notifications, 3 unread, page 1 of 2" for the status line above the list. */
export function notificationCountText(
  { total, unread_count, page, total_pages }: Pick<NotificationPage, "total" | "unread_count" | "page" | "total_pages">,
  unreadOnly = false,
): string {
  const count = unreadOnly
    ? total === 1
      ? "1 unread notification"
      : `${total} unread notifications`
    : `${total === 1 ? "1 notification" : `${total} notifications`}, ${unread_count} unread`;
  return `${count}${total_pages > 1 ? `, page ${page} of ${total_pages}` : ""}, newest first`;
}
