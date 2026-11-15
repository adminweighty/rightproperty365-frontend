import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamList } from "@/components/agent/team-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your team", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; nothing is rendered on the server.
export default function TeamPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <TeamList />
      </Suspense>
    </Container>
  );
}
