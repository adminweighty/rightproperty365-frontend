import { apiFetch, type ApiResult } from "@/lib/api/http";
import {
  readNotificationPage,
  readPreferences,
  readUnreadCount,
  type NotificationPage,
  type NotificationPreference,
} from "@/lib/notifications";

/**
 * The signed-in person's notifications and how they want them sent (new in
 * API 0.35.0). Read only in the browser, with the session cookie, and never
 * cached: public pages stay the same for everyone, and the header bell
 * fills in on the client (`NotificationsProvider`).
 *
 * Every answer goes through a tolerant reader in `src/lib/notifications.ts`,
 * so a field the API leaves out does not break a page, and a notification's
 * `link` is only ever a path on this site.
 */

export type { AppNotification, NotificationPage, NotificationPreference } from "@/lib/notifications";

/** Turns a successful answer into its read form; failures pass through unchanged. */
function mapResult<T, U>(result: ApiResult<T>, read: (data: T) => U): ApiResult<U> {
  return result.ok ? { ok: true, status: result.status, data: read(result.data) } : result;
}

/** `{ unread_count }`. Cheap, so the header can read it every minute. A missing count reads as 0. */
export const getUnreadCount = async (): Promise<ApiResult<number>> =>
  mapResult(await apiFetch<unknown>("/v1/me/notifications/unread-count", { cache: "no-store" }), (data) => readUnreadCount(data) ?? 0);

/** Newest first, one page at a time; `unreadOnly` lists only those not yet read. */
export const listNotifications = async ({ page, unreadOnly = false }: { page: number; unreadOnly?: boolean }) => {
  const search = new URLSearchParams({ page: String(page) });
  if (unreadOnly) search.set("unread", "true");
  return mapResult(
    await apiFetch<unknown>(`/v1/me/notifications?${search}`, { cache: "no-store" }),
    (data): NotificationPage => readNotificationPage(data, page),
  );
};

/**
 * Marks one notification read; the answer is the unread count after it
 * (`{ notification, unread_count }`), or null when it has none. `keepalive`
 * lets it finish when its link is followed at once. Idempotent; another
 * person's or an unknown id is 404 `NOTIFICATION_NOT_FOUND`.
 */
export const markNotificationRead = async (id: string): Promise<ApiResult<number | null>> =>
  mapResult(
    await apiFetch<unknown>(`/v1/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST", cache: "no-store", keepalive: true }),
    readUnreadCount,
  );

/** Marks every notification read; the answer (`{ marked, unread_count }`) gives the count after it. */
export const markAllNotificationsRead = async (): Promise<ApiResult<number | null>> =>
  mapResult(await apiFetch<unknown>("/v1/me/notifications/read-all", { method: "POST", cache: "no-store" }), readUnreadCount);

/** One row per type, with Email, Push and In-app (always on). */
export const getNotificationPreferences = async (): Promise<ApiResult<NotificationPreference[]>> =>
  mapResult(await apiFetch<unknown>("/v1/me/notification-preferences", { cache: "no-store" }), readPreferences);

/**
 * Saves the types whose Email or Push changed; the answer is the whole list
 * again (null if it has none, and the page keeps what it sent). A 400
 * `VALIDATION_FAILED` applies nothing, with `fields` keyed by position
 * (`items[0].push`). `X-Client: web` is recorded as the change's source.
 */
export const saveNotificationPreferences = async (
  items: { type: string; email: boolean; push: boolean }[],
): Promise<ApiResult<NotificationPreference[] | null>> =>
  mapResult(
    await apiFetch<unknown>("/v1/me/notification-preferences", { method: "PUT", body: { items }, headers: { "X-Client": "web" }, cache: "no-store" }),
    (data) => {
      const list = readPreferences(data);
      return list.length > 0 ? list : null;
    },
  );
