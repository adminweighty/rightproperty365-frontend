"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { ErrorSummary } from "@/components/agent/property/form-bits";
import { Linked, ManagementShell, useProperties } from "@/components/agent/property/shared";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { createRequest, uploadRequestPhoto } from "@/lib/api/maintenance";
import { listTenancies } from "@/lib/api/properties";
import {
  canWriteMaintenance,
  createdRequestId,
  defaultPriority,
  DESCRIPTION_MAX,
  emptyRequestForm,
  hasProblems,
  maintenanceHref,
  maintenancePath,
  requestApiProblems,
  requestBody,
  requestFormProblems,
  TITLE_MAX,
  type Choice,
  type RequestForm,
  type RequestProblems,
} from "@/lib/maintenance";
import { partyNames, propertiesPath, tenancyApiQuery, tenancyStatusLabel } from "@/lib/tenancies";
import { PhotoPicker, sectionHeading, uploadChosen, useChosenPhotos, useMaintenanceOptions } from "./shared";

/** `/agent/maintenance/new`: report an issue; `?property=&unit=&tenancy=` fill the place in (from a tenancy's "Report an issue"). */
export function RequestNew() {
  return (
    <ManagementShell area="maintenance" path="/new" title="Report an issue" back={{ href: (org) => maintenancePath("", org), label: "Maintenance" }}>
      {(organisation) => <NewForm organisation={organisation} />}
    </ManagementShell>
  );
}

export const FIELD_LABELS: Record<string, string> = {
  propertyId: "Property",
  unitId: "Unit",
  tenancyId: "Tenancy",
  category: "Category",
  priority: "Priority",
  title: "What is wrong",
  description: "Details",
};

/**
 * The problem itself, shared with the tenant's "Report a problem": its
 * category, how urgent it is, a short title and the details.
 */
export function ProblemFields({
  prefix,
  form,
  set,
  problems,
  categories,
  priorities,
  priorityLabel = "Priority",
}: {
  prefix: string;
  form: RequestForm;
  set: (patch: Partial<RequestForm>) => void;
  problems: RequestProblems;
  categories: Choice[];
  priorities: Choice[];
  priorityLabel?: string;
}) {
  const categoryOptions: SelectOption[] = [{ value: "", label: "Choose a category" }, ...categories.map((item) => ({ value: item.code, label: item.label }))];
  const priorityOptions: SelectOption[] = priorities.map((item) => ({ value: item.code, label: item.label }));
  const titleHint = "A few words, for example “Kitchen tap leaking”.";
  const descriptionHint = "Where it is, when it started, and anything already tried.";
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={`${prefix}-category`} label="Category" error={problems.category}>
        <SearchableSelect
          id={`${prefix}-category`}
          options={categoryOptions}
          value={form.category}
          onValueChange={(value) => set({ category: value })}
          aria-invalid={Boolean(problems.category)}
          aria-describedby={fieldDescribedBy(`${prefix}-category`, { error: problems.category })}
        />
      </Field>
      <Field id={`${prefix}-priority`} label={priorityLabel} error={problems.priority}>
        <SearchableSelect
          id={`${prefix}-priority`}
          options={priorityOptions}
          value={form.priority}
          onValueChange={(value) => set({ priority: value })}
          aria-invalid={Boolean(problems.priority)}
          aria-describedby={fieldDescribedBy(`${prefix}-priority`, { error: problems.priority })}
        />
      </Field>
      <Field id={`${prefix}-title`} label="What is wrong" hint={titleHint} error={problems.title} className="sm:col-span-2">
        <Input
          id={`${prefix}-title`}
          value={form.title}
          maxLength={TITLE_MAX}
          autoComplete="off"
          onChange={(event) => set({ title: event.target.value })}
          aria-invalid={Boolean(problems.title)}
          aria-describedby={fieldDescribedBy(`${prefix}-title`, { hint: titleHint, error: problems.title })}
        />
      </Field>
      <Field id={`${prefix}-description`} label="Details" optional hint={descriptionHint} error={problems.description} className="sm:col-span-2">
        <Textarea
          id={`${prefix}-description`}
          rows={5}
          value={form.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => set({ description: event.target.value })}
          aria-invalid={Boolean(problems.description)}
          aria-describedby={fieldDescribedBy(`${prefix}-description`, { hint: descriptionHint, error: problems.description })}
        />
      </Field>
    </div>
  );
}

/** The summary's links: the id of each control (a SearchableSelect's text field carries the id). */
export const fieldIds = (prefix: string): Record<string, string> => ({
  propertyId: `${prefix}-property`,
  unitId: `${prefix}-unit`,
  tenancyId: `${prefix}-tenancy`,
  category: `${prefix}-category`,
  priority: `${prefix}-priority`,
  title: `${prefix}-title`,
  description: `${prefix}-description`,
});

export function summaryOf(problems: RequestProblems & { other?: string[] }, prefix: string) {
  const ids = fieldIds(prefix);
  const items = Object.entries(problems)
    .filter(([key, text]) => key !== "other" && typeof text === "string")
    .map(([key, text]) => ({ id: ids[key] ?? `${prefix}-title`, text: `${FIELD_LABELS[key] ?? key}: ${text as string}` }));
  for (const text of problems.other ?? []) items.push({ id: `${prefix}-title`, text });
  return items;
}

