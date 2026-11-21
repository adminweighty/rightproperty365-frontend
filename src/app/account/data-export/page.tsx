import type { Metadata } from "next";
import { Suspense } from "react";
import { DataExport } from "@/components/account/data-export";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your data", robots: { index: false, follow: false } };

export default function DataExportPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <DataExport />
      </Suspense>
    </Container>
  );
}
