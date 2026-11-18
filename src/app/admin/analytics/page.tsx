import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAnalytics } from "@/components/analytics/admin-analytics";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "Analytics", robots: { index: false, follow: false } };

/** The figures are read in the browser with the administrator's session; country names come from the server. */
async function WithCountries() {
  const loaded = await load(getAllCountries);
  const countries = loaded.ok
    ? loaded.data
        .map(({ code, name }) => ({ value: code, label: name, keywords: [code] }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  return <AdminAnalytics countries={countries} />;
}

export default function AdminAnalyticsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithCountries />
      </Suspense>
    </Container>
  );
}
