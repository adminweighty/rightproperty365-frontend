import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingManager } from "@/components/agent/listing-manager";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Your listings", robots: { index: false } };

/**
 * What a price is charged per ("per night") is labelled from the API's
 * reference data. If it cannot be loaded the list still works. The listings
 * themselves are private and are read in the browser with the session cookie;
 * the status tab and page are in the address (`?status=DRAFT&page=2`).
 */
async function ListingsWithLabels() {
  const loaded = await load(getCatalogue);
  return <ListingManager periods={loaded.ok ? toLabels(loaded.data.sets.price_periods) : {}} />;
}

export default function AgentListingsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ListingsWithLabels />
      </Suspense>
    </Container>
  );
}
