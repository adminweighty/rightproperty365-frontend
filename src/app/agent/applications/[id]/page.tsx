import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceivedApplicationDetail } from "@/components/applications/received-applications";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/applications/[id]">;

export const metadata: Metadata = { title: "Application", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Read in the browser with the session cookie; each read of the answers is recorded by the API. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <ReceivedApplicationDetail id={id} />;
}

export default function AgentApplicationPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
