import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { NotificationPreferences } from "@/components/account/notification-preferences";
import { AppLinks } from "@/components/layout/app-links";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Notification preferences", robots: { index: false, follow: false } };

/**
 * What a push notification is, with the app store links. Static, so it is
 * rendered here on the server and handed to the client form.
 */
function PushNote() {
  return (
    <section aria-labelledby="push-heading" className="mt-6 rounded-lg border border-line bg-sunken p-4 sm:p-5">
      <h2 id="push-heading" className="flex items-center gap-2 font-sans text-lg font-medium tracking-normal">
        <Smartphone className="size-5 shrink-0 text-primary-ink" aria-hidden="true" />
        Push notifications need the mobile app
      </h2>
      <p className="mt-2 max-w-2xl text-ink">
        Push notifications go to the RightProperty365 app, on phones where you are signed in and have allowed
        notifications. This website does not send them. A phone that is off or offline may get them late or not
        at all, so everything is also kept in your notifications list.
      </p>
      <AppLinks className="mt-4" />
    </section>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <NotificationPreferences pushNote={<PushNote />} />
    </Container>
  );
}
