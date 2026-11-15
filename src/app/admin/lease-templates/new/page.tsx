import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseTemplateEditor } from "@/components/admin/lease-template-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "New lease template", robots: { index: false, follow: false } };

async function Editor() {
  const loaded = await load(getAllCountries);
  const countries = loaded.ok ? loaded.data.map(({ code, name }) => ({ value: code, label: name, keywords: [code] })).sort((a, b) => a.label.localeCompare(b.label, "en-GB")) : [];
  return <LeaseTemplateEditor templateId={null} countries={countries} />;
}

export default function NewLeaseTemplatePage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor />
      </Suspense>
    </Container>
  );
}
