import type { Metadata } from "next";
import { Suspense } from "react";
import { TaxRuleEditor } from "@/components/admin/tax-rule-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

export const metadata: Metadata = { title: "New tax rule", robots: { index: false, follow: false } };

/** The rule is saved in the browser with the administrator's session; the country names come from the server. */
async function Editor() {
  const markets = await load(getMarketOptions);
  return <TaxRuleEditor markets={markets.ok ? markets.data : []} />;
}

export default function NewTaxRulePage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor />
      </Suspense>
    </Container>
  );
}
