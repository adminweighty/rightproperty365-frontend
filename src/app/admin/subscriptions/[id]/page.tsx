import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubscriptionDetailView } from "@/components/admin/subscription-detail";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/admin/subscriptions/[id]">;

export const metadata: Metadata = { title: "Subscription", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The subscription is read and decided in the browser with the administrator's session. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <SubscriptionDetailView subscriptionId={id} />;
}

export default function SubscriptionPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
