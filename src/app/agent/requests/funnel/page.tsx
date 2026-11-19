import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadFunnel } from "@/components/agent/lead-funnel";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Lead conversion", robots: { index: false, follow: false } };

/**
 * Request type labels and country names come from the API's reference data;
 * without them the page still works with the API's own labels. The figures
 * are read in the browser with the session cookie.
 */
async function WithReference() {
  const [catalogue, countries] = await Promise.all([load(getCatalogue), load(getAllCountries)]);
  const sets = catalogue.ok ? catalogue.data.sets : undefined;
  return (
    <LeadFunnel
      requestTypeLabels={sets ? toLabels(sets.request_types) : {}}
      countries={
        countries.ok
          ? countries.data
              .map(({ code, name }) => ({ value: code, label: name, keywords: [code] }))
              .sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
          : []
      }
    />
  );
}

export default function LeadFunnelPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithReference />
      </Suspense>
    </Container>
  );
}
