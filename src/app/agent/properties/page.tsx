import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyList } from "@/components/agent/property/property-list";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

export const metadata: Metadata = { title: "Properties", robots: { index: false, follow: false } };

/** Private: read in the browser with the session cookie. The server reads only the country names. */
async function List() {
  const loaded = await load(getMarketOptions);
  return <PropertyList markets={loaded.ok ? loaded.data : []} />;
}

export default function PropertiesPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <List />
      </Suspense>
    </Container>
  );
}
