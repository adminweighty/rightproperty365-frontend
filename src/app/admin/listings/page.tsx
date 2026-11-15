import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingQueue } from "@/components/admin/listing-queue";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "Listing reviews", robots: { index: false, follow: false } };

/**
 * The queue is read in the browser with the administrator's session. Only the
 * country filter's options come from the server; without them the filter
 * lists no countries and the queue still works.
 */
async function QueueWithCountries() {
  const loaded = await load(getAllCountries);
  const countries = loaded.ok
    ? loaded.data.map(({ code, name }) => ({ value: code, label: name })).sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  return <ListingQueue countries={countries} />;
}

export default function ListingReviewsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <QueueWithCountries />
      </Suspense>
    </Container>
  );
}
