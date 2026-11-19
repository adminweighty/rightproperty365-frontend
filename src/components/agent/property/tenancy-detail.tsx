"use client";

import { useCallback, useState, type FormEvent } from "react";
import { todayLocal } from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { activateTenancy, deleteTenancy, endTenancy, getTenancy } from "@/lib/api/properties";
import { contactHref } from "@/lib/contacts";
import { useRouter } from "next/navigation";
import {
  canWriteTenancies,
  END_REASON_MAX,
  endProblems,
  isTenancyStatus,
  occupyingTenancyId,
  partyNames,
  propertyHref,
  TENANCY_STATUS_EXPLAINED,
  tenanciesPath,
  tenancyActions,
  tenancyHref,
  type Tenancy,
} from "@/lib/tenancies";
import { formatDay, Linked, ManagementShell, rentWords, TenancyStatusBadge } from "./shared";
import { InspectionsSection } from "./inspections-section";
import { MaintenanceSection } from "./maintenance-section";
import { RentSection } from "./rent-section";
import { PartiesCard, TermsCard, TimelineCard } from "./tenancy-view";

/*
 * Rent (part b of the 0.36 contract), maintenance (part c) and inspections
 * (part d) are their own sections.
 */

/** `/agent/tenancies/<id>`: parties, terms, the status timeline; activate a draft, end an active tenancy. */
export function TenancyDetail({ id }: { id: string }) {
  return (
    <ManagementShell area="tenancies" path={`/${encodeURIComponent(id)}`} back={{ href: (org) => tenanciesPath("", org), label: "Tenancies" }}>
      {(organisation) => <Detail id={id} organisation={organisation} />}
    </ManagementShell>
  );
}

function Detail({ id, organisation }: { id: string; organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const load = useCallback(() => getTenancy(org, id), [org, id]);
  const { state, reload } = useApi(load);
  const tenancy = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const writer = canWriteTenancies(organisation.role);

  if (state.status === "error" && state.failure.status === 404) {
    return (
      <EmptyState
        title="We could not find that tenancy"
        action={
          <ButtonLink href={tenanciesPath("", org)} variant="secondary">
            See all tenancies
          </ButtonLink>
        }
      >
        It may belong to another organisation.
      </EmptyState>
    );
  }
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (!tenancy) return <LoadingBlock label="Loading the tenancy" rows={3} />;

  const actions = tenancyActions(tenancy, organisation.role);
  const lease = tenancy.lease ? (
    <Linked href={`/agent/leases/${encodeURIComponent(tenancy.lease.id)}`}>{tenancy.lease.reference ?? "Open the lease"}</Linked>
  ) : (
    "No lease linked"
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TenancyStatusBadge status={tenancy.status} label={tenancy.statusLabel} />
        {tenancy.reference && <span className="text-sm text-muted">{tenancy.reference}</span>}
      </div>
      <h1 className="mt-2 text-3xl break-words md:text-4xl">{partyNames(tenancy.tenants) || "Tenancy"}</h1>
      <p className="mt-2 max-w-2xl break-words text-muted">
        {tenancy.property?.id && !tenancy.property.archived ? (
          <Linked href={propertyHref(tenancy.property.id, org)}>{tenancy.property.name}</Linked>
        ) : (
          (tenancy.property?.name ?? "No property") + (tenancy.property?.archived ? " (deleted)" : "")
        )}
        {tenancy.unit && ` · ${tenancy.unit.label}${tenancy.unit.archived ? " (removed)" : ""}`}
        {` · ${rentWords(tenancy.rent)}`}
      </p>
      {isTenancyStatus(tenancy.status) && <p className="mt-1 text-sm text-muted">{TENANCY_STATUS_EXPLAINED[tenancy.status]}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid min-w-0 content-start gap-6">
          <PartiesCard tenancy={tenancy} contactHref={(contact) => contactHref(contact, org)} />
          <TermsCard tenancy={tenancy} lease={lease} />
          {tenancy.notes && (
            <Card>
              <h2 className="font-sans text-xl font-semibold tracking-normal">Notes</h2>
              <p className="mt-2 text-sm whitespace-pre-line break-words text-ink">{tenancy.notes}</p>
            </Card>
          )}
          <RentSection org={org} role={organisation.role} tenancy={tenancy} />
          <MaintenanceSection org={org} role={organisation.role} tenancy={tenancy} />
          <InspectionsSection org={org} role={organisation.role} tenancy={tenancy} />
          <TimelineCard tenancy={tenancy} />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          {actions.activate && <ActivateCard org={org} tenancy={tenancy} onChanged={reload} />}
          {actions.end && <EndCard org={org} tenancy={tenancy} onChanged={reload} />}
          {actions.delete && <DeleteCard org={org} tenancy={tenancy} />}
          {!writer && <p className="text-sm text-muted">You can read this tenancy but not change it.</p>}
        </div>
      </div>
    </>
  );
}

function ActivateCard({ org, tenancy, onChanged }: { org: string; tenancy: Tenancy; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [occupiedBy, setOccupiedBy] = useState<{ message: string; tenancyId: string | null } | null>(null);

  async function activate() {
    setBusy(true);
    setError(undefined);
    setOccupiedBy(null);
    const answer = await activateTenancy(org, tenancy.id);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.code === "UNIT_OCCUPIED") {
        // Close the dialog so the link to the other tenancy can be followed.
        setOpen(false);
        setOccupiedBy({ message: answer.failure.message, tenancyId: occupyingTenancyId(answer.failure.body) });
        return;
      }
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    onChanged();
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Activate</h2>
      <p className="mt-2 text-sm text-muted">
        When the parties and terms are right, activate the tenancy. It then runs from {tenancy.startDate ? formatDay(tenancy.startDate) : "its start date"}.
      </p>
      <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
        Activate the tenancy
      </Button>
      <div aria-live="polite" className="mt-3">
        {occupiedBy && (
          <Alert title={occupiedBy.message}>
            {occupiedBy.tenancyId ? (
              <>
                End <Linked href={tenancyHref(occupiedBy.tenancyId, org)}>the tenancy that is active there</Linked> first.
              </>
            ) : (
              "End the tenancy that is active there first."
            )}
          </Alert>
        )}
      </div>
      <ConfirmDialog
        open={open}
        tone="primary"
        title="Activate this tenancy?"
        confirmLabel="Yes, activate it"
        busyLabel="Activating…"
        cancelLabel="Not yet"
        busy={busy}
        error={error}
        onConfirm={activate}
        onCancel={() => setOpen(false)}
      >
        {partyNames(tenancy.tenants) || "The tenants"} at {tenancy.property?.name ?? "the property"}
        {tenancy.unit ? `, ${tenancy.unit.label}` : ""}, {rentWords(tenancy.rent)}. A tenancy that is active cannot go back to a draft.
      </ConfirmDialog>
    </Card>
  );
}

/** "Delete the draft": a DRAFT only; the API refuses anything else. */
function DeleteCard({ org, tenancy }: { org: string; tenancy: Tenancy }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function remove() {
    setBusy(true);
    setError(undefined);
    const answer = await deleteTenancy(org, tenancy.id);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.message);
      return;
    }
    router.push(tenanciesPath("", org));
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Delete the draft</h2>
      <p className="mt-2 text-sm text-muted">A draft that will not go ahead can be deleted. An active tenancy is ended instead.</p>
      <Button
        variant="danger"
        className="mt-4 w-full"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        Delete the draft
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this draft tenancy?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      >
        The draft and its terms are deleted. The contacts, the property and any lease stay as they are.
      </ConfirmDialog>
    </Card>
  );
}

