"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { Notice } from "@/components/agent/team/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import {
  cancelMySubscription,
  listMyPlans,
  listMySubscriptions,
  renewMySubscription,
  requestSubscription,
  type MySubscriber,
  type Subscription,
  type SubscriptionPeriod,
  type SubscriptionPlan,
  type SubscriptionUsage,
} from "@/lib/api/subscriptions";
import {
  actionMessage,
  FEATURE_LABELS,
  fieldText,
  formatAmount,
  formatDay,
  PERIOD_LENGTH,
  periodLabel,
  subscriptionStatus,
} from "@/lib/subscriptions";

type CountryOption = { value: string; label: string };

const PERIODS: SubscriptionPeriod[] = ["QUARTERLY", "YEARLY"];

const PAY_WORDS =
  "Pay by bank transfer or the method on the invoice, quoting the invoice number. We activate it when your payment arrives.";

const failureNotice = (failure: ApiFailure): Notice => {
  const text = actionMessage(failure);
  const fields = Object.entries(failure.fields ?? {})
    .map(([name, message]) => fieldText(name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), message))
    .filter(Boolean)
    .join(" ");
  return {
    tone: failure.status === 409 ? "warning" : "danger",
    text: fields ? `${text} ${fields}` : text,
    traceId: text === failure.message ? failure.traceId : undefined,
  };
};

function StatusBadge({ subscription }: { subscription: Subscription }) {
  const { label, tone } = subscriptionStatus(subscription);
  return <Badge tone={tone}>{label}</Badge>;
}

/** "16 Nov 2026 to 16 Feb 2027", or what is known. */
function periodDates(sub: Subscription) {
  if (sub.starts_at && sub.ends_at) return `${formatDay(sub.starts_at)} to ${formatDay(sub.ends_at)}`;
  return `Requested ${formatDay(sub.created_at)}`;
}

function usageText(usage: SubscriptionUsage) {
  const count = usage.active_listings;
  const noun = count === 1 ? "active listing" : "active listings";
  return usage.max_active_listings === null ? `${count} ${noun}, no limit` : `${count} of ${usage.max_active_listings} active listings`;
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term}>
          <dt className="text-sm text-muted">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The invoice of a request waiting for payment, and how to pay it. */
