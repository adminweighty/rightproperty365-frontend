"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/lease-templates";
import { failureNotice, NoticeArea, type Notice } from "@/components/agreements/shared";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LEASE_TEMPLATE_ROLES } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import {
  adminApproveLeaseTemplate,
  adminCreateLeaseTemplate,
  adminEditLeaseTemplate,
  adminGetLeaseTemplate,
  adminListLeaseTemplates,
  adminRetireLeaseTemplate,
  type LeaseKind,
  type LeaseTemplate,
  type LeaseTemplateEvent,
  type LeaseTemplateInput,
  type LeaseVariable,
} from "@/lib/api/leases";
import { CLAUSE_CODE, dayAfter, eventLabel, isDay, isSampleReview, placeholderProblem, statusOf, TEMPLATE_STATUS } from "@/lib/signing";

const PATH = "/admin/lease-templates";

type Section = { key: string; heading: string; text: string };
type Clause = { key: string; code: string; title: string; text: string };
type Values = { market: string; name: string; kind: LeaseKind; description: string; sections: Section[]; clauses: Clause[] };
type Problems = Record<string, string | undefined>;

let counter = 0;
const newKey = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

const fromTemplate = (template: LeaseTemplate | null): Values =>
  template
    ? {
        market: template.market_code,
        name: template.name,
        kind: template.lease_kind,
        description: template.description ?? "",
        sections: template.sections.map((section) => ({ key: newKey(), ...section })),
        clauses: template.optional_clauses.map((clause) => ({ key: newKey(), ...clause })),
      }
    : { market: "", name: "", kind: "RESIDENTIAL", description: "", sections: [{ key: newKey(), heading: "", text: "" }], clauses: [] };

function problemsOf(values: Values, allowed: Set<string>): Problems {
  const problems: Problems = {};
  if (!/^[A-Z]{2}$/.test(values.market)) problems.market = "Choose the country the template is for.";
  if (!values.name.trim()) problems.name = "Give the template a name.";
  else if (Array.from(values.name.trim()).length > 120) problems.name = "Use 120 characters or fewer.";
  if (Array.from(values.description).length > 1000) problems.description = "Use 1000 characters or fewer.";
  if (values.sections.length === 0) problems.sections = "Add at least one section.";
  if (values.sections.length > 60) problems.sections = "At most 60 sections.";
  for (const section of values.sections) {
    if (!section.heading.trim()) problems[`${section.key}.heading`] = "Give the section a heading.";
    else if (Array.from(section.heading).length > 200) problems[`${section.key}.heading`] = "Use 200 characters or fewer.";
    else problems[`${section.key}.heading`] = placeholderProblem(section.heading, allowed);
    if (!section.text.trim()) problems[`${section.key}.text`] = "Write the section's text.";
    else if (Array.from(section.text).length > 10000) problems[`${section.key}.text`] = "Use 10000 characters or fewer.";
    else problems[`${section.key}.text`] = placeholderProblem(section.text, allowed);
  }
  const codes = new Set<string>();
  if (values.clauses.length > 30) problems.clauses = "At most 30 optional clauses.";
  for (const clause of values.clauses) {
    const code = clause.code.trim();
    if (!CLAUSE_CODE.test(code)) problems[`${clause.key}.code`] = "Capital letters, digits and _, starting with a letter, like PETS_ALLOWED.";
    else if (codes.has(code)) problems[`${clause.key}.code`] = "Each clause needs its own code.";
    codes.add(code);
    if (!clause.title.trim()) problems[`${clause.key}.title`] = "Give the clause a title.";
    if (!clause.text.trim()) problems[`${clause.key}.text`] = "Write the clause.";
    else problems[`${clause.key}.text`] = placeholderProblem(clause.text, allowed);
  }
  return problems;
}

const hasProblems = (problems: Problems) => Object.values(problems).some(Boolean);

const toInput = (values: Values, create: boolean): LeaseTemplateInput => ({
  ...(create ? { market_code: values.market } : {}),
  name: values.name.trim(),
  lease_kind: values.kind,
  description: values.description.trim(),
  sections: values.sections.map(({ heading, text }) => ({ heading: heading.trim(), text })),
  optional_clauses: values.clauses.map(({ code, title, text }) => ({ code: code.trim(), title: title.trim(), text })),
});

