"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useListingOptions } from "@/components/agent/books/shared";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { createProperty } from "@/lib/api/properties";
import {
  ADDRESS_MAX,
  canWriteTenancies,
  createdId,
  emptyPropertyForm,
  hasProblems,
  NOTES_MAX,
  PROPERTY_NAME_MAX,
  propertiesPath,
  propertyBody,
  propertyFormProblems,
  propertyHref,
  UNIT_LABEL_MAX,
  type PropertyForm,
  type PropertyProblems,
} from "@/lib/tenancies";
import { ErrorSummary } from "./form-bits";
import { ManagementShell } from "./shared";

/** `/agent/properties/new`. */
export function PropertyNew({ markets }: { markets: SelectOption[] }) {
  return (
    <ManagementShell
      area="properties"
      path="/new"
      title="Add a property"
      intro="A building or home you manage. Add its units (flats, rooms, shops) now or later; with none, it is let as a whole."
      back={{ href: (org) => propertiesPath("", org), label: "Properties" }}
    >
      {(organisation) => <NewForm organisation={organisation} markets={markets} />}
    </ManagementShell>
  );
}

const NOTES_HINT = "For your team, for example where the keys are kept.";

/** The name, address, country, notes and listing: on the new-property page and in a property's "Details". */
export function PropertyDetailsFields({
  form,
  set,
  problems,
  fields,
  markets,
  disabled,
}: {
  form: Omit<PropertyForm, "units">;
  set: (patch: Partial<PropertyForm>) => void;
  problems: PropertyProblems;
  fields: Record<string, string>;
  markets: SelectOption[];
  disabled?: boolean;
}) {
  const listings = useListingOptions();
  const nameError = problems.name ?? fields.name;
  const nameHint = "What your team calls it, for example 12 Fife Avenue or Sunset Court.";
  const addressError = problems.address ?? fields.address;
  const marketError = problems.marketCode ?? fields.market_code;
  const listingError = fields.listing_id;
  const notesError = problems.notes ?? fields.notes;
  const listingHint =
    listings.status === "failed" ? "Your listings could not be loaded. You can link one later." : "Link the property to one of your listings, if it has one.";
  const listingOptions: SelectOption[] = [{ value: "", label: "No listing" }, ...(listings.status === "ready" ? listings.options : [])];
  if (form.listingId && !listingOptions.some((option) => option.value === form.listingId)) {
    listingOptions.push({ value: form.listingId, label: "The listing linked now" });
  }

  return (
    <div className="grid gap-5">
      <Field id="property-name" label="Name" hint={nameHint} error={nameError}>
        <Input
          id="property-name"
          value={form.name}
          maxLength={PROPERTY_NAME_MAX}
          disabled={disabled}
          onChange={(event) => set({ name: event.target.value })}
          aria-invalid={Boolean(nameError)}
          aria-describedby={fieldDescribedBy("property-name", { hint: nameHint, error: nameError })}
        />
      </Field>
      <Field id="property-address" label="Address" error={addressError}>
        <Textarea
          id="property-address"
          rows={3}
          value={form.address}
          maxLength={ADDRESS_MAX}
          disabled={disabled}
          onChange={(event) => set({ address: event.target.value })}
          aria-invalid={Boolean(addressError)}
          aria-describedby={fieldDescribedBy("property-address", { error: addressError })}
        />
      </Field>
      <Field id="property-market" label="Country" error={marketError}>
        <SearchableSelect
          id="property-market"
          options={markets}
          value={form.marketCode}
          disabled={disabled}
          onValueChange={(value) => set({ marketCode: value })}
          aria-invalid={Boolean(marketError)}
          aria-describedby={fieldDescribedBy("property-market", { error: marketError })}
        />
      </Field>
      <Field id="property-notes" label="Notes" optional hint={NOTES_HINT} error={notesError}>
        <Textarea
          id="property-notes"
          rows={3}
          value={form.notes}
          maxLength={NOTES_MAX}
          disabled={disabled}
          onChange={(event) => set({ notes: event.target.value })}
          aria-invalid={Boolean(notesError)}
          aria-describedby={fieldDescribedBy("property-notes", { hint: NOTES_HINT, error: notesError })}
        />
      </Field>
      <Field id="property-listing" label="Listing" optional hint={listingHint} error={listingError}>
        <SearchableSelect
          id="property-listing"
          options={listingOptions}
          value={form.listingId}
          disabled={disabled || listings.status === "loading"}
          onValueChange={(value) => set({ listingId: value })}
          aria-invalid={Boolean(listingError)}
          aria-describedby={fieldDescribedBy("property-listing", { hint: listingHint, error: listingError })}
        />
      </Field>
    </div>
  );
}

