import Link from "next/link";
import type { ReactNode } from "react";
import { formatDay } from "@/components/agent/books/shared";
import { formatWhen } from "@/components/portal/portal-ui";
import { Card } from "@/components/ui/card";
import { formatLedgerAmount } from "@/lib/ledger";
import { dueDayWords, frequencyLabel, tenancyTimeline, type Party, type Tenancy } from "@/lib/tenancies";

/*
 * The parts of a tenancy shown both to the team (`/agent/tenancies/<id>`)
 * and to the tenant (`/account/tenancies/<id>`): the parties, the terms and
 * the status timeline. Read-only; plain markup, so either page can use it.
 */

const heading = "font-sans text-xl font-semibold tracking-normal";

function PartyList({ title, parties, contactHref, empty }: { title: string; parties: Party[]; contactHref?: (id: string) => string; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {parties.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {parties.map((party) => (
            <li key={party.key} className="text-sm break-words">
              {contactHref && party.id && party.live ? (
                <Link href={contactHref(party.id)} className="font-medium text-primary-ink hover:underline">
                  {party.name}
                </Link>
              ) : (
                <span className="font-medium text-ink">{party.name}</span>
              )}
              {contactHref && !party.live && <span className="block text-muted">No longer in the contact book (deleted or merged)</span>}
              {party.email && <span className="block text-muted">{party.email}</span>}
              {party.phone && <span className="block text-muted">{party.phone}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartiesCard({ tenancy, contactHref }: { tenancy: Tenancy; contactHref?: (id: string) => string }) {
  return (
    <Card>
      <h2 className={heading}>Parties</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <PartyList title="Tenants" parties={tenancy.tenants} contactHref={contactHref} empty="No tenants recorded." />
        <PartyList title="Landlords" parties={tenancy.landlords} contactHref={contactHref} empty="No landlord recorded." />
      </div>
    </Card>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="text-sm font-medium text-muted">{term}</dt>
      <dd className="text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

export function TermsCard({ tenancy, lease }: { tenancy: Tenancy; lease?: ReactNode }) {
  const rent = tenancy.rent;
  const due = rent ? dueDayWords(rent.frequency, rent.dueDay) : "";
  return (
    <Card>
      <h2 className={heading}>Terms</h2>
      <dl className="mt-2 divide-y divide-line">
        <Row term="Rent">
          {rent ? <span className="font-semibold tabular-nums">{formatLedgerAmount(rent.amount, rent.currency)}</span> : "Not set"}
        </Row>
        {rent && <Row term="How often">{rent.frequencyLabel ?? frequencyLabel(rent.frequency)}</Row>}
        {rent && <Row term="Due">{due ? due[0].toUpperCase() + due.slice(1) : "Not set"}</Row>}
        <Row term="Deposit">{tenancy.deposit ? <span className="tabular-nums">{formatLedgerAmount(tenancy.deposit.amount, tenancy.deposit.currency)}</span> : "None recorded"}</Row>
        <Row term="Starts">{tenancy.startDate ? formatDay(tenancy.startDate) : "Not set"}</Row>
        <Row term={tenancy.endedOn ? "Agreed end" : "Ends"}>{tenancy.endDate ? formatDay(tenancy.endDate) : "No end date: it runs until notice is given"}</Row>
        {tenancy.endedOn && <Row term="Ended on">{formatDay(tenancy.endedOn)}</Row>}
        {tenancy.endReason && <Row term="Why it ended">{tenancy.endReason}</Row>}
        {lease !== undefined && <Row term="Lease">{lease}</Row>}
      </dl>
      {rent && tenancy.deposit && tenancy.deposit.currency !== rent.currency && (
        <p className="mt-3 text-sm text-muted">The rent and the deposit are in different currencies. Currencies are never added together.</p>
      )}
    </Card>
  );
}

/** `hideWhenEmpty`: the tenant's view carries no history dates, so it shows nothing rather than an empty card. */
export function TimelineCard({ tenancy, hideWhenEmpty }: { tenancy: Tenancy; hideWhenEmpty?: boolean }) {
  const steps = tenancyTimeline(tenancy);
  if (hideWhenEmpty && steps.length === 0) return null;
  return (
    <Card>
      <h2 className={heading}>Status timeline</h2>
      {steps.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No changes recorded yet.</p>
      ) : (
        <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {steps.map((step) => (
            <li key={step.key} className="relative">
              <span className="absolute top-1.5 -left-[1.4rem] size-3 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
              <p className="font-medium text-ink">{step.words}</p>
              <p className="text-sm text-muted">
                {step.day && `Effective ${formatDay(step.day)}`}
                {step.day && step.at && " · "}
                {step.at && <time dateTime={step.at}>{formatWhen(step.at)}</time>}
                {step.actor && ` · by ${step.actor}`}
              </p>
              {step.text && <p className="mt-1 text-sm break-words text-ink">{step.text}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
