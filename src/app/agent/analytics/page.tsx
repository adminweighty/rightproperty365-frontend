import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentAnalytics } from "@/components/analytics/agent-analytics";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Analytics", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; nothing personal is rendered on the server.
export default function AgentAnalyticsPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AgentAnalytics />
      </Suspense>
    </Container>
  );
}
