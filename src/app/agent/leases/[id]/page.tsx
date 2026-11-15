import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeaseEditor } from "@/components/leases/lease-editor";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

type Props = PageProps<"/agent/leases/[id]">;

export const metadata: Metadata = { title: "Lease", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The lease is private: it is read and saved in the browser. The currencies come from the server. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getCurrencyOptions);
  return <LeaseEditor leaseId={id} currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function LeasePage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
