import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityNav } from "@/components/account/activity-nav";
import { MyApplications } from "@/components/applications/my-applications";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your applications", robots: { index: false, follow: false } };

/** Read in the browser with the session cookie. */
export default function MyApplicationsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="applications" className="mb-6" />
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <MyApplications />
      </Suspense>
    </Container>
  );
}
