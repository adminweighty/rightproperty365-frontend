"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { StatusBadge, todayLocal, useLedgerOptions } from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ApiResult } from "@/lib/api/http";
import { reverseEntry } from "@/lib/api/ledger";
import { downloadStatement, getStatement, listDues, listReceipts, recordReceipt, waiveDue, type Span } from "@/lib/api/rent";
import { amountProblem, canExportBooks, currencyMinorUnits, entryHref, formatLedgerAmount, METHODS, methodLabel, primaryEntryId, REFERENCE_MAX } from "@/lib/ledger";
import {
  arrearsHref,
  canRecordReceipt,
  canWriteRent,
  createdReceipt,
  emptyReceiptForm,
  hasReceiptProblems,
  isOpen,
  oldestFirst,
  openDuesOldestFirst,
  receiptBody,
  receiptApiProblems,
  receiptProblems,
  RECEIPT_REFERENCE_MAX,
  REVERSE_REASON_MAX,
  reverseReasonProblem,
  sumAmounts,
  WAIVE_REASON_MAX,
  waiveReasonProblem,
  type Receipt,
  type ReceiptForm,
  type ReceiptProblems,
  type DueList,
  type RentDue,
} from "@/lib/rent";
import type { Party, Tenancy } from "@/lib/tenancies";
import { formatDay } from "./shared";
import { ReceiptsTable, RentSummaryTiles, ScheduleTable, sectionHeading, StatementPanel } from "./rent-view";

/*
 * "Rent" on the team's tenancy page (API 0.36.1): the schedule with its
 * statuses, "Record a payment" with oldest-first or chosen allocation, the
 * receipts (each linked to its ledger entry; "Undo" reverses that entry), a
 * due's waiver, and the statement per currency with CSV and PDF downloads.
 * A payment is recorded by the team: its ledger entry reads "Recorded by
 * you, not verified", never a bank's confirmation.
 */

type Rent = { list: DueList; dues: RentDue[]; receipts: Receipt[] };

const places = (currency: string) => currencyMinorUnits(currency);

