"use client";

import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  canUseInbox,
  hasOnboarding,
  hasOnboardingToDo,
  membershipRoleLabel,
  organisationKindLabel,
  platformRoleLabels,
  titleFromCode,
  type User,
} from "@/lib/api/auth";
import {
  listMyApplications,
  onboardingStatusLabel,
  onboardingStatusLabels,
  onboardingStatusTones,
  roleToSlug,
  type OnboardingApplication,
} from "@/lib/api/onboarding";

type Props = {
  /** code -> label of the API's `account_roles` reference set. */
  roleLabels: Record<string, string>;
  /** code -> label of the API's `organisation_kinds` reference set. */
  organisationKindLabels: Record<string, string>;
};

function Details({ user, roleLabels, organisationKindLabels }: Props & { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";

  // Applications add what /v1/me does not carry: the public profile an approval created.
  const [applications, setApplications] = useState<OnboardingApplication[]>([]);
  const withOnboarding = hasOnboarding(user);
  useEffect(() => {
    if (!withOnboarding) return;
    let cancelled = false;
    listMyApplications().then((result) => {
      if (!cancelled && result.ok) setApplications(result.data.applications);
    });
    return () => {
      cancelled = true;
    };
  }, [withOnboarding]);

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
          <h3 className="mt-4 text-sm font-medium tracking-normal text-muted">Your roles</h3>
          <ul className="mt-2 space-y-3">
            {user.account_roles.map(({ role, status, onboarding_status: onboarding }) => {
              const application = applications.find((item) => item.role === role);
              const label = roleLabels[role] ?? titleFromCode(role);
              return (
                <li key={role}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink">{label}</span>
                    {status === "ACTIVE" ? (
                      <Badge tone="success">Active</Badge>
                    ) : onboarding ? (
                      // The application's own status says more than "pending".
                      <Badge tone={onboardingStatusTones[onboarding]}>
                        {onboardingStatusLabel(application ?? { status: onboarding })}
                      </Badge>
                    ) : status === "REJECTED" ? (
                      <Badge tone="danger">{onboardingStatusLabels.REJECTED}</Badge>
                    ) : (
                      <Badge tone="warning">{onboardingStatusLabels.DRAFT}</Badge>
                    )}
                  </div>
                  {onboarding && (
                    <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                      <Link
                        href={`/onboarding/${roleToSlug(role)}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline"
                      >
                        {onboarding === "DRAFT"
                          ? "Complete your application"
                          : onboarding === "CHANGES_REQUESTED"
                            ? "Fix and resubmit"
                            : onboarding === "REJECTED"
                              ? "See why, or apply again"
                              : "View your application"}
                        <span className="sr-only">: {label}</span>
                      </Link>
                      {application?.profile && (
                        <Link
                          href={`/directory/${application.profile.kind}/${application.profile.slug}`}
                          className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline"
                        >
                          View your public profile
                        </Link>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
            {user.account_roles.length === 0 && <li className="text-muted">No roles chosen yet</li>}
          </ul>
          {user.account_roles.some(({ status }) => status === "PENDING_VERIFICATION") && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A role that is not active gives no access yet. We confirm it after you complete its
              application and our team has checked it.
            </p>
          )}

          {(user.memberships.length > 0 || user.platform_roles.length > 0) && (
            <h3 className="mt-6 border-t border-line pt-4 text-sm font-medium tracking-normal text-muted">
              Organisations and staff access
            </h3>
          )}
          <ul className="mt-2 space-y-3">
            {user.memberships.map((membership) => (
              <li
                key={`${membership.organisation_id}-${membership.market_code}`}
                className="flex items-center justify-between gap-3"
              >
                <span>
                  <span className="block text-ink">{membership.organisation_name}</span>
                  <span className="block text-sm text-muted">
                    {organisationKindLabel(membership.organisation_kind, organisationKindLabels)} ·{" "}
                    {membership.market_code}
                  </span>
                </span>
                <Badge tone="primary">{membershipRoleLabel(membership)}</Badge>
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
        {hasOnboardingToDo(user) && <ButtonLink href="/onboarding">Complete your profile</ButtonLink>}
        {canUseInbox(user) && (
          <ButtonLink href="/agent/requests" variant={hasOnboardingToDo(user) ? "secondary" : "primary"}>
            Open request inbox
          </ButtonLink>
        )}
        {canUseInbox(user) && (
          <ButtonLink href="/agent/appointments" variant="secondary">
            Appointments received
          </ButtonLink>
        )}
        <ButtonLink href="/account/appointments" variant="secondary">
          Your appointments
        </ButtonLink>
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

export function AccountOverview(props: Props) {
  return <RequireAuth>{(user) => <Details user={user} {...props} />}</RequireAuth>;
}
