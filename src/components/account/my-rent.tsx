"use client";

import { useCallback } from "react";
import { todayLocal } from "@/components/agent/books/shared";
import { ReceiptsTable, RentSummaryTiles, ScheduleTable, sectionHeading, StatementPanel } from "@/components/agent/property/rent-view";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Card } from "@/components/ui/card";
import type { ApiResult } from "@/lib/api/http";
import { downloadMyStatement, getMyStatement, listMyDues, listMyReceipts, type Span } from "@/lib/api/rent";
import { currencyMinorUnits } from "@/lib/ledger";
import type { DueList, Receipt } from "@/lib/rent";
import type { Tenancy } from "@/lib/tenancies";

/*
 * The tenant's rent on `/account/tenancies/<id>` (API 0.36.1), read-only:
 * what is due, the payments the landlord or agent recorded, and the
 * statement per currency with CSV and PDF downloads. No ledger links and no
 * controls: corrections are the landlord's or agent's.
 */

type Rent = { list: DueList; receipts: Receipt[] };

export function MyRent({ tenancy }: { tenancy: Tenancy }) {
  const load = useCallback(async (): Promise<ApiResult<Rent>> => {
    const [dues, receipts] = await Promise.all([listMyDues(tenancy.id), listMyReceipts(tenancy.id)]);
    if (!dues.ok) return dues;
    if (!receipts.ok) return receipts;
    return { ok: true, status: 200, data: { list: dues.data, receipts: receipts.data } };
  }, [tenancy.id]);
  const { state, reload } = useApi(load);
  const today = todayLocal();
  const manager = tenancy.managedBy?.name ?? "your landlord or agent";

  const statementLoad = useCallback((span: Span) => getMyStatement(tenancy.id, span), [tenancy.id]);
  const statementDownload = useCallback((span: Span, format: "csv" | "pdf") => downloadMyStatement(tenancy.id, span, format), [tenancy.id]);
  const start = tenancy.startDate && tenancy.startDate <= today ? tenancy.startDate : `${today.slice(0, 4)}-01-01`;

  return (
    <Card>
      <section aria-labelledby="my-rent-heading">
        <h2 id="my-rent-heading" className="font-sans text-xl font-semibold tracking-normal">
          Rent
        </h2>
        <p className="mt-1 text-sm text-muted">
          What is due and the payments {manager} has recorded. They record payments themselves; nothing here is confirmed by a bank.
        </p>
        {state.status === "loading" && (
          <div className="mt-4">
            <LoadingBlock label="Loading your rent" rows={3} />
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-4">
            <LoadError failure={state.failure} onRetry={reload} />
          </div>
        )}
        {state.status === "ready" && (
          <div className="mt-4 space-y-8">
            <RentSummaryTiles list={state.data.list} today={today} places={currencyMinorUnits} />
            <section aria-labelledby="my-dues-heading" className="space-y-3">
              <h3 id="my-dues-heading" className={sectionHeading}>
                What is due
              </h3>
              {state.data.list.dues.length === 0 ? (
                <EmptyState title="No rent due dates yet">They appear here once {manager} has set up the rent schedule.</EmptyState>
              ) : (
                <ScheduleTable dues={state.data.list.dues} today={today} label="Your rent due dates" />
              )}
            </section>
            <section aria-labelledby="my-receipts-heading" className="space-y-3">
              <h3 id="my-receipts-heading" className={sectionHeading}>
                Payments recorded
              </h3>
              {state.data.receipts.length === 0 ? (
                <EmptyState title="No payments recorded yet">When {manager} records a payment from you, it appears here.</EmptyState>
              ) : (
                <ReceiptsTable receipts={state.data.receipts} dues={state.data.list.dues} />
              )}
            </section>
            <section aria-labelledby="my-statement-heading" className="space-y-3">
              <h3 id="my-statement-heading" className={sectionHeading}>
                Statement
              </h3>
              <StatementPanel idPrefix="my" initial={{ from: start, to: today }} load={statementLoad} download={statementDownload} />
            </section>
          </div>
        )}
      </section>
    </Card>
  );
}
