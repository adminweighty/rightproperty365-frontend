import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactNew } from "@/components/agent/contacts/contact-new";
import { Container } from "@/components/ui/container";
import { contactLabels } from "@/lib/api/server/contact-labels";

export const metadata: Metadata = { title: "Add a contact", robots: { index: false, follow: false } };

async function Form() {
  return <ContactNew labels={await contactLabels()} />;
}

export default function NewContactPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
