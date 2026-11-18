import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactMerge } from "@/components/agent/contacts/contact-merge";
import { Container } from "@/components/ui/container";
import { contactLabels } from "@/lib/api/server/contact-labels";

export const metadata: Metadata = { title: "Merge contacts", robots: { index: false, follow: false } };

async function Flow() {
  return <ContactMerge labels={await contactLabels()} />;
}

export default function MergeContactsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <Flow />
      </Suspense>
    </Container>
  );
}
