import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestNew } from "@/components/agent/maintenance/request-new";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Report an issue", robots: { index: false, follow: false } };

/** Private: posted in the browser with the session cookie; inside Suspense because it reads the property and tenancy in the address. */
export default function NewMaintenanceRequestPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <RequestNew />
      </Suspense>
    </Container>
  );
}
