"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreditNote, Invoice, InvoicePayment } from "@/lib/api/invoices";
import { INVOICE_STATUS_TONES, lastDay, taxLabel } from "@/lib/invoices";
import { formatAmount, formatDay, periodLabel } from "@/lib/subscriptions";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * An invoice as a printable document (API 0.47.0): the same layout for the
 * finance team and the payer. The browser prints it (no PDF is generated).
 */
export function InvoiceDocument({
  invoice,
  payments = [],
  credits = [],
}: {
  invoice: Invoice;
  payments?: InvoicePayment[];
  credits?: CreditNote[];
}) {
  const money = (amount: string) => formatAmount(amount, invoice.currency_code);
  return (
    <article aria-labelledby="invoice-title" className="rounded-xl border border-line bg-surface p-5 md:p-8 print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary-ink">RightProperty365</p>
          <h2 id="invoice-title" className="mt-1 text-2xl">
            {invoice.number ? `Invoice ${invoice.number}` : "Draft invoice (not numbered yet)"}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={INVOICE_STATUS_TONES[invoice.status] ?? "neutral"}>{invoice.status_label}</Badge>
            <Badge tone="accent">{invoice.market_code}</Badge>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-4" aria-hidden="true" />
          Print
        </Button>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Billed to">{invoice.payer.name}</Fact>
        <Fact label="Issued">{invoice.issue_on ? formatDay(invoice.issue_on) : "Not yet"}</Fact>
        <Fact label="Due">{formatDay(invoice.due_on)}</Fact>
        <Fact label="Service period">
          {formatDay(invoice.service_from)} to {formatDay(lastDay(invoice.service_to))}
        </Fact>
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Invoice lines</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Unit</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2 pr-3 text-ink">{line.description}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{money(line.unit_amount)}</td>
                <td className="py-2 text-right tabular-nums">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 max-w-sm space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
        </div>
        {invoice.tax ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              {taxLabel(invoice.tax)}
              {invoice.tax.is_sample && <span className="block text-xs text-warning">Sample tax rate (test data)</span>}
            </dt>
            <dd className="tabular-nums">{money(invoice.tax.amount)}</dd>
          </div>
        ) : (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Tax</dt>
            <dd className="text-muted">None for this country</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-line pt-1 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(invoice.total)}</dd>
        </div>
        {invoice.amount_paid !== "0.00" && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Paid</dt>
            <dd className="tabular-nums">−{money(invoice.amount_paid)}</dd>
          </div>
        )}
        {invoice.amount_credited !== "0.00" && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Credited</dt>
            <dd className="tabular-nums">−{money(invoice.amount_credited)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-line pt-1 text-base font-semibold">
          <dt>Balance due</dt>
          <dd className="tabular-nums">{money(invoice.balance)}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-muted">
        {invoice.plan_name}, {periodLabel(invoice.period).toLowerCase()}. {invoice.terms}
      </p>
      {invoice.void_reason && <p className="mt-2 text-sm text-ink">Voided: {invoice.void_reason}</p>}
      {invoice.dispute_reason && invoice.status === "DISPUTED" && <p className="mt-2 text-sm text-ink">Under review: {invoice.dispute_reason}</p>}

      {payments.length > 0 && (
        <section aria-labelledby="invoice-receipts" className="mt-6 border-t border-line pt-4">
          <h3 id="invoice-receipts" className="font-sans text-base font-semibold tracking-normal">
            Receipts
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono">{p.receipt_number}</span> · {p.method_label}
                  {p.reference && ` · ${p.reference}`} · received {formatDay(p.received_on)}
                </span>
                <span className="tabular-nums font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {credits.length > 0 && (
        <section aria-labelledby="invoice-credits" className="mt-4 border-t border-line pt-4">
          <h3 id="invoice-credits" className="font-sans text-base font-semibold tracking-normal">
            Credit notes
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {credits.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono">{c.number}</span> · {c.reason}
                </span>
                <span className="tabular-nums font-medium">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
