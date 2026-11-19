"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import type { SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { useRouter } from "next/navigation";
import { addUnit, deleteProperty, getProperty, listTenancies, removeUnit, renameUnit, updateProperty } from "@/lib/api/properties";
import type { ApiResult } from "@/lib/api/http";
import {
  canWriteTenancies,
  occupancyWords,
  hasProblems,
  partyNames,
  propertiesPath,
  propertyFormProblems,
  propertyPatch,
  tenanciesPath,
  tenancyApiQuery,
  tenancyHref,
  UNIT_LABEL_MAX,
  unitLabelProblem,
  type Property,
  type PropertyForm,
  type PropertyProblems,
  type Unit,
} from "@/lib/tenancies";
import { PropertyDetailsFields } from "./property-new";
import { formatDay, Linked, ManagementShell, rentWords, TenancyStatusBadge } from "./shared";

/** `/agent/properties/<id>`: the details, the units (add, rename, remove) and the property's tenancies. */
export function PropertyDetail({ id, markets }: { id: string; markets: SelectOption[] }) {
  return (
    <ManagementShell area="properties" path={`/${encodeURIComponent(id)}`} back={{ href: (org) => propertiesPath("", org), label: "Properties" }}>
      {(organisation) => <Detail id={id} organisation={organisation} markets={markets} />}
    </ManagementShell>
  );
}

const UNIT_HINT = "For example Flat 2, Room 4 or Shop 1.";

type Notice = { tone: "success" | "danger"; text: string; traceId?: string } | null;

