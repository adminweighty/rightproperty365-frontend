import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormEditor } from "@/components/forms/form-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

type Props = PageProps<"/agent/forms/[id]">;

export const metadata: Metadata = { title: "Application form", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The form is read and saved in the browser with the session cookie; the country names come from the server. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getAllCountries);
  const countries = loaded.ok
    ? loaded.data.map(({ code, name }) => ({ value: code, label: name, keywords: [code] })).sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  return <FormEditor formId={id} countries={countries} />;
}

export default function AgentFormPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
