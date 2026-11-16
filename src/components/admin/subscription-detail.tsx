"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { hasPlatformRole, SUBSCRIPTION_MANAGE_ROLES, SUBSCRIPTION_READ_ROLES, USER_READ_ROLES, type User } from "@/lib/api/auth";
import {
  adminApproveSubscription,
  adminCancelSubscription,
  adminGetSubscription,
  adminRejectSubscription,
  type Subscription,
  type SubscriptionDetail,
  type SubscriptionEvent,
} from "@/lib/api/subscriptions";
import {
  actionMessage,
  AMOUNT_PATTERN,
  fieldText,
  formatAmount,
  formatDay,
  PERIOD_LENGTH,
  periodLabel,
  subscriptionStatus,
  toCents,
  todayIso,
} from "@/lib/subscriptions";

const PATH = "/admin/subscriptions";

const EVENT_WORDS: Record<SubscriptionEvent["action"], string> = {
  REQUESTED: "Requested",
  RENEWAL_REQUESTED: "Renewal requested",
  CANCELLED: "Cancelled",
  PAYMENT_RECORDED: "Payment recorded",
  ACTIVATED: "Activated",
  REJECTED: "Rejected",
  EXPIRED: "Ended",
};

const CANCELLED_BY: Record<string, string> = { SUBSCRIBER: "the subscriber", ADMIN: "an administrator", SYSTEM: "the system" };

type Outcome = { tone: "success" | "warning"; text: string } | null;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="break-words text-ink">{children}</dd>
    </div>
  );
}

type PaymentErrors = { payment_reference?: string; amount?: string; received_on?: string; note?: string };

