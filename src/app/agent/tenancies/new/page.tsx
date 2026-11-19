import type { Metadata } from "next";
import { Suspense } from "react";
import { TenancyNew } from "@/components/agent/property/tenancy-new";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "Start a tenancy", robots: { index: false, follow: false } };

/** The currencies come from the API's reference data on the server; the tenancy is posted in the browser. */
async function Form() {
  const loaded = await load(getCurrencyOptions);
  return <TenancyNew currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function NewTenancyPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form />
      </Suspense>
    </Container>
  );
}
