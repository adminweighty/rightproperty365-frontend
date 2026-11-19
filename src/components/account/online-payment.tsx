"use client";

import { CreditCard } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMySubscriptionPayments, startMyCheckout, type Subscription } from "@/lib/api/subscriptions";
import { canPayOnline, moneyText, paymentMessage, paymentStatusLabel, paymentStatusText, safeHostedUrl } from "@/lib/online-payment";

/** Shown next to every "Pay online" button: only the provider's confirmation activates the subscription. */
export const PAY_ONLINE_WORDS =
  "You pay on the payment provider's secure page. Your subscription activates once the provider confirms the payment to us, which may take a moment.";

/**
 * "Pay online" for a PENDING_PAYMENT invoice when the API offers it
 * (`online_payment_available`). It asks the API for the checkout and sends
 * the browser to the provider's page. Nothing is shown otherwise, so with
 * PAYMENT_GATEWAY=none the page is as before.
 */
export function PayOnline({
  subscription,
  label = "Pay online",
  onStale,
  className,
}: {
  subscription: Subscription;
  label?: string;
  /** The subscription changed (409 SUBSCRIPTION_STATE_CONFLICT) or online payment is off: load it again. */
  onStale?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const retried = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!canPayOnline(subscription)) return null;

  async function pay() {
    setBusy(true);
    setFailure(null);
    const answer = await startMyCheckout(subscription.id);
    if (answer.ok) {
      const url = safeHostedUrl(answer.data.hosted_url);
      if (url) {
        setLeaving(true);
        // A full page, never a frame: the provider's page must be the top window.
        window.location.assign(url);
        return;
      }
      setBusy(false);
      setFailure({ text: "The payment page could not be opened. Please try again later, or pay by bank transfer." });
      return;
    }
    const { failure: f } = answer;
    // Another checkout of this invoice is being made this second: the API asks to retry after 2 s.
    if (f.code === "CHECKOUT_IN_PROGRESS" && retried.current < 2) {
      retried.current += 1;
      timer.current = setTimeout(() => void pay(), 2000);
      return;
    }
    retried.current = 0;
    setBusy(false);
    setFailure({ text: paymentMessage(f), traceId: f.traceId });
    if (f.code === "SUBSCRIPTION_STATE_CONFLICT" || f.code === "ONLINE_PAYMENT_NOT_OFFERED") onStale?.();
  }

  return (
    <div className={className}>
      <Button onClick={() => void pay()} disabled={busy} aria-busy={busy || undefined}>
        <CreditCard className="size-4" aria-hidden="true" />
        {leaving ? "Opening the payment page…" : busy ? "Preparing…" : label}
        <span className="sr-only">: invoice {subscription.invoice_number}</span>
      </Button>
      <p className="mt-2 text-sm leading-relaxed text-muted">{PAY_ONLINE_WORDS}</p>
      <div aria-live="polite">{failure && <Alert title={failure.text} traceId={failure.traceId} className="mt-3" />}</div>
    </div>
  );
}

/**
 * Whether a subscription has online payments worth listing: it can be paid
 * online now, or a gateway confirmed its payment. Without a gateway neither
 * is true, so nothing is asked and nothing changes.
 */
export const hasOnlinePayments = (subscription: Subscription) =>
  canPayOnline(subscription) || subscription.payment?.recorded_by === "GATEWAY";

/** The online payment attempts of one subscription, newest first (PaymentView). */
export function PaymentHistory({ subscription, headingLevel = 4 }: { subscription: Subscription; headingLevel?: 3 | 4 }) {
  const load = useCallback(() => listMySubscriptionPayments(subscription.id), [subscription.id]);
  const { state, reload } = useApi(load);
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const headingId = `payments-${subscription.id}`;

  // ONLINE_PAYMENT_NOT_OFFERED or no such list: there is nothing to show.
  if (state.status === "error" && state.failure.status === 404) return null;

  return (
    <section aria-labelledby={headingId} className="mt-5">
      <Heading id={headingId} className="font-sans text-base font-semibold tracking-normal">
        Online payments
      </Heading>
      <div className="mt-2">
        {state.status === "loading" && <LoadingBlock label="Loading the online payments" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.payments.length === 0 && (
          <p className="text-sm text-muted">No online payment has been started for this invoice.</p>
        )}
        {state.status === "ready" && state.data.payments.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line">
            {state.data.payments.map((payment) => {
              const shown = paymentStatusLabel(payment);
              const url = payment.status === "OPEN" ? safeHostedUrl(payment.hosted_url) : null;
              return (
                <li key={payment.id} className="px-3 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums text-ink">{moneyText(payment.amount, payment.currency_code)}</span>
                    <Badge tone={shown.tone}>{shown.label}</Badge>
                  </p>
                  <p className="mt-1 text-muted">
                    Started {formatWhen(payment.created_at)}
                    {payment.succeeded_at && ` · paid ${formatWhen(payment.succeeded_at)}`}
                    {payment.refunded_at && ` · refunded ${formatWhen(payment.refunded_at)}`}
                  </p>
                  <p className="mt-1 text-ink">{paymentStatusText(payment)}</p>
                  {url && (
                    <a href={url} className="mt-1 inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                      Continue to payment
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
