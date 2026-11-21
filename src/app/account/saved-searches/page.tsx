import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedSearches } from "@/components/saved-searches/saved-searches";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false, follow: false } };

export default function SavedSearchesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <SavedSearches />
      </Suspense>
    </Container>
  );
}
