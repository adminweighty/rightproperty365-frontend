import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryList } from "@/components/agent/books/entry-list";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "Books", robots: { index: false, follow: false } };

/** The books are private: read in the browser with the session cookie. The server reads only the currencies. */
async function List() {
  const loaded = await load(getCurrencyOptions);
  return <EntryList currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function BooksPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <List />
      </Suspense>
    </Container>
  );
}
