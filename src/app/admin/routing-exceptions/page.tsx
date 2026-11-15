import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutingExceptions } from "@/components/admin/routing-exceptions";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Requests nobody could receive", robots: { index: false, follow: false } };

// Read in the browser with the administrator's session; nothing is rendered on the server.
export default function RoutingExceptionsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <RoutingExceptions />
      </Suspense>
    </Container>
  );
}
