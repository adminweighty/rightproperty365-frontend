import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MySigningRequests } from "@/components/signing/my-signing";

export const metadata: Metadata = { title: "Documents to sign", robots: { index: false, follow: false } };

// The list is read in the browser with the session cookie; nothing is rendered on the server.
export default function SigningRequestsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MySigningRequests />
      </Suspense>
    </Container>
  );
}
