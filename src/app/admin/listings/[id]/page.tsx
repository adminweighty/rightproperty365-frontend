import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingReview } from "@/components/admin/listing-review";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getListingEditorLists } from "@/lib/api/server/listing-editor";
import { load } from "@/lib/api/server/load";

type Props = PageProps<"/admin/listings/[id]">;

export const metadata: Metadata = { title: "Listing review", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * The labels of codes (types, places, features) come from the API's
 * reference data on the server; the listing is read in the browser with the
 * administrator's session.
 */
async function Review({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getListingEditorLists);
  if (!loaded.ok) return <ErrorState title="We could not load this review." retryHref={`/admin/listings/${id}`} />;
  return <ListingReview listingId={id} lists={loaded.data} />;
}

export default function ListingReviewPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Review params={params} />
      </Suspense>
    </Container>
  );
}
