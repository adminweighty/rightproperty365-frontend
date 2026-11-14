import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOverview } from "@/components/auth/account-overview";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

/**
 * Role and organisation-kind labels come from the API's reference data. If
 * they cannot be loaded the account page still works and shows each one by a
 * title made from its code.
 */
async function AccountWithLabels() {
  const loaded = await load(getCatalogue);
  const sets = loaded.ok ? loaded.data.sets : undefined;
  return (
    <AccountOverview
      roleLabels={sets ? toLabels(sets.account_roles) : {}}
      organisationKindLabels={sets ? toLabels(sets.organisation_kinds ?? []) : {}}
    />
  );
}

export default function AccountPage() {
  return (
    <Container className="py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AccountWithLabels />
      </Suspense>
    </Container>
  );
}
