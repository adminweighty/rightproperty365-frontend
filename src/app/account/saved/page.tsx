import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityNav } from "@/components/account/activity-nav";
import { SavedListings, SavedListingsSkeleton } from "@/components/account/saved-listings";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Saved properties", robots: { index: false, follow: false } };

/**
 * The list is read in the browser with the session cookie; the server adds
 * only the public price-period labels ("per month"). Without them a period
 * is shown as "per month" made from its code.
 */
async function ListWithLabels() {
  const loaded = await load(getCatalogue);
  return <SavedListings periods={loaded.ok ? toLabels(loaded.data.sets.price_periods) : {}} />;
}

export default function SavedPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="saved" className="mb-6" />
      <Suspense fallback={<SavedListingsSkeleton />}>
        <ListWithLabels />
      </Suspense>
    </Container>
  );
}
