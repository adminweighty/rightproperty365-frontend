"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { adminReportExport } from "@/lib/api/admin-reports";
import { hasPlatformRole, PAYMENT_EXPORT_ROLES, SUBSCRIPTION_READ_ROLES, type User } from "@/lib/api/auth";
import { adminListPayments, PAYMENTS_PAGE_SIZE, type PaymentStatus } from "@/lib/api/subscriptions";
import { compareDecimals, moneyText, PAYMENT_STATUSES, paymentStatusLabel, PROVIDER_LABELS, providerLabel } from "@/lib/online-payment";
import { pageFrom } from "@/lib/request-filters";
import { todayIso } from "@/lib/subscriptions";

const PATH = "/admin/payments";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PROVIDER = /^[a-z][a-z0-9_-]{0,31}$/;

/** "Needs review" first: it is the finance team's work queue. "All" is the one without a status. */
const TABS: { key: string; label: string; status?: PaymentStatus }[] = [
  { key: "all", label: "All" },
  { key: "REVIEW", label: "Needs review", status: "REVIEW" },
  ...PAYMENT_STATUSES.filter((status) => status !== "REVIEW").map((status) => ({
    key: status,
    label: paymentStatusLabel({ status }, "admin").label,
    status,
  })),
];

type Filters = { tab: string; provider: string; q: string };

