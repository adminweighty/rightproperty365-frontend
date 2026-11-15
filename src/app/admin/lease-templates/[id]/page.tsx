import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeaseTemplateEditor } from "@/components/admin/lease-template-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries } from "@/lib/api/server/reference";

type Props = PageProps<"/admin/lease-templates/[id]">;

export const metadata: Metadata = { title: "Lease template", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The template is read and saved in the browser with the administrator's session. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getAllCountries);
  const countries = loaded.ok ? loaded.data.map(({ code, name }) => ({ value: code, label: name, keywords: [code] })).sort((a, b) => a.label.localeCompare(b.label, "en-GB")) : [];
  return <LeaseTemplateEditor templateId={id} countries={countries} />;
}

export default function LeaseTemplatePage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
