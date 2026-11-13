"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isProfessional,
  membershipRoleLabels,
  organisationKindLabels,
  platformRoleLabels,
  type User,
} from "@/lib/api/auth";

function Details({ user }: { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";

  return (
    <>
      <h1 className="text-4xl">Your account</h1>
      {welcome && (
        <Alert tone="success" title="Your email address is confirmed. You are signed in." className="mt-6" />
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl">Profile</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd className="text-ink">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 text-ink">
                <span className="break-all">{user.email}</span>
                {user.email_verified && (
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    Confirmed
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-2xl">Access</h2>
          <ul className="mt-4 space-y-3">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">Customer</span>
              <Badge>Everyone</Badge>
            </li>
            {user.memberships.map((membership) => (
              <li
                key={`${membership.organisation_id}-${membership.market_code}`}
                className="flex items-center justify-between gap-3"
              >
                <span>
                  <span className="block text-ink">{membership.organisation_name}</span>
                  <span className="block text-sm text-muted">
                    {organisationKindLabels[membership.organisation_kind]} · {membership.market_code}
                  </span>
                </span>
                <Badge tone="primary">{membershipRoleLabels[membership.role]}</Badge>
              </li>
            ))}
            {user.platform_roles.map((assignment) => (
              <li
                key={`${assignment.role}-${assignment.market_code ?? "all"}`}
                className="flex items-center justify-between gap-3"
              >
                <span>
                  <span className="block text-ink">RightProperty365 staff</span>
                  <span className="block text-sm text-muted">
                    {assignment.market_code ?? "All markets"}
                  </span>
                </span>
                <Badge tone="accent">{platformRoleLabels[assignment.role]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {isProfessional(user) && <ButtonLink href="/agent/requests">Open request inbox</ButtonLink>}
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </>
  );
}

export function AccountOverview() {
  return <RequireAuth>{(user) => <Details user={user} />}</RequireAuth>;
}
