import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestInbox } from "@/components/agent/request-inbox";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Request inbox", robots: { index: false } };

/**
 * Labels for request types and contact methods come from the API's reference
 * data. If they cannot be loaded the inbox still works and shows the codes.
 */
async function InboxWithLabels() {
  const loaded = await load(getCatalogue);
  const sets = loaded.ok ? loaded.data.sets : undefined;
  return (
    <RequestInbox
      requestTypeLabels={sets ? toLabels(sets.request_types) : {}}
      contactMethodLabels={sets ? toLabels(sets.contact_methods) : {}}
    />
  );
}

export default function AgentRequestsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <InboxWithLabels />
      </Suspense>
    </Container>
  );
}
