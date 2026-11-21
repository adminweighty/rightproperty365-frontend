"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Activity } from "@/components/agent/team/activity";
import { Branches } from "@/components/agent/team/branches";
import { InviteForm, Invitations } from "@/components/agent/team/invitations";
import { JoinRequests } from "@/components/agent/team/join-requests";
import { Members } from "@/components/agent/team/members";
import { invitableRoles, roleTitles } from "@/components/agent/team/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isProfessional } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { listJoinRequests, listTeamInvitations, listTeamMembers, type TeamMember } from "@/lib/api/team";
import { pageFrom } from "@/lib/request-filters";

const PATH = "/agent/team";

/** The organisations whose team the caller manages (OWNER and MANAGER), from the dashboard. */
async function loadOrganisations(): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  const organisations = dashboard.data.organisations.filter(
    (organisation) => organisation.can_manage_team ?? organisation.can_see_members,
  );
  return { ok: true, status: 200, data: organisations };
}

type View = "team" | "activity";

function teamHref(organisationId: string | undefined, view: View, page = 1) {
  const search = new URLSearchParams();
  if (organisationId) search.set("org", organisationId);
  if (view === "activity") search.set("view", "activity");
  if (view === "activity" && page > 1) search.set("page", String(page));
  const text = search.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** Members, requests to join, the invite form and pending invitations of one organisation. */
function TeamView({ organisation }: { organisation: DashboardOrganisation }) {
  const id = organisation.id;
  const loadMembers = useCallback(() => listTeamMembers(id), [id]);
  const loadInvitations = useCallback(() => listTeamInvitations(id), [id]);
  const loadJoinRequests = useCallback(() => listJoinRequests(id), [id]);
  const members = useApi(loadMembers);
  const invitations = useApi(loadInvitations);
  const joinRequests = useApi(loadJoinRequests);

  const memberItems = members.state.status === "ready" ? members.state.data.items : undefined;
  const invitationItems = invitations.state.status === "ready" ? invitations.state.data.items : undefined;
  const titles = roleTitles(organisation.kind, memberItems, invitationItems);
  const roles = invitableRoles(organisation.role);

  // The members are read first: a 403 there means the caller no longer manages this team.
  if (members.state.status === "error") return <LoadError failure={members.state.failure} onRetry={members.reload} />;
  if (members.state.status === "loading" && !members.state.previous) return <LoadingBlock label="Loading your team" rows={3} />;

  const data = members.state.status === "ready" ? members.state.data : members.state.previous!;
  const replaceMember = (member: TeamMember) =>
    members.replace({ ...data, items: data.items.map((item) => (item.user_id === member.user_id ? member : item)) });

  return (
    <div className="space-y-12">
      <Members
        organisationId={id}
        members={data.items}
        titles={titles}
        onChanged={replaceMember}
        onReload={members.reload}
      />

      {organisation.can_manage_team && <Branches organisationId={id} members={data.items} />}

      <div>
        {joinRequests.state.status === "loading" && <LoadingBlock label="Loading requests to join" rows={1} />}
        {joinRequests.state.status === "error" && (
          <LoadError failure={joinRequests.state.failure} onRetry={joinRequests.reload} />
        )}
        {joinRequests.state.status === "ready" && (
          <JoinRequests
            organisationId={id}
            requests={joinRequests.state.data.items}
            onDecided={(approved) => {
              joinRequests.reload();
              if (approved) members.reload();
            }}
          />
        )}
      </div>

      {roles.length > 0 && (
        <InviteForm organisationId={id} roles={roles} titles={titles} onInvited={invitations.reload} />
      )}

      <div>
        {invitations.state.status === "loading" && <LoadingBlock label="Loading invitations" rows={1} />}
        {invitations.state.status === "error" && (
          <LoadError failure={invitations.state.failure} onRetry={invitations.reload} />
        )}
        {invitations.state.status === "ready" && (
          <Invitations organisationId={id} invitations={invitations.state.data.items} onReload={invitations.reload} />
        )}
      </div>
    </div>
  );
}

function Teams() {
  // A module function is stable, so it is read once per visit (and again on "Try again").
  const { state, reload } = useApi(loadOrganisations);
  const params = useSearchParams();
  const router = useRouter();
  const view: View = params.get("view") === "activity" ? "activity" : "team";
  const page = pageFrom(params.get("page"));
  const wanted = params.get("org");

  const organisations = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const organisation = organisations.find((item) => item.id === wanted) ?? organisations[0];

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-4xl">Your team</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Invite people, decide who joins, change roles, and suspend or remove members. Every change is kept in the
        activity log.
      </p>

      <div className="mt-8">
        {state.status === "loading" && <LoadingBlock label="Loading your team" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState
            title="Only the people who run a team can manage it"
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            The Agency Principal and Agency Administrators invite people and change the team. Ask one of them if
            something about your membership needs to change.
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id="team-organisation" label="Organisation" className="mb-6 max-w-md">
                <SearchableSelect
                  id="team-organisation"
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(teamHref(value, view), { scroll: false })}
                />
              </Field>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{organisation.name}</span> · you are the {organisation.role_label} ·{" "}
              {organisation.market_code}
            </p>
            <div className="mt-4">
              <ChipNav
                label="Team sections"
                items={[
                  { key: "team", href: teamHref(organisation.id, "team"), label: "Team", current: view === "team" },
                  {
                    key: "activity",
                    href: teamHref(organisation.id, "activity"),
                    label: "Activity",
                    current: view === "activity",
                  },
                ]}
              />
            </div>
            <div className="mt-8">
              {/* key: nothing of one organisation stays on screen for another. */}
              {view === "team" ? (
                <TeamView key={organisation.id} organisation={organisation} />
              ) : (
                <Activity
                  key={organisation.id}
                  organisationId={organisation.id}
                  page={page}
                  hrefFor={(value) => teamHref(organisation.id, "activity", value)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/team`: the members, invitations, requests to join and activity of each team the caller manages. */
export function TeamList() {
  return <RequireAuth allow={isProfessional}>{() => <Teams />}</RequireAuth>;
}
