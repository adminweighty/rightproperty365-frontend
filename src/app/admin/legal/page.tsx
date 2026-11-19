import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalList } from "@/components/admin/legal-list";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

export const metadata: Metadata = { title: "Legal documents", robots: { index: false, follow: false } };

/** The versions are read in the browser with the administrator's session; the country names come from the server. */
async function WithMarkets() {
  const markets = await load(getMarketOptions);
  return <LegalList markets={markets.ok ? markets.data : []} />;
}

export default function LegalDocumentsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithMarkets />
      </Suspense>
    </Container>
  );
}
