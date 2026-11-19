"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { MaintenanceStatusBadge, PriorityBadge } from "@/components/agent/maintenance/shared";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listRequests } from "@/lib/api/maintenance";
import {
  canWriteMaintenance,
  categoryLabel,
  isOpenStatus,
  maintenanceApiQuery,
  maintenanceHref,
  maintenanceListHref,
  newRequestHref,
} from "@/lib/maintenance";
import type { Tenancy } from "@/lib/tenancies";

/**
 * The Maintenance section of `/agent/tenancies/<id>` (API 0.36.2): the
 * requests linked to this tenancy, newest first, and "Report an issue" with
 * the property, unit and tenancy filled in.
 */
export function MaintenanceSection({ org, role, tenancy }: { org: string; role: string; tenancy: Tenancy }) {
  const load = useCallback(() => listRequests(org, maintenanceApiQuery({ tenancy: tenancy.id, page: 1 }, 10)), [org, tenancy.id]);
  const { state, reload } = useApi(load);
  const writer = canWriteMaintenance(role);
  const report = newRequestHref(org, { property: tenancy.property?.id, unit: tenancy.unit?.id, tenancy: tenancy.id });
  const canReport = writer && tenancy.status !== "DRAFT" && Boolean(tenancy.property?.id) && !tenancy.property?.archived;
  const open = state.status === "ready" ? state.data.items.filter((item) => isOpenStatus(item.status)).length : 0;

  return (
    <Card>
      <section aria-labelledby="tenancy-maintenance">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tenancy-maintenance" className="font-sans text-xl font-semibold tracking-normal">
            Maintenance
          </h2>
          {canReport && (
            <ButtonLink href={report} variant="secondary">
              <Plus className="size-4" aria-hidden="true" />
              Report an issue
            </ButtonLink>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Repairs for this tenancy, reported by your team or by the tenant from their account.
          {tenancy.status === "DRAFT" && " Once the tenancy is active, issues can be reported against it."}
        </p>
        <div className="mt-4">
          {state.status === "loading" && <LoadingBlock label="Loading the maintenance requests" rows={2} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && state.data.items.length === 0 && <p className="text-sm text-muted">No maintenance requests for this tenancy.</p>}
          {state.status === "ready" && state.data.items.length > 0 && (
            <>
              <p className="text-sm text-muted" role="status">
                {state.data.total === 1 ? "1 request" : `${state.data.total} requests`}, {open} open
              </p>
              <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                {state.data.items.map((item) => (
                  <li key={item.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <MaintenanceStatusBadge status={item.status} label={item.statusLabel} />
                      <PriorityBadge priority={item.priority} label={item.priorityLabel} />
                      {item.reference && <span className="text-xs text-muted">{item.reference}</span>}
                    </div>
                    <p className="mt-1 font-medium break-words">
                      <Link href={maintenanceHref(item.id, org)} className="text-primary-ink hover:underline">
                        {item.title}
                      </Link>
                    </p>
                    <p className="text-sm text-muted">
                      {categoryLabel(item.category, item.categoryLabel)}
                      {item.createdAt && ` · ${formatWhen(item.createdAt)}`}
                      {item.raisedBy?.kind === "TENANT" && " · by the tenant"}
                      {item.provider && ` · ${item.provider.name}`}
                    </p>
                  </li>
                ))}
              </ul>
              {state.data.total > state.data.items.length && (
                <p className="mt-3 text-sm">
                  <Link href={maintenanceListHref({ tenancy: tenancy.id }, org)} className="font-medium text-primary-ink hover:underline">
                    See all {state.data.total} requests
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </Card>
  );
}
