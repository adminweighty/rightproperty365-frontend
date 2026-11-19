import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackageEditor } from "@/components/admin/package-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getPackageMarketOptions } from "@/lib/api/server/packages";

type Props = PageProps<"/admin/packages/[id]">;

export const metadata: Metadata = { title: "Listing package", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The package is read and saved in the browser with the administrator's session. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const markets = await load(getPackageMarketOptions);
  return <PackageEditor packageId={id} markets={markets.ok ? markets.data : []} />;
}

export default function PackagePage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