function NewForm({ organisation, markets }: { organisation: DashboardOrganisation; markets: SelectOption[] }) {
  const org = organisation.id;
  const router = useRouter();
  const defaultMarket = markets.some((item) => item.value === organisation.market_code) ? organisation.market_code : "";
  const [form, setForm] = useState<PropertyForm>(() => emptyPropertyForm(defaultMarket));
  const [problems, setProblems] = useState<PropertyProblems>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canWriteTenancies(organisation.role)) {
    return (
      <Alert tone="info" title="You can read this organisation's properties but not add them.">
        The Agency Principal, a branch manager or an agent can add properties.
      </Alert>
    );
  }

  const set = (patch: Partial<PropertyForm>) => setForm((current) => ({ ...current, ...patch }));
  const setUnit = (index: number, label: string) => set({ units: form.units.map((unit, other) => (other === index ? label : unit)) });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = propertyFormProblems(form);
    setProblems(found);
    setFields({});
    setFailure(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await createProperty(org, propertyBody(form));
    if (!answer.ok) {
      setBusy(false);
      setFailure(answer.failure);
      setFields(answer.failure.fields ?? {});
      // `units[1].label` and the like go under that unit.
      const units: Record<number, string> = {};
      for (const [key, text] of Object.entries(answer.failure.fields ?? {})) {
        const match = /^units\[(\d+)\]/.exec(key);
        if (match) units[Number(match[1])] = text;
      }
      if (Object.keys(units).length) setProblems({ units });
      return;
    }
    const id = createdId(answer.data);
    router.push(id ? propertyHref(id, org) : propertiesPath("", org));
  }

  const summary = [
    problems.name && { id: "property-name", text: problems.name },
    problems.address && { id: "property-address", text: problems.address },
    problems.marketCode && { id: "property-market", text: problems.marketCode },
    problems.notes && { id: "property-notes", text: problems.notes },
    ...Object.entries(problems.units ?? {}).map(([index, text]) => ({ id: `unit-${index}`, text: `Unit ${Number(index) + 1}: ${text}` })),
  ].filter((item): item is { id: string; text: string } => Boolean(item));

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-6">
      <ErrorSummary items={summary} />
      {failure && <Alert title={failure.message} traceId={failure.traceId} />}
      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Details</h2>
        <div className="mt-4">
          <PropertyDetailsFields form={form} set={set} problems={problems} fields={fields} markets={markets} />
        </div>
      </Card>
      <Card>
        <h2 className="font-sans text-xl font-semibold tracking-normal">Units</h2>
        <p className="mt-1 text-sm text-muted">Flats, rooms or shops let separately. Leave this empty for a property let as a whole.</p>
        {form.units.length > 0 && (
          <ol className="mt-4 space-y-3">
            {form.units.map((unit, index) => {
              const id = `unit-${index}`;
              const error = problems.units?.[index];
              return (
                <li key={index} className="flex items-end gap-2">
                  <Field id={id} label={`Unit ${index + 1}`} error={error} className="flex-1">
                    <Input
                      id={id}
                      value={unit}
                      maxLength={UNIT_LABEL_MAX}
                      placeholder="Flat 2"
                      onChange={(event) => setUnit(index, event.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={fieldDescribedBy(id, { error })}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    className="w-11 shrink-0 px-0"
                    aria-label={`Remove unit ${index + 1}${unit ? `, ${unit}` : ""}`}
                    onClick={() => set({ units: form.units.filter((_, other) => other !== index) })}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        <Button variant="secondary" className="mt-4" onClick={() => set({ units: [...form.units, ""] })}>
          <Plus className="size-4" aria-hidden="true" />
          Add a unit
        </Button>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save the property"}
        </Button>
        <ButtonLink href={propertiesPath("", org)} variant="ghost" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
