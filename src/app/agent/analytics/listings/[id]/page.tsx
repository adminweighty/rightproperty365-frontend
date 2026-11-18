import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingAnalytics } from "@/components/analytics/agent-analytics";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/analytics/listings/[id]">;

export const metadata: Metadata = { title: "Listing analytics", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function Report({ params }: Pick<Props, "params">) {
  const { id } = await params;
  // An id the API would refuse outright is not a listing.
  if (!UUID.test(id)) notFound();
  return <ListingAnalytics listingId={id} />;
}

// The figures are read in the browser with the session cookie.
export default function ListingAnalyticsPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <Report params={params} />
      </Suspense>
    </Container>
  );
}
