"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  createPhase,
  createUnitType,
  deletePhase,
  deleteUnitType,
  updatePhase,
  updateUnitType,
  type PhaseFields,
  type UnitTypeFields,
} from "@/lib/api/developments";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import {
  amountForInput,
  availabilityText,
  bedroomsText,
  compareAmounts,
  completionText,
  CONTACT_DETAILS_MESSAGE,
  containsContactDetails,
  DEVELOPMENT_STATUSES,
  developmentStatusLabel,
  developmentStatusLabels,
  developmentStatusTone,
  parseCompletionInput,
  parsePriceInput,
  priceRangeText,
  sizeRangeText,
  type DevelopmentStatusCode,
  type ManagedDevelopment,
  type ManagedPhase,
  type ManagedUnitType,
} from "@/lib/developments";
import { parseWholeNumber } from "@/lib/listing-manage";

type Envelope = { development: ManagedDevelopment };

type Props = {
  organisationId: string;
  development: ManagedDevelopment;
  /** OWNER, MANAGER and AGENT change phases and unit types, also while the project is locked. */
  editable: boolean;
  /** The project's market currency, the default for a new unit type. */
  defaultCurrency: string;
  currencies: string[];
  onChange: (development: ManagedDevelopment) => void;
  onConflict: (message: string) => void;
};

const MAX_PHASES = 10;
const MAX_UNIT_TYPES = 20;
const CONFLICTS = new Set(["DEVELOPMENT_STATE_CONFLICT", "DEVELOPMENT_CHANGED", "PHASE_NOT_FOUND", "UNIT_TYPE_NOT_FOUND"]);

const statusOptions = DEVELOPMENT_STATUSES.map((code) => ({ value: code, label: developmentStatusLabels[code] }));
const numberText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

type Errors = Record<string, string>;

/** What the form shows for an API refusal: its field messages, or its message. */
function answerErrors(failure: ApiFailure): { fields: Errors; message: string | null } {
  return failure.fields ? { fields: failure.fields, message: null } : { fields: {}, message: failure.message };
}

// ---- Phase form -------------------------------------------------------------------

