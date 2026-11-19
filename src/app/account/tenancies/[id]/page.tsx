import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyTenancyDetail } from "@/components/account/my-tenancies";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/account/tenancies/[id]">;

export const metadata: Metadata = { title: "My tenancy", robots: { index: false, follow: false } };

/** Read in the browser with the session cookie; the server reads only the id. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  return <MyTenancyDetail id={id} />;
}

export default function MyTenancyPage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
