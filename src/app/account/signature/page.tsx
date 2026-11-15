import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { MySignature } from "@/components/signing/my-signing";

export const metadata: Metadata = { title: "Your signature", robots: { index: false, follow: false } };

// Read and saved in the browser with the session cookie.
export default function SignaturePage() {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MySignature />
      </Suspense>
    </Container>
  );
}
