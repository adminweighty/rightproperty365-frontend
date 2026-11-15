import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyRequestDetail } from "@/components/requests/my-requests";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

type Props = PageProps<"/account/requests/[id]">;

export const metadata: Metadata = { title: "Your request", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Read in the browser with the session cookie; the server reads the id and the public labels. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getCatalogue);
  const sets = loaded.ok ? loaded.data.sets : undefined;
  return (
    <MyRequestDetail
      id={id}
      requestTypeLabels={sets ? toLabels(sets.request_types) : {}}
      contactMethodLabels={sets ? toLabels(sets.contact_methods) : {}}
    />
  );
}

export default function MyRequestPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
