"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isProfessional } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";

/*
 * The organisation an application form or a received application belongs
 * to: `?org=` in the address, else the first organisation the person is a
 * member of, with an "Organisation" SearchableSelect when there are several
 * (as on the contact book and the team page). Forms and applications are
 * under `/v1/agent/organisations/{orgId}`, so a direct owner with no
 * organisation is told where they belong.
 */

/** OWNER and MANAGER design forms; an AGENT reads them (API 0.32.0). */
export const managesForms = (organisation: Pick<DashboardOrganisation, "role">) =>
  organisation.role === "OWNER" || organisation.role === "MANAGER";

/** The organisations that manage listings: the ones that can have forms and receive applications. */
async function loadOrganisations(): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  return { ok: true, status: 200, data: dashboard.data.organisations.filter((item) => item.can_manage_listings || item.role !== "STAFF") };
}

/** `path?org=…&extra`. Empty values are left out. */
export function withOrg(path: string, orgId: string, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams({ org: orgId });
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  return `${path}?${params}`;
}

type Props = {
  /** The page's own address, for the picker. */
  path: string;
  title?: string;
  intro?: ReactNode;
  back?: { href: string; label: string };
  empty: { title: string; body: ReactNode };
  children: (organisation: DashboardOrganisation) => ReactNode;
};

function Shell({ path, title, intro, back, empty, children }: Props) {
  const { state, reload } = useApi(loadOrganisations);
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("org");
  const organisations = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const organisation = organisations.find((item) => item.id === wanted) ?? organisations[0];

  return (
    <>
      <BackLink href={back?.href ?? "/dashboard"}>{back?.label ?? "Dashboard"}</BackLink>
      {title && <h1 className="mt-1 text-3xl md:text-4xl">{title}</h1>}
      {intro && <div className="mt-2 max-w-2xl text-muted">{intro}</div>}
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your organisations" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState
            title={empty.title}
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            {empty.body}
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id={`${path.replace(/\W+/g, "-")}-organisation`} label="Organisation" className="mb-4 max-w-md">
                <SearchableSelect
                  id={`${path.replace(/\W+/g, "-")}-organisation`}
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(withOrg(path, value), { scroll: false })}
                />
              </Field>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{organisation.name}</span> · you are the {organisation.role_label}
            </p>
            {/* key: nothing of one organisation stays on screen for another. */}
            <div key={organisation.id} className="mt-6">
              {children(organisation)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Signed in, a member of an organisation, and that organisation chosen. */
export function OrganisationShell(props: Props) {
  return <RequireAuth allow={isProfessional}>{() => <Shell {...props} />}</RequireAuth>;
}
