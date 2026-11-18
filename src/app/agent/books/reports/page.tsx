import type { Metadata } from "next";
import { Suspense } from "react";
import { BooksReports } from "@/components/agent/books/reports";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = { title: "Books reports", robots: { index: false, follow: false } };

/** The reports are private: read in the browser with the session cookie. */
async function Reports() {
  const loaded = await load(getCurrencyOptions);
  return <BooksReports currencies={loaded.ok ? loaded.data : [{ value: "USD", label: "USD" }]} />;
}

export default function BooksReportsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Reports />
      </Suspense>
    </Container>
  );
}