function hrefFor(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.tab !== "all") params.set("status", filters.tab);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** The payments CSV (SUPER_ADMIN, FINANCE_ADMIN), by the day the payment was started. */
function PaymentsDownload({ user }: { user: User }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string; traceId?: string } | null>(null);
  if (!hasPlatformRole(user, PAYMENT_EXPORT_ROLES)) return null;

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem =
      (from && !DAY.test(from)) || (to && !DAY.test(to))
        ? "Enter the days as dates."
        : from && to && from > to
          ? "The first day must be on or before the last day."
          : to && to > todayIso()
            ? "The last day cannot be in the future."
            : undefined;
    setError(problem);
    setNotice(null);
    if (problem) {
      document.getElementById("payments-from")?.focus();
      return;
    }
    setBusy(true);
    const answer = await adminReportExport("payments", { from: from || undefined, to: to || undefined });
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const { blob, headers } = answer.data;
    const named = /filename="?([^";]+)"?/i.exec(headers.get("Content-Disposition") ?? "")?.[1];
    const name = named ?? `payments-${from || "start"}-to-${to || todayIso()}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    const total = headers.get("X-Total-Count");
    setNotice(
      headers.get("X-Export-Truncated") === "true"
        ? { tone: "warning", text: `Downloaded ${name}, but some rows were left out${total ? ` (${total} match)` : ""}. Choose a shorter date range to get them all.` }
        : { tone: "success", text: `Downloaded ${name}.` },
    );
  }

  return (
    <section aria-labelledby="payments-download" className="mt-10">
      <Card>
        <h2 id="payments-download" className="text-2xl">
          Download as a spreadsheet
        </h2>
        <p className="mt-1 text-sm text-muted">Online payments started in the range (UTC days, both included), newest first. Leave the days empty for the most recent.</p>
        <form onSubmit={download} noValidate className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field id="payments-from" label="First day" optional error={error}>
            <Input
              id="payments-from"
              type="date"
              value={from}
              max={todayIso()}
              onChange={(event) => setFrom(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy("payments-from", { error })}
            />
          </Field>
          <Field id="payments-to" label="Last day" optional>
            <Input id="payments-to" type="date" value={to} max={todayIso()} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy || undefined}>
            <Download className="size-4" aria-hidden="true" />
            {busy ? "Preparing…" : "Payments (CSV)"}
          </Button>
        </form>
        <div aria-live="polite">{notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-4" />}</div>
      </Card>
    </section>
  );
}

function List({ user }: { user: User }) {
  const params = useSearchParams();
  const tab = TABS.find((item) => item.key === (params.get("status") ?? "all")) ?? TABS[0];
  const provider = PROVIDER.test(params.get("provider") ?? "") ? params.get("provider")! : "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const page = pageFrom(params.get("page"));
  const filtered = Boolean(provider || q);

  const load = useCallback(
    () => adminListPayments({ status: tab.status, provider: provider || undefined, q: q || undefined, page }),
    [tab.status, provider, q, page],
  );
  const { state, reload } = useApi(load);
  const filters: Filters = { tab: tab.key, provider, q };
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || PAYMENTS_PAGE_SIZE))) : 1;
  const providers = [...new Set([...Object.keys(PROVIDER_LABELS), ...(provider ? [provider] : [])])].map((value) => ({ value, label: providerLabel(value) }));

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Online payments</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every online checkout of a subscription invoice. Only the provider&apos;s signed confirmation activates a subscription.
            Payments that need review received money that did not match the invoice: they were not activated.
          </p>
        </div>
        <ButtonLink href="/admin/subscriptions" variant="secondary">
          Subscriptions
        </ButtonLink>
      </div>

      <div className="mt-8">
        <ChipNav
          label="Payment status"
          items={TABS.map((item) => ({ key: item.key, href: hrefFor({ ...filters, tab: item.key }), label: item.label, current: item.key === tab.key }))}
        />
      </div>

      <form action={PATH} role="search" aria-label="Filter payments" className="mt-5 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
        {tab.key !== "all" && <input type="hidden" name="status" value={tab.key} />}
        <Field id="payments-q" label="Invoice, subscriber or reference">
          <Input id="payments-q" name="q" type="search" defaultValue={q} key={q} maxLength={100} placeholder="RPS-2026-000123" autoComplete="off" />
        </Field>
        <Field id="payments-provider" label="Provider">
          <SearchableSelect id="payments-provider" name="provider" defaultValue={provider} options={[{ value: "", label: "Any provider" }, ...providers]} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">
            <Search className="size-4" aria-hidden="true" />
            Filter
          </Button>
          {filtered && (
            <ButtonLink href={hrefFor({ tab: tab.key, provider: "", q: "" })} variant="ghost">
              Clear filters
            </ButtonLink>
          )}
        </div>
      </form>

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the payments" rows={3} />}
        {data && (
          <p className="text-sm text-muted" role="status">
            {data.total === 1 ? "1 payment" : `${data.total} payments`}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-4">
            <EmptyState title={filtered ? "No payments match those filters" : tab.key === "REVIEW" ? "Nothing needs review" : "No online payments here"}>
              {!filtered && tab.key === "all" ? "Online payments appear here once online payment is on and a subscriber pays an invoice online." : undefined}
            </EmptyState>
          </div>
        )}
        {data && data.items.length > 0 && (
          <Card padded={false} className="mt-4">
            <ul className="divide-y divide-line">
              {data.items.map((payment) => {
                const shown = paymentStatusLabel(payment, "admin");
                const href = `/admin/subscriptions/${payment.subscription_id}`;
                return (
                  <li key={payment.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={href} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                          {payment.invoice_number}
                        </Link>
                        <Badge tone={shown.tone}>{shown.label}</Badge>
                        <Badge tone="accent">{payment.market_code}</Badge>
                      </p>
                      <p className="text-ink">
                        {payment.subscriber.name}{" "}
                        <span className="text-sm text-muted">({payment.subscriber.kind === "ORGANISATION" ? "organisation" : "person"})</span>
                      </p>
                      <p className="text-sm text-muted">
                        <span className="tabular-nums">{moneyText(payment.amount, payment.currency_code)}</span>
                        {payment.paid_amount && ` · paid ${moneyText(payment.paid_amount, payment.paid_currency_code)}`}
                        {compareDecimals(payment.refunded_amount || "0", "0") === 1 && ` · refunded ${moneyText(payment.refunded_amount, payment.currency_code)}`}
                        {` · ${providerLabel(payment.provider)}`}
                      </p>
                      {payment.review_reason && <p className="text-sm text-warning">Review: {payment.review_reason}</p>}
                      <p className="break-all text-xs text-subtle">
                        Started {formatWhen(payment.created_at)}
                        {payment.payment_ref ? ` · ${payment.payment_ref}` : payment.provider_ref ? ` · ${payment.provider_ref}` : ""}
                      </p>
                    </div>
                    <ButtonLink href={href} size="sm" variant={payment.status === "REVIEW" ? "primary" : "secondary"}>
                      Open<span className="sr-only"> {payment.invoice_number}</span>
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {data && <Pagination page={page} totalPages={totalPages} hrefFor={(value) => hrefFor(filters, value)} label="Payments" className="mt-8" />}
      </div>

      <PaymentsDownload user={user} />
    </>
  );
}

/** `/admin/payments` (SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN, SUPPORT; the CSV for SUPER_ADMIN and FINANCE_ADMIN). */
export function PaymentList() {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the online payments">
      {(user) => <List user={user} />}
    </RoleGate>
  );
}
