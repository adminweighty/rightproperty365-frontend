"use client";

import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { FormSections } from "@/components/applications/form-renderer";
import { managesForms, OrganisationShell, withOrg } from "@/components/applications/organisation-shell";
import { FORM_STATUS, FORMS_PATH } from "@/components/forms/form-list";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import {
  createForm,
  getForm,
  listForms,
  publishForm,
  retireForm,
  updateForm,
  type QuestionnaireForm,
} from "@/lib/api/applications";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { cn } from "@/lib/cn";
import {
  changeFieldType,
  definitionProblems,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  FILE_TYPE_LABELS,
  FILE_TYPES,
  FILES_MAX,
  isChoiceType,
  isTextType,
  keyFromLabel,
  makeVisibleIf,
  moveItem,
  newField,
  newSection,
  RETENTION_MAX,
  RETENTION_MIN,
  uniqueKey,
  usedKeys,
  visibleIfCandidates,
  visibleIfValues,
  type Answers,
  type DefinitionProblem,
  type FieldType,
  type FormDefinition,
  type FormField,
  type FormSection,
} from "@/lib/questionnaires";

/*
 * The form builder (FR-017): one draft version of an application form,
 * edited section by section and saved automatically, with a preview that is
 * the apply page's own renderer, the checks the API runs before a publish,
 * and the API's sensitive-data warnings (FR-018) shown before and after it.
 */

type Option = SelectOption;

// ---- The draft as the builder holds it ---------------------------------------------------

/** A question with a stable id, so typing a new key never remounts its editor. */
type DraftField = FormField & { uid: string; keyTouched?: boolean };
type DraftSection = Omit<FormSection, "fields"> & { uid: string; fields: DraftField[] };
type Draft = Omit<FormDefinition, "sections"> & { sections: DraftSection[] };

let uidCounter = 0;
const uid = () => `u${(uidCounter += 1)}`;

function toDraft(form: QuestionnaireForm): Draft {
  return {
    name: form.name,
    market_code: form.market_code,
    purpose: form.purpose,
    privacy_notice: form.privacy_notice,
    retention_days: form.retention_days,
    expires_at: form.expires_at ?? null,
    sections: form.sections.map((section) => ({
      ...section,
      uid: uid(),
      fields: section.fields.map((field) => ({ ...field, uid: uid(), keyTouched: true })),
    })),
  };
}

/** What is sent: no builder ids, no empty settings. */
function toDefinition(draft: Draft): FormDefinition {
  return {
    name: draft.name.trim(),
    market_code: draft.market_code,
    purpose: draft.purpose,
    privacy_notice: draft.privacy_notice,
    retention_days: draft.retention_days,
    expires_at: draft.expires_at || null,
    sections: draft.sections.map((section) => ({
      key: section.key,
      title: section.title,
      description: section.description,
      fields: section.fields.map((field) => {
        const clean: FormField & { uid?: string; keyTouched?: boolean } = { ...field };
        delete clean.uid;
        delete clean.keyTouched;
        for (const name of Object.keys(clean) as (keyof FormField)[]) {
          if (clean[name] === null || clean[name] === undefined || clean[name] === "") delete clean[name];
        }
        clean.required = field.required === true;
        if (!isChoiceType(field.type)) delete clean.options;
        if (field.type !== "file") {
          delete clean.accept;
          delete clean.max_files;
        }
        if (!isTextType(field.type)) {
          delete clean.min_length;
          delete clean.max_length;
        }
        if (field.type !== "number" && field.type !== "multiple_choice") {
          delete clean.min;
          delete clean.max;
        }
        if (field.type !== "date") {
          delete clean.min_date;
          delete clean.max_date;
        }
        return clean;
      }),
    })),
  };
}

const fieldDomId = (field: { uid: string }, part = "label") => `field-${field.uid}-${part}`;

/** The element a problem points at. */
function problemTarget(problem: DefinitionProblem, draft: Draft): { id: string; open?: string } {
  const [kind, ref, part] = problem.path.split(".");
  if (kind === "form") {
    const ids: Record<string, string> = {
      name: "form-name",
      market_code: "form-market",
      purpose: "form-purpose",
      privacy_notice: "form-privacy",
      retention_days: "form-retention",
      sections: "add-section",
    };
    return { id: ids[ref] ?? "form-name" };
  }
  if (kind === "section") {
    const section = draft.sections[Number(ref)];
    return { id: section ? `section-${section.uid}-title` : "add-section" };
  }
  const field = draft.sections.flatMap((section) => section.fields).find((item) => item.key === ref);
  if (!field) return { id: "form-name" };
  const parts: Record<string, string> = {
    key: "key",
    options: "options",
    accept: "accept",
    max_files: "max-files",
    visible_if: "condition",
    min: "min",
    max: "max",
    min_length: "min-length",
    max_length: "max-length",
  };
  return { id: fieldDomId(field, parts[part] ?? "label"), open: field.uid };
}

// ---- Small controls -----------------------------------------------------------------------

/** A whole number (or any number) typed as text; empty is null. */
function NumberSetting({
  id,
  label,
  value,
  onChange,
  hint,
  allowNegative = false,
  disabled,
  optional = true,
}: {
  id: string;
  label: string;
  value: number | string | null | undefined;
  onChange: (value: number | null) => void;
  hint?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  optional?: boolean;
}) {
  const outside = value === null || value === undefined ? "" : String(value);
  const [text, setText] = useState(outside);
  const [seen, setSeen] = useState(outside);
  if (outside !== seen) {
    setSeen(outside);
    if (text.trim() === "" ? outside !== "" : String(Number(text)) !== outside) setText(outside);
  }
  const invalid = text.trim() !== "" && (!Number.isFinite(Number(text)) || (!allowNegative && Number(text) < 0));
  const error = invalid ? (allowNegative ? "Enter a number." : "Enter a whole number, 0 or more.") : undefined;
  return (
    <Field id={id} label={label} optional={optional} hint={hint} error={error}>
      <Input
        id={id}
        inputMode={allowNegative ? "decimal" : "numeric"}
        autoComplete="off"
        value={text}
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setText(next);
          const number = Number(next);
          if (next.trim() === "") onChange(null);
          else if (Number.isFinite(number) && (allowNegative || number >= 0)) onChange(number);
        }}
        aria-invalid={invalid}
        aria-describedby={fieldDescribedBy(id, { hint, error })}
        className="max-w-[12rem]"
      />
    </Field>
  );
}

