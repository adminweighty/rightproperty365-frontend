import type { Metadata } from "next";
import { Suspense } from "react";
import { AgreementManage } from "@/components/agreements/agreement-manage";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Agreements", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; nothing is rendered on the server.
export default function AgreementsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AgreementManage />
      </Suspense>
    </Container>
  );
}
