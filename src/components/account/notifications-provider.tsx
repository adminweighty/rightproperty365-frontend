"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getUnreadCount } from "@/lib/api/notifications";
import { pollDelay, POLL_INTERVAL_MS, stopsPolling, unreadAnnouncement } from "@/lib/notifications";

type NotificationsValue = {
  /**
   * "off": nobody signed in, or an administrator session (no bell);
   * "loading": the first count is on its way; "ready": `unread` is the API's last answer.
   */
  status: "off" | "loading" | "ready";
  /** Null until the first answer. */
  unread: number | null;
  /** The notification list knows the count better (after marking read): show it at once, without announcing it. */
  setUnread: (count: number) => void;
  /** Reads the count again now, and starts the minute again from here. */
  refresh: () => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/** The count of one account, so a different account never sees another's badge. */
type Count = { userId: string; unread: number };

/**
 * The unread count behind the header bell, read in the browser from
 * `GET /v1/me/notifications/unread-count`: once the session is known, then
 * every minute while the tab is visible. Hidden tabs do not ask; showing the
 * tab again asks at once when a read is due. After failures it waits longer
 * (2, 4, 8, then 15 minutes, or the API's Retry-After); a 401 or 403 stops
 * it until the session changes. Nothing personal is read on the server, so
 * public pages stay cached and the same for everyone.
 *
 * It renders the one polite live region that says when the count goes up.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  // Customer-scope sessions only: professionals sign in with the same scope. Administrators get no bell.
  const userId = auth.status === "authenticated" && auth.scope === "customer" ? auth.user.id : null;
  const [count, setCount] = useState<Count | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** The last count shown, for deciding whether a new one went up. */
  const last = useRef<{ userId: string; unread: number } | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  const show = useCallback((owner: string, unread: number, announce: boolean) => {
    const previous = last.current?.userId === owner ? last.current.unread : null;
    last.current = { userId: owner, unread };
    setCount({ userId: owner, unread });
    const message = announce ? unreadAnnouncement(previous, unread) : null;
    // Cleared when the count does not go up, so the same words can be read again next time.
    setAnnouncement(message ?? "");
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;
    let inFlight = false;
    /** When the next read is due (ms since the epoch). */
    let dueAt = 0;

    const visible = () => document.visibilityState === "visible";

    const schedule = (delay: number) => {
      clearTimeout(timer);
      dueAt = Date.now() + delay;
      if (!stopped && visible()) timer = setTimeout(read, delay);
    };

    async function read() {
      if (cancelled || stopped || inFlight) return;
      inFlight = true;
      const result = await getUnreadCount();
      inFlight = false;
      if (cancelled) return;
      if (result.ok) {
        failures = 0;
        show(userId as string, result.data, true);
        schedule(POLL_INTERVAL_MS);
      } else if (stopsPolling(result.failure.status)) {
        stopped = true;
        clearTimeout(timer);
      } else {
        failures += 1;
        schedule(pollDelay(failures, result.failure.retryAfter));
      }
    }

    const onVisibility = () => {
      if (!visible()) {
        clearTimeout(timer);
        return;
      }
      if (!stopped) schedule(Math.max(0, dueAt - Date.now()));
    };

    refreshRef.current = () => {
      failures = 0;
      stopped = false;
      clearTimeout(timer);
      read();
    };

    // The first read even in a background tab, so the bell is right when it is shown.
    read();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      refreshRef.current = () => {};
    };
  }, [userId, show]);

  const current = userId && count?.userId === userId ? count : null;
  const status: NotificationsValue["status"] = !userId ? "off" : current ? "ready" : "loading";

  const setUnread = useCallback(
    (unread: number) => {
      if (userId) show(userId, Math.max(0, unread), false);
    },
    [userId, show],
  );
  const refresh = useCallback(() => refreshRef.current(), []);

  const value = useMemo<NotificationsValue>(
    () => ({ status, unread: current?.unread ?? null, setUnread, refresh }),
    [status, current, setUnread, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {/* Always in the page, so a change is announced; polite, so it never interrupts. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {userId ? announcement : ""}
      </p>
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider");
  return value;
}
