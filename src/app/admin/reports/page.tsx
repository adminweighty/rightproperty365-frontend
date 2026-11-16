import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminReports } from "@/components/admin/reports";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Reports", robots: { index: false, follow: false } };

/** The figures are read in the browser with the administrator's session; country names and role labels come from the server. */
async function WithOptions() {
  const [countries, catalogue] = await Promise.all([load(getAllCountries), load(getCatalogue)]);
  const markets = countries.ok
    ? countries.data
        .map(({ code, name }) => ({ value: code, label: name, keywords: [code] }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  const roleLabels = catalogue.ok ? toLabels(catalogue.data.sets.account_roles) : {};
  return <AdminReports countries={markets} roleLabels={roleLabels} />;
}

export default function ReportsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithOptions />
      </Suspense>
    </Container>
  );
}
