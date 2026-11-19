"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { ErrorSummary } from "@/components/agent/property/form-bits";
import { Linked, ManagementShell, useProperties } from "@/components/agent/property/shared";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { createInspection } from "@/lib/api/inspections";
import { listTenancies } from "@/lib/api/properties";
import {
  canWriteInspections,
  createdInspectionId,
  emptyInspectionForm,
  hasProblems,
  inspectionApiProblems,
  inspectionBody,
  inspectionFormProblems,
  inspectionHref,
  inspectionsPath,
  isInspectionType,
  localToUtc,
  TYPE_EXPLAINED,
  type InspectionForm,
  type InspectionProblems,
} from "@/lib/inspections";
import { partyNames, propertiesPath, tenancyApiQuery, tenancyStatusLabel } from "@/lib/tenancies";
import { scheduledWords, sectionHeading, useInspectionOptions } from "./shared";

/** `/agent/inspections/new`: schedule an inspection; `?property=&unit=&tenancy=&type=` fill it in (from a tenancy's "Schedule inspection"). */
export function InspectionNew() {
  return (
    <ManagementShell area="inspections" path="/new" title="Schedule inspection" back={{ href: (org) => inspectionsPath("", org), label: "Inspections" }}>
      {(organisation, user) => <NewForm organisation={organisation} user={user} />}
    </ManagementShell>
  );
}

const FIELD_LABELS: Record<string, string> = {
  inspectorId: "Inspector",
  propertyId: "Property",
  unitId: "Unit",
  tenancyId: "Tenancy",
  type: "Type",
  date: "Day",
  time: "Time",
  template: "Checklist",
};

const FIELD_IDS: Record<string, string> = {
  propertyId: "inspection-property",
  unitId: "inspection-unit",
  tenancyId: "inspection-tenancy",
  type: "inspection-type",
  date: "inspection-date",
  time: "inspection-time",
  template: "inspection-template",
  inspectorId: "inspection-inspector",
};

function summaryOf(problems: InspectionProblems & { other?: string[] }) {
  const items = Object.entries(problems)
    .filter(([key, text]) => key !== "other" && typeof text === "string")
    .map(([key, text]) => ({ id: FIELD_IDS[key] ?? "inspection-property", text: `${FIELD_LABELS[key] ?? key}: ${text as string}` }));
  for (const text of problems.other ?? []) items.push({ id: "inspection-property", text });
  return items;
}

