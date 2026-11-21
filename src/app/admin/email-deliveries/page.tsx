import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailDeliveries } from "@/components/admin/email-deliveries";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Email delivery", robots: { index: false, follow: false } };

// Read in the browser with the administrator's session; nothing is rendered on the server.
export default function EmailDeliveriesPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <EmailDeliveries />
      </Suspense>
    </Container>
  );
}
