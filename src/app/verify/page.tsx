import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyForm } from "@/components/signing/verify-form";
import { Container } from "@/components/ui/container";

const title = "Check a signed document";
const description =
  "Check that a document signed on RightProperty365 is complete and unchanged: enter its reference or upload the PDF. No names or documents are shown.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/verify" },
  openGraph: { type: "website", title, description, url: "/verify", images: ["/opengraph-image"] },
};

/** Public: the check runs in the browser against the API; nothing about a document is rendered on the server. */
export default function VerifyPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <div className="rule-brand w-12" aria-hidden="true" />
      <h1 className="mt-4 text-3xl md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        Every document completed on RightProperty365 ends with an audit report and has a recorded SHA-256 fingerprint.
        Check that a copy you were given is the completed one, unchanged. Signed electronically on RightProperty365: whether
        a document needs witnessing, stamping or registration depends on the country, and is not provided here.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-48 rounded-lg bg-sunken" aria-busy="true" />}>
          <VerifyForm />
        </Suspense>
      </div>
    </Container>
  );
}
