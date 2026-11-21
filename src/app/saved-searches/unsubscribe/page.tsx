import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeSavedSearch } from "@/components/saved-searches/unsubscribe";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Stop search alerts", robots: { index: false, follow: false } };

export default function UnsubscribePage() {
  return (
    <Container className="py-14">
      <Suspense fallback={<p className="text-muted">Switching the alerts off…</p>}>
        <UnsubscribeSavedSearch />
      </Suspense>
    </Container>
  );
}
