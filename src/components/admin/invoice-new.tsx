"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SUBSCRIPTION_MANAGE_ROLES } from "@/lib/api/auth";
import { adminCreateInvoice } from "@/lib/api/invoices";
import { adminListSubscriptions, type SubscriptionPeriod } from "@/lib/api/subscriptions";
import { invoiceErrorText, todayIso } from "@/lib/invoices";
import { formatDay, periodLabel } from "@/lib/subscriptions";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type Option = { value: string; label: string; secondary?: string; keywords?: string[] };

/** The newest active and recently ended subscriptions, to choose the one to renew. */
function useRenewable(selected: string) {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([adminListSubscriptions({ status: "ACTIVE", page: 1 }), adminListSubscriptions({ status: "EXPIRED", page: 1 })]).then((answers) => {
      if (cancelled) return;
      const out: Option[] = [];
      for (const answer of answers) {
        if (!answer.ok) continue;
        for (const sub of answer.data.items) {
          out.push({
            value: sub.id,
            label: `${sub.subscriber.name} · ${sub.plan_name}`,
            secondary: `${sub.invoice_number}${sub.ends_at ? `, ${sub.status === "EXPIRED" ? "ended" : "ends"} ${formatDay(sub.ends_at)}` : ""}`,
            keywords: [sub.invoice_number, sub.market_code],
          });
        }
      }
      if (selected && !out.some((o) => o.value === selected)) out.unshift({ value: selected, label: "The subscription you came from" });
      setOptions(out);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  return options;
}

function NewInvoice() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = UUID.test(params.get("subscription") ?? "") ? params.get("subscription")! : "";
  const [subscription, setSubscription] = useState(preset);
  const [period, setPeriod] = useState<"" | SubscriptionPeriod>("");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const options = useRenewable(preset);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!subscription) {
      setErrors({ renews_subscription_id: "Choose the subscription to renew." });
      return;
    }
    setBusy(true);
    const answer = await adminCreateInvoice({ renews_subscription_id: subscription, ...(period ? { period } : {}), ...(dueOn ? { due_on: dueOn } : {}) });
    setBusy(false);
    if (answer.ok) {
      router.push(`/admin/invoices/${answer.data.invoice.id}`);
      return;
    }
    setErrors(answer.failure.fields ?? {});
    setFailure(answer.failure.fields ? null : { text: invoiceErrorText(answer.failure.code) ?? answer.failure.message, traceId: answer.failure.traceId });
  }

  return (
    <>
      <BackLink href="/admin/invoices">Invoices</BackLink>
      <h1 className="mt-1 text-4xl">New renewal invoice</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Draft an invoice for the next period of a subscription. The draft uses the plan&apos;s price and the country&apos;s tax rule, if
        there is one. Nothing is sent until you issue it.
      </p>
      <Card className="mt-8 max-w-2xl">
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field id="new-sub" label="Subscription to renew" hint="Active, or ended in the last 90 days." error={errors.renews_subscription_id}>
            <SearchableSelect id="new-sub" value={subscription} onValueChange={setSubscription} options={[{ value: "", label: "Choose a subscription" }, ...options]} />
          </Field>
          <Field id="new-period" label="Period" optional hint="The same as the subscription's unless you choose." error={errors.period}>
            <SearchableSelect
              id="new-period"
              value={period}
              onValueChange={(value) => setPeriod(value as "" | SubscriptionPeriod)}
              options={[{ value: "", label: "Same as now" }, ...(["QUARTERLY", "YEARLY"] as const).map((value) => ({ value, label: periodLabel(value) }))]}
            />
          </Field>
          <Field id="new-due" label="Due date" optional hint="14 days from today unless you choose." error={errors.due_on}>
            <Input id="new-due" type="date" min={todayIso()} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </Field>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Creating…" : "Create draft"}
          </Button>
          <div aria-live="polite">{failure && <Alert tone="danger" title={failure.text} traceId={failure.traceId} />}</div>
        </form>
      </Card>
    </>
  );
}

/** `/admin/invoices/new?subscription=<id>` (SUPER_ADMIN, FINANCE_ADMIN). */
export function NewInvoiceView() {
  return (
    <RoleGate roles={SUBSCRIPTION_MANAGE_ROLES} what="creating invoices">
      {() => <NewInvoice />}
    </RoleGate>
  );
}
