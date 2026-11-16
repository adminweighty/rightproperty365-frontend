import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanEditor } from "@/components/admin/plan-editor";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "New subscription plan", robots: { index: false, follow: false } };

/** The plan is saved in the browser with the administrator's session; role names and currencies come from the server. */
async function Editor() {
  const [catalogue, currencies] = await Promise.all([load(getCatalogue), load(getCurrencyOptions)]);
  return (
    <PlanEditor
      roleLabels={catalogue.ok ? toLabels(catalogue.data.sets.account_roles) : {}}
      currencies={currencies.ok ? currencies.data : [{ value: "USD", label: "USD" }]}
    />
  );
}

export default function NewPlanPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor />
      </Suspense>
    </Container>
  );
}
