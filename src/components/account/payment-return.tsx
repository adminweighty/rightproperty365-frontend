"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PayOnline } from "@/components/account/online-payment";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ApiFailure } from "@/lib/api/http";
import { getMySubscription, listMySubscriptionPayments, type PaymentView, type Subscription } from "@/lib/api/subscriptions";
import {
  canPayOnline,
  moneyText,
  paymentStatusLabel,
  pickPayment,
  RETURN_POLL_INTERVAL_MS,
  RETURN_WORDS,
  returnState,
  safeHostedUrl,
  shouldPoll,
} from "@/lib/online-payment";
import { formatDay, periodLabel, subscriptionStatus } from "@/lib/subscriptions";
import { currentMarketZone } from "@/lib/display-zone";

const BACK = "/account/subscription";

type Snapshot = { subscription: Subscription; payments: PaymentView[]; elapsedMs: number };

type View =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; snapshot: Snapshot; failure?: ApiFailure };

const borders = { success: "border-success", info: "border-info", warning: "border-warning", danger: "border-danger" } as const;

/**
 * Reads the subscription and its payments every few seconds, for at most
 * about two minutes, until the outcome is known. Read only: it never asks
 * the API to change anything, so reloading it is always safe.
 */
function usePaymentWatch(subscriptionId: string, round: number, left: boolean, paymentId: string | null) {
  const [view, setView] = useState<View>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: Snapshot | null = null;
    const startedAt = Date.now();

    async function tick() {
      const [subscription, payments] = await Promise.all([getMySubscription(subscriptionId), listMySubscriptionPayments(subscriptionId)]);
      if (cancelled) return;
      const elapsedMs = Date.now() - startedAt;
      if (subscription.ok && payments.ok) {
        last = { subscription: subscription.data.subscription, payments: payments.data.payments, elapsedMs };
        setView({ status: "ready", snapshot: last });
        const state = returnState({
          subscription: last.subscription,
          payment: pickPayment(last.payments, paymentId),
          left,
          elapsedMs,
        });
        if (shouldPoll(state, elapsedMs)) timer = setTimeout(() => void tick(), RETURN_POLL_INTERVAL_MS);
        return;
      }
      const failure = (!subscription.ok ? subscription.failure : !payments.ok ? payments.failure : null) as ApiFailure;
      // A passing network error while the outcome is shown: keep the last answer and ask again.
      if (last && failure.status !== 404 && failure.status !== 401 && failure.status !== 403 && shouldPoll("confirming", elapsedMs)) {
        setView({ status: "ready", snapshot: { ...last, elapsedMs }, failure });
        timer = setTimeout(() => void tick(), RETURN_POLL_INTERVAL_MS);
        return;
      }
      setView(last ? { status: "ready", snapshot: { ...last, elapsedMs }, failure } : { status: "error", failure });
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [subscriptionId, round, left, paymentId]);

  return view;
}

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="min-w-0">
          <dt className="text-sm text-muted">{term}</dt>
          <dd className="break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ subscriptionId }: { subscriptionId: string }) {
  const params = useSearchParams();
  // The address only picks which of the API's own payments to describe, and words a visit that was left.
  const paymentId = params.get("payment_id");
  const left = params.get("result") === "cancelled";
  const [round, setRound] = useState(0);
  const view = usePaymentWatch(subscriptionId, round, left, paymentId);

  const again = () => setRound((value) => value + 1);

  if (view.status === "loading") {
    return (
      <>
        <BackLink href={BACK}>Subscription</BackLink>
        <h1 className="mt-1 text-4xl">Your payment</h1>
        <div className="mt-8">
          <LoadingBlock label="Checking your payment" rows={2} />
        </div>
      </>
    );
  }

  if (view.status === "error") {
    return (
      <>
        <BackLink href={BACK}>Subscription</BackLink>
        <h1 className="mt-1 text-4xl">Your payment</h1>
        <div className="mt-8">
          {view.failure.status === 404 ? (
            <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
              <h2 className="text-2xl">We could not find that subscription</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">It may belong to another account. Your own subscriptions are on your subscription page.</p>
              <ButtonLink href={BACK} variant="secondary" className="mt-6">
                Go to your subscription
              </ButtonLink>
            </div>
          ) : (
            <LoadError failure={view.failure} onRetry={again} />
          )}
        </div>
      </>
    );
  }

  const { subscription, payments, elapsedMs } = view.snapshot;
  const payment = pickPayment(payments, paymentId);
  const state = returnState({ subscription, payment, left, elapsedMs });
  const words = RETURN_WORDS[state];
  const polling = shouldPoll(state, elapsedMs) && !view.failure;
  const shownPayment = payment ? paymentStatusLabel(payment) : null;
  const shownSubscription = subscriptionStatus(subscription);
  // An ACTIVE renewal that starts later reads "Paid, starts later".
  const startsLater = subscription.status === "ACTIVE" && shownSubscription.tone === "info";
  const hosted = payment?.status === "OPEN" ? safeHostedUrl(payment.hosted_url) : null;
  const Icon = words.tone === "success" ? CheckCircle2 : words.tone === "danger" ? XCircle : Clock;
  const retryable = state === "failed" || state === "cancelled" || state === "missing";

  return (
    <>
      <BackLink href={BACK}>Subscription</BackLink>
      <h1 className="mt-1 text-4xl">Your payment</h1>
      <p className="mt-2 text-muted">
        Invoice {subscription.invoice_number} · {subscription.plan_name}, {periodLabel(subscription.period)}
      </p>

      <Card className={`mt-8 border-l-4 ${borders[words.tone]}`}>
        <div role="status" aria-live="polite" className="flex items-start gap-3">
          <Icon className={`mt-1 size-6 shrink-0 ${polling ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-2xl">{words.title}</h2>
            <p className="mt-1 leading-relaxed text-ink">{words.text}</p>
            {state === "paid" && subscription.starts_at && subscription.ends_at && (
              <p className="mt-1 text-ink">
                {startsLater
                  ? `It starts on ${formatDay(subscription.starts_at, currentMarketZone())}, when the current period ends, and runs to ${formatDay(subscription.ends_at, currentMarketZone())}.`
                  : `It runs from ${formatDay(subscription.starts_at, currentMarketZone())} to ${formatDay(subscription.ends_at, currentMarketZone())}.`}
              </p>
            )}
          </div>
        </div>
        {polling && <p className="mt-3 text-sm text-muted">Checking again every few seconds…</p>}
        {view.failure && (
          <p className="mt-3 text-sm text-warning">We could not check just now: {view.failure.message}</p>
        )}

        <Facts
          items={[
            ["Invoice number", subscription.invoice_number],
            ["Amount", moneyText(payment?.amount ?? subscription.amount, payment?.currency_code ?? subscription.currency_code)],
            ["Subscription", shownSubscription.label],
            ...(payment && shownPayment ? ([["Payment", `${shownPayment.label}, started ${formatWhen(payment.created_at)}`]] as [string, string][]) : []),
          ]}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          {retryable && hosted && (
            <a href={hosted} className={buttonClasses("primary")}>
              Continue to payment
            </a>
          )}
          {retryable && !hosted && canPayOnline(subscription) && (
            <PayOnline subscription={subscription} label="Try again" onStale={again} className="sm:max-w-md" />
          )}
          {(state === "slow" || view.failure) && (
            <Button variant="secondary" onClick={again}>
              Check again
            </Button>
          )}
          <ButtonLink href={BACK} variant={state === "paid" ? "primary" : "secondary"}>
            Go to your subscription
          </ButtonLink>
        </div>
      </Card>
    </>
  );
}

/** `/account/subscriptions/<id>/payment`: the page the payment provider returns to (API 0.42.0). */
export function PaymentReturn({ subscriptionId }: { subscriptionId: string }) {
  return <RequireAuth>{() => <Body subscriptionId={subscriptionId} />}</RequireAuth>;
}
