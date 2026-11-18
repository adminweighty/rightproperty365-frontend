import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyApplicationDetail } from "@/components/applications/my-applications";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/account/applications/[id]">;

export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Read in the browser with the session cookie; the server reads only the id. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <MyApplicationDetail id={id} />;
}

export default function MyApplicationPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
