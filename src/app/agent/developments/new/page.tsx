import type { Metadata } from "next";
import { Suspense } from "react";
import { NewDevelopment } from "@/components/agent/developments/new-development";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDevelopmentEditorLists } from "@/lib/api/server/listing-editor";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "New development project", robots: { index: false } };

/** The countries come from the API's reference data on the server; the project is created in the browser. */
async function Form() {
  const loaded = await load(getDevelopmentEditorLists);
  if (!loaded.ok) return <ErrorState title="We could not load the project form." retryHref="/agent/developments/new" />;
  return <NewDevelopment lists={loaded.data} />;
}

export default function NewDevelopmentPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
