"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import {
  BooksShell,
  categoryWords,
  ContactPicker,
  ExportButton,
  formatDay,
  StatusBadge,
  TableRegion,
  td,
  tdNum,
  th,
  thNum,
  todayLocal,
  useCategories,
  type Categories,
} from "@/components/agent/books/shared";
import { ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { getCashbook, getCategoriesReport, getReceivables, getStatement } from "@/lib/api/ledger";
import {
  booksPath,
  entryHref,
  entryTypeLabel,
  formatLedgerAmount,
  isCurrencyCode,
  isDay,
  isUuid,
  ageingWords,
  methodLabel,
  type CashbookCurrency,
  type CategoriesCurrency,
  type ReportRow,
  type ReceivablesCurrency,
  type StatementCurrency,
} from "@/lib/ledger";
import { arrearsHref } from "@/lib/rent";

/*
 * The reports of the books (FR-029): the cashbook, categories, a contact's
 * statement and receivables ageing. Every report is per currency: one table
 * per currency, never a combined total, and a visible note says so.
 */

const REPORTS = [
  { key: "cashbook", label: "Cashbook" },
  { key: "categories", label: "Categories" },
  { key: "statement", label: "Contact statement" },
  { key: "receivables", label: "Receivables ageing" },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];

type ReportParams = { report: ReportKey; from: string; to: string; currency?: string; byMethod: boolean; contact?: string; side: "RECEIVABLE" | "PAYABLE" };

const firstOfMonth = (today: string) => `${today.slice(0, 8)}01`;

function readParams(params: URLSearchParams, today: string): ReportParams {
  const report = (REPORTS.find((item) => item.key === params.get("report"))?.key ?? "cashbook") as ReportKey;
  let from = params.get("from") ?? "";
  let to = params.get("to") ?? "";
  if (!isDay(from)) from = firstOfMonth(today);
  if (!isDay(to)) to = today;
  if (from > to) [from, to] = [to, from];
  const currency = (params.get("currency") ?? "").toUpperCase();
  const contact = params.get("contact") ?? "";
  return {
    report,
    from,
    to,
    currency: isCurrencyCode(currency) ? currency : undefined,
    byMethod: params.get("by") === "method",
    contact: isUuid(contact) ? contact : undefined,
    side: params.get("side") === "PAYABLE" ? "PAYABLE" : "RECEIVABLE",
  };
}

function reportHref(org: string, next: ReportParams) {
  return booksPath("/reports", org, {
    report: next.report === "cashbook" ? undefined : next.report,
    from: next.from,
    to: next.to,
    currency: next.currency,
    by: next.byMethod ? "method" : undefined,
    contact: next.contact,
    side: next.side === "PAYABLE" ? "PAYABLE" : undefined,
  });
}

/** The note every report carries (FR-029: totals never silently add USD and ZAR). */
function PerCurrencyNote() {
  return (
    <p className="rounded-md border border-line bg-sunken p-3 text-sm text-ink">
      Each currency has its own table. Currencies are never added together, so there is no combined total.
    </p>
  );
}

const amount = (value: string | null, currency: string) => (value === null ? "—" : formatLedgerAmount(value, currency));

/** A column's amount: "+USD 700.00" in, "−USD 300.00" out; a reversal's negative figure as "-USD 700.00". */
function ColumnAmount({ value, currency, sign }: { value: string | null; currency: string; sign: "+" | "−" }) {
  if (value === null) return <span aria-hidden="true">—</span>;
  const text = formatLedgerAmount(value, currency);
  return <>{text.startsWith("-") ? text : `${sign}${text}`}</>;
}

function EntryRows({ rows, org, categories }: { rows: ReportRow[]; org: string; categories: Categories }) {
  return (
    <>
      {rows.map(({ entry, moneyIn, moneyOut, runningBalance }) => (
        <tr key={entry.id} className="border-b border-line">
          <td className={`${td} whitespace-nowrap`}>{formatDay(entry.effectiveDate)}</td>
          <th scope="row" className={`${td} text-left font-normal`}>
            <Link href={entryHref(entry.id, org)} className="font-medium break-words text-primary-ink hover:underline">
              {entry.description || entryTypeLabel(entry.type, entry.typeLabel)}
            </Link>
            <span className="block text-xs text-muted">
              {[entryTypeLabel(entry.type, entry.typeLabel), entry.category ? categoryWords(categories, entry.category, entry.categoryLabel) : null, entry.method ? methodLabel(entry.method) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </th>
          <td className={tdNum}>
            <ColumnAmount value={moneyIn} currency={entry.currency} sign="+" />
          </td>
          <td className={tdNum}>
            <ColumnAmount value={moneyOut} currency={entry.currency} sign="−" />
          </td>
          <td className={tdNum}>{runningBalance === null ? <span aria-hidden="true">—</span> : formatLedgerAmount(runningBalance, entry.currency)}</td>
          <td className={td}>
            <StatusBadge status={entry.status} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ---- Cashbook --------------------------------------------------------------------------------

function CashbookTable({ block, org, categories, span }: { block: CashbookCurrency; org: string; categories: Categories; span: string }) {
  const c = block.currency;
  return (
    <section aria-labelledby={`cashbook-${c}`} className="space-y-3">
      <h3 id={`cashbook-${c}`} className="text-lg">
        {c}
      </h3>
      <TableRegion label={`Cashbook in ${c}, scrolls sideways`}>
        <table className="w-full min-w-[52rem] border-collapse">
          <caption className="sr-only">
            Cashbook in {c}, {span}. Amounts in {c} only.
          </caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}>Entry</th>
              <th scope="col" className={thNum}>Money in ({c})</th>
              <th scope="col" className={thNum}>Money out ({c})</th>
              <th scope="col" className={thNum}>Balance ({c})</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <th scope="row" colSpan={4} className={`${td} text-left font-medium`}>
                Opening balance
              </th>
              <td className={`${tdNum} font-semibold`}>{amount(block.opening, c)}</td>
              <td />
            </tr>
            {block.rows.length === 0 ? (
              <tr className="border-b border-line">
                <td colSpan={6} className={`${td} text-muted`}>
                  No entries in {c} in this period.
                </td>
              </tr>
            ) : (
              <EntryRows rows={block.rows} org={org} categories={categories} />
            )}
          </tbody>
          <tfoot className="bg-sunken">
            <tr className="border-b border-line">
              <th scope="row" colSpan={2} className={`${td} text-left font-medium`}>
                Totals for the period
              </th>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyIn, c)}</td>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyOut, c)}</td>
              <td colSpan={2} />
            </tr>
            <tr>
              <th scope="row" colSpan={4} className={`${td} text-left font-medium`}>
                Closing balance
              </th>
              <td className={`${tdNum} font-bold`}>{amount(block.closing, c)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableRegion>
      {block.groups.length > 0 && (
        <TableRegion label={`Cashbook in ${c} by method, scrolls sideways`}>
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="px-3 pt-3 text-left text-sm font-medium text-ink">By method, in {c}</caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>Method</th>
                <th scope="col" className={thNum}>Opening</th>
                <th scope="col" className={thNum}>Money in</th>
                <th scope="col" className={thNum}>Money out</th>
                <th scope="col" className={thNum}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {block.groups.map((row) => (
                <tr key={row.key ?? "none"} className="border-b border-line last:border-0">
                  <th scope="row" className={`${td} text-left font-normal`}>{row.label || (row.key ? methodLabel(row.key) : "No method")}</th>
                  <td className={tdNum}>{amount(row.opening, c)}</td>
                  <td className={tdNum}>{amount(row.moneyIn, c)}</td>
                  <td className={tdNum}>{amount(row.moneyOut, c)}</td>
                  <td className={tdNum}>{amount(row.closing, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </section>
  );
}

function Cashbook({ org, values, categories }: { org: string; values: ReportParams; categories: Categories }) {
  const load = useCallback(() => getCashbook(org, { from: values.from, to: values.to, currency: values.currency, byMethod: values.byMethod }), [org, values.from, values.to, values.currency, values.byMethod]);
  const { state, reload } = useApi(load);
  const span = `${formatDay(values.from)} to ${formatDay(values.to)}`;
  if (state.status === "loading") return <LoadingBlock label="Loading the cashbook" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.length === 0) return <EmptyState title="Nothing in the cashbook for this period">Choose other dates, or record an opening balance first.</EmptyState>;
  return (
    <div className="space-y-8">
      {state.data.map((block) => (
        <CashbookTable key={block.currency} block={block} org={org} categories={categories} span={span} />
      ))}
    </div>
  );
}

// ---- Categories ---------------------------------------------------------------------------------

function CategoriesTable({ block, categories }: { block: CategoriesCurrency; categories: Categories }) {
  const c = block.currency;
  return (
    <section aria-labelledby={`categories-${c}`} className="space-y-3">
      <h3 id={`categories-${c}`} className="text-lg">
        {c}
      </h3>
      <TableRegion label={`Categories in ${c}, scrolls sideways`}>
        <table className="w-full min-w-[30rem] border-collapse">
          <caption className="sr-only">Money in and out per category, in {c} only.</caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              <th scope="col" className={th}>Category</th>
              <th scope="col" className={thNum}>Money in ({c})</th>
              <th scope="col" className={thNum}>Money out ({c})</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.category} className="border-b border-line">
                <th scope="row" className={`${td} text-left font-normal`}>{categoryWords(categories, row.category, row.label)}</th>
                <td className={tdNum}>{amount(row.moneyIn, c)}</td>
                <td className={tdNum}>{amount(row.moneyOut, c)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-sunken">
            <tr>
              <th scope="row" className={`${td} text-left font-medium`}>Total in {c}</th>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyIn, c)}</td>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyOut, c)}</td>
            </tr>
          </tfoot>
        </table>
      </TableRegion>
    </section>
  );
}

function CategoriesReport({ org, values, categories }: { org: string; values: ReportParams; categories: Categories }) {
  const load = useCallback(() => getCategoriesReport(org, { from: values.from, to: values.to, currency: values.currency }), [org, values.from, values.to, values.currency]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the categories" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.length === 0) return <EmptyState title="No entries in this period">Choose other dates.</EmptyState>;
  return (
    <div className="space-y-8">
      {state.data.map((block) => (
        <CategoriesTable key={block.currency} block={block} categories={categories} />
      ))}
    </div>
  );
}

// ---- Statement --------------------------------------------------------------------------------------

function StatementTable({ block, org, categories }: { block: StatementCurrency; org: string; categories: Categories }) {
  const c = block.currency;
  return (
    <section aria-labelledby={`statement-${c}`} className="space-y-3">
      <h3 id={`statement-${c}`} className="text-lg">
        {c}
      </h3>
      <TableRegion label={`Statement in ${c}, scrolls sideways`}>
        <table className="w-full min-w-[44rem] border-collapse">
          <caption className="sr-only">The contact&rsquo;s statement in {c} only.</caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={th}>Entry</th>
              <th scope="col" className={thNum}>Money in ({c})</th>
              <th scope="col" className={thNum}>Money out ({c})</th>
              <th scope="col" className={thNum}>Balance ({c})</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {block.opening !== null && (
              <tr className="border-b border-line">
                <th scope="row" colSpan={4} className={`${td} text-left font-medium`}>Brought forward</th>
                <td className={`${tdNum} font-semibold`}>{amount(block.opening, c)}</td>
                <td />
              </tr>
            )}
            {block.rows.length === 0 ? (
              <tr className="border-b border-line">
                <td colSpan={6} className={`${td} text-muted`}>No entries in {c} in this period.</td>
              </tr>
            ) : (
              <EntryRows rows={block.rows} org={org} categories={categories} />
            )}
          </tbody>
          <tfoot className="bg-sunken">
            <tr className="border-b border-line">
              <th scope="row" colSpan={2} className={`${td} text-left font-medium`}>Totals</th>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyIn, c)}</td>
              <td className={`${tdNum} font-semibold`}>{amount(block.moneyOut, c)}</td>
              <td colSpan={2} />
            </tr>
            <tr>
              <th scope="row" colSpan={4} className={`${td} text-left font-medium`}>Balance</th>
              <td className={`${tdNum} font-bold`}>{amount(block.balance, c)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableRegion>
      {(block.receivableOutstanding !== null || block.payableOutstanding !== null) && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          {block.receivableOutstanding !== null && (
            <div>
              <dt className="inline text-muted">Still owed to you: </dt>
              <dd className="inline font-medium tabular-nums text-ink">{amount(block.receivableOutstanding, c)}</dd>
            </div>
          )}
          {block.payableOutstanding !== null && (
            <div>
              <dt className="inline text-muted">Still owed by you: </dt>
              <dd className="inline font-medium tabular-nums text-ink">{amount(block.payableOutstanding, c)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function Statement({ org, contact, values, categories }: { org: string; contact: string; values: ReportParams; categories: Categories }) {
  const load = useCallback(() => getStatement(org, contact, { from: values.from, to: values.to }), [org, contact, values.from, values.to]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the statement" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  return (
    <div className="space-y-8">
      {state.data.contact?.label && <p className="font-medium text-ink">Statement for {state.data.contact.label}</p>}
      {state.data.currencies.length === 0 ? (
        <EmptyState title="No entries for this contact in this period">Choose other dates, or link entries to the contact when you record them.</EmptyState>
      ) : (
        state.data.currencies.map((block) => <StatementTable key={block.currency} block={block} org={org} categories={categories} />)
      )}
    </div>
  );
}

// ---- Receivables -----------------------------------------------------------------------------------------

function ReceivablesTable({ block, org }: { block: ReceivablesCurrency; org: string }) {
  const c = block.currency;
  return (
    <section aria-labelledby={`receivables-${c}`} className="space-y-3">
      <h3 id={`receivables-${c}`} className="text-lg">
        {c}
      </h3>
      <TableRegion label={`Receivables ageing in ${c}, scrolls sideways`}>
        <table className="w-full min-w-[40rem] border-collapse">
          <caption className="sr-only">Amounts still owed to you in {c}, by how long they have been open.</caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              {block.buckets.map((bucket) => (
                <th key={bucket.key} scope="col" className={thNum}>
                  {bucket.words}
                </th>
              ))}
              <th scope="col" className={thNum}>Total open ({c})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {block.buckets.map((bucket) => (
                <td key={bucket.key} className={tdNum}>
                  {amount(bucket.amount, c)}
                </td>
              ))}
              <td className={`${tdNum} font-semibold`}>{amount(block.total, c)}</td>
            </tr>
          </tbody>
        </table>
      </TableRegion>
      {block.rentOutstanding && /[1-9]/.test(block.rentOutstanding) && (
        <p className="text-sm text-muted">
          Includes {amount(block.rentOutstanding, c)} of overdue tenancy rent, listed by tenancy on the{" "}
          <Link href={arrearsHref(org)} className="font-medium text-primary-ink hover:underline">
            arrears page
          </Link>
          .
        </p>
      )}
      {block.items.length > 0 && (
        <TableRegion label={`Open amounts in ${c}, scrolls sideways`}>
          <table className="w-full min-w-[44rem] border-collapse">
            <caption className="px-3 pt-3 text-left text-sm font-medium text-ink">Each open amount in {c}, oldest first</caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>Due</th>
                <th scope="col" className={th}>Entry</th>
                <th scope="col" className={thNum}>Amount</th>
                <th scope="col" className={thNum}>Paid so far</th>
                <th scope="col" className={thNum}>Still open</th>
                <th scope="col" className={th}>Age</th>
              </tr>
            </thead>
            <tbody>
              {block.items.map((item) => (
                <tr key={item.entry.id} className="border-b border-line last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{formatDay(item.entry.effectiveDate)}</td>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <Link href={entryHref(item.entry.id, org)} className="font-medium break-words text-primary-ink hover:underline">
                      {item.entry.description || entryTypeLabel(item.entry.type, item.entry.typeLabel)}
                    </Link>
                    {item.entry.contact?.label && <span className="block text-xs text-muted">{item.entry.contact.label}</span>}
                  </th>
                  <td className={tdNum}>{amount(item.amount, c)}</td>
                  <td className={tdNum}>{amount(item.settled, c)}</td>
                  <td className={`${tdNum} font-semibold`}>{amount(item.outstanding, c)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {ageingWords(item.bucket)}
                    {item.daysOverdue !== null && <span className="block text-xs text-muted">{item.daysOverdue === 1 ? "1 day" : `${item.daysOverdue} days`}</span>}
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

function Receivables({ org, values }: { org: string; values: ReportParams }) {
  const load = useCallback(() => getReceivables(org, { side: values.side, currency: values.currency }), [org, values.side, values.currency]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the receivables" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.length === 0) {
    return values.side === "PAYABLE" ? (
      <EmptyState title="You owe nothing">No open payables in any currency.</EmptyState>
    ) : (
      <EmptyState title="Nothing is owed to you">No open receivables in any currency.</EmptyState>
    );
  }
  return (
    <div className="space-y-8">
      {state.data.map((block) => (
        <ReceivablesTable key={block.currency} block={block} org={org} />
      ))}
    </div>
  );
}

// ---- The page -----------------------------------------------------------------------------------------------

function ReportForm({ org, values, currencies }: { org: string; values: ReportParams; currencies: SelectOption[] }) {
  const router = useRouter();
  const [contact, setContact] = useState(values.contact ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("from") ?? "");
    const to = String(data.get("to") ?? "");
    const currency = String(data.get("currency") ?? "");
    router.push(
      reportHref(org, {
        report: values.report,
        from: isDay(from) ? from : values.from,
        to: isDay(to) ? to : values.to,
        currency: isCurrencyCode(currency) ? currency : undefined,
        byMethod: data.get("by") === "method",
        contact: isUuid(contact) ? contact : undefined,
        side: data.get("side") === "PAYABLE" ? "PAYABLE" : "RECEIVABLE",
      }),
      { scroll: false },
    );
  }

  const receivables = values.report === "receivables";
  return (
    <form method="get" onSubmit={handleSubmit} aria-label="Report settings" className="rounded-lg border border-line bg-surface p-4">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="report" value={values.report} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {receivables ? (
          <Field id="report-side" label="Show">
            <SearchableSelect
              id="report-side"
              name="side"
              options={[
                { value: "RECEIVABLE", label: "Owed to you (receivables)" },
                { value: "PAYABLE", label: "Owed by you (payables)" },
              ]}
              defaultValue={values.side}
            />
          </Field>
        ) : (
          <>
            <Field id="report-from" label="From">
              <Input id="report-from" name="from" type="date" defaultValue={values.from} />
            </Field>
            <Field id="report-to" label="To">
              <Input id="report-to" name="to" type="date" defaultValue={values.to} />
            </Field>
          </>
        )}
        {values.report !== "statement" && (
          <Field id="report-currency" label="Currency">
            <SearchableSelect id="report-currency" name="currency" options={[{ value: "", label: "Every currency, each on its own" }, ...currencies]} defaultValue={values.currency ?? ""} />
          </Field>
        )}
      </div>
      {values.report === "cashbook" && (
        <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-3">
          <input type="checkbox" name="by" value="method" defaultChecked={values.byMethod} className="size-5 accent-primary" />
          <span className="text-ink">Also show each method (cash, bank…)</span>
        </label>
      )}
      {values.report === "statement" && (
        <div className="mt-4">
          <ContactPicker id="report-contact" org={org} name="contact" value={contact} optional={false} onChange={(id) => setContact(id)} />
        </div>
      )}
      <Button type="submit" className="mt-4">
        Show the report
      </Button>
    </form>
  );
}

function Reports({ organisation, currencies }: { organisation: DashboardOrganisation; currencies: SelectOption[] }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const values = readParams(new URLSearchParams(search), todayLocal());
  const categories = useCategories(org);
  const exportValues = {
    from: values.from,
    to: values.to,
    currency: values.currency,
    by: values.report === "cashbook" && values.byMethod ? "method" : undefined,
    contact_id: values.report === "statement" ? values.contact : undefined,
  };

  return (
    <div className="space-y-6">
      <ChipNav
        label="Reports"
        items={REPORTS.map((item) => ({ key: item.key, href: reportHref(org, { ...values, report: item.key }), label: item.label, current: item.key === values.report }))}
      />
      <PerCurrencyNote />
      <ReportForm key={search} org={org} values={values} currencies={currencies} />
      {values.report !== "receivables" && values.report !== "statement" && (
        <ExportButton organisation={organisation} report={values.report} values={exportValues} label={`Export the ${values.report === "cashbook" ? "cashbook" : "categories"} as CSV`} />
      )}
      {values.report === "statement" && values.contact && <ExportButton organisation={organisation} report="statement" values={exportValues} label="Export the statement as CSV" />}
      {values.report === "receivables" && (
        <p className="text-sm text-muted">
          Open amounts {values.side === "PAYABLE" ? "you owe" : "owed to you"}, as at today, by how long they have been open since they were due. Record an amount owed as
          &ldquo;Owed to you&rdquo; or &ldquo;Owed by you&rdquo;, then record payments against it.
          {values.side === "PAYABLE" ? "" : " Overdue tenancy rent is included in the totals and listed by tenancy on the arrears page."}
        </p>
      )}

      <h2 className="text-xl">
        {REPORTS.find((item) => item.key === values.report)?.label}
        {values.report !== "receivables" && <span className="block text-sm font-normal text-muted">{`${formatDay(values.from)} to ${formatDay(values.to)}`}</span>}
      </h2>
      {values.report === "cashbook" && <Cashbook org={org} values={values} categories={categories} />}
      {values.report === "categories" && <CategoriesReport org={org} values={values} categories={categories} />}
      {values.report === "statement" &&
        (values.contact ? (
          <Statement org={org} contact={values.contact} values={values} categories={categories} />
        ) : (
          <EmptyState title="Choose a contact">Find the contact in your contact book above, then show the report.</EmptyState>
        ))}
      {values.report === "receivables" && <Receivables org={org} values={values} />}
    </div>
  );
}

/** `/agent/books/reports`. */
export function BooksReports({ currencies }: { currencies: SelectOption[] }) {
  return (
    <BooksShell path="/reports" section="reports" title="Reports" back={{ href: (org) => booksPath("", org), label: "Books" }}>
      {(organisation) => <Reports organisation={organisation} currencies={currencies} />}
    </BooksShell>
  );
}
