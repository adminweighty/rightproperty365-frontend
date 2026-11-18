import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactImport } from "@/components/agent/contacts/contact-import";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Import contacts", robots: { index: false, follow: false } };

// Read and sent in the browser with the session cookie; nothing is rendered on the server.
export default function ImportContactsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ContactImport />
      </Suspense>
    </Container>
  );
}