function PhaseForm({
  idPrefix,
  phase,
  onSave,
  onCancel,
}: {
  idPrefix: string;
  phase?: ManagedPhase;
  onSave: (fields: PhaseFields) => Promise<ApiResult<Envelope>>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(phase?.name ?? "");
  const [status, setStatus] = useState<string>(phase?.status.code ?? "PLANNED");
  const [completion, setCompletion] = useState(phase?.completion?.value ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    const value = name.replace(/\s+/g, " ").trim();
    if (!value) found.name = "Enter the phase's name, such as Phase 1.";
    else if (value.length > 80) found.name = "Keep the name to 80 characters or fewer.";
    else if (containsContactDetails(value)) found.name = CONTACT_DETAILS_MESSAGE;
    const estimate = parseCompletionInput(completion);
    if (!estimate.ok) found.completion_estimate = estimate.message;
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0 || !estimate.ok) return;
    setPending(true);
    const result = await onSave({ name: value, status: status as DevelopmentStatusCode, completion_estimate: estimate.value });
    setPending(false);
    if (!result.ok) {
      const answer = answerErrors(result.failure);
      setErrors(answer.fields);
      setMessage(answer.message);
    }
  }

  const id = (field: string) => `${idPrefix}-${field}`;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-line bg-soft p-4 sm:grid-cols-3">
      <Field id={id("name")} label="Phase name" error={errors.name}>
        <Input
          id={id("name")}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={fieldDescribedBy(id("name"), { error: errors.name })}
        />
      </Field>
      <Field id={id("status")} label="Status" error={errors.status}>
        <SearchableSelect
          id={id("status")}
          value={status}
          onValueChange={setStatus}
          options={statusOptions}
          aria-invalid={Boolean(errors.status)}
          aria-describedby={fieldDescribedBy(id("status"), { error: errors.status })}
        />
      </Field>
      <Field id={id("completion")} label="Completion estimate" optional hint="A quarter (2027-Q3) or a date (2027-06-30)." error={errors.completion_estimate}>
        <Input
          id={id("completion")}
          value={completion}
          maxLength={10}
          placeholder="2027-Q3"
          autoComplete="off"
          onChange={(event) => setCompletion(event.target.value)}
          aria-invalid={Boolean(errors.completion_estimate)}
          aria-describedby={fieldDescribedBy(id("completion"), { hint: "x", error: errors.completion_estimate })}
        />
      </Field>
      {message && <Alert title={message} className="sm:col-span-3" />}
      <div className="flex flex-wrap gap-3 sm:col-span-3">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Saving…" : phase ? "Save the phase" : "Add the phase"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- Unit type form -----------------------------------------------------------------

type UnitValues = {
  name: string;
  bedrooms: string;
  bathrooms: string;
  size_min: string;
  size_max: string;
  on_request: boolean;
  price_from: string;
  price_to: string;
  currency: string;
  units_total: string;
  units_available: string;
};

function unitValues(unit: ManagedUnitType | undefined, currency: string): UnitValues {
  return {
    name: unit?.name ?? "",
    bedrooms: numberText(unit?.bedrooms),
    bathrooms: numberText(unit?.bathrooms),
    size_min: numberText(unit?.size_m2?.min),
    size_max: numberText(unit?.size_m2?.max),
    on_request: unit?.price.on_request ?? false,
    price_from: amountForInput(unit?.price.from),
    price_to: amountForInput(unit?.price.to),
    currency: unit?.price.currency ?? currency,
    units_total: numberText(unit?.units_total),
    units_available: numberText(unit?.units_available),
  };
}

/** The unit type as the API takes it, or the errors that keep it from being sent. */
export function buildUnitType(values: UnitValues): { fields: UnitTypeFields } | { errors: Errors } {
  const errors: Errors = {};
  const name = values.name.replace(/\s+/g, " ").trim();
  if (!name) errors.name = "Enter the unit type's name, such as Three-bedroom cluster home.";
  else if (name.length > 80) errors.name = "Keep the name to 80 characters or fewer.";
  else if (containsContactDetails(name)) errors.name = CONTACT_DETAILS_MESSAGE;

  const whole = (key: keyof UnitValues & string, apiKey: string, label: string, min: number, max: number) => {
    const parsed = parseWholeNumber(String(values[key]), label, min, max);
    if (!parsed.ok) errors[apiKey] = parsed.message;
    return parsed.ok ? parsed.value : null;
  };
  const bedrooms = whole("bedrooms", "bedrooms", "the bedrooms", 0, 50);
  const bathrooms = whole("bathrooms", "bathrooms", "the bathrooms", 0, 50);
  const sizeMin = whole("size_min", "size_min_m2", "the smallest size", 1, 100000);
  const sizeMax = whole("size_max", "size_max_m2", "the largest size", 1, 100000);
  if (sizeMin !== null && sizeMax !== null && sizeMin > sizeMax) errors.size_max_m2 = "The largest size must be at least the smallest.";
  const total = whole("units_total", "units_total", "the number of units", 0, 100000);
  const available = whole("units_available", "units_available", "the units available", 0, 100000);
  if (total !== null && available !== null && available > total) errors.units_available = "There cannot be more units available than units in all.";

  let price: Pick<UnitTypeFields, "price_on_request" | "price_from" | "price_to" | "currency"> = {
    price_on_request: true,
    price_from: null,
    price_to: null,
    currency: null,
  };
  if (!values.on_request) {
    const from = parsePriceInput(values.price_from);
    const to = parsePriceInput(values.price_to);
    if (!from.ok) errors.price_from = from.message;
    else if (from.value === null) errors.price_from = "Enter the lowest price, or choose Price on request.";
    if (!to.ok) errors.price_to = to.message;
    if (from.ok && to.ok && from.value && to.value && compareAmounts(from.value, to.value) > 0) {
      errors.price_to = "The highest price must be at least the lowest.";
    }
    if (!/^[A-Z]{3}$/.test(values.currency)) errors.currency = "Choose the currency of the price.";
    price = {
      price_on_request: false,
      price_from: from.ok ? from.value : null,
      price_to: to.ok ? to.value : null,
      currency: values.currency || null,
    };
  }
  if (Object.keys(errors).length > 0) return { errors };
  return {
    fields: {
      name,
      bedrooms,
      bathrooms,
      size_min_m2: sizeMin,
      size_max_m2: sizeMax,
      units_total: total,
      units_available: available,
      ...price,
    },
  };
}

function UnitTypeForm({
  idPrefix,
  unit,
  defaultCurrency,
  currencies,
  onSave,
  onCancel,
}: {
  idPrefix: string;
  unit?: ManagedUnitType;
  defaultCurrency: string;
  currencies: string[];
  onSave: (fields: UnitTypeFields) => Promise<ApiResult<Envelope>>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<UnitValues>(() => unitValues(unit, defaultCurrency));
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (change: Partial<UnitValues>) => setValues((current) => ({ ...current, ...change }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const built = buildUnitType(values);
    setMessage(null);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setPending(true);
    const result = await onSave(built.fields);
    setPending(false);
    if (!result.ok) {
      const answer = answerErrors(result.failure);
      setErrors(answer.fields);
      setMessage(answer.message);
    }
  }

  const id = (field: string) => `${idPrefix}-${field}`;
  const text = (key: keyof UnitValues, apiKey: string, label: string, options: { optional?: boolean; hint?: string; inputMode?: "numeric" | "decimal" } = {}) => (
    <Field id={id(apiKey)} label={label} optional={options.optional} hint={options.hint} error={errors[apiKey]}>
      <Input
        id={id(apiKey)}
        value={String(values[key])}
        inputMode={options.inputMode}
        autoComplete="off"
        onChange={(event) => set({ [key]: event.target.value } as Partial<UnitValues>)}
        aria-invalid={Boolean(errors[apiKey])}
        aria-describedby={fieldDescribedBy(id(apiKey), { hint: options.hint, error: errors[apiKey] })}
      />
    </Field>
  );
  const currencyOptions = [...new Set([values.currency, defaultCurrency, ...currencies].filter(Boolean))].map((code) => ({
    value: code,
    label: code,
  }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-line bg-soft p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4">{text("name", "name", "Unit type name")}</div>
      {text("bedrooms", "bedrooms", "Bedrooms", { optional: true, inputMode: "numeric", hint: "0 for a studio." })}
      {text("bathrooms", "bathrooms", "Bathrooms", { optional: true, inputMode: "numeric" })}
      {text("size_min", "size_min_m2", "Smallest size (m²)", { optional: true, inputMode: "numeric" })}
      {text("size_max", "size_max_m2", "Largest size (m²)", { optional: true, inputMode: "numeric" })}
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={values.on_request}
            onChange={(event) => set({ on_request: event.currentTarget.checked })}
          />
          Price on request
        </label>
        <p className="text-sm text-muted">Buyers then see &ldquo;Price on request&rdquo; and ask you in an enquiry.</p>
      </div>
      {!values.on_request && (
        <>
          {text("price_from", "price_from", "Price from", { inputMode: "decimal", hint: "Exact, such as 185000 or 185000.50." })}
          {text("price_to", "price_to", "Price to", { optional: true, inputMode: "decimal", hint: "Leave empty for a single price." })}
          <Field id={id("currency")} label="Currency" error={errors.currency}>
            <SearchableSelect
              id={id("currency")}
              value={values.currency}
              onValueChange={(value) => set({ currency: value })}
              options={currencyOptions}
              aria-invalid={Boolean(errors.currency)}
              aria-describedby={fieldDescribedBy(id("currency"), { error: errors.currency })}
            />
          </Field>
          <div className="hidden lg:block" />
        </>
      )}
      {text("units_total", "units_total", "Units in all", { optional: true, inputMode: "numeric" })}
      {text("units_available", "units_available", "Units available", { optional: true, inputMode: "numeric" })}
      {message && <Alert title={message} className="sm:col-span-2 lg:col-span-4" />}
      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Saving…" : unit ? "Save the unit type" : "Add the unit type"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- The editor ----------------------------------------------------------------------

type Editing =
  | { kind: "new-phase" }
  | { kind: "phase"; id: string }
  | { kind: "new-unit"; phaseId: string }
  | { kind: "unit"; id: string }
  | null;

type Deleting = { kind: "phase"; phase: ManagedPhase } | { kind: "unit"; unit: ManagedUnitType } | null;

/**
 * Phases and their unit types: names, status, completion, bedrooms, sizes,
 * exact prices or "Price on request", and availability. They stay editable
 * while the project waits for review or is public, and apply at once.
 */
export function PhasesEditor({ organisationId, development, editable, defaultCurrency, currencies, onChange, onConflict }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");
  const phases = [...development.phases].sort((a, b) => a.position - b.position);

  async function saved(result: ApiResult<Envelope>, done: string) {
    if (result.ok) {
      onChange(result.data.development);
      setEditing(null);
      setAnnouncement(done);
    } else if (CONFLICTS.has(result.failure.code)) {
      onConflict(result.failure.message);
    }
    return result;
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(undefined);
    const result =
      deleting.kind === "phase"
        ? await deletePhase(organisationId, development.id, deleting.phase.id)
        : await deleteUnitType(organisationId, development.id, deleting.unit.id);
    setBusy(false);
    if (!result.ok) {
      setDeleteError(result.failure.message);
      return;
    }
    onChange(result.data.development);
    setAnnouncement(deleting.kind === "phase" ? "The phase was deleted." : "The unit type was deleted.");
    setDeleting(null);
  }

  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {phases.length === 0 && editing?.kind !== "new-phase" && (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-muted">
          No phases yet. A project needs at least one phase with one unit type before it can be submitted. A project
          built all at once has one phase.
        </p>
      )}
      <ol className="space-y-6">
        {phases.map((phase) => {
          const units = [...phase.unit_types].sort((a, b) => a.position - b.position);
          const phaseCompletion = completionText(phase.completion, phase.status.code);
          return (
            <li key={phase.id} className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
              {editing?.kind === "phase" && editing.id === phase.id ? (
                <PhaseForm
                  idPrefix={`phase-${phase.id}`}
                  phase={phase}
                  onCancel={() => setEditing(null)}
                  onSave={async (fields) =>
                    saved(await updatePhase(organisationId, development.id, phase.id, fields), `${fields.name} was saved.`)
                  }
                />
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="font-sans text-lg font-semibold tracking-normal">{phase.name}</h3>
                  <Badge tone={developmentStatusTone(phase.status.code)}>{developmentStatusLabel(phase.status)}</Badge>
                  {phaseCompletion && <span className="text-sm text-muted">{phaseCompletion}</span>}
                  {editable && (
                    <span className="flex flex-wrap gap-2 sm:ml-auto">
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: "phase", id: phase.id })}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit<span className="sr-only"> {phase.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => {
                          setDeleteError(undefined);
                          setDeleting({ kind: "phase", phase });
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete<span className="sr-only"> {phase.name}</span>
                      </Button>
                    </span>
                  )}
                </div>
              )}

              {units.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No unit types in this phase yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {units.map((unit) => (
                    <li key={unit.id}>
                      {editing?.kind === "unit" && editing.id === unit.id ? (
                        <UnitTypeForm
                          idPrefix={`unit-${unit.id}`}
                          unit={unit}
                          defaultCurrency={defaultCurrency}
                          currencies={currencies}
                          onCancel={() => setEditing(null)}
                          onSave={async (fields) =>
                            saved(await updateUnitType(organisationId, development.id, unit.id, fields), `${fields.name} was saved.`)
                          }
                        />
                      ) : (
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-md border border-line p-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-medium text-ink">{unit.name}</p>
                            <p className="mt-0.5 font-semibold tabular-nums text-ink">{priceRangeText(unit.price)}</p>
                            <p className="mt-0.5 text-sm text-muted">
                              {[bedroomsText(unit.bedrooms), sizeRangeText(unit.size_m2), availabilityText(unit)]
                                .filter(Boolean)
                                .join(" · ") || "No details yet"}
                            </p>
                          </div>
                          {editable && (
                            <span className="flex flex-wrap gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setEditing({ kind: "unit", id: unit.id })}>
                                <Pencil className="size-4" aria-hidden="true" />
                                Edit<span className="sr-only"> {unit.name}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-danger"
                                onClick={() => {
                                  setDeleteError(undefined);
                                  setDeleting({ kind: "unit", unit });
                                }}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Delete<span className="sr-only"> {unit.name}</span>
                              </Button>
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editable &&
                (editing?.kind === "new-unit" && editing.phaseId === phase.id ? (
                  <div className="mt-4">
                    <UnitTypeForm
                      idPrefix={`new-unit-${phase.id}`}
                      defaultCurrency={defaultCurrency}
                      currencies={currencies}
                      onCancel={() => setEditing(null)}
                      onSave={async (fields) =>
                        saved(await createUnitType(organisationId, development.id, phase.id, fields), `${fields.name} was added.`)
                      }
                    />
                  </div>
                ) : (
                  units.length < MAX_UNIT_TYPES && (
                    <Button variant="secondary" className="mt-4" onClick={() => setEditing({ kind: "new-unit", phaseId: phase.id })}>
                      <Plus className="size-4" aria-hidden="true" />
                      Add a unit type<span className="sr-only"> to {phase.name}</span>
                    </Button>
                  )
                ))}
            </li>
          );
        })}
      </ol>

      {editable &&
        (editing?.kind === "new-phase" ? (
          <div className="mt-6">
            <PhaseForm
              idPrefix="new-phase"
              onCancel={() => setEditing(null)}
              onSave={async (fields) =>
                saved(
                  await createPhase(organisationId, development.id, { ...fields, position: phases.length }),
                  `${fields.name} was added.`,
                )
              }
            />
          </div>
        ) : phases.length < MAX_PHASES ? (
          <Button variant="secondary" className="mt-6" onClick={() => setEditing({ kind: "new-phase" })}>
            <Plus className="size-4" aria-hidden="true" />
            Add a phase
          </Button>
        ) : (
          <p className="mt-6 text-sm text-muted">A project can have up to {MAX_PHASES} phases.</p>
        ))}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.kind === "phase" ? `Delete ${deleting.phase.name}?` : `Delete ${deleting?.unit.name ?? "this unit type"}?`}
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        busy={busy}
        error={deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        {deleting?.kind === "phase"
          ? "The phase and all its unit types are removed at once, also from the public page. Listings linked to its unit types stay linked to the project. This cannot be undone."
          : "The unit type is removed at once, also from the public page. Listings linked to it stay linked to the project. This cannot be undone."}
      </ConfirmDialog>
    </div>
  );
}
