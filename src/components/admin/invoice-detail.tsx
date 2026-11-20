"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SUBSCRIPTION_READ_ROLES } from "@/lib/api/auth";
import type { ApiResult } from "@/lib/api/http";
import {
  adminCreditInvoice,
  adminDiscardInvoice,
  adminDisputeInvoice,
  adminGetInvoice,
  adminIssueInvoice,
  adminRecordInvoicePayment,
  adminReissueInvoice,
  adminResendInvoice,
  adminResolveInvoiceDispute,
  adminUpdateInvoice,
  adminVoidInvoice,
  type AdminInvoice,
  type PaymentMethod,
} from "@/lib/api/invoices";
import type { SubscriptionPeriod } from "@/lib/api/subscriptions";
import { actionLabel, eventLabel, invoiceErrorText, OFFLINE_METHODS, todayIso } from "@/lib/invoices";
import { formatAmount, periodLabel } from "@/lib/subscriptions";

const PATH = "/admin/invoices";

type Outcome = { tone: "success" | "danger"; text: string; traceId?: string } | null;
type Answer = ApiResult<{ invoice: AdminInvoice }>;

function failureText(answer: Answer | ApiResult<null>): { text: string; traceId?: string; fields?: Record<string, string> } {
  if (answer.ok) return { text: "" };
  return { text: invoiceErrorText(answer.failure.code) ?? answer.failure.message, traceId: answer.failure.traceId, fields: answer.failure.fields };
}

/** The reasoned decisions: void, dispute, resolve. */
const REASONED = {
  void: { title: "Void this invoice?", confirm: "Void invoice", body: "Nothing is due on a void invoice. Its renewal is cancelled. The number is kept.", call: adminVoidInvoice },
  dispute: { title: "Mark this invoice disputed?", confirm: "Mark disputed", body: "Use this for a contested charge, a chargeback or a refund under review.", call: adminDisputeInvoice },
  resolve_dispute: { title: "Resolve the dispute?", confirm: "Resolve", body: "The invoice goes back to the status it had before.", call: adminResolveInvoiceDispute },
} as const;

function DraftEditor({ invoice, onSaved }: { invoice: AdminInvoice; onSaved: (inv: AdminInvoice) => void }) {
  const [period, setPeriod] = useState<SubscriptionPeriod>(invoice.period);
  const [dueOn, setDueOn] = useState(invoice.due_on);
  const [terms, setTerms] = useState(invoice.terms);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await adminUpdateInvoice(invoice.id, { period, due_on: dueOn, terms });
    setBusy(false);
    if (answer.ok) {
      setErrors({});
      setOutcome({ tone: "success", text: "Draft saved." });
      onSaved(answer.data.invoice);
      return;
    }
    const f = failureText(answer);
    setErrors(f.fields ?? {});
    setOutcome(f.fields ? null : { tone: "danger", text: f.text, traceId: f.traceId });
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 className="text-xl">Edit the draft</h2>
      <Field id="draft-period" label="Period" error={errors.period}>
        <SearchableSelect
          id="draft-period"
          value={period}
          onValueChange={(value) => setPeriod(value as SubscriptionPeriod)}
          options={(["QUARTERLY", "YEARLY"] as const).map((value) => ({ value, label: periodLabel(value) }))}
        />
      </Field>
      <Field id="draft-due" label="Due date" error={errors.due_on}>
        <Input id="draft-due" type="date" value={dueOn} min={todayIso()} onChange={(event) => setDueOn(event.target.value)} />
      </Field>
      <Field id="draft-terms" label="Terms" hint="Shown on the invoice. At most 2000 characters." error={errors.terms}>
        <Textarea id="draft-terms" rows={4} maxLength={2000} value={terms} onChange={(event) => setTerms(event.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
        {busy ? "Saving…" : "Save the draft"}
      </Button>
      <div aria-live="polite">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
    </form>
  );
}

function PaymentForm({ invoice, onDone }: { invoice: AdminInvoice; onDone: (inv: AdminInvoice, text: string) => void }) {
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Outcome>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await adminRecordInvoicePayment(invoice.id, { amount, method, reference, received_on: receivedOn });
    setBusy(false);
    if (answer.ok) {
      setErrors({});
      setFailure(null);
      const inv = answer.data.invoice;
      onDone(inv, inv.status === "PAID" ? "Payment recorded. The invoice is paid and the renewal is active." : "Part payment recorded.");
      setAmount(inv.balance);
      setReference("");
      return;
    }
    const f = failureText(answer);
    setErrors(f.fields ?? {});
    setFailure(f.fields ? null : { tone: "danger", text: f.text, traceId: f.traceId });
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 className="text-xl">Record a payment</h2>
      <p className="text-sm text-muted">Record money received offline. The payment that clears the balance activates the renewal.</p>
      <Field id="pay-amount" label={`Amount (${invoice.currency_code})`} hint={`Due: ${formatAmount(invoice.balance, invoice.currency_code)}`} error={errors.amount}>
        <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field id="pay-method" label="Method" error={errors.method}>
        <SearchableSelect id="pay-method" value={method} onValueChange={(value) => setMethod(value as PaymentMethod)} options={OFFLINE_METHODS} />
      </Field>
      <Field id="pay-reference" label="Reference" optional hint="The bank reference or receipt number." error={errors.reference}>
        <Input id="pay-reference" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
      </Field>
      <Field id="pay-received" label="Received on" error={errors.received_on}>
        <Input id="pay-received" type="date" max={todayIso()} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
      </Field>
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Recording…" : "Record payment"}
      </Button>
      <div aria-live="polite">{failure && <Alert tone="danger" title={failure.text} traceId={failure.traceId} />}</div>
    </form>
  );
}

