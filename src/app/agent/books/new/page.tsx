import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryNew } from "@/components/agent/books/entry-new";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "Record in your books", robots: { index: false, follow: false } };

/** The currencies come from the API's reference data on the server; the entry is posted in the browser. */
async function Form() {
  const loaded = await load(getCurrencyOptions);
  return <EntryNew currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function NewEntryPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
