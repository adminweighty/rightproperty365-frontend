import type { Metadata } from "next";
import { Suspense } from "react";
import { NewInvoiceView } from "@/components/admin/invoice-new";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "New renewal invoice", robots: { index: false, follow: false } };

export default function NewInvoicePage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <NewInvoiceView />
      </Suspense>
    </Container>
  );
}
