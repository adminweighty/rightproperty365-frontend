"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { InspectionStatusBadge, InspectionTypeBadge, scheduledWords } from "@/components/agent/inspections/shared";
import { LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listInspections } from "@/lib/api/inspections";
import {
  canWriteInspections,
  inspectionApiQuery,
  inspectionHref,
  inspectionListHref,
  newInspectionHref,
  progressWords,
  suggestedType,
} from "@/lib/inspections";
import type { Tenancy } from "@/lib/tenancies";

/**
 * The Inspections section of `/agent/tenancies/<id>` (API 0.36.3): the
 * inspections linked to this tenancy, latest first, and "Schedule
 * inspection" with the property, unit, tenancy and the type that fits
 * (move-in until one is completed, move-out once it has ended) filled in.
 */
export function InspectionsSection({ org, role, tenancy }: { org: string; role: string; tenancy: Tenancy }) {
  const load = useCallback(() => listInspections(org, inspectionApiQuery({ tenancy: tenancy.id, page: 1 }, 10)), [org, tenancy.id]);
  const { state, reload } = useApi(load);
  const writer = canWriteInspections(role);
  const hasMoveIn = state.status === "ready" && state.data.items.some((item) => item.type === "MOVE_IN" && item.status === "COMPLETED");
  const schedule = newInspectionHref(org, { property: tenancy.property?.id, unit: tenancy.unit?.id, tenancy: tenancy.id, type: suggestedType(tenancy, hasMoveIn) });
  const canSchedule = writer && Boolean(tenancy.property?.id) && !tenancy.property?.archived;

  return (
    <Card>
      <section aria-labelledby="tenancy-inspections">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tenancy-inspections" className="font-sans text-xl font-semibold tracking-normal">
            Inspections
          </h2>
          {canSchedule && (
            <ButtonLink href={schedule} variant="secondary">
              <Plus className="size-4" aria-hidden="true" />
              Schedule inspection
            </ButtonLink>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">Move-in, routine and move-out inspections of this tenancy. The tenant can read the completed ones from their account.</p>
        <div className="mt-4">
          {state.status === "loading" && <LoadingBlock label="Loading the inspections" rows={2} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && state.data.items.length === 0 && <p className="text-sm text-muted">No inspections for this tenancy yet.</p>}
          {state.status === "ready" && state.data.items.length > 0 && (
            <>
              <p className="text-sm text-muted" role="status">
                {state.data.total === 1 ? "1 inspection" : `${state.data.total} inspections`}
              </p>
              <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                {state.data.items.map((item) => (
                  <li key={item.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <InspectionStatusBadge status={item.status} label={item.statusLabel} />
                      <InspectionTypeBadge type={item.type} label={item.typeLabel} />
                      {item.reference && <span className="text-xs text-muted">{item.reference}</span>}
                    </div>
                    <p className="mt-1 font-medium break-words">
                      <Link href={inspectionHref(item.id, org)} className="text-primary-ink hover:underline">
                        {scheduledWords(item.scheduledFor, item.timeZone)}
                      </Link>
                    </p>
                    <p className="text-sm text-muted">
                      {[item.inspector, item.progress ? progressWords(item.progress.done, item.progress.total) : null].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
              {state.data.total > state.data.items.length && (
                <p className="mt-3 text-sm">
                  <Link href={inspectionListHref({ tenancy: tenancy.id }, org)} className="font-medium text-primary-ink hover:underline">
                    See all {state.data.total} inspections
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
