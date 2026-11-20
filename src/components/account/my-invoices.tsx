"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { getMyInvoice, INVOICES_PAGE_SIZE, listMyInvoices } from "@/lib/api/invoices";
import { INVOICE_STATUS_TONES, payerStatusText } from "@/lib/invoices";
import { pageFrom } from "@/lib/request-filters";
import { formatAmount, formatDay } from "@/lib/subscriptions";

const PATH = "/account/invoices";

/** The path of an absolute web link (the API's pay_url), so it stays on this site. */
function localPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function List() {
  const params = useSearchParams();
  const page = pageFrom(params.get("page"));
  const load = useCallback(() => listMyInvoices(page), [page]);
  const { state, reload } = useApi(load);
  const data = state.status === "ready" ? state.data : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || INVOICES_PAGE_SIZE))) : 1;
  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Invoices</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Renewal invoices for your subscriptions and those of the organisations you own or manage, with their receipts.
      </p>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your invoices" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {data && data.items.length === 0 && (
          <EmptyState title="No invoices yet">Renewal invoices from our finance team appear here.</EmptyState>
        )}
        {data && data.items.length > 0 && (
          <ul className="space-y-4">
            {data.items.map((inv) => (
              <li key={inv.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={INVOICE_STATUS_TONES[inv.status] ?? "neutral"}>{inv.status_label}</Badge>
                    <span className="ml-auto text-sm text-muted">Issued {inv.issue_on ? formatDay(inv.issue_on) : ""}</span>
                  </div>
                  <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                    <Link href={`${PATH}/${inv.id}`} className="text-primary-ink hover:underline">
                      {inv.number}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">
                    {inv.payer.name} · {inv.plan_name} · {formatAmount(inv.total, inv.currency_code)}
                  </p>
                  <p className="mt-1 text-sm text-ink">{payerStatusText(inv.status, inv.due_on, formatDay)}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > INVOICES_PAGE_SIZE && (
          <Pagination page={page} totalPages={totalPages} hrefFor={(value) => (value > 1 ? `${PATH}?page=${value}` : PATH)} label="Invoices" className="mt-8" />
        )}
      </div>
    </>
  );
}

/** `/account/invoices`: the caller's issued invoices. */
export function MyInvoices() {
  return <RequireAuth>{() => <List />}</RequireAuth>;
}

function Detail({ id }: { id: string }) {
  const load = useCallback(() => getMyInvoice(id), [id]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the invoice" rows={4} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState
          title="We could not find that invoice"
          action={
            <ButtonLink href={PATH} variant="secondary">
              Back to your invoices
            </ButtonLink>
          }
        >
          Only invoices for you or an organisation you own or manage can be opened here.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  const inv = state.data.invoice;
  const payable = inv.status === "ISSUED" || inv.status === "PART_PAID" || inv.status === "OVERDUE";
  return (
    <>
      <BackLink href={PATH}>Your invoices</BackLink>
      <h1 className="mt-1 text-3xl md:text-4xl">Invoice {inv.number}</h1>
      <p className="mt-2 text-muted">{payerStatusText(inv.status, inv.due_on, formatDay)}</p>
      {payable && (
        <Card className="mt-6 print:hidden">
          <h2 className="text-xl">How to pay {formatAmount(inv.balance, inv.currency_code)}</h2>
          {inv.pay_online && inv.pay_url ? (
            <>
              <p className="mt-2 text-muted">Pay online on your subscription page, or pay offline as described below.</p>
              <ButtonLink href={localPath(inv.pay_url)} className="mt-4">
                Pay online
              </ButtonLink>
            </>
          ) : inv.pay_url ? (
            <ButtonLink href={localPath(inv.pay_url)} variant="secondary" className="mt-4">
              Open the subscription
            </ButtonLink>
          ) : null}
          <p className="mt-4 text-sm text-ink">{inv.offline_instructions}</p>
          <p className="mt-2 text-sm text-muted">
            Quote <span className="font-mono">{inv.number}</span> with your payment.
          </p>
        </Card>
      )}
      <div className="mt-6">
        <InvoiceDocument invoice={inv} payments={inv.payments} credits={inv.credit_notes} />
      </div>
    </>
  );
}

/** `/account/invoices/<id>`: one invoice, how to pay it, and its receipts. */
export function MyInvoiceDetail({ id }: { id: string }) {
  return <RequireAuth>{() => <Detail id={id} />}</RequireAuth>;
}
