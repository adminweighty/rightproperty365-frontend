import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingReports } from "@/components/admin/listing-reports";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Reported listings", robots: { index: false, follow: false } };

// Read in the browser with the administrator's session; nothing is rendered on the server.
export default function ListingReportsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ListingReports />
      </Suspense>
    </Container>
  );
}