export function RentSection({ org, role, tenancy }: { org: string; role: string | null | undefined; tenancy: Tenancy }) {
  const load = useCallback(async (): Promise<ApiResult<Rent>> => {
    const [dues, receipts] = await Promise.all([listDues(org, tenancy.id), listReceipts(org, tenancy.id)]);
    if (!dues.ok) return dues;
    if (!receipts.ok) return receipts;
    return { ok: true, status: 200, data: { list: dues.data, dues: dues.data.dues, receipts: receipts.data } };
  }, [org, tenancy.id]);
  const { state, reload } = useApi(load);
  const rent = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const [notice, setNotice] = useState<{ text: string; entryId: string | null } | null>(null);
  const today = todayLocal();
  const writer = canWriteRent(role);

  return (
    <Card>
      <section aria-labelledby="rent-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rent-heading" className="font-sans text-xl font-semibold tracking-normal">
            Rent
          </h2>
          <Link href={arrearsHref(org)} className="text-sm font-medium text-primary-ink hover:underline">
            Arrears across all tenancies
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Payments here are recorded by your team and are not verified by a bank. Each one is an entry in your books.
        </p>
        <div aria-live="polite" className="mt-3">
          {notice && (
            <Alert tone="success" title={notice.text}>
              {notice.entryId && (
                <Link href={entryHref(notice.entryId, org)} className="font-medium text-primary-ink hover:underline">
                  Open the entry in your books
                </Link>
              )}
            </Alert>
          )}
        </div>

        {tenancy.status === "DRAFT" ? (
          <p className="mt-4 text-sm text-muted">The rent schedule is made when the tenancy is activated, from its rent terms.</p>
        ) : state.status === "error" ? (
          <div className="mt-4">
            <LoadError failure={state.failure} onRetry={reload} />
          </div>
        ) : !rent ? (
          <div className="mt-4">
            <LoadingBlock label="Loading the rent schedule" rows={3} />
          </div>
        ) : (
          <div className="mt-4 space-y-8">
            <RentSummaryTiles list={rent.list} today={today} places={places} />

            <section aria-labelledby="schedule-heading" className="space-y-3">
              <h3 id="schedule-heading" className={sectionHeading}>
                Schedule
              </h3>
              {rent.dues.length === 0 ? (
                <EmptyState title="No rent due dates yet">The schedule is made from the rent terms when the tenancy is activated, and extended each month.</EmptyState>
              ) : (
                <ScheduleTable
                  dues={rent.dues}
                  today={today}
                  action={
                    writer
                      ? (due) =>
                          (due.can ? due.can.waive : isOpen(due)) ? (
                            <WaiveButton
                              org={org}
                              due={due}
                              onDone={() => {
                                setNotice({ text: `Rent due on ${due.dueDate ? formatDay(due.dueDate) : "that date"} waived.`, entryId: null });
                                reload();
                              }}
                              onStale={reload}
                            />
                          ) : null
                      : undefined
                  }
                />
              )}
            </section>

            {writer && tenancy.rent && canRecordReceipt(tenancy.status, rent.dues) && (
              <RecordPayment
                org={org}
                tenancyId={tenancy.id}
                currency={tenancy.rent.currency}
                dues={rent.dues}
                tenants={tenancy.tenants}
                startDate={tenancy.startDate}
                today={today}
                onStale={reload}
                onRecorded={(text, entryId) => {
                  setNotice({ text, entryId });
                  reload();
                }}
              />
            )}

            <section aria-labelledby="receipts-heading" className="space-y-3">
              <h3 id="receipts-heading" className={sectionHeading}>
                Payments received
              </h3>
              {rent.receipts.length === 0 ? (
                <EmptyState title="No payments recorded yet">{writer ? "Record a payment above when the tenant pays." : "Payments appear here when your team records them."}</EmptyState>
              ) : (
                <ReceiptsTable
                  receipts={rent.receipts}
                  dues={rent.dues}
                  entry={(receipt) => <EntryLink org={org} receipt={receipt} />}
                  action={(receipt) =>
                    !receipt.reversed && receipt.ledgerEntryId && (receipt.can ? receipt.can.reverse : canExportBooks(role)) ? (
                      <UndoButton
                        org={org}
                        receipt={receipt}
                        onDone={(reversalId) => {
                          setNotice({ text: "Payment undone. Its entry stays in your books with a reversal beside it.", entryId: reversalId });
                          reload();
                        }}
                      />
                    ) : null
                  }
                />
              )}
            </section>

            <section aria-labelledby="statement-heading" className="space-y-3">
              <h3 id="statement-heading" className={sectionHeading}>
                Statement
              </h3>
              <AgentStatement org={org} tenancy={tenancy} today={today} />
            </section>
          </div>
        )}
      </section>
    </Card>
  );
}

function AgentStatement({ org, tenancy, today }: { org: string; tenancy: Tenancy; today: string }) {
  const load = useCallback((span: Span & { from: string; to: string }) => getStatement(org, tenancy.id, span), [org, tenancy.id]);
  const download = useCallback((span: Span, format: "csv" | "pdf") => downloadStatement(org, tenancy.id, span, format), [org, tenancy.id]);
  const start = tenancy.startDate && tenancy.startDate <= today ? tenancy.startDate : `${today.slice(0, 4)}-01-01`;
  return <StatementPanel idPrefix="agent" initial={{ from: start, to: today }} load={load} download={download} />;
}

function EntryLink({ org, receipt }: { org: string; receipt: Receipt }) {
  if (!receipt.ledgerEntryId) return <span className="text-muted">—</span>;
  return (
    <span className="grid justify-items-start gap-1">
      <Link href={entryHref(receipt.ledgerEntryId, org)} className="font-medium whitespace-nowrap text-primary-ink hover:underline">
        Open the entry
      </Link>
      <StatusBadge status={receipt.ledgerStatus} />
      {receipt.reversalEntryId && (
        <Link href={entryHref(receipt.reversalEntryId, org)} className="text-sm font-medium whitespace-nowrap text-primary-ink hover:underline">
          Open the reversal
        </Link>
      )}
    </span>
  );
}

// ---- Record a payment --------------------------------------------------------------------------------

