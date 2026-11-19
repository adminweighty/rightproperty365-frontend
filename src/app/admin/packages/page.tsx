import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageList } from "@/components/admin/package-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Listing packages", robots: { index: false, follow: false } };

/** The packages are read in the browser with the administrator's session. */
export default function PackagesPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <PackageList />
      </Suspense>
    </Container>
  );
}
