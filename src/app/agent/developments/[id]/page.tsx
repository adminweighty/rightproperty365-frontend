import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevelopmentEditor } from "@/components/agent/developments/development-editor";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDevelopmentEditorLists } from "@/lib/api/server/listing-editor";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

type Props = PageProps<"/agent/developments/[id]">;

export const metadata: Metadata = { title: "Edit development project", robots: { index: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * The lists the editor chooses from (countries, cities, suburbs, amenities,
 * currencies) come from the API's reference data on the server. The project
 * itself is private: read and saved in the browser with the session cookie.
 */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(async () => {
    const [lists, catalogue] = await Promise.all([getDevelopmentEditorLists(), getCatalogue()]);
    return { lists, contactMethodLabels: toLabels(catalogue.sets.contact_methods) };
  });
  if (!loaded.ok) return <ErrorState title="We could not load the project editor." retryHref={`/agent/developments/${id}`} />;
  return <DevelopmentEditor developmentId={id} lists={loaded.data.lists} contactMethodLabels={loaded.data.contactMethodLabels} />;
}

export default function EditDevelopmentPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
