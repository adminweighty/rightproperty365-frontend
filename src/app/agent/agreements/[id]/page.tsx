import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgreementScreen } from "@/components/agreements/agreement-screen";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/agent/agreements/[id]">;

export const metadata: Metadata = { title: "Agreement", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The agreement is private: it is read in the browser with the session cookie. */
async function Screen({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <AgreementScreen id={id} />;
}

export default function AgreementPage({ params }: Props) {
  return (
    <Container className="max-w-7xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Screen params={params} />
      </Suspense>
    </Container>
  );
}
