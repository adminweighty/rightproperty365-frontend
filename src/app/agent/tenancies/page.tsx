import type { Metadata } from "next";
import { Suspense } from "react";
import { TenancyList } from "@/components/agent/property/tenancy-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Tenancies", robots: { index: false, follow: false } };

/** Private: read in the browser with the session cookie; inside Suspense because it reads the filters in the address. */
export default function TenanciesPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <TenancyList />
      </Suspense>
    </Container>
  );
}
