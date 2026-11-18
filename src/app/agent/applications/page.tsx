import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceivedApplications } from "@/components/applications/received-applications";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Applications", robots: { index: false, follow: false } };

/** Read in the browser with the session cookie; the organisation and filters are in the address. */
export default function AgentApplicationsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ReceivedApplications />
      </Suspense>
    </Container>
  );
}
