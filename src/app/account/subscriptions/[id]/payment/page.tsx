import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PaymentReturn } from "@/components/account/payment-return";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/account/subscriptions/[id]/payment">;

export const metadata: Metadata = { title: "Your payment", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * Where the payment provider sends the browser back (API 0.42.0):
 * `?payment_id=…&result=returned|cancelled`. The page only reads the
 * subscription and its payments from the API; it never activates anything,
 * and the address is not trusted for anything, so it is safe to reload.
 */
async function Return({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PaymentReturn subscriptionId={id} />;
}

export default function PaymentReturnPage({ params }: Props) {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <Return params={params} />
      </Suspense>
    </Container>
  );
}
