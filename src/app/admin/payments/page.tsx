import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentList } from "@/components/admin/payment-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Online payments", robots: { index: false, follow: false } };

/** The payments are read in the browser with the administrator's session (API 0.42.0). */
export default function PaymentsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <PaymentList />
      </Suspense>
    </Container>
  );
}
