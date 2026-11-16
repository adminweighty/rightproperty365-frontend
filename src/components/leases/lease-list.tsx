"use client";

import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PdfActions } from "@/components/agreements/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { canUseInbox } from "@/lib/api/auth";
import { getLeasePdf, listLeases, type Lease, type LeaseStatus } from "@/lib/api/leases";
import { formatMoney } from "@/lib/format";
import { pageFrom } from "@/lib/request-filters";
import { LEASE_STATUS, RENT_PERIODS, statusOf } from "@/lib/signing";

const PATH = "/agent/leases";

const FILTERS: { key: string; label: string; status?: LeaseStatus }[] = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts", status: "DRAFT" },
  { key: "SENT_FOR_SIGNING", label: "Out for signing", status: "SENT_FOR_SIGNING" },
  { key: "SIGNED", label: "Signed", status: "SIGNED" },
  { key: "DECLINED", label: "Declined", status: "DECLINED" },
  { key: "CANCELLED", label: "Cancelled", status: "CANCELLED" },
  { key: "EXPIRED", label: "Expired", status: "EXPIRED" },
];

const href = (status?: string, page = 1) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
};

const period = (value: string) => RENT_PERIODS.find((item) => item.value === value)?.label.toLowerCase() ?? "";

function Row({ lease }: { lease: Lease }) {
  const { label, tone } = statusOf(LEASE_STATUS, lease.status);
  const tenants = lease.tenants.map((party) => party.name).join(", ");
  return (
    <li className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link href={`${PATH}/${lease.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
            {lease.property_address || lease.listing?.title || lease.reference}
          </Link>
          <Badge tone={tone}>{label}</Badge>
        </p>
        <p className="text-sm text-muted">
          <span className="font-mono">{lease.reference}</span> · {tenants ? `Tenants: ${tenants}` : "No tenants yet"} ·{" "}
          {formatMoney({ amount: lease.rent_amount, currency: lease.rent_currency })} {period(lease.rent_period)}
        </p>
        <p className="text-xs text-subtle">
          {lease.template.name}, version {lease.template.version} · {lease.created_by.name} · updated {formatWhen(lease.updated_at)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={`${PATH}/${lease.id}`} size="sm" variant="secondary">
          {lease.status === "DRAFT" ? "Continue" : "Open"}
          <span className="sr-only"> lease {lease.reference}</span>
        </ButtonLink>
        {lease.agreement_id && (
          <ButtonLink href={`/agent/agreements/${lease.agreement_id}`} size="sm" variant="ghost">
            Signing
            <span className="sr-only"> of lease {lease.reference}</span>
          </ButtonLink>
        )}
        {lease.document && <PdfActions read={() => getLeasePdf(lease.id)} name={`Lease ${lease.reference}`} label="PDF" variant="ghost" />}
      </div>
    </li>
  );
}

function Leases() {
  const params = useSearchParams();
  const filter = FILTERS.find((item) => item.key === params.get("status")) ?? FILTERS[0];
  const page = pageFrom(params.get("page"));
  const load = useCallback(() => listLeases({ status: filter.status, page }), [filter.status, page]);
  const { state, reload } = useApi(load);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Leases</h1>
          <p className="mt-2 max-w-2xl text-muted">Draft a lease from one of your templates or a sample, check its PDF, and send it to the landlords and tenants to sign.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/agent/leases/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            New lease
          </ButtonLink>
          <ButtonLink href="/agent/lease-templates" variant="secondary">
            Lease templates
          </ButtonLink>
          <ButtonLink href="/agent/agreements" variant="secondary">
            Agreements
          </ButtonLink>
        </div>
      </div>
      <div className="mt-8">
        <ChipNav
          label="Lease status"
          items={FILTERS.map((item) => ({ key: item.key, href: href(item.status), label: item.label, current: item.key === filter.key }))}
        />
      </div>
      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the leases" rows={3} />}
        {data && data.items.length === 0 && (
          <EmptyState
            title={filter.status ? `No leases are ${statusOf(LEASE_STATUS, filter.status).label.toLowerCase()}` : "No leases yet"}
            action={
              <ButtonLink href="/agent/leases/new" variant="secondary">
                Draft a lease
              </ButtonLink>
            }
          >
            Pick a template for the property&rsquo;s country, add the landlords and tenants, and send it for signing.
          </EmptyState>
        )}
        {data && data.items.length > 0 && (
          <>
            <Card padded={false} aria-busy={state.status === "loading" || undefined}>
              <p role="status" className="sr-only">{`${data.total} ${data.total === 1 ? "lease" : "leases"}`}</p>
              <ul className="divide-y divide-line">
                {data.items.map((lease) => (
                  <Row key={lease.id} lease={lease} />
                ))}
              </ul>
            </Card>
            {data.total_pages > 1 && (
              <Pagination className="mt-6" page={data.page} totalPages={data.total_pages} hrefFor={(value) => href(filter.status, value)} label="Lease pages" />
            )}
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/leases`: the leases the caller drafted or sees, by status. */
export function LeaseList() {
  return <RequireAuth allow={canUseInbox}>{() => <Leases />}</RequireAuth>;
}
