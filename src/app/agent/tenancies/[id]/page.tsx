import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TenancyDetail } from "@/components/agent/property/tenancy-detail";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/tenancies/[id]">;

export const metadata: Metadata = { title: "Tenancy", robots: { index: false, follow: false } };

/** The tenancy is private: read and changed in the browser with the session cookie; the server reads only the id. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  return <TenancyDetail id={id} />;
}

export default function TenancyPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
