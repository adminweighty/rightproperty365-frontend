import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyInvoiceDetail } from "@/components/account/my-invoices";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/account/invoices/[id]">;

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Read in the browser with the session cookie. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <MyInvoiceDetail id={id} />;
}

export default function MyInvoicePage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
