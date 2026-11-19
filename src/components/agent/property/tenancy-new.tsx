"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { createTenancy } from "@/lib/api/properties";
import { amountProblem, currencyMinorUnits } from "@/lib/ledger";
import {
  canWriteTenancies,
  createdId,
  dueDayOptions,
  emptyTenancyForm,
  frequencyLabel,
  hasProblems,
  NOTES_MAX,
  propertiesPath,
  RENT_FREQUENCIES,
  tenanciesPath,
  tenancyApiProblems,
  tenancyBody,
  tenancyFormProblems,
  tenancyHref,
  type TenancyForm,
  type TenancyProblems,
} from "@/lib/tenancies";
import { ErrorSummary } from "./form-bits";
import { ContactsPicker, Linked, ManagementShell, useLeaseOptions, useProperties } from "./shared";

/** `/agent/tenancies/new` (`?property=` chooses the property). */
export function TenancyNew({ currencies }: { currencies: SelectOption[] }) {
  return (
    <ManagementShell
      area="tenancies"
      path="/new"
      title="Start a tenancy"
      intro="Who rents the property, from when and for how much. It is saved as a draft; you activate it from its page."
      back={{ href: (org) => tenanciesPath("", org), label: "Tenancies" }}
    >
      {(organisation) => <NewForm organisation={organisation} currencies={currencies} />}
    </ManagementShell>
  );
}

const decimalsHint = (currency: string) => {
  const units = currencyMinorUnits(currency || "USD");
  return units === 0 ? `In ${currency}: a whole number, no decimal places.` : `In ${currency}: up to ${units} decimal place${units === 1 ? "" : "s"}, for example 450.${"0".repeat(units)}.`;
};

const LABELS: Record<string, string> = {
  propertyId: "Property",
  unitId: "Unit",
  tenants: "Tenants",
  landlords: "Landlords",
  leaseId: "Lease",
  rentAmount: "Rent",
  rentCurrency: "Rent currency",
  frequency: "How often",
  dueDay: "Due on",
  depositAmount: "Deposit",
  startDate: "Start date",
  endDate: "End date",
  notes: "Notes",
};

const IDS: Record<string, string> = {
  propertyId: "tenancy-property",
  unitId: "tenancy-unit",
  tenants: "tenancy-tenants-search",
  landlords: "tenancy-landlords-search",
  leaseId: "tenancy-lease",
  rentAmount: "tenancy-rent",
  rentCurrency: "tenancy-currency",
  frequency: "tenancy-frequency",
  dueDay: "tenancy-due-day",
  depositAmount: "tenancy-deposit",
  startDate: "tenancy-start",
  endDate: "tenancy-end",
  notes: "tenancy-notes",
};

