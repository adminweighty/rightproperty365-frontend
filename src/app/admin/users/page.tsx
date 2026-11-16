import type { Metadata } from "next";
import { Suspense } from "react";
import { UserList } from "@/components/admin/user-list";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue } from "@/lib/api/server/reference";

export const metadata: Metadata = { title: "Accounts", robots: { index: false, follow: false } };

/**
 * The accounts are read in the browser with the administrator's session. Only
 * the filter options (roles and countries) come from the server; without them
 * the filters offer fewer choices and the list still works.
 */
async function WithOptions() {
  const [catalogue, countries] = await Promise.all([load(getCatalogue), load(getAllCountries)]);
  const roles = catalogue.ok ? catalogue.data.sets.account_roles.map(({ code, label }) => ({ value: code, label })) : [];
  const markets = countries.ok
    ? countries.data
        .map(({ code, name }) => ({ value: code, label: name, keywords: [code] }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  return <UserList roles={roles} countries={markets} />;
}

export default function UsersPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <WithOptions />
      </Suspense>
    </Container>
  );
}
