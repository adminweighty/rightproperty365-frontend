import type { Metadata } from "next";
import { Suspense } from "react";
import { MaintenanceList } from "@/components/agent/maintenance/maintenance-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Maintenance", robots: { index: false, follow: false } };

/** Private: read in the browser with the session cookie; inside Suspense because it reads the filters in the address. */
export default function MaintenancePage() {
  return (
    <Container className="max-w-7xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MaintenanceList />
      </Suspense>
    </Container>
  );
}
