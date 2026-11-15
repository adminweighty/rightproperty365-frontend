import type { Metadata } from "next";
import { Suspense } from "react";
import { MyRequests } from "@/components/requests/my-requests";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Your requests", robots: { index: false, follow: false } };

/** The list is read in the browser with the session cookie; the server adds the request-type labels. */
async function ListWithLabels() {
  const loaded = await load(getCatalogue);
  return <MyRequests requestTypeLabels={loaded.ok ? toLabels(loaded.data.sets.request_types) : {}} />;
}

export default function MyRequestsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ListWithLabels />
      </Suspense>
    </Container>
  );
}