function EndCard({ org, tenancy, onChanged }: { org: string; tenancy: Tenancy; onChanged: () => void }) {
  const [endDate, setEndDate] = useState(() => tenancy.endDate ?? todayLocal());
  const [reason, setReason] = useState("");
  const [problems, setProblems] = useState<{ endDate?: string; reason?: string }>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function ask(event: FormEvent) {
    event.preventDefault();
    const found = endProblems(endDate, reason, tenancy.startDate);
    setProblems(found);
    if (found.endDate || found.reason) return;
    setError(undefined);
    setOpen(true);
  }

  async function end() {
    setBusy(true);
    setError(undefined);
    const answer = await endTenancy(org, tenancy.id, { end_date: endDate.trim(), reason: reason.trim() });
    setBusy(false);
    if (!answer.ok) {
      const fields = answer.failure.fields ?? {};
      if (fields.end_date || fields.reason) {
        setProblems({ endDate: fields.end_date, reason: fields.reason });
        setOpen(false);
      }
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    setReason("");
    onChanged();
  }

  const dateHint = "The last day of the tenancy.";
  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">End the tenancy</h2>
      <form onSubmit={ask} noValidate className="mt-4 grid gap-4">
        <Field id="end-date" label="End date" hint={dateHint} error={problems.endDate}>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            min={tenancy.startDate ?? undefined}
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={Boolean(problems.endDate)}
            aria-describedby={fieldDescribedBy("end-date", { hint: dateHint, error: problems.endDate })}
          />
        </Field>
        <Field id="end-reason" label="Why is it ending?" error={problems.reason}>
          <Textarea
            id="end-reason"
            rows={3}
            value={reason}
            maxLength={END_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(problems.reason)}
            aria-describedby={fieldDescribedBy("end-reason", { error: problems.reason })}
          />
        </Field>
        <Button type="submit" variant="danger">
          End the tenancy
        </Button>
        {error && !open && <Alert title={error} />}
      </form>
      <ConfirmDialog
        open={open}
        title="End this tenancy?"
        confirmLabel="Yes, end it"
        busyLabel="Ending…"
        cancelLabel="Keep it running"
        busy={busy}
        error={error}
        onConfirm={end}
        onCancel={() => setOpen(false)}
      >
        It ends on {formatDay(endDate)}
        {tenancy.endDate && endDate < tenancy.endDate ? `, before the agreed end on ${formatDay(tenancy.endDate)}, so it is recorded as terminated early` : ""}. This
        cannot be undone: to let the property again, start a new tenancy.
      </ConfirmDialog>
    </Card>
  );
}
