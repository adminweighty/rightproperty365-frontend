import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestDetail } from "@/components/agent/maintenance/request-detail";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/maintenance/[id]">;

export const metadata: Metadata = { title: "Maintenance request", robots: { index: false, follow: false } };

/** The request is private: read and changed in the browser with the session cookie; the server reads only the id. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  return <RequestDetail id={id} />;
}

export default function MaintenanceRequestPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
