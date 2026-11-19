import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityNav } from "@/components/account/activity-nav";
import { MyTenancies } from "@/components/account/my-tenancies";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "My tenancy", robots: { index: false, follow: false } };

/** Read in the browser with the session cookie. */
export default function MyTenanciesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="tenancies" className="mb-6" />
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MyTenancies />
      </Suspense>
    </Container>
  );
}