function RecordPayment({
  org,
  tenancyId,
  currency,
  dues,
  tenants,
  startDate,
  today,
  onRecorded,
  onStale,
}: {
  org: string;
  tenancyId: string;
  currency: string;
  dues: RentDue[];
  tenants: Party[];
  startDate: string | null;
  today: string;
  onRecorded: (text: string, entryId: string | null) => void;
  /** The schedule changed meanwhile (409 `RENT_DUE_CHANGED`): read it again. */
  onStale: () => void;
}) {
  const options = useLedgerOptions(org);
  const unitsOf = (code: string) => options?.minorUnits[code] ?? currencyMinorUnits(code);
  const units = unitsOf(currency);
  const check = useCallback((value: string, code: string) => amountProblem(value, code, options?.minorUnits[code] ?? null), [options]);
  const [form, setForm] = useState<ReceiptForm>(() => emptyReceiptForm(today));
  const [problems, setProblems] = useState<ReceiptProblems>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; traceId?: string; other?: string[] } | null>(null);
  const [recorded, setRecorded] = useState("");
  const open = useMemo(() => openDuesOldestFirst(dues), [dues]);

  const set = <K extends keyof ReceiptForm>(key: K, value: ReceiptForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const amountOk = !check(form.amount, currency);
  const preview = amountOk && form.mode === "OLDEST_FIRST" ? oldestFirst(dues, form.amount.replace(/\s+/g, ""), units) : null;
  const chosenTotal = sumAmounts(
    Object.values(form.chosen)
      .map((value) => value.replace(/\s+/g, ""))
      .filter((value) => value && !check(value, currency)),
    units,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setRecorded("");
    const found = receiptProblems(form, currency, dues, today, check, units, startDate);
    setProblems(found);
    if (hasReceiptProblems(found)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#record-payment [aria-invalid='true']")?.focus());
      return;
    }
    setBusy(true);
    const body = receiptBody(form, currency, dues);
    const answer = await recordReceipt(org, tenancyId, body);
    setBusy(false);
    if (!answer.ok) {
      const { other, ...next } = receiptApiProblems(answer.failure.fields, body);
      setProblems(next);
      if (answer.failure.code === "RENT_DUE_CHANGED") {
        setFailure({ message: "The schedule changed while you were recording this payment. It has been read again: check the amounts and record it again.", traceId: answer.failure.traceId });
        onStale();
        return;
      }
      setFailure({ message: answer.failure.message, traceId: answer.failure.traceId, other });
      return;
    }
    const created = createdReceipt(answer.data);
    const words = `Payment of ${formatLedgerAmount(String(body.amount), currency)} recorded.`;
    setForm(emptyReceiptForm(today));
    setProblems({});
    setRecorded(`${words} The schedule and the payments below are up to date.`);
    onRecorded(`${words} It is in your books as recorded by you, not verified.`, created.ledgerEntryId);
  }

  const amountHint = `In ${currency}, the rent's currency.`;
  // Tenants still in the contact book; the API defaults to the first of them.
  const payers = tenants.filter((party) => party.id && party.live);
  const methodOptions = [{ value: "", label: "Choose how it was paid" }, ...(METHODS as readonly string[]).map((code) => ({ value: code, label: methodLabel(code) }))];

  return (
    <section aria-labelledby="record-heading" id="record-payment" className="space-y-3">
      <h3 id="record-heading" className={sectionHeading}>
        Record a payment
      </h3>
      <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-line p-4">
        {failure && (
          <Alert title={failure.message} traceId={failure.traceId}>
            {failure.other && failure.other.length > 0 && (
              <ul className="list-disc pl-5">
                {failure.other.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="receipt-amount" label={`Amount (${currency})`} hint={amountHint} error={problems.amount}>
            <div className="flex">
              <span className="inline-flex h-11 shrink-0 items-center rounded-l-md border border-r-0 border-control bg-sunken px-3 text-sm font-medium text-ink" aria-hidden="true">
                {currency}
              </span>
              <Input
                id="receipt-amount"
                inputMode="decimal"
                autoComplete="off"
                className="rounded-l-none"
                value={form.amount}
                onChange={(event) => set("amount", event.target.value)}
                aria-invalid={Boolean(problems.amount)}
                aria-describedby={fieldDescribedBy("receipt-amount", { hint: amountHint, error: problems.amount })}
              />
            </div>
          </Field>
          <Field id="receipt-method" label="How it was paid" error={problems.method}>
            <SearchableSelect
              id="receipt-method"
              options={methodOptions}
              value={form.method}
              onValueChange={(value) => set("method", value)}
              aria-invalid={Boolean(problems.method)}
              aria-describedby={fieldDescribedBy("receipt-method", { error: problems.method })}
            />
          </Field>
          <Field id="receipt-received" label="Received on" error={problems.receivedOn}>
            <Input
              id="receipt-received"
              type="date"
              max={today}
              value={form.receivedOn}
              onChange={(event) => set("receivedOn", event.target.value)}
              aria-invalid={Boolean(problems.receivedOn)}
              aria-describedby={fieldDescribedBy("receipt-received", { error: problems.receivedOn })}
            />
          </Field>
          <Field id="receipt-reference" label="Reference" optional hint="A bank or mobile money reference, or a receipt number." error={problems.reference}>
            <Input
              id="receipt-reference"
              maxLength={Math.min(RECEIPT_REFERENCE_MAX, REFERENCE_MAX)}
              value={form.reference}
              onChange={(event) => set("reference", event.target.value)}
              aria-invalid={Boolean(problems.reference)}
              aria-describedby={fieldDescribedBy("receipt-reference", { hint: "A bank or mobile money reference, or a receipt number.", error: problems.reference })}
            />
          </Field>
          {payers.length > 1 && (
            <Field id="receipt-tenant" label="Paid by" optional hint="The tenant named on the entry in your books.">
              <SearchableSelect
                id="receipt-tenant"
                options={[{ value: "", label: `${payers[0].name} (the first tenant)` }, ...payers.slice(1).map((party) => ({ value: party.id as string, label: party.name }))]}
                value={form.tenantContactId}
                onValueChange={(value) => set("tenantContactId", value)}
                aria-describedby={fieldDescribedBy("receipt-tenant", { hint: "The tenant named on the entry in your books." })}
              />
            </Field>
          )}
        </div>

        <fieldset className="min-w-0" aria-describedby={problems.allocation?.total ? "allocation-error" : undefined}>
          <legend className="text-sm font-medium text-ink">What it pays</legend>
          <div className="mt-2 grid gap-2">
            {(
              [
                ["OLDEST_FIRST", "Oldest first", "The money pays the oldest outstanding rent first, then the next."],
                ["CHOSEN", "Choose the due dates", "Say how much goes to each due date. The amounts must add up to the payment."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line p-3 has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="allocation-mode"
                  value={value}
                  checked={form.mode === value}
                  onChange={() => {
                    set("mode", value);
                    setProblems((current) => ({ ...current, allocation: undefined }));
                  }}
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="block text-sm text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {problems.allocation?.total && (
            <p id="allocation-error" className="mt-2 text-sm text-danger" role="alert">
              {problems.allocation.total}
            </p>
          )}
          {form.mode === "OLDEST_FIRST" && preview && preview.allocations.length > 0 && (
            <div className="mt-3 rounded-md bg-sunken p-3 text-sm">
              <p className="font-medium text-ink">It will pay:</p>
              <ul className="mt-1 space-y-0.5">
                {preview.allocations.map((item) => {
                  const due = dues.find((other) => other.id === item.dueId);
                  return (
                    <li key={item.dueId} className="tabular-nums">
                      {due?.dueDate ? formatDay(due.dueDate) : "A due"}: {formatLedgerAmount(item.amount, currency)}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {form.mode === "CHOSEN" &&
            (open.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing is outstanding on this tenancy.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <ul className="grid gap-2">
                  {open.map((due) => {
                    const id = `allocate-${due.id}`;
                    const error = problems.allocation?.rows[due.id];
                    const hint = `Outstanding ${formatLedgerAmount(due.outstanding, currency)}`;
                    return (
                      <li key={due.id}>
                        <Field id={id} label={`Rent due ${due.dueDate ? formatDay(due.dueDate) : ""} (${currency})`} hint={hint} error={error}>
                          <Input
                            id={id}
                            inputMode="decimal"
                            autoComplete="off"
                            className="sm:max-w-xs"
                            value={form.chosen[due.id] ?? ""}
                            onChange={(event) => set("chosen", { ...form.chosen, [due.id]: event.target.value })}
                            aria-invalid={Boolean(error)}
                            aria-describedby={fieldDescribedBy(id, { hint, error })}
                          />
                        </Field>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-ink" role="status">
                  Allocated {formatLedgerAmount(chosenTotal ?? "0", currency)}
                  {amountOk ? ` of ${formatLedgerAmount(form.amount.replace(/\s+/g, ""), currency)}` : ""}
                </p>
              </div>
            ))}
        </fieldset>

        <div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Recording…" : "Record the payment"}
          </Button>
          <p className="mt-2 text-sm text-muted">It is added to your books as rent received, recorded by you and not verified.</p>
          {/* Seen beside the button; the section's live region above announces it. */}
          {recorded && <p className="mt-2 text-sm font-medium text-success">{recorded}</p>}
        </div>
      </form>
    </section>
  );
}

// ---- Waive a due ----------------------------------------------------------------------------------------

function WaiveButton({ org, due, onDone, onStale }: { org: string; due: RentDue; onDone: () => void; onStale: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const day = due.dueDate ? formatDay(due.dueDate) : "this date";
  const id = `waive-${due.id}`;

  async function confirm() {
    const found = waiveReasonProblem(reason);
    setProblem(found ?? undefined);
    if (found) return;
    setBusy(true);
    setError(undefined);
    const answer = await waiveDue(org, due.id, reason.trim());
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.code === "RENT_DUE_NOT_WAIVABLE" || answer.failure.code === "RENT_DUE_NOT_FOUND") {
        // Paid or waived meanwhile: the schedule is read again and shows why.
        setOpen(false);
        onStale();
        return;
      }
      if (answer.failure.fields?.reason) setProblem(answer.failure.fields.reason);
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    setReason("");
    onDone();
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError(undefined);
          setProblem(undefined);
          setOpen(true);
        }}
        aria-label={`Waive the rent due on ${day}`}
      >
        Waive
      </Button>
      <ConfirmDialog
        open={open}
        title={`Waive the rent due on ${day}?`}
        confirmLabel="Yes, waive it"
        busyLabel="Waiving…"
        cancelLabel="Keep it due"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <p>
          {formatLedgerAmount(due.outstanding, due.currency)} will no longer be owed for this date. Anything already paid towards it stays recorded. The
          waiver and its reason are kept in the activity log.
        </p>
        <Field id={id} label="Why is it waived?" error={problem} className="mt-4 text-ink">
          <Textarea
            id={id}
            rows={3}
            maxLength={WAIVE_REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy(id, { error: problem })}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}

// ---- Undo a payment (reverse its ledger entry) ----------------------------------------------------------------

function UndoButton({ org, receipt, onDone }: { org: string; receipt: Receipt; onDone: (reversalId: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const what = `${formatLedgerAmount(receipt.amount, receipt.currency)}${receipt.receivedOn ? ` received on ${formatDay(receipt.receivedOn)}` : ""}`;
  const id = `undo-${receipt.id}`;

  async function confirm() {
    if (!receipt.ledgerEntryId) return;
    const found = reverseReasonProblem(reason);
    setProblem(found ?? undefined);
    if (found) return;
    setBusy(true);
    setError(undefined);
    const answer = await reverseEntry(org, receipt.ledgerEntryId, reason.trim());
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.fields?.reason) setProblem(answer.failure.fields.reason);
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    setReason("");
    // `{entry: the reversal, created, updated}`.
    onDone(primaryEntryId(answer.data));
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError(undefined);
          setProblem(undefined);
          setOpen(true);
        }}
        aria-label={`Undo the payment of ${what}`}
      >
        Undo
      </Button>
      <ConfirmDialog
        open={open}
        title="Undo this payment?"
        confirmLabel="Yes, reverse it"
        busyLabel="Reversing…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <p>
          The payment of {what} is reversed in your books. Its entry stays there, marked as reversed, and a reversal entry with the opposite
          sign is created beside it. The rent it paid shows as outstanding again. A reversal cannot be undone; record the payment again if
          needed.
        </p>
        <Field id={id} label="Why is it being undone?" error={problem} className="mt-4 text-ink">
          <Textarea
            id={id}
            rows={2}
            maxLength={REVERSE_REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy(id, { error: problem })}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}
