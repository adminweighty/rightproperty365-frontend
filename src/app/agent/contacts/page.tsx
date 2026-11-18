import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactList } from "@/components/agent/contacts/contact-list";
import { Container } from "@/components/ui/container";
import { contactLabels } from "@/lib/api/server/contact-labels";

export const metadata: Metadata = { title: "Contacts", robots: { index: false, follow: false } };

/** The contacts are private: read in the browser with the session cookie. The server reads only the public labels. */
async function List() {
  return <ContactList labels={await contactLabels()} />;
}

export default function ContactsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <List />
      </Suspense>
    </Container>
  );
}