function mapApiFields(fields: Record<string, string> | undefined, values: Values): Problems {
  const problems: Problems = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const section = /^sections\[(\d+)\]\.(heading|text)$/.exec(key);
    const clause = /^optional_clauses\[(\d+)\]\.(code|title|text)$/.exec(key);
    if (section) problems[`${values.sections[Number(section[1])]?.key}.${section[2]}`] = message;
    else if (clause) problems[`${values.clauses[Number(clause[1])]?.key}.${clause[2]}`] = message;
    else problems[{ market_code: "market", lease_kind: "kind", optional_clauses: "clauses" }[key] ?? key] = message;
  }
  return problems;
}

function ApproveDialog({ open, template, onCancel, onApproved }: { open: boolean; template: LeaseTemplate; onCancel: () => void; onApproved: (template: LeaseTemplate) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<Problems>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [today] = useState(() => dayAfter(Date.now(), 0));

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const review = {
      reviewer_name: String(data.get("reviewer_name") ?? "").trim(),
      organisation: String(data.get("organisation") ?? "").trim(),
      reviewed_on: String(data.get("reviewed_on") ?? ""),
      note: String(data.get("note") ?? "").trim(),
    };
    const problems: Problems = {
      reviewer_name: review.reviewer_name ? undefined : "Enter the name of the lawyer who reviewed the wording.",
      organisation: review.organisation ? undefined : "Enter their firm or organisation.",
      reviewed_on: !review.reviewed_on ? "Enter the day of the review." : !isDay(review.reviewed_on) ? "Enter a date like 2026-11-01." : review.reviewed_on > today ? "The review cannot be in the future." : undefined,
      note: Array.from(review.note).length > 2000 ? "Use 2000 characters or fewer." : undefined,
    };
    setErrors(problems);
    setFailure(undefined);
    if (hasProblems(problems)) return;
    setBusy(true);
    const result = await adminApproveLeaseTemplate(template.id, { ...review, ...(review.note ? {} : { note: undefined }) });
    setBusy(false);
    if (result.ok) {
      onApproved(result.data.template);
      return;
    }
    const fields = result.failure.fields ?? {};
    const mapped = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key.replace(/^legal_review\./, ""), value]));
    if (Object.keys(mapped).length > 0) setErrors(mapped);
    else setFailure(failureNotice(result.failure).text);
  }

  const control = (name: string, label: string, type = "text", optional = false) => (
    <Field id={`approve-${name}`} label={label} optional={optional} error={errors[name]} className="mt-4">
      <Input
        id={`approve-${name}`}
        name={name}
        type={type}
        max={type === "date" ? today : undefined}
        defaultValue={type === "date" ? today : undefined}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={fieldDescribedBy(`approve-${name}`, { error: errors[name] })}
      />
    </Field>
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="approve-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-overlay"
    >
      <form onSubmit={submit} noValidate>
        <h2 id="approve-title" className="font-sans text-xl font-semibold tracking-normal">
          Approve version {template.version}
        </h2>
        <p className="mt-2 text-muted">
          Leases can then be drafted from it in {template.market_code}. Any earlier approved version of this template is
          retired at the same time; leases made from it keep their wording. Record who reviewed the wording.
        </p>
        {control("reviewer_name", "Reviewed by")}
        {control("organisation", "Firm or organisation")}
        {control("reviewed_on", "Reviewed on", "date")}
        <Field id="approve-note" label="Note" optional error={errors.note} className="mt-4" hint='Shown with the template. For sample wording, write "SAMPLE".'>
          <Textarea id="approve-note" name="note" rows={3} maxLength={2100} aria-invalid={Boolean(errors.note)} aria-describedby={fieldDescribedBy("approve-note", { error: errors.note, hint: "x" })} />
        </Field>
        {failure && <Alert title={failure} className="mt-4" />}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

function Editor({ templateId, countries }: { templateId: string | null; countries: { value: string; label: string }[] }) {
  const router = useRouter();
  const [template, setTemplate] = useState<LeaseTemplate | null>(null);
  const [events, setEvents] = useState<LeaseTemplateEvent[]>([]);
  const [variables, setVariables] = useState<LeaseVariable[] | null>(null);
  const [values, setValues] = useState<Values | null>(templateId ? null : fromTemplate(null));
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"version" | "retire" | null>(null);
  const [approving, setApproving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastText = useRef<{ id: string; apply: (text: string) => void } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const newVersion = useSearchParams().get("new_version") === "1";

  const read = useCallback(async () => {
    if (!templateId) {
      const list = await adminListLeaseTemplates();
      if (list.ok) setVariables(list.data.variables);
      else setLoadFailure(list.failure);
      return;
    }
    const result = await adminGetLeaseTemplate(templateId);
    if (!result.ok) {
      setLoadFailure(result.failure);
      return;
    }
    setTemplate(result.data.template);
    setEvents(result.data.events);
    setVariables(result.data.variables);
    setValues(fromTemplate(result.data.template));
    setDirty(false);
  }, [templateId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void read(), 0);
    return () => window.clearTimeout(timer);
  }, [read]);

  if (loadFailure) return <LoadError failure={loadFailure} onRetry={() => { setLoadFailure(null); void read(); }} />;
  if (!values || !variables) return <LoadingBlock label="Loading the template" rows={4} />;

  const allowed = new Set(variables.map((variable) => variable.name));
  const current = problemsOf(values, allowed);
  const shown = touched ? { ...current, ...problems } : problems;
  const readOnly = template?.status === "RETIRED";
  const status = template ? statusOf(TEMPLATE_STATUS, template.status) : null;

  function change(next: Values) {
    setValues(next);
    setProblems({});
    setDirty(true);
  }

  const setSection = (key: string, change_: Partial<Section>) => change({ ...values!, sections: values!.sections.map((item) => (item.key === key ? { ...item, ...change_ } : item)) });
  const setClause = (key: string, change_: Partial<Clause>) => change({ ...values!, clauses: values!.clauses.map((item) => (item.key === key ? { ...item, ...change_ } : item)) });

  /** Remembers the text box last used, so a variable can be put where the caret was. */
  function track(id: string, apply: (text: string) => void) {
    lastText.current = { id, apply };
  }

  function insert(name: string) {
    const target = lastText.current;
    const element = target ? (document.getElementById(target.id) as HTMLTextAreaElement | HTMLInputElement | null) : null;
    if (!target || !element) {
      setNotice({ tone: "info", text: "Click in a heading or text first, then choose the variable to put there." });
      return;
    }
    const token = `{{${name}}}`;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    target.apply(element.value.slice(0, start) + token + element.value.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(confirmed = false) {
    if (!values) return;
    setTouched(true);
    setNotice(null);
    if (hasProblems(current)) {
      const first = Object.entries(current).find(([, value]) => value)?.[0];
      const id = first === "market" ? "template-market" : first === "name" ? "template-name" : first?.includes(".") ? `template-${first.replace(".", "-")}` : null;
      if (id) document.getElementById(id)?.focus();
      return;
    }
    if (template?.status === "APPROVED" && !confirmed) {
      setConfirm("version");
      return;
    }
    setBusy(true);
    const result = template ? await adminEditLeaseTemplate(template.id, toInput(values, false)) : await adminCreateLeaseTemplate(toInput(values, true));
    setBusy(false);
    setConfirm(null);
    if (!result.ok) {
      const mapped = mapApiFields(result.failure.fields, values);
      if (Object.keys(mapped).length > 0) setProblems(mapped);
      else setNotice(failureNotice(result.failure));
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    const saved = result.data.template;
    setDirty(false);
    if (!template || result.data.new_version) {
      router.push(`${PATH}/${saved.id}${result.data.new_version ? "?new_version=1" : ""}`);
      return;
    }
    setTemplate(saved);
    setValues(fromTemplate(saved));
    setNotice({ tone: "success", text: "The draft is saved." });
    void read();
  }

  async function retire() {
    if (!template) return;
    setBusy(true);
    const result = await adminRetireLeaseTemplate(template.id);
    setBusy(false);
    setConfirm(null);
    if (!result.ok) {
      setNotice(failureNotice(result.failure));
      return;
    }
    setNotice({ tone: "success", text: "Retired. It is no longer offered for new leases; existing leases keep it." });
    void read();
  }

  const countryName = countries.find((country) => country.value === values.market)?.label ?? values.market;

  return (
    <>
      <BackLink href={PATH}>Lease templates</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{template ? template.name : "New lease template"}</h1>
          {template && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={status!.tone}>{status!.label}</Badge>
              Version {template.version} · {countryName} · by {template.created_by_name}, updated {formatWhen(template.updated_at)}
            </p>
          )}
        </div>
        {template && (
          <div className="flex flex-wrap gap-2">
            {template.status === "DRAFT" && (
              <Button onClick={() => (dirty ? setNotice({ tone: "warning", text: "Save your changes before approving." }) : setApproving(true))}>Approve…</Button>
            )}
            {template.status === "APPROVED" && (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirm("retire")}>
                Retire
              </Button>
            )}
          </div>
        )}
      </div>
      <NoticeArea ref={noticeRef} notice={notice} />
      {template?.status === "APPROVED" && (
        <Alert tone="info" title="This version is approved and in use" className="mt-4">
          Saving changes starts version {template.version + 1} as a draft. This version stays approved until the new one is approved.
        </Alert>
      )}
      {newVersion && template?.status === "DRAFT" && (
        <Alert tone="success" title={`Version ${template.version} was created as a draft with your changes.`} className="mt-4">
          It needs a legal review and approval before it is offered. The earlier version stays in use until then.
        </Alert>
      )}
      {readOnly && <Alert tone="warning" title="This version is retired. It can no longer be changed or offered." className="mt-4" />}
      {template?.legal_review && (
        <Card className="mt-4">
          <h2 className="font-sans text-base font-semibold tracking-normal">Legal review</h2>
          <p className="mt-1 text-sm text-ink">
            {template.legal_review.reviewer_name}, {template.legal_review.organisation}, reviewed on {template.legal_review.reviewed_on}
            {template.approved_by_name && ` · approved by ${template.approved_by_name}`}
            {template.approved_at && ` on ${formatWhen(template.approved_at)}`}
          </p>
          {template.legal_review.note && <p className="mt-1 text-sm text-muted">{template.legal_review.note}</p>}
          {isSampleReview(template.legal_review) && <Badge tone="warning" className="mt-2">Sample wording: people drafting a lease are told so</Badge>}
        </Card>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-8"
        >
          <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
            <Field id="template-market" label="Country" error={shown.market} hint={template ? "It cannot change." : undefined}>
              <SearchableSelect
                id="template-market"
                options={[{ value: "", label: "Choose a country…" }, ...countries]}
                value={values.market}
                disabled={Boolean(template) || readOnly}
                onValueChange={(value) => change({ ...values, market: value })}
                aria-invalid={Boolean(shown.market)}
                aria-describedby={fieldDescribedBy("template-market", { error: shown.market, hint: template ? "x" : undefined })}
              />
            </Field>
            <Field id="template-kind" label="Kind of lease">
              <SearchableSelect
                id="template-kind"
                options={[
                  { value: "RESIDENTIAL", label: "Residential" },
                  { value: "COMMERCIAL", label: "Commercial" },
                ]}
                value={values.kind}
                disabled={readOnly}
                onValueChange={(value) => change({ ...values, kind: value as LeaseKind })}
              />
            </Field>
            <Field id="template-name" label="Name" error={shown.name} className="md:col-span-2">
              <Input id="template-name" value={values.name} maxLength={140} onChange={(event) => change({ ...values, name: event.currentTarget.value })} aria-invalid={Boolean(shown.name)} aria-describedby={fieldDescribedBy("template-name", { error: shown.name })} />
            </Field>
            <Field id="template-description" label="Description" optional error={shown.description} className="md:col-span-2" hint="For the people choosing a template.">
              <Textarea id="template-description" rows={2} maxLength={1100} value={values.description} onChange={(event) => change({ ...values, description: event.currentTarget.value })} aria-invalid={Boolean(shown.description)} aria-describedby={fieldDescribedBy("template-description", { error: shown.description, hint: "x" })} />
            </Field>
          </fieldset>

          <fieldset disabled={readOnly}>
            <legend className="text-2xl">Sections</legend>
            <p className="mt-1 text-sm text-muted">In order. Plain text: line breaks are kept. Use the variables on the right for the details of each lease.</p>
            {shown.sections && <p className="mt-2 text-sm text-danger">{shown.sections}</p>}
            <ol className="mt-4 space-y-4">
              {values.sections.map((section, index) => {
                const headingId = `template-${section.key}-heading`;
                const textId = `template-${section.key}-text`;
                return (
                  <li key={section.key} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="pt-8 text-sm font-semibold tabular-nums text-muted">{index + 1}</span>
                      <Field id={headingId} label="Heading" error={shown[`${section.key}.heading`]} className="min-w-48 flex-1">
                        <Input
                          id={headingId}
                          value={section.heading}
                          maxLength={220}
                          onFocus={() => track(headingId, (text) => setSection(section.key, { heading: text }))}
                          onChange={(event) => setSection(section.key, { heading: event.currentTarget.value })}
                          aria-invalid={Boolean(shown[`${section.key}.heading`])}
                          aria-describedby={fieldDescribedBy(headingId, { error: shown[`${section.key}.heading`] })}
                        />
                      </Field>
                      <div className="flex gap-1 pt-7">
                        <Button size="sm" variant="ghost" disabled={index === 0} aria-label={`Move section ${index + 1} up`} onClick={() => change({ ...values, sections: swap(values.sections, index, index - 1) })}>
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={index === values.sections.length - 1} aria-label={`Move section ${index + 1} down`} onClick={() => change({ ...values, sections: swap(values.sections, index, index + 1) })}>
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" disabled={values.sections.length === 1} aria-label={`Remove section ${index + 1}`} onClick={() => change({ ...values, sections: values.sections.filter((item) => item.key !== section.key) })}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <Field id={textId} label="Text" error={shown[`${section.key}.text`]} className="mt-3">
                      <Textarea
                        id={textId}
                        rows={6}
                        maxLength={10100}
                        value={section.text}
                        onFocus={() => track(textId, (text) => setSection(section.key, { text }))}
                        onChange={(event) => setSection(section.key, { text: event.currentTarget.value })}
                        aria-invalid={Boolean(shown[`${section.key}.text`])}
                        aria-describedby={fieldDescribedBy(textId, { error: shown[`${section.key}.text`] })}
                        className="font-mono text-sm"
                      />
                    </Field>
                  </li>
                );
              })}
            </ol>
            <Button variant="secondary" className="mt-3" disabled={values.sections.length >= 60} onClick={() => change({ ...values, sections: [...values.sections, { key: newKey(), heading: "", text: "" }] })}>
              <Plus className="size-4" aria-hidden="true" />
              Add a section
            </Button>
          </fieldset>

          <fieldset disabled={readOnly}>
            <legend className="text-2xl">Optional clauses</legend>
            <p className="mt-1 text-sm text-muted">The person drafting a lease ticks the ones it includes.</p>
            {shown.clauses && <p className="mt-2 text-sm text-danger">{shown.clauses}</p>}
            <ul className="mt-4 space-y-4">
              {values.clauses.map((clause, index) => {
                const ids = { code: `template-${clause.key}-code`, title: `template-${clause.key}-title`, text: `template-${clause.key}-text` };
                return (
                  <li key={clause.key} className="rounded-lg border border-line p-4">
                    <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
                      <Field id={ids.code} label="Code" error={shown[`${clause.key}.code`]}>
                        <Input id={ids.code} value={clause.code} maxLength={40} className="font-mono uppercase" onChange={(event) => setClause(clause.key, { code: event.currentTarget.value.toUpperCase() })} aria-invalid={Boolean(shown[`${clause.key}.code`])} aria-describedby={fieldDescribedBy(ids.code, { error: shown[`${clause.key}.code`] })} />
                      </Field>
                      <Field id={ids.title} label="Title" error={shown[`${clause.key}.title`]}>
                        <Input id={ids.title} value={clause.title} maxLength={200} onChange={(event) => setClause(clause.key, { title: event.currentTarget.value })} aria-invalid={Boolean(shown[`${clause.key}.title`])} aria-describedby={fieldDescribedBy(ids.title, { error: shown[`${clause.key}.title`] })} />
                      </Field>
                      <div className="flex items-end">
                        <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove clause ${index + 1}`} onClick={() => change({ ...values, clauses: values.clauses.filter((item) => item.key !== clause.key) })}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <Field id={ids.text} label="Text" error={shown[`${clause.key}.text`]} className="mt-3">
                      <Textarea
                        id={ids.text}
                        rows={4}
                        value={clause.text}
                        onFocus={() => track(ids.text, (text) => setClause(clause.key, { text }))}
                        onChange={(event) => setClause(clause.key, { text: event.currentTarget.value })}
                        aria-invalid={Boolean(shown[`${clause.key}.text`])}
                        aria-describedby={fieldDescribedBy(ids.text, { error: shown[`${clause.key}.text`] })}
                        className="font-mono text-sm"
                      />
                    </Field>
                  </li>
                );
              })}
            </ul>
            <Button variant="secondary" className="mt-3" disabled={values.clauses.length >= 30} onClick={() => change({ ...values, clauses: [...values.clauses, { key: newKey(), code: "", title: "", text: "" }] })}>
              <Plus className="size-4" aria-hidden="true" />
              Add an optional clause
            </Button>
          </fieldset>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
              <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
                {busy ? "Saving…" : !template ? "Create the draft" : template.status === "APPROVED" ? `Save as version ${template.version + 1}` : "Save the draft"}
              </Button>
              {dirty && <span className="text-sm text-muted">Changes not saved yet</span>}
            </div>
          )}

          {events.length > 0 && (
            <section aria-labelledby="template-history">
              <h2 id="template-history" className="text-2xl">
                History
              </h2>
              <ol className="mt-4 space-y-3 border-l-2 border-line pl-6">
                {events.map((event) => (
                  <li key={event.id}>
                    <p className="font-medium text-ink">
                      {eventLabel(event.action)}
                      <span className="font-normal text-muted"> · {event.actor.name}</span>
                    </p>
                    <p className="text-sm text-muted">{formatWhen(event.at)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </form>

        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <Card>
            <h2 className="font-sans text-base font-semibold tracking-normal">Variables</h2>
            <p className="mt-1 text-xs text-muted">Click in a heading or text, then choose one to put {"{{variable}}"} there. Only these can be used.</p>
            <ul className="mt-3 space-y-2">
              {variables.map((variable) => (
                <li key={variable.name}>
                  <button
                    type="button"
                    disabled={readOnly}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insert(variable.name)}
                    className="w-full rounded-md border border-line px-3 py-2 text-left hover:bg-sunken disabled:opacity-50"
                  >
                    <span className="block font-mono text-sm text-primary-ink">{`{{${variable.name}}}`}</span>
                    <span className="block text-xs text-muted">{variable.description}</span>
                    <span className="block truncate text-xs text-subtle">e.g. {variable.example}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      {template && <ApproveDialog open={approving} template={template} onCancel={() => setApproving(false)} onApproved={() => {
        setApproving(false);
        setNotice({ tone: "success", text: "Approved. It is now offered for new leases in its country." });
        void read();
      }} />}
      <ConfirmDialog
        open={confirm !== null}
        tone={confirm === "retire" ? "danger" : "primary"}
        title={confirm === "retire" ? "Retire this template?" : `Start version ${(template?.version ?? 0) + 1}?`}
        confirmLabel={confirm === "retire" ? "Retire it" : "Save as a new version"}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => (confirm === "retire" ? void retire() : void save(true))}
      >
        {confirm === "retire" ? (
          <p>It is no longer offered for new leases. Leases already made from it keep its wording.</p>
        ) : (
          <p>Your changes become a new draft version. It needs its own legal review and approval before it is offered; until then this version stays in use.</p>
        )}
      </ConfirmDialog>
    </>
  );
}

function swap<T>(items: T[], from: number, to: number): T[] {
  const copy = items.slice();
  [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}

/** `/admin/lease-templates/new` and `/admin/lease-templates/<id>` (SUPER_ADMIN, CONTENT_ADMIN). */
export function LeaseTemplateEditor({ templateId, countries }: { templateId: string | null; countries: { value: string; label: string }[] }) {
  return (
    <RoleGate roles={LEASE_TEMPLATE_ROLES} what="the lease templates">
      {() => <Editor templateId={templateId} countries={countries} />}
    </RoleGate>
  );
}
