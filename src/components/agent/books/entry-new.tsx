"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { EntryEditor } from "@/components/agent/books/entry-form";
import { BooksShell, todayLocal } from "@/components/agent/books/shared";
import { ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { createEntry, getEntry } from "@/lib/api/ledger";
import {
  booksPath,
  canWriteBooks,
  emptyEntryForm,
  entryHref,
  entryTypeLabel,
  formatLedgerAmount,
  isMemoType,
  paymentFormFor,
  primaryEntryId,
  type EntryForm,
} from "@/lib/ledger";

/** A payment against an amount owed (`?settles=<id>`): the form starts from that entry. */
function Payment({ org, owedId, currencies }: { org: string; owedId: string; currencies: SelectOption[] }) {
  const router = useRouter();
  const load = useCallback(() => getEntry(org, owedId), [org, owedId]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the amount owed" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  const owed = state.data.entry;
  if (!isMemoType(owed.type) || owed.reversed_by) {
    return (
      <EmptyState
        title="Payments are recorded against an amount owed that is still open"
        action={
          <ButtonLink href={entryHref(owed.id, org)} variant="secondary">
            Back to the entry
          </ButtonLink>
        }
      />
    );
  }
  const label = `${entryTypeLabel(owed.type, owed.typeLabel).toLowerCase()} of ${formatLedgerAmount(owed.amount, owed.currency)}`;
  return (
    <Card>
      <h2 className="text-xl">{owed.type === "PAYABLE" ? "Record a payment you made" : "Record a payment received"}</h2>
      <div className="mt-6">
        <EntryEditor
          org={org}
          mode="create"
          initial={paymentFormFor(owed, todayLocal())}
          contactLabel={owed.contact?.label}
          settlesLabel={label}
          currencies={currencies}
          submitLabel="Record the payment"
          busyLabel="Recording…"
          send={(body) => createEntry(org, body)}
          onSent={(data) => {
            const id = primaryEntryId(data);
            router.push(id ? entryHref(id, org) : entryHref(owed.id, org));
          }}
          onCancel={() => router.push(entryHref(owed.id, org))}
        />
      </div>
    </Card>
  );
}

const KINDS: { kind: EntryForm["kind"]; label: string; heading: string }[] = [
  { kind: "entry", label: "Money in or out", heading: "Record an entry" },
  { kind: "transfer", label: "Transfer", heading: "Record a transfer" },
  { kind: "opening", label: "Opening balance", heading: "Record an opening balance" },
];

function NewEntry({ organisation, currencies }: { organisation: DashboardOrganisation; currencies: SelectOption[] }) {
  const org = organisation.id;
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("kind");
  const current = KINDS.find((item) => item.kind === wanted) ?? KINDS[0];
  const settles = params.get("settles") ?? "";

  if (!canWriteBooks(organisation.role)) {
    return (
      <EmptyState
        title="Agency Staff can read the books but not record entries"
        action={
          <ButtonLink href={booksPath("", org)} variant="secondary">
            Back to the entries
          </ButtonLink>
        }
      >
        Ask the Agency Principal, a Manager or an Estate Agent of your team to record it.
      </EmptyState>
    );
  }

  if (/^[A-Za-z0-9_-]{1,64}$/.test(settles)) return <Payment org={org} owedId={settles} currencies={currencies} />;

  return (
    <>
      <ChipNav
        label="What to record"
        items={KINDS.map((item) => ({
          key: item.kind,
          href: booksPath("/new", org, { kind: item.kind === "entry" ? undefined : item.kind }),
          label: item.label,
          current: item.kind === current.kind,
        }))}
      />
      <Card className="mt-6">
        <h2 className="text-xl">{current.heading}</h2>
        <p className="mt-1 text-sm text-muted">It is posted at once. An entry is never edited afterwards: a mistake is reversed or corrected, and both stay visible.</p>
        <div className="mt-6">
          {/* key: switching what to record starts a clean form. */}
          <EntryEditor
            key={current.kind}
            org={org}
            mode="create"
            initial={emptyEntryForm(current.kind, todayLocal(), currencies[0]?.value ?? "USD")}
            currencies={currencies}
            submitLabel={current.kind === "transfer" ? "Record the transfer" : current.kind === "opening" ? "Record the opening balance" : "Record the entry"}
            busyLabel="Recording…"
            send={(body) => createEntry(org, body)}
            onSent={(data) => {
              const id = primaryEntryId(data);
              router.push(id ? entryHref(id, org) : booksPath("", org));
            }}
            onCancel={() => router.push(booksPath("", org))}
          />
        </div>
      </Card>
    </>
  );
}

/** `/agent/books/new` (`?kind=transfer`, `?kind=opening`). */
export function EntryNew({ currencies }: { currencies: SelectOption[] }) {
  return (
    <BooksShell path="/new" section="other" title="Record in your books" back={{ href: (org) => booksPath("", org), label: "Books" }}>
      {(organisation) => <NewEntry organisation={organisation} currencies={currencies} />}
    </BooksShell>
  );
}
