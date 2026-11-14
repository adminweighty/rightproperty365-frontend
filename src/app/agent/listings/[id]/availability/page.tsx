import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityEditor } from "@/components/agent/availability-editor";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/listings/[id]/availability">;

export const metadata: Metadata = { title: "Availability", robots: { index: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * The calendar is private: it is read and changed in the browser with the
 * session cookie. The server only reads the listing's id from the address.
 */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  // An id the API would refuse outright is not a listing.
  if (!UUID.test(id)) notFound();
  return <AvailabilityEditor listingId={id} />;
}

export default function ListingAvailabilityPage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
