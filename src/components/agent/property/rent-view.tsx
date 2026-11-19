"use client";

import { Download } from "lucide-react";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { formatDay, saveBlob, TableRegion, td, tdNum, th, thNum } from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import type { ApiResult } from "@/lib/api/http";
import { fileNameFrom, formatLedgerAmount, methodLabel } from "@/lib/ledger";
import { dueBadge, rentSummary, statementFileName, type DueList, type Receipt, type RentDue, type RentSummary, type StatementBlock } from "@/lib/rent";
import { isDay } from "@/lib/tenancies";

/*
 * The parts of a tenancy's rent shown both to the team (`/agent/tenancies/<id>`)
 * and to the tenant (`/account/tenancies/<id>`): the summary per currency, the
 * schedule, the receipts and the statement with its downloads. The team's
 * page adds its controls through the `action` slots; the tenant's has none.
 *
 * Every amount carries its currency code, and nothing adds one currency to
 * another. A payment is what the team recorded, never a bank's confirmation.
 */

export const sectionHeading = "font-sans text-lg font-semibold tracking-normal";

const nonZero = (amount: string | null | undefined) => Boolean(amount && /[1-9]/.test(amount));

const money = (amount: string | null | undefined, currency: string) => (amount === null || amount === undefined ? "—" : formatLedgerAmount(amount, currency));

export function DueBadge({ due, today }: { due: RentDue; today: string }) {
  const badge = dueBadge(due, today, due.statusLabel);
  return <Badge tone={badge.tone}>{badge.words}</Badge>;
}

const tileClass = "rounded-lg border border-line bg-surface p-4";

/**
 * Overdue, outstanding to date and the next due, per currency: the API's
 * summary when it sends one, otherwise made from the dues. Each tile names
 * its currency; two currencies are never one figure.
 */
export function RentSummaryTiles({ list, today, places }: { list: DueList; today: string; places: (currency: string) => number }) {
  const summaries: RentSummary[] = list.summary ? [list.summary] : rentSummary(list.dues, today, places);
  return (
    <div className="grid gap-3">
      {summaries.map((item) => (
        <div key={item.currency}>
          <dl className="grid gap-3 sm:grid-cols-3" aria-label={`Rent in ${item.currency}`}>
            <div className={tileClass}>
              <dt className="text-sm text-muted">Overdue ({item.currency})</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{money(item.overdue, item.currency)}</dd>
              <dd className="text-xs text-muted">
                {item.overdueCount === 0 ? "Nothing overdue" : item.overdueCount === 1 ? "1 due date has passed unpaid" : `${item.overdueCount} due dates have passed unpaid`}
              </dd>
            </div>
            <div className={tileClass}>
              <dt className="text-sm text-muted">Outstanding to date ({item.currency})</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{money(item.outstanding, item.currency)}</dd>
              <dd className="text-xs text-muted">
                {money(item.charged, item.currency)} due so far, {money(item.paid, item.currency)} paid
                {/[1-9]/.test(item.waived) ? `, ${money(item.waived, item.currency)} waived` : ""}
              </dd>
            </div>
            <div className={tileClass}>
              <dt className="text-sm text-muted">Next due</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{item.nextDue ? money(item.nextDue.outstanding, item.currency) : "—"}</dd>
              <dd className="text-xs text-muted">{item.nextDue?.dueDate ? `On ${formatDay(item.nextDue.dueDate)}` : "No upcoming due dates"}</dd>
            </div>
          </dl>
          {/[1-9]/.test(item.paidInAdvance) && (
            <p className="mt-2 text-sm text-muted">Paid in advance, on rent not yet due: {money(item.paidInAdvance, item.currency)}.</p>
          )}
        </div>
      ))}
      {list.schedule?.rule && (
        <p className="text-sm text-muted">
          {list.schedule.rule}
          {list.schedule.through && `, through ${formatDay(list.schedule.through)}`}
          {list.schedule.rolling ? ". The schedule is extended each month while the tenancy has no end date." : "."}
        </p>
      )}
    </div>
  );
}

