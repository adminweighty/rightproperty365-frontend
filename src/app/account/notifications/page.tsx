import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationList, NotificationListSkeleton } from "@/components/account/notification-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

/**
 * The list is read in the browser with the session cookie, so the page the
 * server sends is the same for everyone. It reads `?page` and `?unread`, so
 * it sits inside Suspense.
 */
export default function NotificationsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<NotificationListSkeleton />}>
        <NotificationList />
      </Suspense>
    </Container>
  );
}
