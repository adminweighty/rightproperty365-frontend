import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanEditor } from "@/components/admin/plan-editor";
import { Container } from "@/components/ui/container";
import { getCurrencyOptions } from "@/lib/api/server/currencies";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

type Props = PageProps<"/admin/subscription-plans/[id]">;

export const metadata: Metadata = { title: "Subscription plan", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The plan is read and saved in the browser with the administrator's session. */
async function Editor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [catalogue, currencies] = await Promise.all([load(getCatalogue), load(getCurrencyOptions)]);
  return (
    <PlanEditor
      planId={id}
      roleLabels={catalogue.ok ? toLabels(catalogue.data.sets.account_roles) : {}}
      currencies={currencies.ok ? currencies.data : [{ value: "USD", label: "USD" }]}
    />
  );
}

export default function PlanPage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
