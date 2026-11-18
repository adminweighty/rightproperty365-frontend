import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContactDetail } from "@/components/agent/contacts/contact-detail";
import { Container } from "@/components/ui/container";
import { contactLabels } from "@/lib/api/server/contact-labels";
import { isUuid } from "@/lib/contacts";

type Props = PageProps<"/agent/contacts/[id]">;

export const metadata: Metadata = { title: "Contact", robots: { index: false, follow: false } };

/** The contact is private: read and changed in the browser with the session cookie. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <ContactDetail id={id} labels={await contactLabels()} />;
}

export default function ContactPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