/** "Record payment and activate": the payment received outside the platform. */
function RecordPayment({ sub, onDone, onStale }: { sub: Subscription; onDone: (detail: SubscriptionDetail) => void; onStale: (text: string) => void }) {
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(sub.amount);
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const invoice = formatAmount(sub.amount, sub.currency_code);
  const ids: Record<keyof PaymentErrors, string> = {
    payment_reference: "pay-reference",
    amount: "pay-amount",
    received_on: "pay-received",
    note: "pay-note",
  };

  function focusFirst(next: PaymentErrors) {
    const first = (Object.keys(ids) as (keyof PaymentErrors)[]).find((key) => next[key]);
    if (first) document.getElementById(ids[first])?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: PaymentErrors = {};
    const ref = reference.trim();
    if (!ref) next.payment_reference = "Enter the bank reference or receipt number.";
    else if (ref.length > 100) next.payment_reference = "Use 100 characters or fewer.";
    const cents = toCents(amount);
    const invoiceCents = toCents(sub.amount);
    if (cents === null || cents <= 0) next.amount = "Enter the amount received, for example 30.00.";
    else if (invoiceCents !== null && cents < invoiceCents) next.amount = `The amount must be at least ${invoice}.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) next.received_on = "Enter the day the payment arrived.";
    else if (receivedOn > todayIso()) next.received_on = "The date cannot be in the future.";
    if (note.length > 1000) next.note = "Use 1000 characters or fewer.";
    setErrors(next);
    setFailure(null);
    if (Object.values(next).some(Boolean)) {
      focusFirst(next);
      return;
    }
    setBusy(true);
    const result = await adminApproveSubscription(sub.id, {
      payment_reference: ref,
      amount: amount.trim(),
      received_on: receivedOn,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setBusy(false);
    if (result.ok) {
      onDone(result.data);
      return;
    }
    const { failure: f } = result;
    if (f.code === "SUBSCRIPTION_STATE_CONFLICT" || f.status === 409) {
      onStale(actionMessage(f));
      return;
    }
    if (f.code === "PAYMENT_AMOUNT_TOO_LOW") {
      const amountError = { amount: `The amount must be at least ${invoice}.` };
      setErrors(amountError);
      focusFirst(amountError);
      return;
    }
    const fields = f.fields ?? {};
    const fromApi: PaymentErrors = {
      payment_reference: fieldText("Payment reference", fields.payment_reference),
      amount: fieldText("Amount", fields.amount),
      received_on: fieldText("Date received", fields.received_on),
      note: fieldText("Note", fields.note),
    };
    if (Object.values(fromApi).some(Boolean)) {
      setErrors(fromApi);
      focusFirst(fromApi);
      return;
    }
    setFailure({ text: actionMessage(f), traceId: f.traceId });
  }

  return (
    <section aria-labelledby="record-payment">
      <Card>
        <h2 id="record-payment" className="text-2xl">
          Record payment and activate
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Do this once the money is in our account. The subscription starts now
          {sub.renewal_of ? " (or when the current paid period ends, for this renewal)" : ""} and lasts{" "}
          {PERIOD_LENGTH[sub.period] ?? periodLabel(sub.period)}. The requester is emailed. If more than the invoice was paid,
          the amount received is recorded and the difference is refunded as the Refund Policy says.
        </p>
        <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field id={ids.payment_reference} label="Payment reference" hint="The bank reference or receipt number." error={errors.payment_reference}>
            <Input
              id={ids.payment_reference}
              value={reference}
              maxLength={100}
              autoComplete="off"
              onChange={(event) => setReference(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.payment_reference)}
              aria-describedby={fieldDescribedBy(ids.payment_reference, { hint: "x", error: errors.payment_reference })}
            />
          </Field>
          <Field id={ids.amount} label={`Amount received (${sub.currency_code})`} hint={`The invoice is for ${invoice}.`} error={errors.amount}>
            <Input
              id={ids.amount}
              value={amount}
              inputMode="decimal"
              pattern={AMOUNT_PATTERN.source}
              autoComplete="off"
              onChange={(event) => setAmount(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={fieldDescribedBy(ids.amount, { hint: "x", error: errors.amount })}
            />
          </Field>
          <Field id={ids.received_on} label="Date received" error={errors.received_on}>
            <Input
              id={ids.received_on}
              type="date"
              value={receivedOn}
              max={todayIso()}
              onChange={(event) => setReceivedOn(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.received_on)}
              aria-describedby={fieldDescribedBy(ids.received_on, { error: errors.received_on })}
            />
          </Field>
          <Field id={ids.note} label="Note" optional error={errors.note} className="sm:col-span-2">
            <Textarea
              id={ids.note}
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={fieldDescribedBy(ids.note, { error: errors.note })}
            />
          </Field>
          <div className="sm:col-span-2">
            {failure && <Alert title={failure.text} traceId={failure.traceId} className="mb-4" />}
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Recording…" : "Record payment and activate"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

type Decision = "reject" | "cancel" | null;

const decisionWords = {
  reject: {
    title: "Reject this request?",
    body: "The subscription will not start. The requester is emailed your reason.",
    refund: "A payment was received, so a refund is due",
    refundHint: "Under the Refund Policy, a payment for a service we do not activate is refunded.",
    confirm: "Yes, reject it",
    busy: "Rejecting…",
    done: "The request was rejected. The requester has been emailed.",
  },
  cancel: {
    title: "Cancel this subscription?",
    body: "It ends now. The requester is emailed your reason.",
    refund: "A refund is due",
    refundHint:
      "Tick this when a pro-rata refund of the unused period is due under the Refund Policy, for example when we withdraw it for a reason other than a breach of the Terms.",
    confirm: "Yes, cancel it",
    busy: "Cancelling…",
    done: "The subscription was cancelled. The requester has been emailed.",
  },
};

function Detail({ subscriptionId, user }: { subscriptionId: string; user: User }) {
  const load = useCallback(() => adminGetSubscription(subscriptionId), [subscriptionId]);
  const { state, reload, replace } = useApi(load);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [refundDue, setRefundDue] = useState(false);
  const [refundNote, setRefundNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const outcomeRef = useRef<HTMLDivElement>(null);
  const manages = hasPlatformRole(user, SUBSCRIPTION_MANAGE_ROLES);
  const readsUsers = hasPlatformRole(user, USER_READ_ROLES);

  function show(next: Outcome) {
    setOutcome(next);
    requestAnimationFrame(() => outcomeRef.current?.focus());
  }

  function openDecision(kind: Decision) {
    setDecision(kind);
    setReason("");
    setReasonError(undefined);
    setRefundDue(false);
    setRefundNote("");
    setDialogError(undefined);
  }

  if (state.status === "loading") return <LoadingBlock label="Loading the subscription" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that subscription</h1>
          <ButtonLink href={PATH} variant="secondary" className="mt-6">
            Back to subscriptions
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const { subscription: sub, events, usage } = state.data;
  const shown = subscriptionStatus(sub);
  const pending = sub.status === "PENDING_PAYMENT";
  const cancellable = pending || sub.status === "ACTIVE";
  const words = decision ? decisionWords[decision] : null;

  const stale = (text: string) => {
    show({ tone: "warning", text: `${text}` });
    reload();
  };

  async function decide() {
    if (!decision) return;
    const text = reason.trim();
    const problem =
      text.length < 3 ? "Write a reason of at least 3 characters. The requester is emailed it." : text.length > 1000 ? "Use 1000 characters or fewer." : undefined;
    setReasonError(problem);
    if (problem) {
      document.getElementById("decision-reason")?.focus();
      return;
    }
    setBusy(true);
    setDialogError(undefined);
    const input = { reason: text, refund_due: refundDue, ...(refundDue && refundNote.trim() ? { refund_note: refundNote.trim() } : {}) };
    const result = decision === "reject" ? await adminRejectSubscription(sub.id, input) : await adminCancelSubscription(sub.id, input);
    setBusy(false);
    if (result.ok) {
      const done = decisionWords[decision].done;
      setDecision(null);
      replace(result.data);
      show({ tone: "success", text: done });
      return;
    }
    if (result.failure.status === 409) {
      setDecision(null);
      stale(actionMessage(result.failure));
      return;
    }
    const fields = result.failure.fields ?? {};
    if (fields.reason) {
      setReasonError(fieldText("Reason", fields.reason));
      return;
    }
    setDialogError(fieldText("Refund note", fields.refund_note) ?? actionMessage(result.failure));
  }

  const subscriberName =
    sub.subscriber.kind === "INDIVIDUAL" && readsUsers ? (
      <Link href={`/admin/users/${sub.subscriber.id}`} className="font-medium text-primary-ink hover:underline">
        {sub.subscriber.name}
      </Link>
    ) : (
      sub.subscriber.name
    );

  return (
    <>
      <BackLink href={PATH}>Subscriptions</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={shown.tone}>{shown.label}</Badge>
        <Badge tone="accent">{sub.market_code}</Badge>
        {sub.refund_due && <Badge tone="danger">Refund due</Badge>}
        {sub.renewal_of && <Badge tone="info">Renewal</Badge>}
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">Invoice {sub.invoice_number}</h1>
      <p className="mt-2 text-muted">
        {sub.plan_name} for {sub.subscriber.name} · {formatAmount(sub.amount, sub.currency_code)}
      </p>

      <div ref={outcomeRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {outcome && <Alert tone={outcome.tone} title={outcome.text} className="mt-6" />}
      </div>

      <div className="mt-8 space-y-8">
        {manages && pending && (
          <RecordPayment
            key={sub.updated_at}
            sub={sub}
            onDone={(detail) => {
              replace(detail);
              show({ tone: "success", text: "The payment was recorded and the subscription is active. The requester has been emailed." });
            }}
            onStale={stale}
          />
        )}

        <section aria-labelledby="sub-details">
          <Card>
            <h2 id="sub-details" className="text-2xl">
              Details
            </h2>
            <dl className="mt-3 divide-y divide-line">
              <Row label="Subscriber">
                {subscriberName} <span className="text-sm text-muted">({sub.subscriber.kind === "ORGANISATION" ? "organisation" : "person"})</span>
              </Row>
              <Row label="Requested by">
                {sub.requested_by.id && readsUsers ? (
                  <Link href={`/admin/users/${sub.requested_by.id}`} className="font-medium text-primary-ink hover:underline">
                    {sub.requested_by.name}
                  </Link>
                ) : (
                  sub.requested_by.name
                )}
              </Row>
              <Row label="Plan">
                <Link href={`/admin/subscription-plans/${sub.plan_id}`} className="font-medium text-primary-ink hover:underline">
                  {sub.plan_name}
                </Link>
              </Row>
              <Row label="Period">
                {periodLabel(sub.period)} ({PERIOD_LENGTH[sub.period] ?? sub.period})
              </Row>
              <Row label="Amount">{formatAmount(sub.amount, sub.currency_code)}</Row>
              <Row label="Invoice reference">{sub.invoice_number}</Row>
              <Row label="Country and currency">
                {sub.market_code} · {sub.currency_code}
              </Row>
              <Row label="Requested">{formatWhen(sub.created_at)}</Row>
              {sub.activated_at && <Row label="Activated">{formatWhen(sub.activated_at)}</Row>}
              {sub.starts_at && <Row label="Starts">{formatDay(sub.starts_at)}</Row>}
              {sub.ends_at && <Row label="Ends">{formatDay(sub.ends_at)}</Row>}
              {sub.renewal_opens_at && <Row label="Renewal opens">{formatDay(sub.renewal_opens_at)}</Row>}
              {sub.expired_at && <Row label="Ended">{formatWhen(sub.expired_at)}</Row>}
              {sub.renewal_of && (
                <Row label="Renews">
                  <Link href={`${PATH}/${sub.renewal_of}`} className="font-medium text-primary-ink hover:underline">
                    The previous subscription
                  </Link>
                </Row>
              )}
              {sub.rejected_at && (
                <Row label="Rejected">
                  {formatWhen(sub.rejected_at)}
                  {sub.rejection_reason && <span className="mt-1 block whitespace-pre-line text-sm">{sub.rejection_reason}</span>}
                </Row>
              )}
              {sub.cancelled_at && (
                <Row label="Cancelled">
                  {formatWhen(sub.cancelled_at)}
                  {sub.cancelled_by && ` by ${CANCELLED_BY[sub.cancelled_by] ?? sub.cancelled_by}`}
                  {sub.cancel_reason && <span className="mt-1 block whitespace-pre-line text-sm">{sub.cancel_reason}</span>}
                </Row>
              )}
              {(sub.refund_due || sub.refund_note) && (
                <Row label="Refund">
                  {sub.refund_due ? "A refund is due. No money moves here: pay it outside the platform." : "No refund is due."}
                  {sub.refund_note && <span className="mt-1 block whitespace-pre-line text-sm">{sub.refund_note}</span>}
                </Row>
              )}
            </dl>
          </Card>
        </section>

        {sub.payment && (
          <section aria-labelledby="sub-payment">
            <Card>
              <h2 id="sub-payment" className="text-2xl">
                Payment recorded
              </h2>
              <dl className="mt-3 divide-y divide-line">
                <Row label="Reference">{sub.payment.reference}</Row>
                <Row label="Amount">{formatAmount(sub.payment.amount, sub.currency_code)}</Row>
                <Row label="Received on">{formatDay(sub.payment.received_on)}</Row>
                {sub.payment.note && <Row label="Note">{sub.payment.note}</Row>}
                <Row label="Recorded by">{sub.payment.recorded_by_name}</Row>
              </dl>
            </Card>
          </section>
        )}

        <section aria-labelledby="sub-usage">
          <Card>
            <h2 id="sub-usage" className="text-2xl">
              Usage
            </h2>
            <p className="mt-3 text-ink">
              <span className="text-3xl font-bold tabular-nums">{usage.active_listings}</span>{" "}
              {usage.max_active_listings === null
                ? "active listings (no limit)"
                : `of ${usage.max_active_listings} active listings`}
            </p>
            {!usage.limit_enforced && <p className="mt-1 text-sm text-muted">The limit is shown only. It is not enforced yet.</p>}
          </Card>
        </section>

        <section aria-labelledby="sub-history">
          <Card>
            <h2 id="sub-history" className="text-2xl">
              History
            </h2>
            {events.length === 0 ? (
              <p className="mt-3 text-muted">Nothing recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 border-line pl-3">
                    <p className="font-medium text-ink">{EVENT_WORDS[event.action] ?? event.action}</p>
                    <p className="text-sm text-muted">
                      {event.actor_name} · {formatWhen(event.at)}
                    </p>
                    {event.note && <p className="mt-1 whitespace-pre-line text-sm text-ink">{event.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>

        {manages && cancellable && (
          <div className="flex flex-wrap gap-3">
            {pending && (
              <Button variant="danger" onClick={() => openDecision("reject")}>
                Reject the request
              </Button>
            )}
            <Button variant={pending ? "secondary" : "danger"} onClick={() => openDecision("cancel")}>
              Cancel the subscription
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={decision !== null}
        title={words?.title ?? ""}
        confirmLabel={words?.confirm ?? ""}
        busyLabel={words?.busy}
        cancelLabel="Go back"
        busy={busy}
        error={dialogError}
        onCancel={() => setDecision(null)}
        onConfirm={() => void decide()}
      >
        <p>{words?.body}</p>
        <Field id="decision-reason" label="Reason" hint="3 to 1000 characters." error={reasonError} className="mt-4 text-left">
          <Textarea
            id="decision-reason"
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError(undefined);
            }}
            aria-required="true"
            aria-invalid={Boolean(reasonError)}
            aria-describedby={fieldDescribedBy("decision-reason", { hint: "x", error: reasonError })}
          />
        </Field>
        <label className="mt-4 flex min-h-11 items-start gap-3 text-left text-ink">
          <input
            type="checkbox"
            checked={refundDue}
            onChange={(event) => setRefundDue(event.currentTarget.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            <span className="font-medium">{words?.refund}</span>
            <span className="block text-sm text-muted">{words?.refundHint} No money moves here.</span>
          </span>
        </label>
        {refundDue && (
          <Field id="decision-refund-note" label="Refund note" optional className="mt-3 text-left">
            <Textarea
              id="decision-refund-note"
              rows={3}
              maxLength={1000}
              value={refundNote}
              onChange={(event) => setRefundNote(event.target.value)}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/admin/subscriptions/<id>`: one subscription; FINANCE_ADMIN and SUPER_ADMIN decide it. */
export function SubscriptionDetailView({ subscriptionId }: { subscriptionId: string }) {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the subscriptions">
      {(user) => <Detail subscriptionId={subscriptionId} user={user} />}
    </RoleGate>
  );
}