function IconButton({ label, onClick, disabled, children, id, onKeyDown }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; id?: string; onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="inline-flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// ---- Options of a choice question ---------------------------------------------------------

function OptionsEditor({ field, onChange }: { field: DraftField; onChange: (options: FormField["options"]) => void }) {
  const options = field.options ?? [];
  const set = (index: number, next: { value: string; label: string }) => onChange(options.map((option, i) => (i === index ? next : option)));
  return (
    <fieldset id={fieldDomId(field, "options")} tabIndex={-1} className="min-w-0 outline-none">
      <legend className="text-sm font-medium text-ink">Choices</legend>
      <p className="mt-1 text-sm text-muted">At least 2. The value is what is stored; applicants see the words.</p>
      <ol className="mt-3 grid gap-3">
        {options.map((option, index) => {
          const base = `${fieldDomId(field, "option")}-${index}`;
          return (
            <li key={index} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field id={`${base}-label`} label={`Choice ${index + 1}`}>
                <Input
                  id={`${base}-label`}
                  value={option.label}
                  maxLength={200}
                  onChange={(event) => {
                    const label = event.currentTarget.value;
                    const auto = option.value === "" || /^option_\d+$/.test(option.value) || option.value === keyFromLabel(option.label);
                    const taken = options.filter((_, i) => i !== index).map((item) => item.value);
                    set(index, { label, value: auto && label.trim() ? uniqueKey(keyFromLabel(label), taken) : option.value });
                  }}
                />
              </Field>
              <Field id={`${base}-value`} label="Value">
                <Input
                  id={`${base}-value`}
                  value={option.value}
                  maxLength={60}
                  spellCheck={false}
                  className="font-mono text-sm"
                  onChange={(event) => set(index, { ...option, value: event.currentTarget.value.replace(/\s+/g, "_") })}
                />
              </Field>
              <div className="flex gap-2">
                <IconButton label={`Move choice ${index + 1} up`} disabled={index === 0} onClick={() => onChange(moveItem(options, index, index - 1))}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton label={`Move choice ${index + 1} down`} disabled={index === options.length - 1} onClick={() => onChange(moveItem(options, index, index + 1))}>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton label={`Remove choice ${index + 1}`} onClick={() => onChange(options.filter((_, i) => i !== index))}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => {
          const values = options.map((option) => option.value);
          onChange([...options, { value: uniqueKey(`option_${options.length + 1}`, values), label: `Option ${options.length + 1}` }]);
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add a choice
      </Button>
    </fieldset>
  );
}

// ---- One question ---------------------------------------------------------------------------

type FieldEditorProps = {
  field: DraftField;
  position: number;
  count: number;
  sectionIndex: number;
  sections: DraftSection[];
  draft: Draft;
  open: boolean;
  onToggle: () => void;
  onChange: (next: DraftField) => void;
  onMove: (delta: number) => void;
  onMoveToSection: (sectionIndex: number) => void;
  onRemove: () => void;
};

function FieldEditor({ field, position, count, sectionIndex, sections, draft, open, onToggle, onChange, onMove, onMoveToSection, onRemove }: FieldEditorProps) {
  const name = field.label.trim() || `question ${position + 1}`;
  const candidates = visibleIfCandidates(toDefinition(draft), field.key);
  const controller = candidates.find((item) => item.key === field.visible_if?.field) ?? null;
  const values = visibleIfValues(field.visible_if);
  const otherKeys = usedKeys(draft).filter((key) => key !== field.key);
  const set = (patch: Partial<DraftField>) => onChange({ ...field, ...patch });

  // Alt+Up / Alt+Down on the row's controls move the question.
  function onRowKey(event: KeyboardEvent<HTMLElement>) {
    if (!event.altKey) return;
    if (event.key === "ArrowUp" && position > 0) {
      event.preventDefault();
      onMove(-1);
    } else if (event.key === "ArrowDown" && position < count - 1) {
      event.preventDefault();
      onMove(1);
    }
  }

  return (
    <li className={cn("rounded-lg border bg-surface", open ? "border-primary" : "border-line")} onKeyDown={onRowKey}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-medium tabular-nums text-muted" aria-hidden="true">
          {position + 1}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="break-words font-medium text-ink">{field.label.trim() || <span className="text-subtle">Untitled question</span>}</p>
          <p className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge>{FIELD_TYPE_LABELS[field.type]}</Badge>
            {field.required ? <Badge tone="primary">Required</Badge> : <Badge>Optional</Badge>}
            {field.visible_if && <Badge tone="accent">Conditional</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton id={fieldDomId(field, "up")} label={`Move ${name} up`} disabled={position === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton id={fieldDomId(field, "down")} label={`Move ${name} down`} disabled={position === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" aria-hidden="true" />
          </IconButton>
          <button
            type="button"
            id={fieldDomId(field, "toggle")}
            aria-expanded={open}
            aria-controls={fieldDomId(field, "settings")}
            onClick={onToggle}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-sunken"
          >
            {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            {open ? "Close" : "Edit"}
            <span className="sr-only"> {name}</span>
          </button>
          <IconButton label={`Remove ${name}`} onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {open && (
        <div id={fieldDomId(field, "settings")} className="grid gap-5 border-t border-line p-4">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id={fieldDomId(field, "label")} label="Question">
              <Input
                id={fieldDomId(field, "label")}
                value={field.label}
                maxLength={200}
                onChange={(event) => {
                  const label = event.currentTarget.value;
                  set({ label, key: field.keyTouched ? field.key : uniqueKey(keyFromLabel(label), otherKeys) });
                }}
              />
            </Field>
            <Field id={fieldDomId(field, "type")} label="Kind of answer">
              <SearchableSelect
                id={fieldDomId(field, "type")}
                options={FIELD_TYPES.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] }))}
                value={field.type}
                onValueChange={(type) => type && onChange({ ...changeFieldType(field, type as FieldType), uid: field.uid, keyTouched: field.keyTouched })}
              />
            </Field>
          </div>
          <Field id={fieldDomId(field, "help")} label="Help text" optional hint="One line under the question, such as an example.">
            <Input id={fieldDomId(field, "help")} value={field.help ?? ""} maxLength={300} onChange={(event) => set({ help: event.currentTarget.value })} aria-describedby={`${fieldDomId(field, "help")}-hint`} />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id={fieldDomId(field, "key")}
              label="Key"
              hint="Stored with every answer and used in exports. Letters a to z, digits and _."
            >
              <Input
                id={fieldDomId(field, "key")}
                value={field.key}
                maxLength={40}
                spellCheck={false}
                className="font-mono text-sm"
                onChange={(event) => set({ key: event.currentTarget.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"), keyTouched: true })}
                aria-describedby={`${fieldDomId(field, "key")}-hint`}
              />
            </Field>
            {sections.length > 1 && (
              <Field id={fieldDomId(field, "section")} label="Section">
                <SearchableSelect
                  id={fieldDomId(field, "section")}
                  options={sections.map((section, index) => ({ value: String(index), label: section.title || `Section ${index + 1}` }))}
                  value={String(sectionIndex)}
                  onValueChange={(value) => value !== "" && Number(value) !== sectionIndex && onMoveToSection(Number(value))}
                />
              </Field>
            )}
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
            <input type="checkbox" checked={field.required} onChange={(event) => set({ required: event.currentTarget.checked })} className="size-4 accent-primary" />
            <span className="text-ink">Applicants must answer it (when it is shown)</span>
          </label>

          {isTextType(field.type) && (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberSetting id={fieldDomId(field, "min-length")} label="Shortest answer, in characters" value={field.min_length} onChange={(value) => set({ min_length: value })} />
              <NumberSetting
                id={fieldDomId(field, "max-length")}
                label="Longest answer, in characters"
                value={field.max_length}
                onChange={(value) => set({ max_length: value })}
                hint={field.type === "short_text" ? "Up to 500. Without it, 200." : "Up to 10,000. Without it, 5,000."}
              />
            </div>
          )}
          {field.type === "number" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberSetting id={fieldDomId(field, "min")} label="Smallest value" value={field.min} allowNegative onChange={(value) => set({ min: value })} />
              <NumberSetting id={fieldDomId(field, "max")} label="Largest value" value={field.max} allowNegative onChange={(value) => set({ max: value })} />
            </div>
          )}
          {field.type === "date" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={fieldDomId(field, "min")} label="Earliest day" optional>
                <Input id={fieldDomId(field, "min")} type="date" value={field.min_date ?? ""} onChange={(event) => set({ min_date: event.currentTarget.value || null })} className="max-w-xs" />
              </Field>
              <Field id={fieldDomId(field, "max")} label="Latest day" optional>
                <Input id={fieldDomId(field, "max")} type="date" value={field.max_date ?? ""} onChange={(event) => set({ max_date: event.currentTarget.value || null })} className="max-w-xs" />
              </Field>
            </div>
          )}
          {isChoiceType(field.type) && <OptionsEditor field={field} onChange={(options) => set({ options })} />}
          {field.type === "multiple_choice" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberSetting id={fieldDomId(field, "min")} label="Fewest choices" value={field.min} onChange={(value) => set({ min: value })} />
              <NumberSetting id={fieldDomId(field, "max")} label="Most choices" value={field.max} onChange={(value) => set({ max: value })} />
            </div>
          )}
          {field.type === "file" && (
            <>
              <fieldset id={fieldDomId(field, "accept")} tabIndex={-1} className="min-w-0 outline-none">
                <legend className="text-sm font-medium text-ink">File types accepted</legend>
                <p className="mt-1 text-sm text-muted">Up to 10 MB a file. Ask only for the documents you need.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {FILE_TYPES.map((code) => {
                    const accept = (field.accept ?? []).map((item) => item.toLowerCase());
                    return (
                      <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
                        <input
                          type="checkbox"
                          checked={accept.includes(code)}
                          onChange={(event) => set({ accept: event.currentTarget.checked ? [...accept, code] : accept.filter((item) => item !== code) })}
                          className="size-4 accent-primary"
                        />
                        <span className="text-ink">{FILE_TYPE_LABELS[code]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <NumberSetting
                id={fieldDomId(field, "max-files")}
                label="Most files"
                optional={false}
                value={field.max_files ?? 1}
                onChange={(value) => set({ max_files: value })}
                hint={`1 to ${FILES_MAX}.`}
              />
            </>
          )}

          <fieldset className="min-w-0 rounded-md border border-line p-4">
            <legend className="px-1 text-sm font-medium text-ink">When to ask it</legend>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted">Always asked. To ask it only after a certain answer, put a question with choices before it.</p>
            ) : (
              <div className="grid gap-4">
                <Field id={fieldDomId(field, "condition")} label="Ask this question">
                  <SearchableSelect
                    id={fieldDomId(field, "condition")}
                    options={[
                      { value: "", label: "Always" },
                      ...candidates.map((item) => ({ value: item.key, label: `Only after “${item.label || item.key}”`, keywords: [item.key] })),
                    ]}
                    value={controller?.key ?? ""}
                    onValueChange={(key) => set({ visible_if: key ? makeVisibleIf(key, []) ?? { field: key } : null })}
                  />
                </Field>
                {field.visible_if && !controller && (
                  <p className="text-sm text-danger">It depends on a question that is no longer before it. Choose again.</p>
                )}
                {controller && (
                  <fieldset className="min-w-0">
                    <legend className="text-sm font-medium text-ink">… when the answer is</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(controller.options ?? []).map((option) => (
                        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
                          <input
                            type="checkbox"
                            checked={values.includes(option.value)}
                            onChange={(event) => {
                              const next = event.currentTarget.checked ? [...values, option.value] : values.filter((item) => item !== option.value);
                              set({ visible_if: makeVisibleIf(controller.key, next) ?? { field: controller.key } });
                            }}
                            className="size-4 accent-primary"
                          />
                          <span className="text-ink">{option.label || option.value}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-muted">A question that is not asked is never required, and any answer to it is dropped.</p>
                  </fieldset>
                )}
              </div>
            )}
          </fieldset>
        </div>
      )}
    </li>
  );
}

// ---- The editor -----------------------------------------------------------------------------

type SaveState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "saving" }
  | { status: "saved"; at: Date }
  | { status: "failed"; failure: ApiFailure };

type Session = { draft: Draft | null; dirty: boolean; inFlight: boolean; again: boolean; timer: ReturnType<typeof setTimeout> | undefined };

const timeText = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(at);

function isoToDay(iso: string | null | undefined) {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The end of a local day, as the instant the form expires. */
const dayToIso = (day: string) => (day ? new Date(`${day}T23:59:59`).toISOString() : null);

function DetailsCard({ draft, countries, onChange, disabled }: { draft: Draft; countries: Option[]; onChange: (patch: Partial<Draft>) => void; disabled: boolean }) {
  return (
    <section aria-labelledby="form-details">
      <Card>
        <h2 id="form-details" className="text-2xl">
          About this form
        </h2>
        <p className="mt-1 text-sm text-muted">Applicants read the purpose and the privacy notice before they start.</p>
        <fieldset disabled={disabled} className="mt-5 grid min-w-0 gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="form-name" label="Name" hint="Seen by applicants, such as “Rental application”.">
              <Input id="form-name" value={draft.name} maxLength={120} onChange={(event) => onChange({ name: event.currentTarget.value })} aria-describedby="form-name-hint" />
            </Field>
            <Field id="form-market" label="Country" hint="It can be attached to listings in this country only.">
              <SearchableSelect
                id="form-market"
                options={[{ value: "", label: "Choose a country…" }, ...countries]}
                value={draft.market_code}
                onValueChange={(market_code) => onChange({ market_code })}
                disabled={disabled}
                aria-describedby="form-market-hint"
              />
            </Field>
          </div>
          <Field id="form-purpose" label="Purpose" hint="What the answers are used for, in one or two sentences.">
            <Textarea id="form-purpose" rows={3} value={draft.purpose} maxLength={1000} onChange={(event) => onChange({ purpose: event.currentTarget.value })} aria-describedby="form-purpose-hint" />
          </Field>
          <Field id="form-privacy" label="Privacy notice" hint="Who receives the answers, how long they are kept and how to ask for them to be deleted, as your market requires.">
            <Textarea id="form-privacy" rows={5} value={draft.privacy_notice} maxLength={5000} onChange={(event) => onChange({ privacy_notice: event.currentTarget.value })} aria-describedby="form-privacy-hint" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberSetting
              id="form-retention"
              label="Keep answers for, in days"
              optional={false}
              value={draft.retention_days}
              onChange={(retention_days) => onChange({ retention_days })}
              hint={`${RETENTION_MIN} to ${RETENTION_MAX}. Counted from when an application is decided or withdrawn; then answers and files are deleted.`}
              disabled={disabled}
            />
            <Field id="form-expires" label="Stop taking applications on" optional hint="After this day the form cannot be attached and its listings stop taking applications.">
              <Input
                id="form-expires"
                type="date"
                value={isoToDay(draft.expires_at)}
                onChange={(event) => onChange({ expires_at: dayToIso(event.currentTarget.value) })}
                aria-describedby="form-expires-hint"
                className="max-w-xs"
              />
            </Field>
          </div>
        </fieldset>
      </Card>
    </section>
  );
}

function Warnings({ warnings, title = "Check the sensitive questions" }: { warnings: string[]; title?: string }) {
  if (warnings.length === 0) return null;
  return (
    <div role="status" className="rounded-md border-l-4 border-warning bg-warning-soft p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-warning">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
        {warnings.map((warning, index) => (
          <li key={index}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

function Versions({ organisation, form }: { organisation: DashboardOrganisation; form: QuestionnaireForm }) {
  const [versions, setVersions] = useState<QuestionnaireForm[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listForms(organisation.id, { family_id: form.family_id }).then((result) => {
      if (!cancelled && result.ok) setVersions(result.data.filter((item) => item.family_id === form.family_id).sort((a, b) => b.version - a.version));
    });
    return () => {
      cancelled = true;
    };
  }, [organisation.id, form.family_id, form.status]);
  if (!versions || versions.length < 2) return null;
  return (
    <Card>
      <h2 className="text-lg">Versions</h2>
      <ol className="mt-2 grid gap-1">
        {versions.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            {item.id === form.id ? (
              <span className="inline-flex min-h-11 items-center font-medium text-ink" aria-current="page">
                Version {item.version}
              </span>
            ) : (
              <Link href={withOrg(`${FORMS_PATH}/${item.id}`, organisation.id)} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                Version {item.version}
              </Link>
            )}
            <Badge tone={FORM_STATUS[item.status].tone}>{FORM_STATUS[item.status].label}</Badge>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Editor({ organisation, formId, countries }: { organisation: DashboardOrganisation; formId: string; countries: Option[] }) {
  const router = useRouter();
  const [form, setForm] = useState<QuestionnaireForm | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"build" | "preview">("build");
  const [preview, setPreview] = useState<Answers>({});
  const [announce, setAnnounce] = useState("");
  const [showProblems, setShowProblems] = useState(false);
  const [dialog, setDialog] = useState<"publish" | "retire" | "version" | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "warning" | "danger"; title: string; warnings?: string[] } | null>(null);
  const session = useRef<Session>({ draft: null, dirty: false, inFlight: false, again: false, timer: undefined });
  const focusAfter = useRef<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const editable = Boolean(form && managesForms(organisation) && form.status === "DRAFT" && form.can_edit !== false && !form.locked);

  const setDraft = useCallback((next: Draft) => {
    session.current.draft = next;
    setDraftState(next);
  }, []);

  const read = useCallback(async () => {
    const result = await getForm(organisation.id, formId);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }
    setFailure(null);
    setForm(result.data);
    setDraft(toDraft(result.data));
    session.current.dirty = false;
  }, [organisation.id, formId, setDraft]);

  useEffect(() => {
    let cancelled = false;
    getForm(organisation.id, formId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.failure);
        return;
      }
      setForm(result.data);
      setDraft(toDraft(result.data));
    });
    return () => {
      cancelled = true;
    };
  }, [organisation.id, formId, setDraft]);

  // Focus moves to an element after the render that drew it (a moved question, a new one).
  useEffect(() => {
    if (!focusAfter.current) return;
    const element = document.getElementById(focusAfter.current);
    if (element) {
      element.focus();
      focusAfter.current = null;
    }
  });

  const flush = useCallback(async (): Promise<boolean> => {
    const s = session.current;
    for (;;) {
      clearTimeout(s.timer);
      if (!s.draft || !s.dirty) return true;
      if (s.inFlight) {
        s.again = true;
        return true;
      }
      s.inFlight = true;
      s.dirty = false;
      setSave({ status: "saving" });
      const result = await updateForm(organisation.id, formId, toDefinition(s.draft));
      s.inFlight = false;
      if (!result.ok) {
        s.dirty = true;
        setSave({ status: "failed", failure: result.failure });
        if (result.failure.status === 409) void read();
        return false;
      }
      // The draft on screen stays as typed; the saved version's warnings and dates come from the answer.
      setForm(result.data);
      if (!s.again && !s.dirty) {
        setSave({ status: "saved", at: new Date() });
        return true;
      }
      s.again = false;
    }
  }, [organisation.id, formId, read]);

  const change = useCallback(
    (next: Draft) => {
      setDraft(next);
      const s = session.current;
      s.dirty = true;
      setSave({ status: "pending" });
      clearTimeout(s.timer);
      s.timer = setTimeout(() => void flush(), 900);
    },
    [flush, setDraft],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (session.current.dirty || session.current.inFlight) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const problems = useMemo(() => (draft ? definitionProblems(toDefinition(draft)) : []), [draft]);

  if (failure && !form) {
    if (failure.status === 404) {
      return (
        <EmptyState title="We could not find that form" action={<ButtonLink href={withOrg(FORMS_PATH, organisation.id)} variant="secondary">Application forms</ButtonLink>}>
          It may belong to another organisation.
        </EmptyState>
      );
    }
    return <LoadError failure={failure} onRetry={() => void read()} />;
  }
  if (!form || !draft) return <LoadingBlock label="Loading the form" rows={4} />;

  const updateSections = (sections: DraftSection[]) => change({ ...draft, sections });

  const updateField = (sectionIndex: number, fieldIndex: number, next: DraftField) => {
    const previous = draft.sections[sectionIndex].fields[fieldIndex];
    let sections = draft.sections.map((section, i) =>
      i === sectionIndex ? { ...section, fields: section.fields.map((field, j) => (j === fieldIndex ? next : field)) } : section,
    );
    // A new key keeps the conditions that named the old one.
    if (previous.key !== next.key) {
      sections = sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => (field.visible_if?.field === previous.key ? { ...field, visible_if: { ...field.visible_if, field: next.key } } : field)),
      }));
    }
    updateSections(sections);
  };

  const moveField = (sectionIndex: number, fieldIndex: number, delta: number) => {
    const section = draft.sections[sectionIndex];
    const target = fieldIndex + delta;
    if (target < 0 || target >= section.fields.length) return;
    const field = section.fields[fieldIndex];
    updateSections(draft.sections.map((item, i) => (i === sectionIndex ? { ...item, fields: moveItem(item.fields, fieldIndex, target) } : item)));
    focusAfter.current = fieldDomId(field, delta < 0 ? (target === 0 ? "down" : "up") : target === section.fields.length - 1 ? "up" : "down");
    setAnnounce(`${field.label || "The question"} moved to position ${target + 1} of ${section.fields.length} in ${section.title || `section ${sectionIndex + 1}`}.`);
  };

  const moveFieldToSection = (sectionIndex: number, fieldIndex: number, toSection: number) => {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    updateSections(
      draft.sections.map((section, i) => {
        if (i === sectionIndex) return { ...section, fields: section.fields.filter((_, j) => j !== fieldIndex) };
        if (i === toSection) return { ...section, fields: [...section.fields, field] };
        return section;
      }),
    );
    focusAfter.current = fieldDomId(field, "section");
    setAnnounce(`${field.label || "The question"} moved to the end of ${draft.sections[toSection].title || `section ${toSection + 1}`}.`);
  };

  const removeField = (sectionIndex: number, fieldIndex: number) => {
    const field = draft.sections[sectionIndex].fields[fieldIndex];
    const dependants = draft.sections.flatMap((section) => section.fields).filter((item) => item.visible_if?.field === field.key);
    updateSections(
      draft.sections.map((section, i) => ({
        ...section,
        fields: section.fields
          .filter((_, j) => !(i === sectionIndex && j === fieldIndex))
          .map((item) => (item.visible_if?.field === field.key ? { ...item, visible_if: null } : item)),
      })),
    );
    focusAfter.current = `section-${draft.sections[sectionIndex].uid}-add`;
    setAnnounce(
      `${field.label || "The question"} removed.${dependants.length > 0 ? ` ${dependants.length === 1 ? "1 question that depended on it is" : `${dependants.length} questions that depended on it are`} now always asked.` : ""}`,
    );
  };

  const addField = (sectionIndex: number, type: FieldType) => {
    const field: DraftField = { ...newField(type, usedKeys(draft)), uid: uid() };
    updateSections(draft.sections.map((section, i) => (i === sectionIndex ? { ...section, fields: [...section.fields, field] } : section)));
    setOpen((current) => new Set(current).add(field.uid));
    focusAfter.current = fieldDomId(field, "label");
  };

  const addSection = () => {
    const section: DraftSection = { ...newSection(usedKeys(draft), ""), uid: uid(), fields: [] };
    updateSections([...draft.sections, section]);
    focusAfter.current = `section-${section.uid}-title`;
  };

  const moveSection = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draft.sections.length) return;
    const section = draft.sections[index];
    updateSections(moveItem(draft.sections, index, target));
    focusAfter.current = `section-${section.uid}-${delta < 0 ? (target === 0 ? "down" : "up") : target === draft.sections.length - 1 ? "up" : "down"}`;
    setAnnounce(`${section.title || "The section"} moved to position ${target + 1} of ${draft.sections.length}.`);
  };

  const removeSection = (index: number) => {
    const section = draft.sections[index];
    const removed = new Set(section.fields.map((field) => field.key));
    updateSections(
      draft.sections
        .filter((_, i) => i !== index)
        .map((item) => ({ ...item, fields: item.fields.map((field) => (field.visible_if && removed.has(field.visible_if.field) ? { ...field, visible_if: null } : field)) })),
    );
    focusAfter.current = "add-section";
    setAnnounce(`${section.title || "The section"} removed${section.fields.length ? ` with its ${section.fields.length === 1 ? "question" : `${section.fields.length} questions`}` : ""}.`);
  };

  function goToProblem(problem: DefinitionProblem) {
    if (!draft) return;
    const target = problemTarget(problem, draft);
    if (target.open) setOpen((current) => new Set(current).add(target.open as string));
    setView("build");
    focusAfter.current = target.id;
    // Already drawn: focus at once.
    const element = document.getElementById(target.id);
    if (element) {
      element.focus();
      focusAfter.current = null;
    }
  }

  async function startPublish() {
    setNotice(null);
    setActionError(undefined);
    const saved = await flush();
    if (!saved) return;
    if (problems.length > 0) {
      setShowProblems(true);
      goToProblem(problems[0]);
      return;
    }
    setDialog("publish");
  }

  async function runAction() {
    if (!form || !dialog) return;
    setActing(true);
    setActionError(undefined);
    if (dialog === "version") {
      const result = await updateForm(organisation.id, form.id, toDefinition(toDraft(form)));
      setActing(false);
      if (!result.ok) {
        setActionError(result.failure.message);
        return;
      }
      setDialog(null);
      router.push(withOrg(`${FORMS_PATH}/${result.data.id}`, organisation.id));
      return;
    }
    const result = dialog === "publish" ? await publishForm(organisation.id, form.id) : await retireForm(organisation.id, form.id);
    setActing(false);
    if (!result.ok) {
      setActionError(result.failure.fields ? Object.values(result.failure.fields).join(" ") || result.failure.message : result.failure.message);
      return;
    }
    const done = dialog;
    setDialog(null);
    setForm(result.data);
    setDraft(toDraft(result.data));
    setNotice(
      done === "publish"
        ? {
            tone: "success",
            title: `Version ${result.data.version} is published. Attach it to a listing to take applications.`,
            warnings: result.data.warnings.length > 0 ? result.data.warnings : form.warnings,
          }
        : { tone: "info", title: `Version ${result.data.version} is retired. Listings using it stop taking applications.` },
    );
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  const status = FORM_STATUS[form.status];
  const canManage = managesForms(organisation);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-sm text-muted">Version {form.version}</span>
        {form.market_code && <Badge tone="accent">{form.market_code}</Badge>}
      </div>
      <h1 className="mt-2 break-words text-3xl md:text-4xl">{draft.name.trim() || "Untitled form"}</h1>

      <div ref={noticeRef} tabIndex={-1} className="mt-4 grid gap-3 outline-none">
        {notice && (
          <Alert tone={notice.tone} title={notice.title}>
            {notice.warnings && notice.warnings.length > 0 && <Warnings warnings={notice.warnings} title="Sensitive questions to check" />}
          </Alert>
        )}
        {!canManage && <Alert tone="info" title={`You can read ${organisation.name}'s forms.`}>Its owner and managers change, publish and retire them.</Alert>}
        {canManage && form.status === "PUBLISHED" && (
          <Alert tone="info" title="This version is published and cannot change.">
            Applications are made on it as it is. To change the questions, make a new version: once you publish it, it replaces this one on every listing that uses it and this one is retired.
          </Alert>
        )}
        {form.status === "RETIRED" && <Alert tone="info" title="This version is retired.">It can no longer be attached to a listing. Applications made on it keep its questions.</Alert>}
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Show">
        <Button variant={view === "build" ? "primary" : "secondary"} aria-pressed={view === "build"} onClick={() => setView("build")}>
          {editable ? "Build" : "Questions"}
        </Button>
        <Button variant={view === "preview" ? "primary" : "secondary"} aria-pressed={view === "preview"} onClick={() => setView("preview")}>
          Preview
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="order-first grid content-start gap-4 lg:order-last lg:sticky lg:top-24 lg:self-start" aria-label="Saving and publishing">
          {editable && (
            <Card>
              <h2 className="text-lg">Saving</h2>
              <div role="status" className="mt-2 text-sm">
                {save.status === "idle" && <p className="text-muted">Changes are saved as you go.</p>}
                {save.status === "pending" && <p className="text-muted">Changes not saved yet…</p>}
                {save.status === "saving" && <p className="text-muted">Saving…</p>}
                {save.status === "saved" && <p className="text-success">All changes saved. Saved at {timeText(save.at)}.</p>}
                {save.status === "failed" && (
                  <div className="text-danger">
                    <p>{save.failure.message}</p>
                    {save.failure.fields && (
                      <ul className="mt-1 list-disc pl-5">
                        {Object.entries(save.failure.fields).map(([key, message]) => (
                          <li key={key}>{message}</li>
                        ))}
                      </ul>
                    )}
                    <Button variant="secondary" size="sm" className="mt-2" onClick={() => { session.current.dirty = true; void flush(); }}>
                      Try saving again
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
          {editable && (
            <Card>
              <h2 className="text-lg">{problems.length === 0 ? "Ready to publish" : "Before you publish"}</h2>
              {problems.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Every check passes. Publishing fixes this version: later changes start the next one.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted">{problems.length === 1 ? "1 thing to fix." : `${problems.length} things to fix.`}</p>
                  {(showProblems || problems.length <= 6) && (
                    <ul className="mt-2 grid gap-1" role={showProblems ? "alert" : undefined}>
                      {problems.map((problem, index) => (
                        <li key={`${problem.path}-${index}`}>
                          <button type="button" onClick={() => goToProblem(problem)} className="min-h-11 text-left text-sm font-medium text-primary-ink hover:underline">
                            {problem.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!showProblems && problems.length > 6 && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowProblems(true)}>
                      Show them
                    </Button>
                  )}
                </>
              )}
            </Card>
          )}
          {form.warnings.length > 0 && (
            <Card>
              <Warnings warnings={form.warnings} />
              <p className="mt-2 text-xs text-muted">A warning does not stop a publish. Collect government ID numbers and bank details only when you must.</p>
            </Card>
          )}
          {canManage && (
            <Card>
              <h2 className="text-lg">Actions</h2>
              <div className="mt-3 grid gap-2">
                {editable && (
                  <Button onClick={() => void startPublish()} disabled={save.status === "saving"}>
                    Publish this version
                  </Button>
                )}
                {(form.status === "PUBLISHED" || form.status === "RETIRED") && (
                  <Button variant={form.status === "PUBLISHED" ? "primary" : "secondary"} onClick={() => { setActionError(undefined); setDialog("version"); }}>
                    Make a new version
                  </Button>
                )}
                {form.status === "PUBLISHED" && (
                  <Button variant="danger" onClick={() => { setActionError(undefined); setDialog("retire"); }}>
                    Retire this version
                  </Button>
                )}
              </div>
            </Card>
          )}
          <Versions organisation={organisation} form={form} />
        </aside>

        <div className="grid min-w-0 content-start gap-6">
          {view === "preview" ? (
            <>
              <Card className="bg-soft">
                <h2 className="text-xl">What applicants see</h2>
                <p className="mt-1 text-sm text-muted">Answer as an applicant would: questions that depend on an answer appear and disappear. Nothing is saved.</p>
                {draft.purpose && (
                  <p className="mt-3 text-sm text-ink">
                    <span className="font-medium">Why we ask: </span>
                    {draft.purpose}
                  </p>
                )}
                {draft.privacy_notice && <p className="mt-2 whitespace-pre-line text-sm text-ink">{draft.privacy_notice}</p>}
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setPreview({})}>
                  Clear the preview answers
                </Button>
              </Card>
              {draft.sections.length === 0 ? (
                <p className="text-muted">No questions yet.</p>
              ) : (
                <FormSections sections={toDefinition(draft).sections} answers={preview} onAnswer={(key, value) => setPreview((current) => ({ ...current, [key]: value }))} idPrefix="preview" />
              )}
            </>
          ) : (
            <>
              <DetailsCard draft={draft} countries={countries} disabled={!editable} onChange={(patch) => change({ ...draft, ...patch })} />
              {draft.sections.map((section, sectionIndex) => (
                <SectionEditor
                  key={section.uid}
                  section={section}
                  index={sectionIndex}
                  draft={draft}
                  editable={editable}
                  open={open}
                  onToggle={(fieldUid) =>
                    setOpen((current) => {
                      const next = new Set(current);
                      if (next.has(fieldUid)) next.delete(fieldUid);
                      else next.add(fieldUid);
                      return next;
                    })
                  }
                  onSection={(next) => updateSections(draft.sections.map((item, i) => (i === sectionIndex ? next : item)))}
                  onMove={(delta) => moveSection(sectionIndex, delta)}
                  onRemove={() => removeSection(sectionIndex)}
                  onAddField={(type) => addField(sectionIndex, type)}
                  onField={(fieldIndex, next) => updateField(sectionIndex, fieldIndex, next)}
                  onMoveField={(fieldIndex, delta) => moveField(sectionIndex, fieldIndex, delta)}
                  onMoveFieldToSection={(fieldIndex, to) => moveFieldToSection(sectionIndex, fieldIndex, to)}
                  onRemoveField={(fieldIndex) => removeField(sectionIndex, fieldIndex)}
                />
              ))}
              {editable && (
                <Button id="add-section" variant="secondary" className="justify-self-start" onClick={addSection}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add a section
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === "publish" ? `Publish version ${form.version}?` : dialog === "retire" ? `Retire version ${form.version}?` : `Make version ${form.version + 1}?`}
        confirmLabel={dialog === "publish" ? "Yes, publish it" : dialog === "retire" ? "Yes, retire it" : "Make a new version"}
        busyLabel={dialog === "publish" ? "Publishing…" : dialog === "retire" ? "Retiring…" : "Making it…"}
        tone={dialog === "retire" ? "danger" : "primary"}
        busy={acting}
        error={actionError}
        onCancel={() => setDialog(null)}
        onConfirm={() => void runAction()}
      >
        {dialog === "publish" && (
          <>
            <p>
              Once published, this version cannot change. You can then attach it to listings in {draft.market_code || "its country"}
              {form.version > 1 && ". It replaces the published version on every listing that uses it, and that version is retired"}.
            </p>
            {form.warnings.length > 0 && (
              <div className="mt-3">
                <Warnings warnings={form.warnings} />
              </div>
            )}
          </>
        )}
        {dialog === "retire" && <p>It can no longer be attached, and listings that use it stop taking applications. Applications already made keep its questions.</p>}
        {dialog === "version" && <p>A draft copy of this version opens for you to change. Listings keep this version until you publish the new one; then it takes this one&rsquo;s place on them, and this one is retired.</p>}
      </ConfirmDialog>
    </>
  );
}

type SectionEditorProps = {
  section: DraftSection;
  index: number;
  draft: Draft;
  editable: boolean;
  open: Set<string>;
  onToggle: (fieldUid: string) => void;
  onSection: (next: DraftSection) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onAddField: (type: FieldType) => void;
  onField: (fieldIndex: number, next: DraftField) => void;
  onMoveField: (fieldIndex: number, delta: number) => void;
  onMoveFieldToSection: (fieldIndex: number, to: number) => void;
  onRemoveField: (fieldIndex: number) => void;
};

function SectionEditor({ section, index, draft, editable, open, onToggle, onSection, onMove, onRemove, onAddField, onField, onMoveField, onMoveFieldToSection, onRemoveField }: SectionEditorProps) {
  const [type, setType] = useState<FieldType>("short_text");
  const [confirming, setConfirming] = useState(false);
  const headingId = `section-${section.uid}-heading`;
  const name = section.title || `section ${index + 1}`;
  const count = draft.sections.length;

  if (!editable) {
    return (
      <section aria-labelledby={headingId}>
        <Card>
          <h2 id={headingId} className="text-2xl">
            {section.title || `Section ${index + 1}`}
          </h2>
          {section.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{section.description}</p>}
          <ol className="mt-4 grid gap-2">
            {section.fields.map((field, position) => (
              <li key={field.uid} className="rounded-md border border-line p-3">
                <p className="font-medium text-ink">
                  {position + 1}. {field.label || "Untitled question"}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{FIELD_TYPE_LABELS[field.type]}</Badge>
                  {field.required ? <Badge tone="primary">Required</Badge> : <Badge>Optional</Badge>}
                  {field.visible_if && <Badge tone="accent">Conditional</Badge>}
                </p>
                {isChoiceType(field.type) && (field.options ?? []).length > 0 && (
                  <p className="mt-1 text-sm text-muted">{(field.options ?? []).map((option) => option.label).join(" · ")}</p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={headingId} className="text-xl">
            Section {index + 1} of {count}
          </h2>
          <div className="flex gap-2">
            <IconButton id={`section-${section.uid}-up`} label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton id={`section-${section.uid}-down`} label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton label={`Remove ${name}`} onClick={() => (section.fields.length > 0 ? setConfirming(true) : onRemove())}>
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <div className="mt-4 grid gap-5">
          <Field id={`section-${section.uid}-title`} label="Section title">
            <Input id={`section-${section.uid}-title`} value={section.title} maxLength={120} onChange={(event) => onSection({ ...section, title: event.currentTarget.value })} />
          </Field>
          <Field id={`section-${section.uid}-description`} label="Introduction" optional>
            <Textarea id={`section-${section.uid}-description`} rows={2} value={section.description ?? ""} maxLength={1000} onChange={(event) => onSection({ ...section, description: event.currentTarget.value })} />
          </Field>
        </div>
        <h3 className="mt-6 font-sans text-base font-semibold tracking-normal">Questions</h3>
        {section.fields.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No questions in this section yet.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Move a question with its arrow buttons, or Alt and the up or down arrow key.</p>
            <ol className="mt-3 grid gap-3">
              {section.fields.map((field, fieldIndex) => (
                <FieldEditor
                  key={field.uid}
                  field={field}
                  position={fieldIndex}
                  count={section.fields.length}
                  sectionIndex={index}
                  sections={draft.sections}
                  draft={draft}
                  open={open.has(field.uid)}
                  onToggle={() => onToggle(field.uid)}
                  onChange={(next) => onField(fieldIndex, next)}
                  onMove={(delta) => onMoveField(fieldIndex, delta)}
                  onMoveToSection={(to) => onMoveFieldToSection(fieldIndex, to)}
                  onRemove={() => onRemoveField(fieldIndex)}
                />
              ))}
            </ol>
          </>
        )}
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            onAddField(type);
          }}
        >
          <Field id={`section-${section.uid}-new-type`} label="New question" className="w-full max-w-xs">
            <SearchableSelect
              id={`section-${section.uid}-new-type`}
              options={FIELD_TYPES.map((item) => ({ value: item, label: FIELD_TYPE_LABELS[item] }))}
              value={type}
              onValueChange={(value) => value && setType(value as FieldType)}
            />
          </Field>
          <Button id={`section-${section.uid}-add`} type="submit" variant="secondary">
            <Plus className="size-4" aria-hidden="true" />
            Add the question
          </Button>
        </form>
      </Card>
      <ConfirmDialog
        open={confirming}
        title={`Remove ${name}?`}
        confirmLabel="Yes, remove it"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      >
        Its {section.fields.length === 1 ? "question goes" : `${section.fields.length} questions go`} with it. This version is a draft, so nothing applicants sent is affected.
      </ConfirmDialog>
    </section>
  );
}

// ---- New form -------------------------------------------------------------------------------

function NewForm({ organisation, countries }: { organisation: DashboardOrganisation; countries: Option[] }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", market_code: organisation.market_code ?? "", purpose: "", privacy_notice: "", retention_days: 180 as number | null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);

  if (!managesForms(organisation)) {
    return <Alert tone="info" title={`Only ${organisation.name}'s owner and managers create application forms.`} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.name.trim()) found.name = "Give the form a name.";
    if (!values.market_code) found.market_code = "Choose the country the form is for.";
    if (!values.purpose.trim()) found.purpose = "Say what the answers are used for.";
    if (!values.privacy_notice.trim()) found.privacy_notice = "Write the privacy notice applicants read first.";
    const days = Number(values.retention_days);
    if (!Number.isInteger(days) || days < RETENTION_MIN || days > RETENTION_MAX) found.retention_days = `Enter ${RETENTION_MIN} to ${RETENTION_MAX} days.`;
    setErrors(found);
    setFailure(null);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`new-form-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const result = await createForm(organisation.id, {
      name: values.name.trim(),
      market_code: values.market_code,
      purpose: values.purpose.trim(),
      privacy_notice: values.privacy_notice.trim(),
      retention_days: days,
      sections: [{ key: "about_you", title: "About you", description: "", fields: [] }],
    });
    if (result.ok) {
      router.replace(withOrg(`${FORMS_PATH}/${result.data.id}`, organisation.id));
      return;
    }
    setBusy(false);
    if (result.failure.fields) setErrors(result.failure.fields);
    setFailure(result.failure);
  }

  const described = (name: string, hint?: string) => fieldDescribedBy(`new-form-${name}`, { hint, error: errors[name] });

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-5">
      {Object.keys(errors).length > 0 && <Alert title="Check the form before you continue." />}
      <Field id="new-form-name" label="Name" hint="Seen by applicants, such as “Rental application”." error={errors.name}>
        <Input id="new-form-name" value={values.name} maxLength={120} onChange={(event) => setValues({ ...values, name: event.currentTarget.value })} aria-invalid={Boolean(errors.name)} aria-describedby={described("name", "x")} />
      </Field>
      <Field id="new-form-market_code" label="Country" hint="It can be attached to listings in this country only." error={errors.market_code}>
        <SearchableSelect
          id="new-form-market_code"
          options={[{ value: "", label: "Choose a country…" }, ...countries]}
          value={values.market_code}
          onValueChange={(market_code) => setValues({ ...values, market_code })}
          aria-invalid={Boolean(errors.market_code)}
          aria-describedby={described("market_code", "x")}
        />
      </Field>
      <Field id="new-form-purpose" label="Purpose" hint="What the answers are used for, in one or two sentences." error={errors.purpose}>
        <Textarea id="new-form-purpose" rows={3} value={values.purpose} maxLength={1000} onChange={(event) => setValues({ ...values, purpose: event.currentTarget.value })} aria-invalid={Boolean(errors.purpose)} aria-describedby={described("purpose", "x")} />
      </Field>
      <Field id="new-form-privacy_notice" label="Privacy notice" hint="Who receives the answers, how long they are kept and how to ask for them to be deleted." error={errors.privacy_notice}>
        <Textarea id="new-form-privacy_notice" rows={5} value={values.privacy_notice} maxLength={5000} onChange={(event) => setValues({ ...values, privacy_notice: event.currentTarget.value })} aria-invalid={Boolean(errors.privacy_notice)} aria-describedby={described("privacy_notice", "x")} />
      </Field>
      <Field id="new-form-retention_days" label="Keep answers for, in days" hint={`${RETENTION_MIN} to ${RETENTION_MAX}, counted from when an application is decided or withdrawn.`} error={errors.retention_days}>
        <Input
          id="new-form-retention_days"
          inputMode="numeric"
          value={values.retention_days ?? ""}
          onChange={(event) => setValues({ ...values, retention_days: event.currentTarget.value === "" ? null : Number(event.currentTarget.value) })}
          aria-invalid={Boolean(errors.retention_days)}
          aria-describedby={described("retention_days", "x")}
          className="max-w-[12rem]"
        />
      </Field>
      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}
      <div>
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Creating…" : "Create the form"}
        </Button>
      </div>
    </form>
  );
}

/** `/agent/forms/<id>`: one version of a form, editable while it is a draft. */
export function FormEditor({ formId, countries }: { formId: string; countries: Option[] }) {
  return (
    <OrganisationShell
      path={`${FORMS_PATH}/${formId}`}
      back={{ href: FORMS_PATH, label: "Application forms" }}
      empty={{ title: "Application forms belong to an organisation", body: "Ask the Agency Principal to add you to the team." }}
    >
      {(organisation) => <Editor organisation={organisation} formId={formId} countries={countries} />}
    </OrganisationShell>
  );
}

/** `/agent/forms/new`: the name, country, purpose, privacy notice and retention; then the builder. */
export function NewFormPage({ countries }: { countries: Option[] }) {
  return (
    <OrganisationShell
      path={`${FORMS_PATH}/new`}
      title="New application form"
      back={{ href: FORMS_PATH, label: "Application forms" }}
      intro={<p>Start with what the form is for. You add the sections and questions next, and nothing is shown to applicants until you publish it.</p>}
      empty={{ title: "Application forms belong to an organisation", body: "Ask the Agency Principal to add you to the team." }}
    >
      {(organisation) => <NewForm organisation={organisation} countries={countries} />}
    </OrganisationShell>
  );
}
