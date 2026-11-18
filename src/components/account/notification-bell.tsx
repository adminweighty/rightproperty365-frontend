"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useNotifications } from "@/components/account/notifications-provider";
import { bellLabel, unreadBadgeText } from "@/lib/notifications";

/**
 * The header bell: a 44px link to `/account/notifications` with the unread
 * count on a badge. Only for a signed-in customer-scope session (Property
 * Seekers and professionals); nothing while the session loads, when signed
 * out, or for an administrator. The count is drawn on the client from
 * `NotificationsProvider`, so the header the server renders is the same for
 * everyone (it reads nothing from the address, which would make the
 * layout wait for the request on dynamic pages). Its name carries the count ("Notifications, 3 unread"); the
 * badge is hidden from screen readers so the number is not read twice.
 */
export function NotificationBell() {
  const { status, unread } = useNotifications();
  if (status === "off") return null;

  const badge = unreadBadgeText(unread);

  return (
    <Link
      href="/account/notifications"
      aria-label={bellLabel(unread)}
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-sunken"
    >
      <Bell className="size-5" aria-hidden="true" />
      {badge && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold leading-none text-on-primary tabular-nums ring-2 ring-surface"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
