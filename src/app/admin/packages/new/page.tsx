import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageEditor } from "@/components/admin/package-editor";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getPackageMarketOptions } from "@/lib/api/server/packages";

export const metadata: Metadata = { title: "New listing package", robots: { index: false, follow: false } };

/** The package is saved in the browser with the administrator's session; the countries and currencies come from the server. */
async function Editor() {
  const markets = await load(getPackageMarketOptions);
  return <PackageEditor markets={markets.ok ? markets.data : []} />;
}

export default function NewPackagePage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor />
      </Suspense>
    </Container>
  );
}
