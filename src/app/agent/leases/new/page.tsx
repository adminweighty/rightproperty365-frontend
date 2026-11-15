import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseEditor } from "@/components/leases/lease-editor";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "New lease", robots: { index: false, follow: false } };

/** The currencies come from the API's reference data on the server; the lease is saved in the browser. */
async function Editor() {
  const loaded = await load(getCurrencyOptions);
  return <LeaseEditor leaseId={null} currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function NewLeasePage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor />
      </Suspense>
    </Container>
  );
}
