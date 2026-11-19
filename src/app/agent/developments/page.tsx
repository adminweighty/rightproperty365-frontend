import type { Metadata } from "next";
import { Suspense } from "react";
import { DevelopmentList } from "@/components/agent/developments/development-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Development projects", robots: { index: false } };

/** The organisation's projects are private: read in the browser with the session cookie. */
export default function AgentDevelopmentsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <DevelopmentList />
      </Suspense>
    </Container>
  );
}
