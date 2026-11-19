"use client";

import Link from "next/link";
import { useCallback } from "react";
import { formatDay, TableRegion, td, tdNum, th, thNum } from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { getArrears } from "@/lib/api/rent";
import { booksPath, currencyMinorUnits, formatLedgerAmount } from "@/lib/ledger";
import { AGEING, type ArrearsBlock } from "@/lib/rent";
import { tenanciesPath, tenancyHref } from "@/lib/tenancies";
import { ManagementShell } from "./shared";

/*
 * `/agent/arrears` (API 0.36.1): rent past its due date and still
 * outstanding, aged 0-30, 31-60, 61-90 and over 90 days, one table per
 * currency with a row per tenancy. Currencies are never added together.
 */

export function Arrears() {
  return (
    <ManagementShell
      area="arrears"
      path=""
      nav
      title="Arrears"
      intro="Rent that is past its due date and still outstanding, by how long it has been overdue. One table per currency: currencies are never added together."
    >
      {(organisation) => <Report organisation={organisation} />}
    </ManagementShell>
  );
}

function Report({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const load = useCallback(() => getArrears(org, currencyMinorUnits), [org]);
  const { state, reload } = useApi(load);

  if (state.status === "loading") return <LoadingBlock label="Loading the arrears" rows={3} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.length === 0 || state.data.every((block) => block.rows.length === 0 && !/[1-9]/.test(block.total))) {
    return (
      <EmptyState
        title="No rent is overdue"
        action={
          <ButtonLink href={tenanciesPath("", org, { status: "ACTIVE" })} variant="secondary">
            See active tenancies
          </ButtonLink>
        }
      >
        Every rent due date that has passed is paid or waived, in every currency.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-10">
      <p role="status" className="text-sm text-muted">
        {state.data.length === 1 ? `Arrears in ${state.data[0].currency}.` : `Arrears in ${state.data.length} currencies: ${state.data.map((block) => block.currency).join(", ")}.`}{" "}
        The same figures feed the{" "}
        <Link href={booksPath("/reports", org, { report: "receivables" })} className="font-medium text-primary-ink hover:underline">
          receivables report in your books
        </Link>
        .
      </p>
      {state.data.map((block) => (
        <CurrencyBlock key={block.currency} block={block} org={org} />
      ))}
    </div>
  );
}

function CurrencyBlock({ block, org }: { block: ArrearsBlock; org: string }) {
  const c = block.currency;
  const amount = (value: string) => formatLedgerAmount(value, c);
  return (
    <section aria-labelledby={`arrears-${c}`} className="space-y-3">
      <h2 id={`arrears-${c}`} className="font-sans text-xl font-semibold tracking-normal">
        In {c}
      </h2>
      <dl className="grid gap-2 sm:grid-cols-5">
        {AGEING.map((bucket) => (
          <div key={bucket.key} className="rounded-md border border-line bg-surface px-3 py-2">
            <dt className="text-sm text-muted">{bucket.words}</dt>
            <dd className="font-semibold tabular-nums text-ink">{amount(block.buckets[bucket.key])}</dd>
          </div>
        ))}
        <div className="rounded-md border border-line-strong bg-sunken px-3 py-2">
          <dt className="text-sm text-muted">Total overdue ({c})</dt>
          <dd className="font-semibold tabular-nums text-ink">{amount(block.total)}</dd>
        </div>
      </dl>
      {block.rows.length > 0 && (
        <TableRegion label={`Arrears in ${c} by tenancy, scrolls sideways`}>
          <table className="w-full min-w-[52rem] border-collapse">
            <caption className="sr-only">Overdue rent in {c} by tenancy, largest first, by how long it has been overdue.</caption>
            <thead className="border-b border-line bg-sunken">
              <tr>
                <th scope="col" className={th}>Tenancy</th>
                {AGEING.map((bucket) => (
                  <th key={bucket.key} scope="col" className={thNum}>
                    {bucket.words}
                  </th>
                ))}
                <th scope="col" className={thNum}>Total ({c})</th>
                <th scope="col" className={th}>Oldest</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={`${row.tenancyId}-${c}`} className="border-b border-line last:border-0">
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <Link href={tenancyHref(row.tenancyId, org)} className="font-medium break-words text-primary-ink hover:underline">
                      {row.tenants || "A tenancy"}
                    </Link>
                    {(row.property || row.unit) && (
                      <span className="block text-xs break-words text-muted">
                        {row.property}
                        {row.unit ? `${row.property ? ", " : ""}${row.unit}` : ""}
                      </span>
                    )}
                  </th>
                  {AGEING.map((bucket) => (
                    <td key={bucket.key} className={tdNum}>
                      {/[1-9]/.test(row.buckets[bucket.key]) ? amount(row.buckets[bucket.key]) : <span className="text-muted">—</span>}
                    </td>
                  ))}
                  <td className={`${tdNum} font-semibold`}>{amount(row.total)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {row.oldestDueDate ? formatDay(row.oldestDueDate) : "—"}
                    {row.daysOverdue !== null && <span className="block text-xs text-muted">{row.daysOverdue === 1 ? "1 day overdue" : `${row.daysOverdue} days overdue`}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </section>
  );
}
