import type { Metadata } from "next";
import { Suspense } from "react";
import { MyInvoices } from "@/components/account/my-invoices";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your invoices", robots: { index: false, follow: false } };

export default function MyInvoicesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MyInvoices />
      </Suspense>
    </Container>
  );
}