function InvoiceDetails({ subscription }: { subscription: Subscription }) {
  return (
    <>
      <Facts
        items={[
          ["Invoice number", subscription.invoice_number],
          ["Amount to pay", formatAmount(subscription.amount, subscription.currency_code)],
          ["Plan", `${subscription.plan_name}, ${periodLabel(subscription.period)} (${PERIOD_LENGTH[subscription.period] ?? ""})`],
          ["Requested", formatDay(subscription.created_at)],
        ]}
      />
      {subscription.payment_instructions && (
        <p className="mt-4 whitespace-pre-line rounded-md bg-sunken p-3 text-sm text-ink">{subscription.payment_instructions}</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {PAY_WORDS} Pay only into the account named on an invoice we sent you. Nothing is charged automatically.
      </p>
    </>
  );
}

function PeriodSelect({
  id,
  label,
  periods,
  value,
  onChange,
}: {
  id: string;
  label: string;
  periods: { value: SubscriptionPeriod; label: string }[];
  value: SubscriptionPeriod;
  onChange: (value: SubscriptionPeriod) => void;
}) {
  return (
    <Field id={id} label={label} className="w-full sm:w-56">
      <SearchableSelect id={id} options={periods} value={value} onValueChange={(next) => onChange(next as SubscriptionPeriod)} />
    </Field>
  );
}

function priceOf(plan: SubscriptionPlan, period: SubscriptionPeriod, currency: string | null) {
  return plan.prices.find((price) => price.period === period && (!currency || price.currency_code === currency));
}

/** The plans one subscriber may take, with the request for one. */
function Plans({
  entry,
  canRequest,
  countries,
  onRequested,
}: {
  entry: MySubscriber;
  canRequest: boolean;
  countries: CountryOption[];
  onRequested: (subscription: Subscription, paymentNote: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { subscriber } = entry;
  const individual = subscriber.kind === "INDIVIDUAL";
  const chosen = /^[A-Z]{2}$/.test(params.get("market") ?? "") ? params.get("market")! : "";
  const market = subscriber.market_code || (individual ? chosen : "");
  const load = useCallback(() => listMyPlans(market || undefined), [market]);
  const { state, reload } = useApi(load);
  const [periods, setPeriods] = useState<Record<string, SubscriptionPeriod>>({});
  const [asking, setAsking] = useState<{ plan: SubscriptionPlan; period: SubscriptionPeriod } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [marketError, setMarketError] = useState<string | undefined>();
  const prefix = `plans-${subscriber.id}`;

  async function request() {
    if (!asking) return;
    setBusy(true);
    setError(undefined);
    const answer = await requestSubscription({
      plan_id: asking.plan.id,
      period: asking.period,
      ...(individual ? (market ? { market_code: market } : {}) : { organisation_id: subscriber.id }),
    });
    setBusy(false);
    if (answer.ok) {
      setAsking(null);
      onRequested(answer.data.subscription, state.status === "ready" ? state.data.payment_note : "");
      return;
    }
    if (answer.failure.fields?.market_code) {
      setAsking(null);
      setMarketError(fieldText("Country", answer.failure.fields.market_code));
      document.getElementById(`${prefix}-market`)?.focus();
      return;
    }
    setError(failureNotice(answer.failure).text);
  }

  const data = state.status === "ready" ? state.data : null;
  const plans = data?.plans.filter((plan) => plan.subscriber_kind === subscriber.kind) ?? [];
  const currency = data?.currency_code ?? null;

  return (
    <section aria-labelledby={`${prefix}-title`} className="mt-8">
      <h3 id={`${prefix}-title`} className="font-sans text-lg font-semibold tracking-normal">
        Plans
      </h3>
      {individual && !subscriber.market_code && (
        <Field
          id={`${prefix}-market`}
          label="Country you will pay in"
          hint="Prices are shown in this country's currency."
          error={marketError}
          className="mt-3 max-w-sm"
        >
          <SearchableSelect
            id={`${prefix}-market`}
            options={[{ value: "", label: "Choose a country" }, ...countries]}
            value={chosen}
            aria-invalid={Boolean(marketError)}
            aria-describedby={fieldDescribedBy(`${prefix}-market`, { hint: "x", error: marketError })}
            onValueChange={(value) => {
              setMarketError(undefined);
              const next = new URLSearchParams(params.toString());
              if (value) next.set("market", value);
              else next.delete("market");
              const text = next.toString();
              router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
            }}
          />
        </Field>
      )}
      {!canRequest && (
        <p className="mt-2 text-sm text-muted">
          You already have a subscription or a request here. You can take a new plan when it ends, or renew it when renewal opens.
        </p>
      )}
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the plans" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {data && plans.length === 0 && (
          <EmptyState title="No plans to show">
            {market
              ? "There are no plans for your approved roles in this country yet."
              : "Plans are for approved professional roles."}{" "}
            If your application is still being checked, <Link href="/onboarding" className="font-medium text-primary-ink hover:underline">complete your profile</Link> first.
          </EmptyState>
        )}
        {data && plans.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => {
              const available = PERIODS.filter((period) => priceOf(plan, period, currency));
              const period = periods[plan.id] && available.includes(periods[plan.id]) ? periods[plan.id] : available[0];
              const listings = plan.features.find((feature) => feature.code === "MAX_ACTIVE_LISTINGS");
              return (
                <li key={plan.id}>
                  <Card className="flex h-full flex-col">
                    <h4 className="font-sans text-lg font-semibold tracking-normal">{plan.name}</h4>
                    {plan.description && <p className="mt-1 text-sm leading-relaxed text-muted">{plan.description}</p>}
                    <ul className="mt-3 space-y-1 text-sm text-ink">
                      {listings && (
                        <li>
                          {FEATURE_LABELS.MAX_ACTIVE_LISTINGS}: {listings.limit === null ? "Unlimited" : listings.limit}
                        </li>
                      )}
                      {plan.features
                        .filter((feature) => feature.code !== "MAX_ACTIVE_LISTINGS")
                        .map((feature) => (
                          <li key={feature.code}>
                            {feature.label ?? FEATURE_LABELS[feature.code] ?? feature.code}: {feature.limit === null ? "Unlimited" : feature.limit}
                          </li>
                        ))}
                      {plan.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      {PERIODS.map((item) => {
                        const prices = currency ? [priceOf(plan, item, currency)].filter(Boolean) : plan.prices.filter((price) => price.period === item);
                        return (
                          <div key={item} className="rounded-md border border-line p-3">
                            <dt className="text-sm text-muted">{periodLabel(item)}</dt>
                            <dd className="font-semibold tabular-nums text-ink">
                              {prices.length === 0
                                ? "Not offered"
                                : prices.map((price) => <span key={price!.currency_code} className="block">{formatAmount(price!.amount, price!.currency_code)}</span>)}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {canRequest && available.length > 0 && (individual ? Boolean(market) : true) && (
                      <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-end">
                        <PeriodSelect
                          id={`${prefix}-${plan.id}-period`}
                          label="Period"
                          periods={available.map((value) => ({ value, label: periodLabel(value) }))}
                          value={period}
                          onChange={(value) => setPeriods((current) => ({ ...current, [plan.id]: value }))}
                        />
                        <Button
                          onClick={() => {
                            setError(undefined);
                            setAsking({ plan, period });
                          }}
                        >
                          Request this plan<span className="sr-only">: {plan.name}</span>
                        </Button>
                      </div>
                    )}
                    {canRequest && individual && !market && (
                      <p className="mt-auto pt-4 text-sm text-muted">Choose the country you will pay in to request this plan.</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {data?.payment_note && plans.length > 0 && <p className="mt-4 text-sm leading-relaxed text-muted">{data.payment_note}</p>}
      </div>

      <ConfirmDialog
        open={asking !== null}
        title={asking ? `Request ${asking.plan.name}?` : ""}
        confirmLabel="Yes, send me the invoice"
        busyLabel="Requesting…"
        tone="primary"
        busy={busy}
        error={error}
        onCancel={() => setAsking(null)}
        onConfirm={() => void request()}
      >
        {asking && (
          <p>
            {periodLabel(asking.period)} ({PERIOD_LENGTH[asking.period]})
            {(() => {
              const price = priceOf(asking.plan, asking.period, currency);
              return price ? ` for ${formatAmount(price.amount, price.currency_code)}` : "";
            })()}
            . We email you an invoice. Nothing is charged now: the plan starts when we receive your payment.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}

function Subscriber({
  entry,
  countries,
  onReload,
}: {
  entry: MySubscriber;
  countries: CountryOption[];
  onReload: () => void;
}) {
  const { subscriber, current, upcoming, pending, usage, history } = entry;
  const prefix = `sub-${subscriber.id}`;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [created, setCreated] = useState<{ subscription: Subscription; note: string } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewPeriod, setRenewPeriod] = useState<SubscriptionPeriod>(current?.period ?? "QUARTERLY");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const result = useRef<HTMLDivElement>(null);

  function show(next: Notice) {
    setNotice(next);
    requestAnimationFrame(() => result.current?.focus());
  }

  async function withdraw() {
    if (!pending) return;
    setBusy(true);
    setDialogError(undefined);
    const answer = await cancelMySubscription(pending.id);
    setBusy(false);
    if (answer.ok || answer.failure.status === 409) {
      setWithdrawing(false);
      setCreated(null);
      show(answer.ok ? { tone: "success", text: `Request ${pending.invoice_number} was withdrawn. Do not pay that invoice.` } : failureNotice(answer.failure));
      onReload();
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  async function renew() {
    if (!current) return;
    setBusy(true);
    setDialogError(undefined);
    const answer = await renewMySubscription(current.id, renewPeriod);
    setBusy(false);
    if (answer.ok) {
      setRenewing(false);
      setCreated({ subscription: answer.data.subscription, note: "" });
      requestAnimationFrame(() => result.current?.focus());
      onReload();
      return;
    }
    if (answer.failure.status === 409) {
      setRenewing(false);
      show(failureNotice(answer.failure));
      onReload();
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  const canRequest = !current && !pending && !upcoming;
  const title = subscriber.kind === "INDIVIDUAL" ? "Your own subscription" : subscriber.name;

  return (
    <section aria-labelledby={`${prefix}-title`}>
      <Card>
        <h2 id={`${prefix}-title`} className="text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {subscriber.kind === "INDIVIDUAL" ? `For you, ${subscriber.name}.` : "For the organisation you run."}
          {subscriber.market_code && ` Country: ${subscriber.market_code}.`}
        </p>

        <div ref={result} tabIndex={-1} aria-live="polite" className="outline-none">
          {created && (
            <Alert tone="success" title={`Invoice ${created.subscription.invoice_number} is on its way to your email.`} className="mt-4">
              <p>
                Amount to pay: <strong>{formatAmount(created.subscription.amount, created.subscription.currency_code)}</strong>.
              </p>
              {created.subscription.payment_instructions && <p className="mt-1 whitespace-pre-line">{created.subscription.payment_instructions}</p>}
              {created.note && <p className="mt-1">{created.note}</p>}
              <p className="mt-1">{PAY_WORDS}</p>
            </Alert>
          )}
          {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-4" />}
        </div>

        <h3 className="mt-6 font-sans text-lg font-semibold tracking-normal">Now</h3>
        {current ? (
          <div className="mt-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{current.plan_name}</span>
              <StatusBadge subscription={current} />
            </p>
            <Facts
              items={[
                ["Period", `${periodLabel(current.period)} (${PERIOD_LENGTH[current.period] ?? ""})`],
                ["Dates", periodDates(current)],
                ["Amount paid", formatAmount(current.payment?.amount ?? current.amount, current.currency_code)],
                ["Invoice number", current.invoice_number],
              ]}
            />
          </div>
        ) : (
          <p className="mt-2 text-muted">No subscription is in force.</p>
        )}
        <p className="mt-4 text-sm text-ink">
          <span className="font-medium">Listings: </span>
          {usageText(usage)}
          {!usage.limit_enforced && usage.max_active_listings !== null && (
            <span className="text-muted"> (the limit is shown only for now: it is not enforced yet)</span>
          )}
        </p>

        {upcoming && (
          <div className="mt-6 rounded-md border border-line p-4">
            <h3 className="flex flex-wrap items-center gap-2 font-sans text-base font-semibold tracking-normal">
              Next period <StatusBadge subscription={upcoming} />
            </h3>
            <p className="mt-1 text-sm text-muted">
              {upcoming.plan_name}, {periodLabel(upcoming.period)}: {periodDates(upcoming)}. It is paid and starts when the current one ends.
            </p>
          </div>
        )}

        {pending && (
          <div className="mt-6 rounded-md border-2 border-warning p-4">
            <h3 className="flex flex-wrap items-center gap-2 font-sans text-base font-semibold tracking-normal">
              Waiting for your payment <StatusBadge subscription={pending} />
            </h3>
            <InvoiceDetails subscription={pending} />
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setDialogError(undefined);
                setWithdrawing(true);
              }}
            >
              Withdraw this request
            </Button>
          </div>
        )}

        {current && entry.can_renew && (
          <div className="mt-6 rounded-md border border-line bg-sunken p-4">
            <h3 className="font-sans text-base font-semibold tracking-normal">Renew</h3>
            <p className="mt-1 text-sm text-muted">
              Ask for the next period now. We email you an invoice at the plan&apos;s current price. The next period starts when this one
              ends, once we receive your payment.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <PeriodSelect
                id={`${prefix}-renew-period`}
                label="Next period"
                periods={PERIODS.map((value) => ({ value, label: `${periodLabel(value)} (${PERIOD_LENGTH[value]})` }))}
                value={renewPeriod}
                onChange={setRenewPeriod}
              />
              <Button
                onClick={() => {
                  setDialogError(undefined);
                  setRenewing(true);
                }}
              >
                Renew
              </Button>
            </div>
          </div>
        )}
        {current && !entry.can_renew && !upcoming && !pending && current.renewal_opens_at && (
          <p className="mt-4 text-sm text-muted">You can renew from {formatDay(current.renewal_opens_at)}. Nothing renews by itself.</p>
        )}

        <Plans
          entry={entry}
          canRequest={canRequest}
          countries={countries}
          onRequested={(subscription, note) => {
            setNotice(null);
            setCreated({ subscription, note });
            requestAnimationFrame(() => result.current?.focus());
            onReload();
          }}
        />

        {history.length > 0 && (
          <section aria-labelledby={`${prefix}-history`} className="mt-8">
            <h3 id={`${prefix}-history`} className="font-sans text-lg font-semibold tracking-normal">
              History
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {history.map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{item.plan_name}</span>
                    <StatusBadge subscription={item} />
                    <span className="text-muted">{item.invoice_number}</span>
                  </p>
                  <p className="mt-1 text-muted">
                    {periodLabel(item.period)} · {formatAmount(item.amount, item.currency_code)} · {periodDates(item)}
                  </p>
                  {item.rejection_reason && <p className="mt-1 text-ink">Reason: {item.rejection_reason}</p>}
                  {item.cancel_reason && (
                    <p className="mt-1 text-ink">
                      {item.cancelled_by === "SUBSCRIBER" ? "Withdrawn" : "Cancelled"}
                      {item.cancelled_at ? ` on ${formatWhen(item.cancelled_at)}` : ""}: {item.cancel_reason}
                    </p>
                  )}
                  {item.refund_due && (
                    <p className="mt-1 text-ink">
                      A refund is due{item.refund_note ? `: ${item.refund_note}` : "."} See the{" "}
                      <Link href="/legal/refund-policy" className="font-medium text-primary-ink hover:underline">
                        Refund Policy
                      </Link>
                      .
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </Card>

      <ConfirmDialog
        open={withdrawing}
        title="Withdraw this request?"
        confirmLabel="Yes, withdraw it"
        busyLabel="Withdrawing…"
        busy={busy}
        error={dialogError}
        onCancel={() => setWithdrawing(false)}
        onConfirm={() => void withdraw()}
      >
        <p>
          Invoice {pending?.invoice_number} will no longer be valid. Do not pay it. If you already paid, tell us and we refund you as the
          Refund Policy says.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={renewing}
        title="Renew for another period?"
        confirmLabel="Yes, send me the invoice"
        busyLabel="Requesting…"
        tone="primary"
        busy={busy}
        error={dialogError}
        onCancel={() => setRenewing(false)}
        onConfirm={() => void renew()}
      >
        <p>
          {current?.plan_name}, {periodLabel(renewPeriod)} ({PERIOD_LENGTH[renewPeriod]}). We email you an invoice. Nothing is charged
          now.
        </p>
      </ConfirmDialog>
    </section>
  );
}

function Body({ countries }: { countries: CountryOption[] }) {
  const { state, reload } = useApi(listMySubscriptions);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Subscription</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        Plans for people who list or manage property. Each period is invoiced and paid outside the site, by bank transfer or the
        method on the invoice. We activate it when your payment arrives. Nothing is charged automatically. See the{" "}
        <Link href="/legal/refund-policy" className="font-medium text-primary-ink hover:underline">
          Refund Policy
        </Link>
        .
      </p>
      <p role="status" className="sr-only">
        {state.status === "ready" ? "Your subscriptions have loaded." : ""}
      </p>
      <div className="mt-8 space-y-8">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading your subscriptions" rows={2} />}
        {data && data.subscribers.length === 0 && (
          <EmptyState title="Nothing to subscribe to yet" action={<ButtonLink href="/onboarding" variant="secondary">Complete your profile</ButtonLink>}>
            Plans are for approved professional roles.
          </EmptyState>
        )}
        {data?.subscribers.map((entry) => (
          <Subscriber key={`${entry.subscriber.kind}-${entry.subscriber.id}`} entry={entry} countries={countries} onReload={reload} />
        ))}
      </div>
    </>
  );
}

/** `/account/subscription`: the professional's plans, invoices and renewals (API 0.25.0). */
export function SubscriptionPage({ countries }: { countries: CountryOption[] }) {
  return <RequireAuth>{() => <Body countries={countries} />}</RequireAuth>;
}