/** Due date, amount, paid, outstanding and the status in words; `action` adds a control per line (waive). */
export function ScheduleTable({ dues, today, action, label = "Rent schedule" }: { dues: RentDue[]; today: string; action?: (due: RentDue) => ReactNode; label?: string }) {
  return (
    <TableRegion label={`${label}, scrolls sideways`}>
      <table className="w-full min-w-[40rem] border-collapse">
        <caption className="sr-only">{label}, oldest due date first.</caption>
        <thead className="border-b border-line bg-sunken">
          <tr>
            <th scope="col" className={th}>Due date</th>
            <th scope="col" className={thNum}>Amount</th>
            <th scope="col" className={thNum}>Paid</th>
            <th scope="col" className={thNum}>Outstanding</th>
            <th scope="col" className={th}>Status</th>
            {action && (
              <th scope="col" className={th}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {dues.map((due) => (
            <tr key={due.id} className="border-b border-line last:border-0">
              <th scope="row" className={`${td} text-left font-medium whitespace-nowrap`}>
                {due.dueDate ? formatDay(due.dueDate) : "No date"}
                {due.periodStart && due.periodEnd && (
                  <span className="block text-xs font-normal text-muted">
                    For {formatDay(due.periodStart)} to {formatDay(due.periodEnd)}
                  </span>
                )}
              </th>
              <td className={tdNum}>{money(due.amount, due.currency)}</td>
              <td className={tdNum}>{money(due.paid, due.currency)}</td>
              <td className={`${tdNum} font-semibold`}>{money(due.outstanding, due.currency)}</td>
              <td className={td}>
                <DueBadge due={due} today={today} />
                {due.status === "WAIVED" && (
                  <span className="mt-1 block max-w-xs text-xs break-words text-muted">
                    {due.waived && /[1-9]/.test(due.waived) && `${money(due.waived, due.currency)} waived`}
                    {due.waivedAt && ` on ${formatDay(due.waivedAt.slice(0, 10))}`}
                    {due.waivedBy && ` by ${due.waivedBy}`}
                    {due.waivedReason && <span className="block">{due.waivedReason}</span>}
                  </span>
                )}
                {due.status !== "WAIVED" && due.daysOverdue !== null && due.daysOverdue > 0 && (
                  <span className="mt-1 block text-xs text-muted">{due.daysOverdue === 1 ? "1 day overdue" : `${due.daysOverdue} days overdue`}</span>
                )}
              </td>
              {action && <td className={`${td} whitespace-nowrap`}>{action(due)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}

/** Which dues a receipt paid, in words: "1 October 2026: USD 950.00". */
function AllocatedTo({ receipt, dues }: { receipt: Receipt; dues: RentDue[] }) {
  if (receipt.allocations.length === 0) return <span className="text-muted">—</span>;
  return (
    <ul className="space-y-0.5">
      {receipt.allocations.map((item, index) => {
        const day = item.dueDate ?? dues.find((due) => due.id === item.dueId)?.dueDate ?? null;
        return (
          <li key={`${item.dueId ?? "due"}-${index}`} className="whitespace-nowrap">
            {day ? formatDay(day) : "A due"}: <span className="tabular-nums">{money(item.amount, receipt.currency)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Receipts, newest first. `entry` links a receipt to its ledger entry (the
 * team's page only); `action` adds "Undo". A reversed receipt says so in
 * words and its allocations are no longer counted.
 */
export function ReceiptsTable({
  receipts,
  dues,
  entry,
  action,
}: {
  receipts: Receipt[];
  dues: RentDue[];
  entry?: (receipt: Receipt) => ReactNode;
  action?: (receipt: Receipt) => ReactNode;
}) {
  return (
    <TableRegion label="Payments received, scrolls sideways">
      <table className="w-full min-w-[46rem] border-collapse">
        <caption className="sr-only">Payments received, newest first.</caption>
        <thead className="border-b border-line bg-sunken">
          <tr>
            <th scope="col" className={th}>Received on</th>
            <th scope="col" className={thNum}>Amount</th>
            <th scope="col" className={th}>Method</th>
            <th scope="col" className={th}>Reference</th>
            <th scope="col" className={th}>Paid towards</th>
            {entry && <th scope="col" className={th}>In the books</th>}
            {action && (
              <th scope="col" className={th}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.id} className="border-b border-line last:border-0">
              <th scope="row" className={`${td} text-left font-medium whitespace-nowrap`}>
                {receipt.receivedOn ? formatDay(receipt.receivedOn) : "No date"}
                {receipt.tenant && <span className="block text-xs font-normal text-muted">From {receipt.tenant}</span>}
                {receipt.reversed && (
                  <span className="mt-1 block">
                    <Badge tone="neutral">Undone (reversed)</Badge>
                    {receipt.reversedOn && <span className="mt-0.5 block text-xs font-normal text-muted">On {formatDay(receipt.reversedOn)}</span>}
                  </span>
                )}
              </th>
              <td className={`${tdNum} font-semibold ${receipt.reversed ? "line-through decoration-1" : ""}`}>
                {receipt.reversed && <span className="sr-only">Undone: </span>}
                {money(receipt.amount, receipt.currency)}
              </td>
              <td className={td}>{methodLabel(receipt.method, receipt.methodLabel)}</td>
              <td className={`${td} break-words`}>{receipt.reference ?? <span className="text-muted">—</span>}</td>
              <td className={td}>
                <AllocatedTo receipt={receipt} dues={dues} />
                {receipt.reversed && receipt.allocations.length > 0 && <span className="mt-1 block text-xs text-muted">No longer counted: the payment was undone.</span>}
              </td>
              {entry && <td className={td}>{entry(receipt)}</td>}
              {action && <td className={`${td} whitespace-nowrap`}>{action(receipt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}

// ---- The statement -----------------------------------------------------------------------------------------

function StatementTable({ block }: { block: StatementBlock }) {
  const c = block.currency;
  return (
    <section aria-labelledby={`statement-${c}`} className="space-y-3">
      <h4 id={`statement-${c}`} className="font-sans text-base font-semibold tracking-normal">
        In {c}
      </h4>
      <dl className="grid gap-2 text-sm sm:grid-cols-4">
        {(
          [
            ["Brought forward", block.opening],
            ["Rent charged", block.charged],
            ["Paid", block.received],
            ["Balance at the end", block.closing],
          ] as const
        ).map(([term, value]) => (
          <div key={term} className="rounded-md bg-sunken px-3 py-2">
            <dt className="text-muted">{term}</dt>
            <dd className="font-semibold tabular-nums text-ink">{money(value, c)}</dd>
          </div>
        ))}
      </dl>
      {(nonZero(block.waived) || nonZero(block.reversed) || nonZero(block.overdue)) && (
        <p className="text-sm text-muted">
          {[
            nonZero(block.waived) && `Waived: ${money(block.waived, c)}`,
            nonZero(block.reversed) && `Payments undone: ${money(block.reversed, c)}`,
            nonZero(block.overdue) && `Overdue at the end of the period: ${money(block.overdue, c)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p className="text-xs text-muted">A positive balance is owed by the tenant; a negative balance is in the tenant&apos;s favour.</p>
      {block.lines.length === 0 ? (
        <p className="text-sm text-muted">Nothing was charged or received in {c} in this period.</p>
      ) : (
        <TableRegion label={`Statement in ${c}, scrolls sideways`}>
          <table className="w-full min-w-[38rem] border-collapse">
            <caption className="sr-only">Statement lines in {c}, oldest first.</caption>
            <thead className="border-b border-line bg-sunken">
              <tr>
                <th scope="col" className={th}>Date</th>
                <th scope="col" className={th}>What</th>
                <th scope="col" className={thNum}>Owed more</th>
                <th scope="col" className={thNum}>Paid or waived</th>
                <th scope="col" className={thNum}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {block.lines.map((line) => (
                <tr key={line.key} className="border-b border-line last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{line.date ? formatDay(line.date) : ""}</td>
                  <th scope="row" className={`${td} text-left font-normal break-words`}>
                    {line.description}
                    {line.reference && <span className="block text-xs text-muted">{line.reference}</span>}
                  </th>
                  <td className={tdNum}>{line.charge ? money(line.charge, c) : ""}</td>
                  <td className={tdNum}>{line.credit ? money(line.credit, c) : ""}</td>
                  <td className={`${tdNum} font-semibold`}>{money(line.balance, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </section>
  );
}

type Span = { from: string; to: string };

/**
 * The statement for a period, one block per currency, with CSV and PDF
 * downloads of the same period. `load` and `download` are the team's or the
 * tenant's endpoints.
 */
export function StatementPanel({
  idPrefix,
  initial,
  load,
  download,
}: {
  idPrefix: string;
  initial: Span;
  load: (span: Span) => Promise<ApiResult<StatementBlock[]>>;
  download: (span: Span, format: "csv" | "pdf") => Promise<ApiResult<{ blob: Blob; headers: Headers }>>;
}) {
  const [span, setSpan] = useState<Span>(initial);
  const [draft, setDraft] = useState<Span>(initial);
  const [problem, setProblem] = useState<{ from?: string; to?: string }>({});
  const read = useCallback(() => load(span), [load, span]);
  const { state, reload } = useApi(read);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: { from?: string; to?: string } = {};
    if (!isDay(draft.from)) found.from = "Enter a real date, for example 2026-01-01.";
    if (!isDay(draft.to)) found.to = "Enter a real date, for example 2026-11-30.";
    else if (!found.from && draft.to < draft.from) found.to = "The end of the period must be on or after its start.";
    setProblem(found);
    if (found.from || found.to) return;
    setSpan({ ...draft });
  }

  const fromId = `${idPrefix}-statement-from`;
  const toId = `${idPrefix}-statement-to`;
  return (
    <div className="space-y-4">
      <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id={fromId} label="From" error={problem.from}>
          <Input
            id={fromId}
            type="date"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            aria-invalid={Boolean(problem.from)}
            aria-describedby={fieldDescribedBy(fromId, { error: problem.from })}
          />
        </Field>
        <Field id={toId} label="To" error={problem.to}>
          <Input
            id={toId}
            type="date"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            aria-invalid={Boolean(problem.to)}
            aria-describedby={fieldDescribedBy(toId, { error: problem.to })}
          />
        </Field>
        <Button type="submit" variant="secondary">
          Show the statement
        </Button>
      </form>
      <p className="text-sm text-muted">
        {formatDay(span.from)} to {formatDay(span.to)}. Each currency has its own statement; currencies are never added together.
      </p>
      <Downloads span={span} download={download} />
      {state.status === "loading" && <LoadingBlock label="Loading the statement" rows={2} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" && state.data.length === 0 && <EmptyState title="Nothing in this period">No rent was charged or received between these dates.</EmptyState>}
      {state.status === "ready" && state.data.length > 0 && (
        <div className="space-y-6">
          {state.data.map((block) => (
            <StatementTable key={block.currency} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

function Downloads({ span, download }: { span: Span; download: (span: Span, format: "csv" | "pdf") => Promise<ApiResult<{ blob: Blob; headers: Headers }>> }) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);

  async function get(format: "csv" | "pdf") {
    setBusy(format);
    setNotice(null);
    const answer = await download(span, format);
    setBusy(null);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), statementFileName(format, span));
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}.` });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {(["csv", "pdf"] as const).map((format) => (
          <Button key={format} variant="secondary" onClick={() => void get(format)} disabled={busy !== null} aria-busy={busy === format}>
            <Download className="size-4" aria-hidden="true" />
            {busy === format ? "Preparing the file…" : `Download as ${format.toUpperCase()}`}
          </Button>
        ))}
      </div>
      <div aria-live="polite" className="mt-2">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
    </div>
  );
}
