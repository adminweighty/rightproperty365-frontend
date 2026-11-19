import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyDetail } from "@/components/agent/property/property-detail";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getMarketOptions } from "@/lib/api/server/markets";

type Props = PageProps<"/agent/properties/[id]">;

export const metadata: Metadata = { title: "Property", robots: { index: false, follow: false } };

/** The property is private: read and changed in the browser with the session cookie. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const loaded = await load(getMarketOptions);
  return <PropertyDetail id={id} markets={loaded.ok ? loaded.data : []} />;
}

export default function PropertyPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
