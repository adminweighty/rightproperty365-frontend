"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SUBSCRIPTION_READ_ROLES } from "@/lib/api/auth";
import {
  adminListPlans,
  adminListSubscriptions,
  SUBSCRIPTIONS_PAGE_SIZE,
  type SubscriberKind,
  type SubscriptionPeriod,
  type SubscriptionStatus,
} from "@/lib/api/subscriptions";
import { pageFrom } from "@/lib/request-filters";
import { formatAmount, formatDay, periodLabel, subscriptionStatus } from "@/lib/subscriptions";

const PATH = "/admin/subscriptions";

type Country = { value: string; label: string; keywords?: string[] };

/** The tabs, what needs a decision first. "All" is the one without a status. */
const TABS: { key: string; label: string; status?: SubscriptionStatus }[] = [
  { key: "PENDING_PAYMENT", label: "Awaiting payment", status: "PENDING_PAYMENT" },
  { key: "ACTIVE", label: "Active", status: "ACTIVE" },
  { key: "EXPIRED", label: "Ended", status: "EXPIRED" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
  { key: "CANCELLED", label: "Cancelled", status: "CANCELLED" },
  { key: "all", label: "All" },
];

const PERIODS: SubscriptionPeriod[] = ["QUARTERLY", "YEARLY"];
const KINDS: { value: SubscriberKind; label: string }[] = [
  { value: "INDIVIDUAL", label: "People" },
  { value: "ORGANISATION", label: "Organisations" },
];

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type Filters = { tab: string; plan: string; period: string; market: string; kind: string; q: string };

function hrefFor(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.tab !== "PENDING_PAYMENT") params.set("status", filters.tab);
  if (filters.plan) params.set("plan", filters.plan);
  if (filters.period) params.set("period", filters.period);
  if (filters.market) params.set("market", filters.market);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** The plans for the plan filter. Without them the filter offers only "Any plan". */
function usePlanOptions() {
  const [options, setOptions] = useState<{ value: string; label: string; secondary?: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminListPlans().then((result) => {
      if (!cancelled && result.ok) {
        setOptions(
          result.data.plans.map((plan) => ({
            value: plan.id,
            label: plan.name,
            ...(plan.status === "RETIRED" ? { secondary: "(retired)" } : {}),
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

function List({ countries }: { countries: Country[] }) {
  const params = useSearchParams();
  const tab = TABS.find((item) => item.key === (params.get("status") ?? "PENDING_PAYMENT")) ?? TABS[0];
  const plan = UUID.test(params.get("plan") ?? "") ? params.get("plan")! : "";
  const period = PERIODS.find((item) => item === params.get("period")) ?? "";
  const market = /^[A-Z]{2}$/.test(params.get("market") ?? "") ? params.get("market")! : "";
  const kind = KINDS.find((item) => item.value === params.get("kind"))?.value ?? "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const page = pageFrom(params.get("page"));
  const filtered = Boolean(plan || period || market || kind || q);

  const load = useCallback(
    () =>
      adminListSubscriptions({
        status: tab.status,
        plan_id: plan || undefined,
        period: period || undefined,
        market: market || undefined,
        subscriber_kind: kind || undefined,
        q: q || undefined,
        page,
      }),
    [tab.status, plan, period, market, kind, q, page],
  );
  const { state, reload } = useApi(load);
  const filters: Filters = { tab: tab.key, plan, period, market, kind, q };
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const planOptions = usePlanOptions();
  const countryName = (code: string) => countries.find((country) => country.value === code)?.label ?? code;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || SUBSCRIPTIONS_PAGE_SIZE))) : 1;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Subscriptions</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Plans professionals asked for. Each request is an invoice. A transfer is recorded here when it arrives, which activates
            the subscription; when online payment is on, a confirmed online payment activates it by itself.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/payments" variant="secondary">
            Online payments
          </ButtonLink>
          <ButtonLink href="/admin/subscription-plans" variant="secondary">
            Plans
          </ButtonLink>
        </div>
      </div>

      <div className="mt-8">
        <ChipNav
          label="Subscription status"
          items={TABS.map((item) => ({ key: item.key, href: hrefFor({ ...filters, tab: item.key }), label: item.label, current: item.key === tab.key }))}
        />
      </div>

      {/* A plain GET form: the filters live in the address, so a view can be bookmarked. */}
      <form
        action={PATH}
        role="search"
        aria-label="Filter subscriptions"
        className="mt-5 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {tab.key !== "PENDING_PAYMENT" && <input type="hidden" name="status" value={tab.key} />}
        <Field id="subs-q" label="Invoice number or subscriber">
          <Input id="subs-q" name="q" type="search" defaultValue={q} key={q} maxLength={100} placeholder="RPS-2026-000123" autoComplete="off" />
        </Field>
        <Field id="subs-plan" label="Plan">
          <SearchableSelect id="subs-plan" name="plan" defaultValue={plan} options={[{ value: "", label: "Any plan" }, ...planOptions]} />
        </Field>
        <Field id="subs-period" label="Period">
          <SearchableSelect
            id="subs-period"
            name="period"
            defaultValue={period}
            options={[{ value: "", label: "Any period" }, ...PERIODS.map((value) => ({ value, label: periodLabel(value) }))]}
          />
        </Field>
        <Field id="subs-market" label="Country">
          <SearchableSelect id="subs-market" name="market" defaultValue={market} options={[{ value: "", label: "Every country" }, ...countries]} />
        </Field>
        <Field id="subs-kind" label="Subscriber">
          <SearchableSelect id="subs-kind" name="kind" defaultValue={kind} options={[{ value: "", label: "People and organisations" }, ...KINDS]} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">
            <Search className="size-4" aria-hidden="true" />
            Filter
          </Button>
          {filtered && (
            <ButtonLink href={hrefFor({ tab: tab.key, plan: "", period: "", market: "", kind: "", q: "" })} variant="ghost">
              Clear filters
            </ButtonLink>
          )}
        </div>
      </form>

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the subscriptions" rows={3} />}
        {data && (
          <p className="text-sm text-muted" role="status">
            {data.total === 1 ? "1 subscription" : `${data.total} subscriptions`}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-4">
            <EmptyState title={filtered ? "No subscriptions match those filters" : tab.key === "PENDING_PAYMENT" ? "Nothing is waiting for payment" : "No subscriptions here"} />
          </div>
        )}
        {data && data.items.length > 0 && (
          <Card padded={false} className="mt-4">
            <ul className="divide-y divide-line">
              {data.items.map((sub) => {
                const shown = subscriptionStatus(sub);
                return (
                  <li key={sub.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`${PATH}/${sub.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                          {sub.invoice_number}
                        </Link>
                        <Badge tone={shown.tone}>{shown.label}</Badge>
                        <Badge tone="accent">{sub.market_code}</Badge>
                        {sub.refund_due && <Badge tone="danger">Refund due</Badge>}
                      </p>
                      <p className="text-ink">
                        {sub.subscriber.name}{" "}
                        <span className="text-sm text-muted">({sub.subscriber.kind === "ORGANISATION" ? "organisation" : "person"})</span>
                      </p>
                      <p className="text-sm text-muted">
                        {sub.plan_name} · {periodLabel(sub.period)} · {formatAmount(sub.amount, sub.currency_code)} · {countryName(sub.market_code)}
                      </p>
                      <p className="text-xs text-subtle">
                        Requested {formatDay(sub.created_at)}
                        {sub.starts_at && sub.ends_at && ` · ${formatDay(sub.starts_at)} to ${formatDay(sub.ends_at)}`}
                      </p>
                    </div>
                    <ButtonLink href={`${PATH}/${sub.id}`} size="sm" variant={sub.status === "PENDING_PAYMENT" ? "primary" : "secondary"}>
                      Open<span className="sr-only"> {sub.invoice_number}</span>
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {data && (
          <Pagination page={page} totalPages={totalPages} hrefFor={(value) => hrefFor(filters, value)} label="Subscriptions" className="mt-8" />
        )}
      </div>
    </>
  );
}

/** `/admin/subscriptions` (SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN, SUPPORT). */
export function SubscriptionList({ countries }: { countries: Country[] }) {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the subscriptions">
      {() => <List countries={countries} />}
    </RoleGate>
  );
}
