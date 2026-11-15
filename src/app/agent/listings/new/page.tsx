import type { Metadata } from "next";
import { Suspense } from "react";
import { NewListing } from "@/components/agent/new-listing";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getListingEditorLists } from "@/lib/api/server/listing-editor";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "Add a listing", robots: { index: false } };

/** The countries come from the API on the server; the draft is created in the browser with the session cookie. */
async function Form() {
  const loaded = await load(getListingEditorLists);
  if (!loaded.ok) return <ErrorState title="We could not load this form." retryHref="/agent/listings/new" />;
  return <NewListing countries={loaded.data.countries} />;
}

export default function NewListingPage() {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