function Detail({ id, organisation, markets }: { id: string; organisation: DashboardOrganisation; markets: SelectOption[] }) {
  const org = organisation.id;
  const load = useCallback(() => getProperty(org, id), [org, id]);
  const { state, reload } = useApi(load);
  const property = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const roleWriter = canWriteTenancies(organisation.role);
  const writer = roleWriter && (property?.can ? property.can.edit : true);

  if (state.status === "error" && state.failure.status === 404) {
    return (
      <EmptyState
        title="We could not find that property"
        action={
          <ButtonLink href={propertiesPath("", org)} variant="secondary">
            See all properties
          </ButtonLink>
        }
      >
        It may have been removed, or it belongs to another organisation.
      </EmptyState>
    );
  }
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (!property) return <LoadingBlock label="Loading the property" rows={3} />;

  const marketName = markets.find((item) => item.value === property.marketCode)?.label ?? property.marketCode;

  return (
    <>
      <h1 className="text-3xl break-words md:text-4xl">{property.name}</h1>
      <p className="mt-2 max-w-2xl break-words text-muted">
        {property.address}
        {marketName && ` · ${marketName}`}
      </p>
      {property.listing && (
        <p className="mt-2 text-sm">
          Listing: <Linked href={`/agent/listings/${encodeURIComponent(property.listing.id)}`}>{property.listing.title ?? property.listing.reference ?? "Open the listing"}</Linked>
        </p>
      )}
      {property.occupiedUnits !== null && (
        <div className="mt-3">
          <Badge tone={property.occupiedUnits > 0 ? "success" : "neutral"}>{occupancyWords(property.occupiedUnits, property.lettableUnits)}</Badge>
        </div>
      )}
      {!writer && <p className="mt-2 text-sm text-muted">You can read this property but not change it.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid min-w-0 content-start gap-6">
          <Units org={org} property={property} writer={writer} onChanged={reload} />
          <PropertyTenancies org={org} property={property} writer={writer} />
          {!writer && property.notes && (
            <Card>
              <h2 className="font-sans text-xl font-semibold tracking-normal">Notes</h2>
              <p className="mt-2 text-sm whitespace-pre-line break-words">{property.notes}</p>
            </Card>
          )}
        </div>
        <div className="grid min-w-0 content-start gap-6">
          {writer && <DetailsCard org={org} property={property} markets={markets} onChanged={reload} />}
          {roleWriter && <DeleteCard org={org} property={property} />}
        </div>
      </div>
    </>
  );
}

function DetailsCard({ org, property, markets, onChanged }: { org: string; property: Property; markets: SelectOption[]; onChanged: () => void }) {
  const [form, setForm] = useState<Omit<PropertyForm, "units">>({
    name: property.name,
    address: property.address,
    marketCode: property.marketCode,
    listingId: property.listing?.id ?? "",
    notes: property.notes,
  });
  const [problems, setProblems] = useState<PropertyProblems>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const found = propertyFormProblems({ ...form, units: [] });
    setProblems(found);
    setFields({});
    setNotice(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await updateProperty(org, property.id, propertyPatch(form));
    setBusy(false);
    if (!answer.ok) {
      setFields(answer.failure.fields ?? {});
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setNotice({ tone: "success", text: "The details are saved." });
    onChanged();
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Details</h2>
      <form onSubmit={save} noValidate className="mt-4 grid gap-5">
        <PropertyDetailsFields form={form} set={(patch) => setForm((current) => ({ ...current, ...patch }))} problems={problems} fields={fields} markets={markets} />
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save the details"}
        </Button>
        <div aria-live="polite">{notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}</div>
      </form>
    </Card>
  );
}

function Units({ org, property, writer, onChanged }: { org: string; property: Property; writer: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState("");
  const [addError, setAddError] = useState<string | undefined>();
  const [renaming, setRenaming] = useState<{ id: string; label: string; error?: string } | null>(null);
  const [removing, setRemoving] = useState<Unit | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice>(null);

  async function send(request: Promise<ApiResult<unknown>>, done: string, field: (text: string) => void): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    const answer = await request;
    setBusy(false);
    if (!answer.ok) {
      const label = answer.failure.fields?.label;
      if (label) field(label);
      else setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return false;
    }
    setNotice({ tone: "success", text: done });
    onChanged();
    return true;
  }

  const labels = property.units.map((unit) => unit.label);

  async function add(event: FormEvent) {
    event.preventDefault();
    const problem = unitLabelProblem(adding, labels);
    setAddError(problem ?? undefined);
    if (problem) return;
    if (await send(addUnit(org, property.id, adding.trim()), `${adding.trim()} added.`, setAddError)) setAdding("");
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    const problem = unitLabelProblem(renaming.label, property.units.filter((unit) => unit.id !== renaming.id).map((unit) => unit.label));
    if (problem) {
      setRenaming({ ...renaming, error: problem });
      return;
    }
    const current = renaming;
    const label = current.label.trim();
    if (await send(renameUnit(org, property.id, current.id, label), `Renamed to ${label}.`, (error) => setRenaming({ ...current, error }))) setRenaming(null);
  }

  async function remove() {
    if (!removing) return;
    setRemoveError(undefined);
    setBusy(true);
    const answer = await removeUnit(org, property.id, removing.id);
    setBusy(false);
    if (!answer.ok) {
      setRemoveError(answer.failure.message);
      return;
    }
    setNotice({ tone: "success", text: `${removing.label} removed.` });
    setRemoving(null);
    onChanged();
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Units</h2>
      {property.units.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No units. The property is let as a whole and counts as a single unit.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {property.units.map((unit) => (
            <li key={unit.id} className="py-3">
              {renaming?.id === unit.id ? (
                <form onSubmit={rename} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field id={`rename-${unit.id}`} label={`New name for ${unit.label}`} error={renaming.error} className="flex-1">
                    <Input
                      id={`rename-${unit.id}`}
                      value={renaming.label}
                      maxLength={UNIT_LABEL_MAX}
                      autoFocus
                      onChange={(event) => setRenaming({ id: unit.id, label: event.target.value })}
                      aria-invalid={Boolean(renaming.error)}
                      aria-describedby={fieldDescribedBy(`rename-${unit.id}`, { error: renaming.error })}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy} aria-busy={busy}>
                      {busy ? "Saving…" : "Save the name"}
                    </Button>
                    <Button variant="ghost" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words text-ink">{unit.label}</span>
                  {unit.occupied !== null && <Badge tone={unit.occupied ? "success" : "neutral"}>{unit.occupied ? "Let" : "Not let"}</Badge>}
                  {writer && (
                    <span className="ml-auto flex gap-1">
                      <Button variant="ghost" onClick={() => setRenaming({ id: unit.id, label: unit.label })}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Rename<span className="sr-only"> {unit.label}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRemoveError(undefined);
                          setRemoving(unit);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Remove<span className="sr-only"> {unit.label}</span>
                      </Button>
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {writer && (
        <form onSubmit={add} noValidate className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
          <Field id="unit-new" label="Add a unit" hint={UNIT_HINT} error={addError} className="flex-1">
            <Input
              id="unit-new"
              value={adding}
              maxLength={UNIT_LABEL_MAX}
              onChange={(event) => setAdding(event.target.value)}
              aria-invalid={Boolean(addError)}
              aria-describedby={fieldDescribedBy("unit-new", { hint: UNIT_HINT, error: addError })}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {busy ? "Saving…" : "Add the unit"}
          </Button>
        </form>
      )}
      <div aria-live="polite" className="mt-3">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.label ?? "the unit"}?`}
        confirmLabel="Yes, remove it"
        busyLabel="Removing…"
        cancelLabel="Keep it"
        busy={busy}
        error={removeError}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      >
        The unit leaves this property. It cannot be removed while a draft or active tenancy uses it; tenancies that ended keep
        showing it.
      </ConfirmDialog>
    </Card>
  );
}

/** "Delete the property": the API archives it; refused (409 `PROPERTY_IN_USE`) while a draft or active tenancy uses it. */
function DeleteCard({ org, property }: { org: string; property: Property }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const blocked = property.can ? !property.can.delete : (property.openTenancies ?? 0) > 0;

  async function remove() {
    setBusy(true);
    setError(undefined);
    const answer = await deleteProperty(org, property.id);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.message);
      return;
    }
    router.push(propertiesPath("", org));
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Delete the property</h2>
      {blocked ? (
        <p className="mt-2 text-sm text-muted">
          It cannot be deleted while a draft or active tenancy uses it. End or delete those tenancies first.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">It leaves your list of properties. Tenancies that ended keep showing it.</p>
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => {
              setError(undefined);
              setOpen(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete the property
          </Button>
        </>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete ${property.name}?`}
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      >
        It leaves your list of properties and cannot be used for new tenancies. Tenancies that ended keep showing it.
      </ConfirmDialog>
    </Card>
  );
}

function PropertyTenancies({ org, property, writer }: { org: string; property: Property; writer: boolean }) {
  const load = useCallback(() => listTenancies(org, tenancyApiQuery({ property: property.id, page: 1 }, 50)), [org, property.id]);
  const { state, reload } = useApi(load);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-xl font-semibold tracking-normal">Tenancies</h2>
        {writer && (
          <ButtonLink href={tenanciesPath("/new", org, { property: property.id })} variant="secondary">
            Start a tenancy
          </ButtonLink>
        )}
      </div>
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the tenancies" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && <p className="text-sm text-muted">No tenancies for this property yet.</p>}
        {state.status === "ready" && state.data.items.length > 0 && (
          <ul className="divide-y divide-line">
            {state.data.items.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TenancyStatusBadge status={item.status} label={item.statusLabel} />
                  {item.unit && <span className="text-sm text-muted">{item.unit.label}</span>}
                </div>
                <p className="mt-1 font-medium break-words">
                  <Linked href={tenancyHref(item.id, org)}>{partyNames(item.tenants) || item.reference || "Tenancy"}</Linked>
                </p>
                <p className="text-sm text-muted">
                  {rentWords(item.rent)}
                  {item.startDate && ` · from ${formatDay(item.startDate)}`}
                  {item.endDate && ` to ${formatDay(item.endDate)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
