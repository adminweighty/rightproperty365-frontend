"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RoleGate } from "@/components/admin/lease-templates";
import { AgreementStatusBadge, RecipientChips } from "@/components/agreements/shared";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { adminListAgreements, type AgreementStatus } from "@/lib/api/agreements";
import { SIGNING_OVERSIGHT_ROLES } from "@/lib/api/auth";
import { adminListLeases, type LeaseStatus } from "@/lib/api/leases";
import { formatMoney } from "@/lib/format";
import { pageFrom } from "@/lib/request-filters";
import { AGREEMENT_STATUS, LEASE_STATUS, statusOf } from "@/lib/signing";

function hrefFor(path: string, status: string | undefined, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

const AGREEMENT_STATUSES = Object.keys(AGREEMENT_STATUS) as AgreementStatus[];
const LEASE_STATUSES = Object.keys(LEASE_STATUS) as LeaseStatus[];

const readOnlyNote = "Read-only. Names and addresses are shown for support; documents are opened only by the people who sent or received them.";

function Agreements() {
  const path = "/admin/agreements";
  const params = useSearchParams();
  const statuses = AGREEMENT_STATUSES;
  const status = statuses.find((item) => item === params.get("status"));
  const page = pageFrom(params.get("page"));
  const load = useCallback(() => adminListAgreements({ status, page }), [status, page]);
  const { state, reload } = useApi(load);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Agreements</h1>
      <p className="mt-2 max-w-2xl text-muted">Every document sent for signature. {readOnlyNote}</p>
      <div className="mt-8">
        <ChipNav
          label="Agreement status"
          items={[
            { key: "all", href: path, label: "All", current: !status },
            ...statuses.map((item) => ({ key: item, href: hrefFor(path, item), label: AGREEMENT_STATUS[item].label, current: item === status })),
          ]}
        />
      </div>
      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the agreements" rows={3} />}
        {data && data.items.length === 0 && <EmptyState title="No agreements here" />}
        {data && data.items.length > 0 && (
          <>
            <Card padded={false}>
              <ul className="divide-y divide-line">
                {data.items.map((agreement) => (
                  <li key={agreement.id} className="px-5 py-4">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {agreement.name}
                      <AgreementStatusBadge status={agreement.status} />
                      {agreement.source === "LEASE" && <Badge>Lease</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      <span className="font-mono">{agreement.reference}</span> · sent by {agreement.sender.name}
                      {agreement.organisation && `, ${agreement.organisation.name}`} · updated {formatWhen(agreement.updated_at)}
                    </p>
                    <div className="mt-2">
                      <RecipientChips recipients={agreement.recipients} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            {data.total_pages > 1 && (
              <Pagination className="mt-6" page={data.page} totalPages={data.total_pages} hrefFor={(value) => hrefFor(path, status, value)} label="Agreement pages" />
            )}
          </>
        )}
      </div>
    </>
  );
}

function Leases() {
  const path = "/admin/leases";
  const params = useSearchParams();
  const statuses = LEASE_STATUSES;
  const status = statuses.find((item) => item === params.get("status"));
  const page = pageFrom(params.get("page"));
  const load = useCallback(() => adminListLeases({ status, page }), [status, page]);
  const { state, reload } = useApi(load);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Leases</h1>
      <p className="mt-2 max-w-2xl text-muted">Every lease drafted on the site. {readOnlyNote}</p>
      <div className="mt-8">
        <ChipNav
          label="Lease status"
          items={[
            { key: "all", href: path, label: "All", current: !status },
            ...statuses.map((item) => ({ key: item, href: hrefFor(path, item), label: LEASE_STATUS[item].label, current: item === status })),
          ]}
        />
      </div>
      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the leases" rows={3} />}
        {data && data.items.length === 0 && <EmptyState title="No leases here" />}
        {data && data.items.length > 0 && (
          <>
            <Card padded={false}>
              <ul className="divide-y divide-line">
                {data.items.map((lease) => {
                  const { label, tone } = statusOf(LEASE_STATUS, lease.status);
                  return (
                    <li key={lease.id} className="px-5 py-4">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {lease.property_address}
                        <Badge tone={tone}>{label}</Badge>
                        <Badge tone="accent">{lease.template.market_code}</Badge>
                      </p>
                      <p className="text-sm text-muted">
                        <span className="font-mono">{lease.reference}</span> · {lease.template.name} v{lease.template.version} · by {lease.created_by.name}
                        {lease.organisation && `, ${lease.organisation.name}`} · {formatMoney({ amount: lease.rent_amount, currency: lease.rent_currency })}
                      </p>
                      <p className="text-xs text-subtle">
                        Landlords: {lease.landlords.map((party) => party.name).join(", ")} · Tenants: {lease.tenants.map((party) => party.name).join(", ")} · updated{" "}
                        {formatWhen(lease.updated_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
            {data.total_pages > 1 && (
              <Pagination className="mt-6" page={data.page} totalPages={data.total_pages} hrefFor={(value) => hrefFor(path, status, value)} label="Lease pages" />
            )}
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/agreements` (SUPER_ADMIN, SUPPORT). */
export function AdminAgreements() {
  return <RoleGate roles={SIGNING_OVERSIGHT_ROLES} what="the agreements">{() => <Agreements />}</RoleGate>;
}

/** `/admin/leases` (SUPER_ADMIN, SUPPORT). */
export function AdminLeases() {
  return <RoleGate roles={SIGNING_OVERSIGHT_ROLES} what="the leases">{() => <Leases />}</RoleGate>;
}
