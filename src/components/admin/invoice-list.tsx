"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { hasPlatformRole, SUBSCRIPTION_MANAGE_ROLES, SUBSCRIPTION_READ_ROLES, type User } from "@/lib/api/auth";
import { adminListInvoices, INVOICES_PAGE_SIZE } from "@/lib/api/invoices";
import { INVOICE_STATUS_TONES, INVOICE_TABS } from "@/lib/invoices";
import { pageFrom } from "@/lib/request-filters";
import { formatAmount, formatDay } from "@/lib/subscriptions";

const PATH = "/admin/invoices";

type Country = { value: string; label: string; keywords?: string[] };
type Filters = { tab: string; market: string; q: string };

function hrefFor(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.tab !== INVOICE_TABS[0].key) params.set("tab", filters.tab);
  if (filters.market) params.set("market", filters.market);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

function List({ countries, user }: { countries: Country[]; user: User }) {
  const params = useSearchParams();
  const tab = INVOICE_TABS.find((item) => item.key === (params.get("tab") ?? INVOICE_TABS[0].key)) ?? INVOICE_TABS[0];
  const market = /^[A-Z]{2}$/.test(params.get("market") ?? "") ? params.get("market")! : "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const page = pageFrom(params.get("page"));
  const filtered = Boolean(market || q);
  const load = useCallback(
    () => adminListInvoices({ status: tab.status, market: market || undefined, q: q || undefined, page }),
    [tab.status, market, q, page],
  );
  const { state, reload } = useApi(load);
  const filters: Filters = { tab: tab.key, market, q };
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || INVOICES_PAGE_SIZE))) : 1;
  const canManage = hasPlatformRole(user, SUBSCRIPTION_MANAGE_ROLES);

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Invoices</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Renewal invoices issued by the finance team. Issuing numbers the invoice, emails the payer and creates the renewal it pays;
            the renewal starts when the invoice is paid in full.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/subscriptions" variant="secondary">
            Subscriptions
          </ButtonLink>
          {canManage && (
            <ButtonLink href={`${PATH}/new`}>
              <Plus className="size-4" aria-hidden="true" />
              New renewal invoice
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="mt-8">
        <ChipNav
          label="Invoice status"
          items={INVOICE_TABS.map((item) => ({ key: item.key, href: hrefFor({ ...filters, tab: item.key }), label: item.label, current: item.key === tab.key }))}
        />
      </div>

      <form action={PATH} role="search" aria-label="Filter invoices" className="mt-5 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-3">
        {tab.key !== INVOICE_TABS[0].key && <input type="hidden" name="tab" value={tab.key} />}
        <Field id="inv-q" label="Invoice number or payer">
          <Input id="inv-q" name="q" type="search" defaultValue={q} key={q} maxLength={100} placeholder="INV-ZW-2026-000001" autoComplete="off" />
        </Field>
        <Field id="inv-market" label="Country">
          <SearchableSelect id="inv-market" name="market" defaultValue={market} options={[{ value: "", label: "Every country" }, ...countries]} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">
            <Search className="size-4" aria-hidden="true" />
            Filter
          </Button>
          {filtered && (
            <ButtonLink href={hrefFor({ tab: tab.key, market: "", q: "" })} variant="ghost">
              Clear filters
            </ButtonLink>
          )}
        </div>
      </form>

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the invoices" rows={3} />}
        {data && (
          <p className="text-sm text-muted" role="status">
            {data.total === 1 ? "1 invoice" : `${data.total} invoices`}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-4">
            <EmptyState title={filtered ? "No invoices match those filters" : tab.key === "open" ? "No unpaid invoices" : "No invoices here"} />
          </div>
        )}
        {data && data.items.length > 0 && (
          <Card padded={false} className="mt-4">
            <ul className="divide-y divide-line">
              {data.items.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`${PATH}/${inv.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                        {inv.number ?? "Draft"}
                      </Link>
                      <Badge tone={INVOICE_STATUS_TONES[inv.status] ?? "neutral"}>{inv.status_label}</Badge>
                      <Badge tone="accent">{inv.market_code}</Badge>
                    </p>
                    <p className="text-ink">{inv.payer.name}</p>
                    <p className="text-sm text-muted">
                      {inv.plan_name} · total {formatAmount(inv.total, inv.currency_code)}
                      {inv.balance !== inv.total && ` · ${formatAmount(inv.balance, inv.currency_code)} due`} · due {formatDay(inv.due_on)}
                    </p>
                  </div>
                  <ButtonLink href={`${PATH}/${inv.id}`} size="sm" variant={inv.status === "OVERDUE" || inv.status === "DRAFT" ? "primary" : "secondary"}>
                    Open<span className="sr-only"> {inv.number ?? "draft"}</span>
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {data && <Pagination page={page} totalPages={totalPages} hrefFor={(value) => hrefFor(filters, value)} label="Invoices" className="mt-8" />}
      </div>
    </>
  );
}

/** `/admin/invoices` (read: SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN, SUPPORT). */
export function InvoiceList({ countries }: { countries: Country[] }) {
  return (
    <RoleGate roles={SUBSCRIPTION_READ_ROLES} what="the invoices">
      {(user) => <List countries={countries} user={user} />}
    </RoleGate>
  );
}
