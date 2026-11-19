"use client";

import { useCallback, useRef, useState } from "react";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { hasPlatformRole, PAYMENT_REFUND_ROLES, type User } from "@/lib/api/auth";
import { adminListSubscriptionPayments, adminRefundSubscription, type AdminPaymentView, type RefundView, type Subscription } from "@/lib/api/subscriptions";
import {
  compareDecimals,
  isFullRefund,
  moneyText,
  normaliseRefundAmount,
  paymentMessage,
  paymentStatusLabel,
  providerLabel,
  refundAmountProblem,
  refundReasonProblem,
  refundTarget,
  REFUND_REASON_MAX,
} from "@/lib/online-payment";

const REFUND_STATUS: Record<RefundView["status"], { label: string; tone: "info" | "success" | "danger" }> = {
  PENDING: { label: "Waiting for the provider", tone: "info" },
  SUCCEEDED: { label: "Refunded", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

/** A key per refund the administrator means: a retry of the same dialog is the same refund. */
function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function Refunds({ refunds }: { refunds: RefundView[] }) {
  if (refunds.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {refunds.map((refund) => {
        const shown = REFUND_STATUS[refund.status] ?? { label: refund.status, tone: "info" as const };
        return (
          <li key={refund.id} className="text-sm">
            <span className="font-medium tabular-nums text-ink">{moneyText(refund.amount, refund.currency_code)}</span>{" "}
            <Badge tone={shown.tone}>{shown.label}</Badge>{" "}
            <span className="text-muted">
              {refund.requested_by.name} · {formatWhen(refund.created_at)}
            </span>
            <span className="block whitespace-pre-line text-ink">{refund.reason}</span>
            {refund.failure_reason && <span className="block text-danger">{refund.failure_reason}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The online payments of one subscription (API 0.42.0), and the refund of
 * the paid one for SUPER_ADMIN and FINANCE_ADMIN. Nothing is shown when the
 * subscription has no online payment (always so with PAYMENT_GATEWAY=none).
 */
export function SubscriptionPayments({
  subscription,
  user,
  onChanged,
}: {
  subscription: Subscription;
  user: User;
  /** A refund was made: the subscription may be CANCELLED now. */
  onChanged: (text: string, tone?: "success" | "warning") => void;
}) {
  const load = useCallback(() => adminListSubscriptionPayments(subscription.id), [subscription.id]);
  const { state, reload } = useApi(load);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  const refunds = hasPlatformRole(user, PAYMENT_REFUND_ROLES);

  // Quiet while loading unless the subscription is known to have online payments, so nothing flickers without a gateway.
  if (state.status === "loading") {
    const expected = subscription.payment?.recorded_by === "GATEWAY" || subscription.online_payment_available === true;
    return expected ? <LoadingBlock label="Loading the online payments" rows={1} /> : null;
  }
  if (state.status === "error") {
    if (state.failure.status === 404) return null;
    return (
      <section aria-labelledby="sub-online-payments">
        <Card>
          <h2 id="sub-online-payments" className="text-2xl">
            Online payments
          </h2>
          <div className="mt-3">
            <LoadError failure={state.failure} onRetry={reload} />
          </div>
        </Card>
      </section>
    );
  }

  const payments = state.data.payments;
  if (payments.length === 0) return null;
  const target = refundTarget(payments);
  const max = target?.refundable.amount ?? "0.00";
  const currency = target?.refundable.currency ?? subscription.currency_code;

  function start() {
    if (!target) return;
    key.current = newKey();
    setAmount(max);
    setReason("");
    setErrors({});
    setDialogError(undefined);
    setOpen(true);
  }

  async function refund() {
    if (!target) return;
    const next = { amount: refundAmountProblem(amount, max, currency) ?? undefined, reason: refundReasonProblem(reason) ?? undefined };
    setErrors(next);
    if (next.amount || next.reason) {
      document.getElementById(next.amount ? "refund-amount" : "refund-reason")?.focus();
      return;
    }
    setBusy(true);
    setDialogError(undefined);
    const answer = await adminRefundSubscription(subscription.id, { amount: normaliseRefundAmount(amount), reason: reason.trim() }, key.current);
    setBusy(false);
    if (answer.ok) {
      setOpen(false);
      const { refund: made, subscription: after } = answer.data;
      const money = moneyText(made.amount, made.currency_code);
      onChanged(
        made.status === "PENDING"
          ? `A refund of ${money} was sent to the payment provider. It confirms it by itself.`
          : after.status === "CANCELLED"
            ? `${money} was refunded in full. The subscription is cancelled and the subscriber has been emailed.`
            : `${money} was refunded.`,
      );
      reload();
      return;
    }
    const { failure } = answer;
    const fields = failure.fields ?? {};
    if (fields.amount || fields.reason) {
      setErrors({ amount: fields.amount ? `Amount ${fields.amount}.` : undefined, reason: fields.reason ? `Reason ${fields.reason}.` : undefined });
      return;
    }
    if (failure.code === "REFUND_EXCEEDS_PAYMENT" || failure.code === "NO_GATEWAY_PAYMENT") {
      setOpen(false);
      onChanged(paymentMessage(failure), "warning");
      reload();
      return;
    }
    // 502: recorded FAILED and nothing moved; the same key may be sent again.
    setDialogError(paymentMessage(failure));
  }

  const full = target ? isFullRefund(amount || "0", max) && !refundAmountProblem(amount, max, currency) : false;

  return (
    <section aria-labelledby="sub-online-payments">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="sub-online-payments" className="text-2xl">
            Online payments
          </h2>
          {refunds && target && (
            <Button variant="secondary" onClick={start}>
              Refund
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">Every checkout of this invoice, newest first. Only the provider&apos;s signed confirmation activates a subscription.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Online payments of invoice {subscription.invoice_number}</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Amount</th>
                <th scope="col" className="py-2 pr-4 font-medium">Provider</th>
                <th scope="col" className="py-2 pr-4 font-medium">Started</th>
                <th scope="col" className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {payments.map((payment: AdminPaymentView) => {
                const shown = paymentStatusLabel(payment, "admin");
                return (
                  <tr key={payment.id}>
                    <td className="py-3 pr-4">
                      <Badge tone={shown.tone}>{shown.label}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-ink">
                      {moneyText(payment.amount, payment.currency_code)}
                      {payment.paid_amount && (payment.paid_amount !== payment.amount || payment.paid_currency_code !== payment.currency_code) && (
                        <span className="block text-muted">Paid {moneyText(payment.paid_amount, payment.paid_currency_code)}</span>
                      )}
                      {payment.refunded_amount && compareDecimals(payment.refunded_amount, "0") === 1 && (
                        <span className="block text-muted">Refunded {moneyText(payment.refunded_amount, payment.currency_code)}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink">{providerLabel(payment.provider)}</td>
                    <td className="py-3 pr-4 text-muted">
                      {formatWhen(payment.created_at)}
                      {payment.opened_by && <span className="block">by {payment.opened_by.name}</span>}
                    </td>
                    <td className="py-3 text-muted">
                      {payment.payment_ref && <span className="block break-all">Payment ref: {payment.payment_ref}</span>}
                      {payment.provider_ref && <span className="block break-all">Checkout ref: {payment.provider_ref}</span>}
                      {payment.succeeded_at && <span className="block">Paid {formatWhen(payment.succeeded_at)}</span>}
                      {payment.review_reason && <span className="block text-warning">Review: {payment.review_reason}</span>}
                      {payment.failure_reason && <span className="block text-danger">{payment.failure_reason}</span>}
                      <Refunds refunds={payment.refunds ?? []} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {refunds && !target && (
          <p className="mt-3 text-sm text-muted">Nothing is left to refund online. A bank transfer is refunded outside the platform: cancel with a refund due.</p>
        )}
      </Card>

      <ConfirmDialog
        open={open}
        title={target?.status === "REVIEW" ? "Refund the payment under review?" : "Refund this payment?"}
        confirmLabel={full ? `Yes, refund ${moneyText(normaliseRefundAmount(amount), currency)} in full` : "Yes, refund it"}
        busyLabel="Refunding…"
        cancelLabel="Go back"
        busy={busy}
        error={dialogError}
        onCancel={() => setOpen(false)}
        onConfirm={() => void refund()}
      >
        <p>
          The money goes back through the payment provider. At most {moneyText(max, currency)} can be refunded.{" "}
          {target?.status === "REVIEW"
            ? "This payment is under review, so the subscription is not changed."
            : full
              ? "A full refund cancels the subscription now: access ends at once and the subscriber is emailed."
              : "After a partial refund the subscription stays active until it ends. To end it early as well, cancel it."}
        </p>
        <Field id="refund-amount" label={`Amount (${currency})`} hint="Two decimals at most, for example 30.00." error={errors.amount} className="mt-4 text-left">
          <Input
            id="refund-amount"
            value={amount}
            inputMode="decimal"
            autoComplete="off"
            onChange={(event) => {
              setAmount(event.target.value);
              key.current = newKey();
              if (errors.amount) setErrors((current) => ({ ...current, amount: undefined }));
            }}
            aria-required="true"
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={fieldDescribedBy("refund-amount", { hint: "x", error: errors.amount })}
          />
        </Field>
        <Field id="refund-reason" label="Reason" hint="3 to 1000 characters. Kept in the audit log." error={errors.reason} className="mt-4 text-left">
          <Textarea
            id="refund-reason"
            rows={3}
            maxLength={REFUND_REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              key.current = newKey();
              if (errors.reason) setErrors((current) => ({ ...current, reason: undefined }));
            }}
            aria-required="true"
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={fieldDescribedBy("refund-reason", { hint: "x", error: errors.reason })}
          />
        </Field>
        <div aria-live="polite">{busy && <Alert tone="info" title="Asking the payment provider…" className="mt-4" />}</div>
      </ConfirmDialog>
    </section>
  );
}
