"use client";

import { NoAccess, RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listOrganisationMembers, type OrganisationMember } from "@/lib/api/agent";
import type { ApiResult } from "@/lib/api/http";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import { isProfessional } from "@/lib/api/auth";
import { legal } from "@/lib/legal";

const statusTones: Record<string, "success" | "neutral" | "warning"> = {
  ACTIVE: "success",
  INVITED: "neutral",
  SUSPENDED: "warning",
};

type Team = {
  organisation: DashboardOrganisation;
  members: ApiResult<{ items: OrganisationMember[] }>;
};

/** The organisations whose members the caller may see (from the dashboard), each with its members. */
async function loadTeams(): Promise<ApiResult<Team[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  const organisations = dashboard.data.organisations.filter((organisation) => organisation.can_see_members);
  const teams = await Promise.all(
    organisations.map(async (organisation) => ({ organisation, members: await listOrganisationMembers(organisation.id) })),
  );
  return { ok: true, status: 200, data: teams };
}

function Teams() {
  // A module function is stable, so it is read once per visit (and again on "Try again").
  const { state, reload } = useApi(loadTeams);

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-4xl">Your team</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Everyone in your organisation and their role. Adding, changing and removing members is not available here yet;
        to change your team, email{" "}
        <a href={`mailto:${legal.emails.support}`} className="font-medium text-primary-ink underline underline-offset-2">
          {legal.emails.support}
        </a>
        .
      </p>

      <div className="mt-8">
        {state.status === "loading" && <LoadingBlock label="Loading your team" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.length === 0 && <NoAccess />}
        {state.status === "ready" && state.data.length > 0 && (
          <div className="space-y-10">
            {state.data.map(({ organisation, members }) => (
              <section key={organisation.id} aria-labelledby={`team-${organisation.id}`}>
                <h2 id={`team-${organisation.id}`} className="text-2xl">
                  {organisation.name}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  You are the {organisation.role_label} · {organisation.market_code}
                </p>
                <div className="mt-4">
                  {!members.ok ? (
                    <LoadError failure={members.failure} onRetry={reload} />
                  ) : members.data.items.length === 0 ? (
                    <EmptyState title="No members listed" />
                  ) : (
                    <Card padded={false}>
                      <p role="status" className="sr-only">
                        {members.data.items.length === 1 ? "1 member" : `${members.data.items.length} members`}
                      </p>
                      <ul className="divide-y divide-line">
                        {members.data.items.map((member) => (
                          <li key={member.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                            <span className="font-medium text-ink">
                              {member.name}
                              {member.is_you && <span className="font-normal text-muted"> (you)</span>}
                            </span>
                            <span className="text-sm text-muted">{member.role_label}</span>
                            <span className="flex items-center gap-2 sm:ml-auto">
                              <Badge tone="accent">{member.market_code}</Badge>
                              <Badge tone={statusTones[member.status] ?? "neutral"}>{member.status_label}</Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** `/agent/team`: read-only members of each organisation the caller owns or manages. */
export function TeamList() {
  return <RequireAuth allow={isProfessional}>{() => <Teams />}</RequireAuth>;
}