function CreditForm({ invoice, onDone }: { invoice: AdminInvoice; onDone: (inv: AdminInvoice, text: string) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Outcome>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await adminCreditInvoice(invoice.id, { amount, reason });
    setBusy(false);
    if (answer.ok) {
      setErrors({});
      setFailure(null);
      setAmount("");
      setReason("");
      onDone(answer.data.invoice, "Credit note issued.");
      return;
    }
    const f = failureText(answer);
    setErrors(f.fields ?? {});
    setFailure(f.fields ? null : { tone: "danger", text: f.text, traceId: f.traceId });
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 className="text-xl">Credit note</h2>
      <p className="text-sm text-muted">Lowers what is due. Crediting everything that is due on an unpaid invoice voids it.</p>
      <Field id="credit-amount" label={`Amount (${invoice.currency_code})`} hint={`At most ${formatAmount(invoice.balance, invoice.currency_code)}`} error={errors.amount}>
        <Input id="credit-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field id="credit-reason" label="Reason" hint="3 to 1000 characters. Shown on the credit note." error={errors.reason}>
        <Textarea id="credit-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
        {busy ? "Issuing…" : "Issue credit note"}
      </Button>
      <div aria-live="polite">{failure && <Alert tone="danger" title={failure.text} traceId={failure.traceId} />}</div>
    </form>
  );
}

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const load = useCallback(() => adminGetInvoice(id), [id]);
  const { state, reload, replace } = useApi(load);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "issue" | "discard">(null);
  const [reasoned, setReasoned] = useState<null | keyof typeof REASONED>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | undefined>();

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the invoice" rows={4} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  const invoice = state.status === "ready" ? state.data.invoice : state.previous!.invoice;
  const update = (inv: AdminInvoice, text?: string) => {
    replace({ invoice: inv });
    if (text) setOutcome({ tone: "success", text });
  };
  const can = (action: string) => invoice.actions.includes(action as never);

  async function run(action: string, call: () => Promise<Answer>, text: string, navigate = false) {
    setBusy(action);
    setOutcome(null);
    const answer = await call();
    setBusy(null);
    if (answer.ok) {
      if (navigate) router.push(`${PATH}/${answer.data.invoice.id}`);
      else update(answer.data.invoice, text);
      return true;
    }
    const f = failureText(answer);
    setOutcome({ tone: "danger", text: f.text, traceId: f.traceId });
    return false;
  }

  async function confirmed() {
    if (confirm === "issue") {
      setConfirm(null);
      await run("issue", () => adminIssueInvoice(invoice.id), "Issued and emailed to the payer.");
    } else if (confirm === "discard") {
      setBusy("discard");
      const answer = await adminDiscardInvoice(invoice.id);
      setBusy(null);
      setConfirm(null);
      if (answer.ok) router.push(PATH);
      else setOutcome({ tone: "danger", ...failureText(answer) });
    }
  }

  async function decideReasoned() {
    if (!reasoned) return;
    if (reason.trim().length < 3) {
      setDialogError("Give a reason (3 to 1000 characters).");
      return;
    }
    const words = REASONED[reasoned];
    setBusy(reasoned);
    const answer = await words.call(invoice.id, reason.trim());
    setBusy(null);
    if (answer.ok) {
      setReasoned(null);
      setReason("");
      update(answer.data.invoice, `${actionLabel(reasoned)}: done.`);
      return;
    }
    setDialogError(failureText(answer).text);
  }

  return (
    <>
      <BackLink href={PATH}>Invoices</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">{invoice.number ?? "Draft invoice"}</h1>
          <p className="mt-1 text-muted">
            {invoice.payer.name} · renews{" "}
            <Link href={`/admin/subscriptions/${invoice.renews_subscription_id}`} className="font-medium text-primary-ink hover:underline">
              this subscription
            </Link>
            {invoice.subscription_id && (
              <>
                {" · pays "}
                <Link href={`/admin/subscriptions/${invoice.subscription_id}`} className="font-medium text-primary-ink hover:underline">
                  the renewal
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div aria-live="polite" className="mt-4">
        {outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}
      </div>

      {invoice.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {can("issue") && (
            <Button onClick={() => setConfirm("issue")} disabled={busy !== null}>
              {actionLabel("issue")}
            </Button>
          )}
          {can("resend") && (
            <Button variant="secondary" disabled={busy !== null} aria-busy={busy === "resend"}
              onClick={() => void run("resend", () => adminResendInvoice(invoice.id), "Emailed to the payer again.")}>
              {busy === "resend" ? "Sending…" : actionLabel("resend")}
            </Button>
          )}
          {can("reissue") && (
            <Button variant="secondary" disabled={busy !== null} aria-busy={busy === "reissue"}
              onClick={() => void run("reissue", () => adminReissueInvoice(invoice.id), "", true)}>
              {actionLabel("reissue")}
            </Button>
          )}
          {(["void", "dispute", "resolve_dispute"] as const).filter(can).map((action) => (
            <Button key={action} variant={action === "resolve_dispute" ? "secondary" : "danger"} disabled={busy !== null}
              onClick={() => { setReason(""); setDialogError(undefined); setReasoned(action); }}>
              {actionLabel(action)}
            </Button>
          ))}
          {can("discard") && (
            <Button variant="ghost" onClick={() => setConfirm("discard")} disabled={busy !== null}>
              {actionLabel("discard")}
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <InvoiceDocument invoice={invoice} payments={invoice.payments} credits={invoice.credit_notes} />
        <div className="space-y-6">
          {can("edit") && (
            <Card>
              <DraftEditor invoice={invoice} onSaved={(inv) => update(inv)} />
            </Card>
          )}
          {can("record_payment") && (
            <Card>
              <PaymentForm invoice={invoice} onDone={update} />
            </Card>
          )}
          {can("credit_note") && (
            <Card>
              <CreditForm invoice={invoice} onDone={update} />
            </Card>
          )}
          <Card>
            <h2 className="text-xl">History</h2>
            <p className="mt-1 text-sm text-muted">
              Created by {invoice.created_by_name || "the finance team"}
              {invoice.send_count > 0 && ` · emailed ${invoice.send_count === 1 ? "once" : `${invoice.send_count} times`}`}
            </p>
            <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
              {invoice.events.map((e, index) => (
                <li key={`${e.at}-${index}`}>
                  <p className="font-medium text-ink">{eventLabel(e.action)}</p>
                  {e.note && <p className="text-sm text-ink">{e.note}</p>}
                  <p className="text-sm text-muted">
                    {e.actor_name || (e.actor_type === "SYSTEM" ? "RightProperty365" : "Finance")}, {formatWhen(e.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "issue" ? "Issue this invoice?" : "Discard this draft?"}
        confirmLabel={confirm === "issue" ? "Issue and email" : "Discard"}
        busyLabel={confirm === "issue" ? "Issuing…" : "Discarding…"}
        tone={confirm === "issue" ? "primary" : "danger"}
        busy={busy !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirmed()}
      >
        <p>
          {confirm === "issue"
            ? `The invoice gets its number, can no longer be edited, and is emailed to ${invoice.payer.name} for ${formatAmount(invoice.total, invoice.currency_code)}. The renewal it pays is created now and starts once the invoice is paid.`
            : "The draft has no number, so nothing is lost from the numbering."}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={reasoned !== null}
        title={reasoned ? REASONED[reasoned].title : ""}
        confirmLabel={reasoned ? REASONED[reasoned].confirm : ""}
        busyLabel="Saving…"
        tone={reasoned === "resolve_dispute" ? "primary" : "danger"}
        busy={busy !== null}
        error={dialogError}
        onCancel={() => setReasoned(null)}
        onConfirm={() => void decideReasoned()}
      >
        <p>{reasoned ? REASONED[reasoned].body : ""}</p>
        <Field id="invoice-reason" label="Reason" hint="3 to 1000 characters." className="mt-4 text-left">
          <Textarea id="invoice-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

/** `/admin/invoices/<id>`: one invoice; SUPER_ADMIN and FINANCE_ADMIN act on it. */
export function InvoiceDetailView({ id }: { id: string }) {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the invoices">
      {() => <Detail id={id} />}
    </RoleGate>
  );
}
