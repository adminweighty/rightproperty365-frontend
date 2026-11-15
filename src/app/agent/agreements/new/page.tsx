import type { Metadata } from "next";
import { Suspense } from "react";
import { NewAgreement } from "@/components/agreements/agreement-screen";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Send for signature", robots: { index: false, follow: false } };

// The draft is created and saved in the browser with the session cookie.
export default function NewAgreementPage() {
  return (
    <Container className="max-w-7xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <NewAgreement />
      </Suspense>
    </Container>
  );
}
