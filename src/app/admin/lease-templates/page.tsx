import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseTemplates } from "@/components/admin/lease-templates";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "Sample templates", robots: { index: false, follow: false } };

/** The templates are read in the browser with the administrator's session; the country names come from the server. */
async function WithCountries() {
  const loaded = await load(getAllCountries);
  const countries = loaded.ok ? loaded.data.map(({ code, name }) => ({ value: code, label: name })).sort((a, b) => a.label.localeCompare(b.label, "en-GB")) : [];
  return <LeaseTemplates countries={countries} />;
}

export default function LeaseTemplatesPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithCountries />
      </Suspense>
    </Container>
  );
}
