import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; nothing private is rendered on the server.
export default function DashboardPage() {
  return (
    <Container className="py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <DashboardHome />
      </Suspense>
    </Container>
  );
}
