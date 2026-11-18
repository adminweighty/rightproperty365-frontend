"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/account/notifications-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import type { ApiFailure } from "@/lib/api/http";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationPage,
} from "@/lib/api/notifications";
import { cn } from "@/lib/cn";
import { notificationCountText, notificationsPageHref, relativeTime } from "@/lib/notifications";
import { pageFrom } from "@/lib/request-filters";

/** The loading state, also the page's Suspense fallback. */
export function NotificationListSkeleton() {
  return <LoadingBlock label="Loading your notifications" rows={4} />;
}

/** "2 hours ago" with the date and time beside it; the date alone once it is a month old. */
function When({ iso, now }: { iso: string; now: number | null }) {
  const absolute = formatWhen(iso);
  // The relative words need the time in the browser, so they appear once it is known.
  const relative = now === null ? null : relativeTime(iso, now);
  return (
    <time dateTime={iso} className="text-sm text-muted">
      {relative ? (
        <>
          {relative} · {absolute}
        </>
      ) : (
        absolute
      )}
    </time>
  );
}

type ItemProps = {
  item: AppNotification;
  now: number | null;
  busy: boolean;
  failure: ApiFailure | null;
  onOpen: (item: AppNotification) => void;
  onMarkRead: (item: AppNotification) => void;
};

/**
 * One notification. Unread: a "New" badge, a bar down the left, a tinted
 * panel and a bold title, so the state never rests on colour alone, and
 * "Mark as read". Read: a plain white panel with "Read" beside the time.
 * The title is a link only when the API's link is a page of this site.
 */
function NotificationItem({ item, now, busy, failure, onOpen, onMarkRead }: ItemProps) {
  const unread = !item.read_at;
  const titleId = `notification-${item.id}`;
  // A team invitation points back here (its own link is only in the email): no link to this page.
  const href = item.link && item.link !== "/account/notifications" ? item.link : null;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-lg border p-4 sm:p-5",
        unread ? "border-line border-l-4 border-l-primary bg-tint" : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {unread ? <Badge tone="primary">New</Badge> : <Badge>Read</Badge>}
        <When iso={item.created_at} now={now} />
      </div>
      <h2 id={titleId} className={cn("mt-2 font-sans text-lg tracking-normal", unread ? "font-semibold" : "font-normal")}>
        {href ? (
          <Link href={href} onClick={() => onOpen(item)} className="text-primary-ink hover:underline">
            {item.title}
            {unread && <span className="sr-only"> (unread)</span>}
          </Link>
        ) : (
          <span className="text-ink">
            {item.title}
            {unread && <span className="sr-only"> (unread)</span>}
          </span>
        )}
      </h2>
      {item.body && <p className="mt-1 break-words text-ink">{item.body}</p>}
      {item.reference && !item.body.includes(item.reference) && (
        <p className="mt-1 font-mono text-xs text-muted">{item.reference}</p>
      )}

      {failure && <Alert className="mt-3" title={failure.message} traceId={failure.traceId} />}

      {unread && (
        <div className="mt-3">
          <Button variant="ghost" disabled={busy} aria-busy={busy} onClick={() => onMarkRead(item)} className="-ml-3">
            {busy ? "Marking as read…" : "Mark as read"}
            <span className="sr-only">: {item.title}</span>
          </Button>
        </div>
      )}
    </article>
  );
}

/** The same page with one item read, and the unread count the API gave, or one lower. */
function withRead(page: NotificationPage, id: string, at: string, unread: number | null = null): NotificationPage {
  const target = page.items.find((item) => item.id === id);
  if (!target || target.read_at) return unread === null ? page : { ...page, unread_count: unread };
  return {
    ...page,
    unread_count: unread ?? Math.max(0, page.unread_count - 1),
    items: page.items.map((item) => (item.id === id ? { ...item, read_at: at } : item)),
  };
}