function NewForm({ organisation, currencies }: { organisation: DashboardOrganisation; currencies: SelectOption[] }) {
  const org = organisation.id;
  const router = useRouter();
  const params = useSearchParams();
  const properties = useProperties(org);
  const leases = useLeaseOptions(org, organisation.kind === "DIRECT_OWNER");
  const [form, setForm] = useState<TenancyForm>(() => ({ ...emptyTenancyForm(currencies[0]?.value ?? "USD"), propertyId: params.get("property") ?? "" }));
  const [problems, setProblems] = useState<TenancyProblems & { leaseId?: string; other?: string[] }>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canWriteTenancies(organisation.role)) {
    return (
      <Alert tone="info" title="You can read this organisation's tenancies but not start them.">
        The Agency Principal, a branch manager or an agent can start a tenancy.
      </Alert>
    );
  }

  const set = (patch: Partial<TenancyForm>) => setForm((current) => ({ ...current, ...patch }));
  const property = properties.status === "ready" ? properties.items.find((item) => item.id === form.propertyId) : undefined;
  const units = property?.units ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = tenancyFormProblems(form, (value, currency) => amountProblem(value, currency), { unitRequired: units.length > 0 });
    setProblems(found);
    setFailure(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await createTenancy(org, tenancyBody(form));
    if (!answer.ok) {
      setBusy(false);
      setFailure(answer.failure);
      setProblems(tenancyApiProblems(answer.failure.fields));
      return;
    }
    const id = createdId(answer.data);
    router.push(id ? tenancyHref(id, org) : tenanciesPath("", org));
  }

  const summary = Object.entries(problems)
    .filter(([key, text]) => key !== "other" && typeof text === "string")
    .map(([key, text]) => ({ id: IDS[key] ?? "tenancy-property", text: `${LABELS[key] ?? key}: ${text as string}` }));
  for (const text of problems.other ?? []) summary.push({ id: "tenancy-property", text });

  const propertyOptions: SelectOption[] = [{ value: "", label: "Choose a property" }];
  if (properties.status === "ready") propertyOptions.push(...properties.items.map((item) => ({ value: item.id, label: item.name, secondary: item.address })));
  if (form.propertyId && !propertyOptions.some((option) => option.value === form.propertyId)) propertyOptions.push({ value: form.propertyId, label: "The property chosen" });
  const unitOptions: SelectOption[] = [{ value: "", label: "Choose a unit" }, ...units.map((unit) => ({ value: unit.id, label: unit.label, secondary: unit.occupied ? "Let now" : undefined }))];
  const leaseOptions: SelectOption[] = [{ value: "", label: "No lease" }, ...(leases.status === "ready" ? leases.options : [])];
  const frequencyOptions: SelectOption[] = RENT_FREQUENCIES.map((value) => ({ value, label: frequencyLabel(value) }));
  const leaseHint =
    leases.status === "failed"
      ? "Your leases could not be loaded. You can start the tenancy without one."
      : leases.status === "ready" && leases.options.length === 0
        ? "This organisation has no leases yet."
        : "A lease drafted in RightProperty365 for this tenancy, if there is one.";
  const rentHint = decimalsHint(form.rentCurrency);
  const depositHint = `In the rent's currency. ${decimalsHint(form.rentCurrency)} Leave empty if no deposit was taken.`;
  const dueHint = form.frequency === "WEEKLY" ? "The day of the week the rent is due." : "The day of the month the rent is due.";
  const notesHint = "For your team, for example how the rent is paid.";
  const endHint = "Leave empty for a tenancy that runs until notice is given.";

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-6">
      <ErrorSummary items={summary} />
      {failure && <Alert title={failure.message} traceId={failure.traceId} />}

      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Property</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            id="tenancy-property"
            label="Property"
            error={problems.propertyId}
            hint={properties.status === "failed" ? properties.message : undefined}
          >
            <SearchableSelect
              id="tenancy-property"
              options={propertyOptions}
              value={form.propertyId}
              disabled={properties.status === "loading"}
              onValueChange={(value) => set({ propertyId: value, unitId: "" })}
              aria-invalid={Boolean(problems.propertyId)}
              aria-describedby={fieldDescribedBy("tenancy-property", { error: problems.propertyId, hint: properties.status === "failed" ? properties.message : undefined })}
            />
          </Field>
          {units.length > 0 ? (
            <Field id="tenancy-unit" label="Unit" error={problems.unitId}>
              <SearchableSelect
                id="tenancy-unit"
                options={unitOptions}
                value={form.unitId}
                onValueChange={(value) => set({ unitId: value })}
                aria-invalid={Boolean(problems.unitId)}
                aria-describedby={fieldDescribedBy("tenancy-unit", { error: problems.unitId })}
              />
            </Field>
          ) : (
            property && <p className="self-end text-sm text-muted">This property has no units: the tenancy is for the whole property.</p>
          )}
        </div>
        {properties.status === "ready" && properties.items.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            There are no properties yet. <Linked href={propertiesPath("/new", org)}>Add a property</Linked> first.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Parties</h2>
        <p className="mt-1 text-sm text-muted">Tenants and landlords are people or businesses from your contact book.</p>
        <div className="mt-4 grid gap-5">
          <ContactsPicker
            id="tenancy-tenants"
            org={org}
            legend="Tenants"
            noun="tenant"
            value={form.tenants}
            onChange={(tenants) => set({ tenants })}
            error={problems.tenants}
            hint="At least one. A tenant whose email matches their RightProperty365 account can read the tenancy."
          />
          <ContactsPicker
            id="tenancy-landlords"
            org={org}
            legend="Landlords"
            noun="landlord"
            optional
            value={form.landlords}
            onChange={(landlords) => set({ landlords })}
            error={problems.landlords}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Terms</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field id="tenancy-rent" label="Rent" hint={rentHint} error={problems.rentAmount}>
            <Input
              id="tenancy-rent"
              inputMode="decimal"
              autoComplete="off"
              value={form.rentAmount}
              onChange={(event) => set({ rentAmount: event.target.value })}
              aria-invalid={Boolean(problems.rentAmount)}
              aria-describedby={fieldDescribedBy("tenancy-rent", { hint: rentHint, error: problems.rentAmount })}
            />
          </Field>
          <Field id="tenancy-currency" label="Currency" error={problems.rentCurrency}>
            <SearchableSelect
              id="tenancy-currency"
              options={currencies}
              value={form.rentCurrency}
              onValueChange={(value) => set({ rentCurrency: value })}
              aria-invalid={Boolean(problems.rentCurrency)}
              aria-describedby={fieldDescribedBy("tenancy-currency", { error: problems.rentCurrency })}
            />
          </Field>
          <Field id="tenancy-frequency" label="How often" error={problems.frequency}>
            <SearchableSelect
              id="tenancy-frequency"
              options={frequencyOptions}
              value={form.frequency}
              onValueChange={(value) => set({ frequency: value, dueDay: "1" })}
              aria-invalid={Boolean(problems.frequency)}
              aria-describedby={fieldDescribedBy("tenancy-frequency", { error: problems.frequency })}
            />
          </Field>
          <Field id="tenancy-due-day" label="Due on" hint={dueHint} error={problems.dueDay}>
            <SearchableSelect
              id="tenancy-due-day"
              options={dueDayOptions(form.frequency)}
              value={form.dueDay}
              onValueChange={(value) => set({ dueDay: value })}
              aria-invalid={Boolean(problems.dueDay)}
              aria-describedby={fieldDescribedBy("tenancy-due-day", { hint: dueHint, error: problems.dueDay })}
            />
          </Field>
          <Field id="tenancy-deposit" label="Deposit" optional hint={depositHint} error={problems.depositAmount}>
            <Input
              id="tenancy-deposit"
              inputMode="decimal"
              autoComplete="off"
              value={form.depositAmount}
              onChange={(event) => set({ depositAmount: event.target.value })}
              aria-invalid={Boolean(problems.depositAmount)}
              aria-describedby={fieldDescribedBy("tenancy-deposit", { hint: depositHint, error: problems.depositAmount })}
            />
          </Field>
          <Field id="tenancy-start" label="Start date" error={problems.startDate}>
            <Input
              id="tenancy-start"
              type="date"
              value={form.startDate}
              onChange={(event) => set({ startDate: event.target.value })}
              aria-invalid={Boolean(problems.startDate)}
              aria-describedby={fieldDescribedBy("tenancy-start", { error: problems.startDate })}
            />
          </Field>
          <Field id="tenancy-end" label="End date" optional hint={endHint} error={problems.endDate}>
            <Input
              id="tenancy-end"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(event) => set({ endDate: event.target.value })}
              aria-invalid={Boolean(problems.endDate)}
              aria-describedby={fieldDescribedBy("tenancy-end", { hint: endHint, error: problems.endDate })}
            />
          </Field>
        </div>
        <p className="mt-4 text-sm text-muted">The deposit is in the same currency as the rent.</p>
      </Card>

      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Lease and notes</h2>
        <div className="mt-4 grid gap-5">
          <Field id="tenancy-lease" label="Lease" optional hint={leaseHint} error={problems.leaseId}>
            <SearchableSelect
              id="tenancy-lease"
              options={leaseOptions}
              value={form.leaseId}
              disabled={leases.status === "loading"}
              onValueChange={(value) => set({ leaseId: value })}
              aria-invalid={Boolean(problems.leaseId)}
              aria-describedby={fieldDescribedBy("tenancy-lease", { hint: leaseHint, error: problems.leaseId })}
            />
          </Field>
          <Field id="tenancy-notes" label="Notes" optional hint={notesHint} error={problems.notes}>
            <Textarea
              id="tenancy-notes"
              value={form.notes}
              maxLength={NOTES_MAX}
              onChange={(event) => set({ notes: event.target.value })}
              aria-invalid={Boolean(problems.notes)}
              aria-describedby={fieldDescribedBy("tenancy-notes", { hint: notesHint, error: problems.notes })}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save as a draft"}
        </Button>
        <ButtonLink href={tenanciesPath("", org)} variant="ghost" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