function NewForm({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const router = useRouter();
  const params = useSearchParams();
  const properties = useProperties(org);
  const options = useMaintenanceOptions(org);
  const chosen = useChosenPhotos();
  const [draft, setForm] = useState<RequestForm>(() => ({
    ...emptyRequestForm(),
    propertyId: params.get("property") ?? "",
    unitId: params.get("unit") ?? "",
    tenancyId: params.get("tenancy") ?? "",
  }));
  const [problems, setProblems] = useState<RequestProblems & { other?: string[] }>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: string; failed: string[] } | null>(null);

  // The priority is one of the reference set's: "normal" by default, else its first.
  const form: RequestForm = options.priorities.some((item) => item.code === draft.priority) ? draft : { ...draft, priority: defaultPriority(options.priorities) };

  const loadTenancies = useCallback(
    () => (form.propertyId ? listTenancies(org, tenancyApiQuery({ property: form.propertyId, page: 1 }, 50)) : Promise.resolve({ ok: true as const, status: 200, data: null })),
    [org, form.propertyId],
  );
  const tenancies = useApi(loadTenancies).state;

  if (!canWriteMaintenance(organisation.role)) {
    return (
      <Alert tone="info" title="You can read this organisation's maintenance requests but not report them.">
        The Agency Principal, a branch manager or an agent can report an issue.
      </Alert>
    );
  }

  const set = (patch: Partial<RequestForm>) => setForm({ ...form, ...patch });
  const property = properties.status === "ready" ? properties.items.find((item) => item.id === form.propertyId) : undefined;
  const units = property?.units ?? [];
  const tenancyItems = tenancies.status === "ready" && tenancies.data ? tenancies.data.items.filter((item) => item.status !== "DRAFT") : [];
  const matching = tenancyItems.filter((item) => !form.unitId || !item.unit?.id || item.unit.id === form.unitId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = requestFormProblems(form);
    setProblems(found);
    setFailure(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = saved ? null : await createRequest(org, requestBody(form));
    if (answer && !answer.ok) {
      setBusy(false);
      setFailure(answer.failure);
      setProblems(requestApiProblems(answer.failure.fields));
      return;
    }
    const id = saved?.id ?? (answer?.ok ? createdRequestId(answer.data) : null);
    if (!id) {
      router.push(maintenancePath("", org));
      return;
    }
    const failed = await uploadChosen(chosen.photos, (file, progress) => uploadRequestPhoto(org, id, file, progress), chosen.update);
    setBusy(false);
    if (failed.length === 0) {
      router.push(maintenanceHref(id, org));
      return;
    }
    setSaved({ id, failed });
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
  const tenancyHint = "Link the tenancy so its tenant can follow the request from their account.";

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-6">
      <ErrorSummary items={summaryOf(problems, "request")} />
      {failure && <Alert title={failure.message} traceId={failure.traceId} />}
      {saved && (
        <Alert tone="warning" title="The request is saved, but some photos were not sent.">
          {saved.failed.join(", ")}. Try again, remove them, or{" "}
          <Linked href={maintenanceHref(saved.id, org)}>open the request</Linked> without them.
        </Alert>
      )}

      <Card>
        <h2 className={sectionHeading}>Where</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field id="request-property" label="Property" error={problems.propertyId} hint={properties.status === "failed" ? properties.message : undefined}>
            <SearchableSelect
              id="request-property"
              options={propertyOptions}
              value={form.propertyId}
              disabled={properties.status === "loading" || Boolean(saved)}
              onValueChange={(value) => set({ propertyId: value, unitId: "", tenancyId: "" })}
              aria-invalid={Boolean(problems.propertyId)}
              aria-describedby={fieldDescribedBy("request-property", { error: problems.propertyId, hint: properties.status === "failed" ? properties.message : undefined })}
            />
          </Field>
          {units.length > 0 ? (
            <Field id="request-unit" label="Unit" optional hint="Leave as the whole property for shared areas." error={problems.unitId}>
              <SearchableSelect
                id="request-unit"
                options={unitOptions}
                value={form.unitId}
                disabled={Boolean(saved)}
                onValueChange={(value) => set({ unitId: value, tenancyId: "" })}
                aria-invalid={Boolean(problems.unitId)}
                aria-describedby={fieldDescribedBy("request-unit", { hint: "Leave as the whole property for shared areas.", error: problems.unitId })}
              />
            </Field>
          ) : (
            property && <p className="self-end text-sm text-muted">This property has no units: the request is for the whole property.</p>
          )}
          {form.propertyId && (
            <Field id="request-tenancy" label="Tenancy" optional hint={tenancyHint} error={problems.tenancyId} className="sm:col-span-2">
              <SearchableSelect
                id="request-tenancy"
                options={tenancyOptions}
                value={form.tenancyId}
                disabled={tenancies.status === "loading" || Boolean(saved)}
                onValueChange={(value) => set({ tenancyId: value })}
                aria-invalid={Boolean(problems.tenancyId)}
                aria-describedby={fieldDescribedBy("request-tenancy", { hint: tenancyHint, error: problems.tenancyId })}
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
        <h2 className={sectionHeading}>The problem</h2>
        <div className="mt-4">
          <ProblemFields prefix="request" form={form} set={set} problems={problems} categories={options.categories} priorities={options.priorities} />
        </div>
      </Card>

      <PhotoPicker id="request-photos" photos={chosen.photos} onAdd={chosen.add} onRemove={chosen.remove} disabled={busy} rules={options.photoRules} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
          {busy ? (saved || chosen.photos.length ? "Sending…" : "Saving…") : saved ? "Try the photos again" : "Report the issue"}
        </Button>
        <ButtonLink href={maintenancePath("", org)} variant="ghost" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
