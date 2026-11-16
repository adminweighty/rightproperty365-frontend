import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanList } from "@/components/admin/plan-list";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Subscription plans", robots: { index: false, follow: false } };

/** The plans are read in the browser with the administrator's session; the role names come from the server. */
async function WithRoles() {
  const loaded = await load(getCatalogue);
  return <PlanList roleLabels={loaded.ok ? toLabels(loaded.data.sets.account_roles) : {}} />;
}

export default function SubscriptionPlansPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithRoles />
      </Suspense>
    </Container>
  );
}
