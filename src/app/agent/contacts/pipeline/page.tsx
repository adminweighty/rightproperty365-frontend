import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactPipeline } from "@/components/agent/contacts/contact-pipeline";
import { Container } from "@/components/ui/container";
import { contactLabels } from "@/lib/api/server/contact-labels";

export const metadata: Metadata = { title: "Contact pipeline", robots: { index: false, follow: false } };

async function Board() {
  return <ContactPipeline labels={await contactLabels()} />;
}

export default function ContactPipelinePage() {
  return (
    <Container className="max-w-7xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Board />
      </Suspense>
    </Container>
  );
}