function List() {
  const router = useRouter();
  const params = useSearchParams();
  const page = pageFrom(params.get("page"));
  const unreadOnly = params.get("unread") === "1";
  const load = useCallback(() => listNotifications({ page, unreadOnly }), [page, unreadOnly]);
  const { state, reload, replace } = useApi(load);
  const { setUnread, refresh } = useNotifications();
  const heading = useRef<HTMLHeadingElement>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; failure: ApiFailure } | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [allFailure, setAllFailure] = useState<ApiFailure | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The time used for "2 hours ago", read in the browser after the first render.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  // The list knows the count: keep the bell in step with it.
  const listUnread = state.status === "ready" ? state.data.unread_count : null;
  useEffect(() => {
    if (listUnread !== null) setUnread(listUnread);
  }, [listUnread, setUnread]);

  /** Following a link marks the notification read; the page changes straight away. */
  function open(item: AppNotification) {
    if (item.read_at || state.status !== "ready") return;
    replace(withRead(state.data, item.id, new Date().toISOString()));
    // The bell takes the API's count when it sends one; otherwise it asks again.
    markNotificationRead(item.id).then((result) => (result.ok && result.data !== null ? setUnread(result.data) : refresh()));
  }

  async function markRead(item: AppNotification) {
    setMarking(item.id);
    setFailed(null);
    setAnnouncement("");
    const result = await markNotificationRead(item.id);
    setMarking(null);
    if (!result.ok) {
      setFailed({ id: item.id, failure: result.failure });
      return;
    }
    setAnnouncement(`Marked "${item.title}" as read.`);
    if (result.data !== null) setUnread(result.data);
    if (state.status !== "ready") return;
    // In the "Unread" list it leaves the page, so read the page again; elsewhere it changes in place.
    if (unreadOnly) {
      requestAnimationFrame(() => heading.current?.focus());
      if (state.data.items.length === 1 && page > 1) router.push(notificationsPageHref(page - 1, true));
      else reload();
    } else {
      replace(withRead(state.data, item.id, new Date().toISOString(), result.data));
    }
  }

  async function markAll() {
    setMarkingAll(true);
    setAllFailure(null);
    setAnnouncement("");
    const result = await markAllNotificationsRead();
    setMarkingAll(false);
    if (!result.ok) {
      setAllFailure(result.failure);
      return;
    }
    setUnread(result.data ?? 0);
    setAnnouncement("All your notifications are marked as read.");
    requestAnimationFrame(() => heading.current?.focus());
    if (unreadOnly && page > 1) router.push(notificationsPageHref(1, true));
    else reload();
  }

  const data = state.status === "ready" ? state.data : null;
  const unreadCount = data?.unread_count ?? (state.status === "loading" ? state.previous?.unread_count : undefined);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 ref={heading} tabIndex={-1} className="text-4xl outline-none">
          Notifications
        </h1>
        <Link
          href="/account/notification-preferences"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-ink hover:underline"
        >
          <Settings2 className="size-4" aria-hidden="true" />
          Notification preferences
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-muted">
        Updates about your requests, appointments, applications, listings and account. They are kept here even when
        we also send an email or a push notification to the app.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <ChipNav
          label="Show"
          items={[
            { key: "all", href: notificationsPageHref(1), label: "All", current: !unreadOnly },
            { key: "unread", href: notificationsPageHref(1, true), label: "Unread", count: unreadCount, current: unreadOnly },
          ]}
        />
        {data && data.unread_count > 0 && (
          <Button variant="secondary" disabled={markingAll} aria-busy={markingAll} onClick={markAll}>
            {markingAll ? "Marking all as read…" : "Mark all as read"}
          </Button>
        )}
      </div>
      {allFailure && <Alert className="mt-4" title={allFailure.message} traceId={allFailure.traceId} />}

      <p role="status" className="mt-4 text-sm text-muted">
        {announcement || (data && data.total > 0 ? notificationCountText(data, unreadOnly) : "")}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <NotificationListSkeleton />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {data &&
          data.items.length === 0 &&
          (data.total > 0 ? (
            <EmptyState
              title={`There is no page ${page} of your ${unreadOnly ? "unread " : ""}notifications`}
              action={
                <ButtonLink href={notificationsPageHref(1, unreadOnly)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : unreadOnly ? (
            <EmptyState
              title="You have no unread notifications"
              action={
                <ButtonLink href={notificationsPageHref(1)} variant="secondary">
                  See all notifications
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title="You have no notifications yet">
              When something changes on a request, an appointment, an application or a listing, it is listed here.
            </EmptyState>
          ))}
        {data && data.items.length > 0 && (
          <>
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <NotificationItem
                    item={item}
                    now={now}
                    busy={marking === item.id}
                    failure={failed?.id === item.id ? failed.failure : null}
                    onOpen={open}
                    onMarkRead={markRead}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={data.page}
              totalPages={data.total_pages}
              hrefFor={(value) => notificationsPageHref(value, unreadOnly)}
              label={unreadOnly ? "Unread notifications" : "Notifications"}
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/account/notifications`: the signed-in person's notifications, read in the browser with the session cookie. */
export function NotificationList() {
  return <RequireAuth>{() => <List />}</RequireAuth>;
}
