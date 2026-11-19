import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyNew } from "@/components/agent/property/property-new";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

export const metadata: Metadata = { title: "Add a property", robots: { index: false, follow: false } };

/** The countries come from the API's reference data on the server; the property is posted in the browser. */
async function Form() {
  const loaded = await load(getMarketOptions);
  return <PropertyNew markets={loaded.ok ? loaded.data : []} />;
}

export default function NewPropertyPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
