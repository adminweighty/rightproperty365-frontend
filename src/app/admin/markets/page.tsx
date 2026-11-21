import type { Metadata } from "next";
import { Suspense } from "react";
import { Markets } from "@/components/admin/markets";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Countries", robots: { index: false, follow: false } };

// Read in the browser with the administrator's session; nothing is rendered on the server.
export default function MarketsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <Markets />
      </Suspense>
    </Container>
  );
}
