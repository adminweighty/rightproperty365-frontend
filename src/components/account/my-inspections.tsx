"use client";

import { ChevronDown } from "lucide-react";
import { useCallback } from "react";
import { CompletionSummary, InspectionTypeBadge, ReadOnlyChecklist, ReportDownload, scheduledWords, sectionHeading } from "@/components/agent/inspections/shared";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Card } from "@/components/ui/card";
import { downloadMyInspectionReport, listMyInspections } from "@/lib/api/inspections";
import { inspectionTypeLabel, progressWords } from "@/lib/inspections";
import type { Tenancy } from "@/lib/tenancies";

/*
 * The tenant's inspections on `/account/tenancies/<id>` (API 0.36.3): the
 * COMPLETED inspections of their tenancy, latest first, read-only, each
 * with its findings per area (notes and photos), the summary, the sign-off
 * names and "Download report (PDF)". Scheduled and in-progress inspections
 * are never shown to the tenant (they are told by email when one is
 * scheduled), and nothing here can be changed.
 */

export function MyInspections({ tenancy }: { tenancy: Tenancy }) {
  const load = useCallback(() => listMyInspections(tenancy.id), [tenancy.id]);
  const { state, reload } = useApi(load);
  const manager = tenancy.managedBy?.name ?? "your landlord or agent";

  return (
    <Card>
      <section aria-labelledby="my-inspections">
        <h2 id="my-inspections" className={sectionHeading}>
          Inspections
        </h2>
        <p className="mt-1 text-sm text-muted">The reports of completed inspections: what {manager} found in each room when you moved in, during the tenancy and when you leave.</p>
        <div className="mt-4">
          {state.status === "loading" && <LoadingBlock label="Loading your inspections" rows={1} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && state.data.items.length === 0 && (
            <p className="text-sm text-muted">No completed inspections yet. When {manager} completes one, its report appears here.</p>
          )}
          {state.status === "ready" && state.data.items.length > 0 && (
            <ul className="grid gap-3">
              {state.data.items.map((inspection) => (
                <li key={inspection.id}>
                  <details className="group rounded-md border border-line">
                    <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <InspectionTypeBadge type={inspection.type} label={inspection.typeLabel} />
                          {inspection.reference && <span className="text-xs text-muted">{inspection.reference}</span>}
                        </span>
                        <span className="mt-1 block font-medium break-words text-ink">
                          {inspectionTypeLabel(inspection.type, inspection.typeLabel)} inspection
                          {inspection.completedAt ? `, completed ${formatWhen(inspection.completedAt)}` : `, ${scheduledWords(inspection.scheduledFor)}`}
                        </span>
                        <span className="block text-sm text-muted">
                          {[inspection.inspector && `by ${inspection.inspector}`, inspection.progress && progressWords(inspection.progress.done, inspection.progress.total)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <ChevronDown className="mt-1 size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="grid gap-5 border-t border-line p-3">
                      <CompletionSummary inspection={inspection} />
                      <ReportDownload inspection={inspection} download={() => downloadMyInspectionReport(tenancy.id, inspection.id)} />
                      <ReadOnlyChecklist checklist={inspection.checklist} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Card>
  );
}
