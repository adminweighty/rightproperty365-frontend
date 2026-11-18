import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryDetail } from "@/components/agent/books/entry-detail";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

type Props = PageProps<"/agent/books/[id]">;

export const metadata: Metadata = { title: "Entry", robots: { index: false, follow: false } };

/** The entry is private: read and changed in the browser with the session cookie. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const loaded = await load(getCurrencyOptions);
  return <EntryDetail id={id} currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function EntryPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}
