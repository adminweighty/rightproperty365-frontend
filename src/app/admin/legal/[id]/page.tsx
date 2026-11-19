import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LegalEditor } from "@/components/admin/legal-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

type Props = PageProps<"/admin/legal/[id]">;

export const metadata: Metadata = { title: "Legal document version", robots: { index: false, follow: false } };

const ID = /^[0-9a-z-]{1,64}$/i;

/** The version is read and saved in the browser with the administrator's session. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const markets = await load(getMarketOptions);
  return <LegalEditor versionId={id} markets={markets.ok ? markets.data : []} />;
}

export default function LegalVersionPage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
