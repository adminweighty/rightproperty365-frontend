import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseList } from "@/components/leases/lease-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Leases", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; nothing is rendered on the server.
export default function LeasesPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <LeaseList />
      </Suspense>
    </Container>
  );
}
