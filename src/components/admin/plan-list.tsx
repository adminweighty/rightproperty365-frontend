"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasPlatformRole, SUBSCRIPTION_MANAGE_ROLES, SUBSCRIPTION_READ_ROLES, titleFromCode, type User } from "@/lib/api/auth";
import { adminListPlans, type SubscriptionPlan } from "@/lib/api/subscriptions";
import { formatAmount } from "@/lib/subscriptions";

const PATH = "/admin/subscription-plans";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Offered" },
  { key: "RETIRED", label: "Retired" },
] as const;

/** "USD 30.00 quarterly · USD 100.00 yearly", by currency. */
export function pricesText(plan: Pick<SubscriptionPlan, "prices">): string {
  const order = { QUARTERLY: 0, YEARLY: 1 };
  return [...plan.prices]
    .sort((a, b) => a.currency_code.localeCompare(b.currency_code) || order[a.period] - order[b.period])
    .map((price) => `${formatAmount(price.amount, price.currency_code)} ${price.period === "QUARTERLY" ? "quarterly" : "yearly"}`)
    .join(" · ");
}

/** "Unlimited", "10", or "Not set" for the plan's MAX_ACTIVE_LISTINGS. */
export function listingLimitText(plan: Pick<SubscriptionPlan, "features">): string {
  const feature = plan.features.find((item) => item.code === "MAX_ACTIVE_LISTINGS");
  if (!feature) return "Not set";
  return feature.limit === null ? "Unlimited" : String(feature.limit);
}

function Plans({ user, roleLabels }: { user: User; roleLabels: Record<string, string> }) {
  const params = useSearchParams();
  const filter = FILTERS.find((item) => item.key === params.get("status")) ?? FILTERS[0];
  const { state, reload } = useApi(adminListPlans);
  const manages = hasPlatformRole(user, SUBSCRIPTION_MANAGE_ROLES);
  const plans =
    state.status === "ready" ? state.data.plans.filter((plan) => filter.key === "all" || plan.status === filter.key) : [];

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Subscription plans</h1>
          <p className="mt-2 max-w-2xl text-muted">
            What professionals can subscribe to, with a price per currency for 3 months or a year. A retired plan is no
            longer offered; subscriptions already taken run to their end.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/subscriptions" variant="secondary">
            Subscriptions
          </ButtonLink>
          {manages && (
            <ButtonLink href={`${PATH}/new`}>
              <Plus className="size-4" aria-hidden="true" />
              New plan
            </ButtonLink>
          )}
        </div>
      </div>
      <div className="mt-8">
        <ChipNav
          label="Plan status"
          items={FILTERS.map((item) => ({
            key: item.key,
            href: item.key === "all" ? PATH : `${PATH}?status=${item.key}`,
            label: item.label,
            current: item.key === filter.key,
          }))}
        />
      </div>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading the plans" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && plans.length === 0 && (
          <EmptyState
            title="No plans here"
            action={manages ? <ButtonLink href={`${PATH}/new`} variant="secondary">Create a plan</ButtonLink> : undefined}
          />
        )}
        {plans.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {plans.map((plan) => (
                <li key={plan.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`${PATH}/${plan.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                        {plan.name}
                      </Link>
                      <Badge tone={plan.status === "ACTIVE" ? "success" : "warning"}>{plan.status === "ACTIVE" ? "Offered" : "Retired"}</Badge>
                      <Badge tone="neutral">{plan.subscriber_kind === "ORGANISATION" ? "For an organisation" : "For a person"}</Badge>
                    </p>
                    <p className="text-sm text-muted">
                      For {plan.eligible_roles.map((role) => roleLabels[role] ?? titleFromCode(role)).join(", ") || "no roles"}
                    </p>
                    <p className="text-sm text-ink">{pricesText(plan) || "No prices"}</p>
                    <p className="text-xs text-subtle">Active listings: {listingLimitText(plan)}</p>
                  </div>
                  <ButtonLink href={`${PATH}/${plan.id}`} size="sm" variant="secondary">
                    {manages && plan.status === "ACTIVE" ? "Edit" : "View"}
                    <span className="sr-only"> {plan.name}</span>
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

/** `/admin/subscription-plans` (read: SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN, SUPPORT). */
export function PlanList({ roleLabels }: { roleLabels: Record<string, string> }) {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the subscription plans">
      {(user) => <Plans user={user} roleLabels={roleLabels} />}
    </RoleGate>
  );
}
