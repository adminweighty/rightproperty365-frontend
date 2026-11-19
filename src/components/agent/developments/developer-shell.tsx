"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState } from "@/components/portal/portal-ui";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Membership, User } from "@/lib/api/auth";

/*
 * The developer organisation a page about development projects works for:
 * `?org=` in the address, else the first developer organisation the person is
 * a member of, with an "Organisation" choice when there are several. Projects
 * live under `/v1/agent/organisations/{orgId}/developments`; the API answers
 * 404 to anyone who is not a member, so this only chooses what to show.
 */

/** The organisation kind of a property developer (API `organisation_kinds`). */
export const DEVELOPER_KIND = "DEVELOPER";

export const developerOrganisations = (user: User | null) =>
  (user?.memberships ?? []).filter((membership) => membership.organisation_kind === DEVELOPER_KIND);

/** OWNER and MANAGER read a project's enquiries, with the customers' contact details. */
export const readsEnquiries = (membership: Pick<Membership, "role">) => membership.role === "OWNER" || membership.role === "MANAGER";

/** `/agent/developments…?org=…`. */
export function withOrg(path: string, organisationId: string) {
  return `${path}${path.includes("?") ? "&" : "?"}org=${encodeURIComponent(organisationId)}`;
}

type Props = {
  back?: { href: string; label: string };
  children: (membership: Membership, user: User) => ReactNode;
};

function Shell({ user, back, children }: Props & { user: User }) {
  const params = useSearchParams();
  const router = useRouter();
  const organisations = developerOrganisations(user);
  const wanted = params.get("org");
  const membership = organisations.find((item) => item.organisation_id === wanted) ?? organisations[0];

  if (!membership) {
    return (
      <>
        <BackLink href="/dashboard">Dashboard</BackLink>
        <h1 className="mt-1 text-3xl md:text-4xl">Development projects</h1>
        <div className="mt-6">
          <EmptyState
            title="Projects are for property developers"
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            Development projects belong to a Property Developer organisation. Apply for the Property Developer role from
            your account, or ask your developer&rsquo;s principal to add you to their team.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink href={back?.href ?? "/dashboard"}>{back?.label ?? "Dashboard"}</BackLink>
      {organisations.length > 1 && (
        <Field id="developer-organisation" label="Organisation" className="mt-4 max-w-sm">
          <SearchableSelect
            id="developer-organisation"
            value={membership.organisation_id}
            onValueChange={(value) => router.replace(withOrg("/agent/developments", value))}
            options={organisations.map((item) => ({ value: item.organisation_id, label: item.organisation_name }))}
          />
        </Field>
      )}
      {children(membership, user)}
    </>
  );
}

/** Signed in, and a member of a developer organisation. */
export function DeveloperShell(props: Props) {
  return <RequireAuth>{(user) => <Shell user={user} {...props} />}</RequireAuth>;
}
