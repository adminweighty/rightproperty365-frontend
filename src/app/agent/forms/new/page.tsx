import type { Metadata } from "next";
import { Suspense } from "react";
import { NewFormPage } from "@/components/forms/form-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "New application form", robots: { index: false, follow: false } };

/** The form is created in the browser with the session cookie; the country names come from the server. */
async function WithCountries() {
  const loaded = await load(getAllCountries);
  const countries = loaded.ok
    ? loaded.data.map(({ code, name }) => ({ value: code, label: name, keywords: [code] })).sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  return <NewFormPage countries={countries} />;
}

export default function NewAgentFormPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithCountries />
      </Suspense>
    </Container>
  );
}
