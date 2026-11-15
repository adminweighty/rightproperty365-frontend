import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingEditor } from "@/components/agent/listing-editor";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getListingEditorLists } from "@/lib/api/server/listing-editor";
import { load } from "@/lib/api/server/load";

type Props = PageProps<"/agent/listings/[id]">;

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * The lists every drop-down chooses from come from the API's reference data
 * on the server. The listing itself is private: it is read and saved in the
 * browser with the session cookie.
 */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  // An id the API would refuse outright is not a listing.
  if (!UUID.test(id)) notFound();
  const loaded = await load(getListingEditorLists);
  if (!loaded.ok) return <ErrorState title="We could not load the listing editor." retryHref={`/agent/listings/${id}`} />;
  return <ListingEditor listingId={id} lists={loaded.data} />;
}

export default function EditListingPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