/** The browser's time zone name, for the hint ("Africa/Harare"). */
function zoneName(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function NewForm({ organisation, user }: { organisation: DashboardOrganisation; user: User }) {
  const org = organisation.id;
  const router = useRouter();
  const params = useSearchParams();
  const properties = useProperties(org);
  const options = useInspectionOptions(org);
  const [form, setForm] = useState<InspectionForm>(() => {
    const type = (params.get("type") ?? "").toUpperCase();
    return {
      ...emptyInspectionForm(),
      propertyId: params.get("property") ?? "",
      unitId: params.get("unit") ?? "",
      tenancyId: params.get("tenancy") ?? "",
      type: isInspectionType(type) ? type : "ROUTINE",
    };
  });
  const [problems, setProblems] = useState<InspectionProblems & { other?: string[] }>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTenancies = useCallback(
    () => (form.propertyId ? listTenancies(org, tenancyApiQuery({ property: form.propertyId, page: 1 }, 50)) : Promise.resolve({ ok: true as const, status: 200, data: null })),
    [org, form.propertyId],
  );
  const tenancies = useApi(loadTenancies).state;

  if (!canWriteInspections(organisation.role)) {
    return (
      <Alert tone="info" title="You can read this organisation's inspections but not schedule them.">
        The Agency Principal, a branch manager or an agent can schedule an inspection.
      </Alert>
    );
  }

  const set = (patch: Partial<InspectionForm>) => setForm((current) => ({ ...current, ...patch }));
  const property = properties.status === "ready" ? properties.items.find((item) => item.id === form.propertyId) : undefined;
  const units = property?.units ?? [];
  const tenancyItems = tenancies.status === "ready" && tenancies.data ? tenancies.data.items : [];
  const matching = tenancyItems.filter((item) => !form.unitId || !item.unit?.id || item.unit.id === form.unitId);
  // The template is required when the API offers templates; the first one is chosen until the inspector picks another.
  const template = form.template || options.templates[0]?.code || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const chosen = { ...form, template };
    const found = inspectionFormProblems(chosen, { templateRequired: true });
    setProblems(found);
    setFailure(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await createInspection(org, inspectionBody(chosen));
    setBusy(false);
    if (!answer.ok) {
      setFailure(answer.failure);
      setProblems(inspectionApiProblems(answer.failure.fields));
      return;
    }
    const id = createdInspectionId(answer.data);
    router.push(id ? inspectionHref(id, org) : inspectionsPath("", org));
  }

  const propertyOptions: SelectOption[] = [{ value: "", label: "Choose a property" }];
  if (properties.status === "ready") propertyOptions.push(...properties.items.map((item) => ({ value: item.id, label: item.name, secondary: item.address })));
  if (form.propertyId && !propertyOptions.some((option) => option.value === form.propertyId)) propertyOptions.push({ value: form.propertyId, label: "The property chosen" });
  const unitOptions: SelectOption[] = [{ value: "", label: "The whole property" }, ...units.map((unit) => ({ value: unit.id, label: unit.label }))];
  const tenancyOptions: SelectOption[] = [
    { value: "", label: "No tenancy" },
    ...matching.map((item) => ({
      value: item.id,
      label: partyNames(item.tenants) || "Tenancy",
      secondary: `${tenancyStatusLabel(item.status, item.statusLabel)}${item.unit ? ` · ${item.unit.label}` : ""}`,
    })),
  ];
  if (form.tenancyId && !tenancyOptions.some((option) => option.value === form.tenancyId)) tenancyOptions.push({ value: form.tenancyId, label: "The tenancy chosen" });
  const typeOptions: SelectOption[] = options.types.map((item) => ({ value: item.code, label: item.label }));
  const templateOptions: SelectOption[] = options.templates.map((item) => ({
    value: item.code,
    label: item.label,
    secondary: item.areas ? `${item.areas} ${item.areas === 1 ? "area" : "areas"}, ${item.items} ${item.items === 1 ? "item" : "items"}` : undefined,
  }));
  // "" is the signed-in person (the API's default); the others are the organisation's active members.
  const inspectorOptions: SelectOption[] = [
    { value: "", label: `You (${user.name})` },
    ...options.inspectors.filter((item) => item.userId !== user.id).map((item) => ({ value: item.userId, label: item.name })),
  ];
  const inspectorHint = "Who will carry out the inspection.";
  const zone = zoneName();
  const timeHint = `In your own time zone${zone ? ` (${zone})` : ""}. Everyone sees it in theirs.`;
  const when = localToUtc(form.date, form.time);
  const tenancyHint = "Link the tenancy so its tenant can read the report from their account once it is completed.";
  const templateHint = "The rooms and items to check. You can add or remove areas and items on the inspection.";
  const typeHint = isInspectionType(form.type) ? TYPE_EXPLAINED[form.type] : undefined;

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-6">
      <ErrorSummary items={summaryOf(problems)} />
      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}

      <Card>
        <h2 className={sectionHeading}>Where</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field id="inspection-property" label="Property" error={problems.propertyId} hint={properties.status === "failed" ? properties.message : undefined}>
            <SearchableSelect
              id="inspection-property"
              options={propertyOptions}
              value={form.propertyId}
              disabled={properties.status === "loading"}
              onValueChange={(value) => set({ propertyId: value, unitId: "", tenancyId: "" })}
              aria-invalid={Boolean(problems.propertyId)}
              aria-describedby={fieldDescribedBy("inspection-property", { error: problems.propertyId, hint: properties.status === "failed" ? properties.message : undefined })}
            />
          </Field>
          {units.length > 0 ? (
            <Field id="inspection-unit" label="Unit" optional hint="Leave as the whole property for shared areas." error={problems.unitId}>
              <SearchableSelect
                id="inspection-unit"
                options={unitOptions}
                value={form.unitId}
                onValueChange={(value) => set({ unitId: value, tenancyId: "" })}
                aria-invalid={Boolean(problems.unitId)}
                aria-describedby={fieldDescribedBy("inspection-unit", { hint: "Leave as the whole property for shared areas.", error: problems.unitId })}
              />
            </Field>
          ) : (
            property && <p className="self-end text-sm text-muted">This property has no units: the inspection is of the whole property.</p>
          )}
          {form.propertyId && (
            <Field id="inspection-tenancy" label="Tenancy" optional hint={tenancyHint} error={problems.tenancyId} className="sm:col-span-2">
              <SearchableSelect
                id="inspection-tenancy"
                options={tenancyOptions}
                value={form.tenancyId}
                disabled={tenancies.status === "loading"}
                onValueChange={(value) => set({ tenancyId: value })}
                aria-invalid={Boolean(problems.tenancyId)}
                aria-describedby={fieldDescribedBy("inspection-tenancy", { hint: tenancyHint, error: problems.tenancyId })}
              />
            </Field>
          )}
        </div>
        {properties.status === "ready" && properties.items.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            There are no properties yet. <Linked href={propertiesPath("/new", org)}>Add a property</Linked> first.
          </p>
        )}
      </Card>

      <Card>
        <h2 className={sectionHeading}>What and when</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field id="inspection-type" label="Type" hint={typeHint} error={problems.type} className="sm:col-span-2">
            <SearchableSelect
              id="inspection-type"
              options={typeOptions}
              value={form.type}
              onValueChange={(value) => set({ type: value })}
              aria-invalid={Boolean(problems.type)}
              aria-describedby={fieldDescribedBy("inspection-type", { hint: typeHint, error: problems.type })}
            />
          </Field>
          <Field id="inspection-date" label="Day" error={problems.date}>
            <Input
              id="inspection-date"
              type="date"
              value={form.date}
              onChange={(event) => set({ date: event.target.value })}
              aria-invalid={Boolean(problems.date)}
              aria-describedby={fieldDescribedBy("inspection-date", { error: problems.date })}
            />
          </Field>
          <Field id="inspection-time" label="Time" hint={timeHint} error={problems.time}>
            <Input
              id="inspection-time"
              type="time"
              step={300}
              value={form.time}
              onChange={(event) => set({ time: event.target.value })}
              aria-invalid={Boolean(problems.time)}
              aria-describedby={fieldDescribedBy("inspection-time", { hint: timeHint, error: problems.time })}
            />
          </Field>
          {when && (
            <p className="text-sm text-muted sm:col-span-2" aria-live="polite">
              Scheduled for {scheduledWords(when)}.
            </p>
          )}
          {inspectorOptions.length > 1 && (
            <Field id="inspection-inspector" label="Inspector" hint={inspectorHint} error={problems.inspectorId} className="sm:col-span-2">
              <SearchableSelect
                id="inspection-inspector"
                options={inspectorOptions}
                value={form.inspectorId}
                onValueChange={(value) => set({ inspectorId: value })}
                aria-invalid={Boolean(problems.inspectorId)}
                aria-describedby={fieldDescribedBy("inspection-inspector", { hint: inspectorHint, error: problems.inspectorId })}
              />
            </Field>
          )}
          {options.templates.length > 0 ? (
            <Field id="inspection-template" label="Checklist" hint={templateHint} error={problems.template} className="sm:col-span-2">
              <SearchableSelect
                id="inspection-template"
                options={templateOptions}
                value={template}
                onValueChange={(value) => set({ template: value })}
                aria-invalid={Boolean(problems.template)}
                aria-describedby={fieldDescribedBy("inspection-template", { hint: templateHint, error: problems.template })}
              />
            </Field>
          ) : (
            <p className="text-sm text-muted sm:col-span-2">
              {options.loaded ? "No checklist templates are available. Ask an administrator to add one." : "Loading the checklists…"}
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? "Scheduling…" : "Schedule inspection"}
        </Button>
        <ButtonLink href={inspectionsPath("", org)} variant="ghost" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
