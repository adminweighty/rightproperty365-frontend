import type { Metadata } from "next";
import { Suspense } from "react";
import { Arrears } from "@/components/agent/property/arrears";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Arrears", robots: { index: false, follow: false } };

/** Private: read in the browser with the session cookie; inside Suspense because it reads the book in the address. */
export default function ArrearsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <Arrears />
      </Suspense>
    </Container>
  );
}
