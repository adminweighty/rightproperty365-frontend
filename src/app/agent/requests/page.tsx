import type { Metadata } from "next";
import { RequestInbox } from "@/components/agent/request-inbox";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Request inbox", robots: { index: false } };

export default function AgentRequestsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <RequestInbox />
    </Container>
  );
}
