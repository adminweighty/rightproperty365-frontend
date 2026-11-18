"use client";

import { Plus, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { sourceLabel, type ContactLabels } from "@/components/agent/contacts/shared";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import type { MarketingPermission } from "@/lib/api/contacts";
import { cleanList, emailProblem, phoneProblem, TAG_MAX } from "@/lib/contacts";

/*
 * The details of a contact: name, type, emails, phones, tags, source and
 * marketing permission. Used to add a contact (with its first stage, owner
 * and note in `extra`) and to edit one.
 */

const NAME_MAX = 200;

export type ContactDetails = {
  name: string;
  type: string;
  emails: string[];
  phones: string[];
  tags: string[];
  source: string;
  marketing: { granted: boolean; source: string };
};

export const emptyDetails = (): ContactDetails => ({
  name: "",
  type: "",
  emails: [""],
  phones: [""],
  tags: [],
  source: "",
  marketing: { granted: false, source: "" },
});

type Errors = Record<string, string>;

/** "emails[1]" -> "emails.1", "marketing_permission.source" -> "marketing.source": the form's own keys. */
function errorKey(field: string): string {
  const key = field.replace(/\[(\d+)\]/g, ".$1").replace(/^marketing_permission/, "marketing");
  return key;
}

/** The API's field errors in the form's keys. */
export function errorsFromFailure(failure: ApiFailure): Errors {
  const errors: Errors = {};
  for (const [field, message] of Object.entries(failure.fields ?? {})) errors[errorKey(field)] = message;
  return errors;
}

/** Checks before sending, in the same words as under the controls. */
export function validateDetails(details: ContactDetails, labels: ContactLabels): Errors {
  const errors: Errors = {};
  const name = details.name.trim();
  if (!name) errors.name = "Enter the contact’s name.";
  else if (name.length > NAME_MAX) errors.name = `A name can be at most ${NAME_MAX} characters.`;
  if (!details.type) errors.type = "Choose what kind of contact this is.";
  else if (Object.keys(labels.types).length > 0 && !labels.types[details.type]) errors.type = "Choose a type from the list.";
  details.emails.forEach((email, index) => {
    if (email.trim()) {
      const problem = emailProblem(email);
      if (problem) errors[`emails.${index}`] = problem;
    }
  });
  details.phones.forEach((phone, index) => {
    if (phone.trim()) {
      const problem = phoneProblem(phone);
      if (problem) errors[`phones.${index}`] = problem;
    }
  });
  return errors;
}

/** The body the API takes for these details. */
export function detailsBody(details: ContactDetails) {
  return {
    name: details.name.trim(),
    type: details.type,
    emails: cleanList(details.emails),
    phones: cleanList(details.phones),
    tags: cleanList(details.tags),
    ...(details.source ? { source: details.source } : {}),
    marketing_permission: { granted: details.marketing.granted, source: details.marketing.source.trim() },
  };
}

function ListEditor({
  id,
  label,
  noun,
  values,
  onChange,
  errors,
  type,
  autoComplete,
  inputMode,
  hint,
}: {
  id: string;
  label: string;
  /** "email address", "phone number". */
  noun: string;
  values: string[];
  onChange: (values: string[]) => void;
  errors: Errors;
  type: "email" | "tel";
  autoComplete: string;
  inputMode: "email" | "tel";
  hint?: string;
}) {
  const key = id.split("-").pop()!;
  const list = values.length ? values : [""];
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">
        {label} <span className="ml-1 font-normal text-subtle">(optional)</span>
      </legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <ul className="mt-2 space-y-2">
        {list.map((value, index) => {
          const controlId = `${id}-${index}`;
          const error = errors[`${key}.${index}`];
          return (
            <li key={index}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={controlId} className="sr-only">
                    {`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${index + 1}`}
                  </label>
                  <Input
                    id={controlId}
                    type={type}
                    inputMode={inputMode}
                    autoComplete={autoComplete}
                    value={value}
                    onChange={(event) => onChange(list.map((item, at) => (at === index ? event.target.value : item)))}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${controlId}-error` : undefined}
                  />
                </div>
                {list.length > 1 && (
                  <Button
                    variant="ghost"
                    className="w-11 shrink-0 px-0"
                    aria-label={`Remove ${noun} ${index + 1}`}
                    onClick={() => onChange(list.filter((_, at) => at !== index))}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {error && (
                <p id={`${controlId}-error`} className="mt-1 text-sm text-danger">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" className="mt-2" onClick={() => onChange([...list, ""])}>
        <Plus className="size-4" aria-hidden="true" />
        Add another {noun}
      </Button>
    </fieldset>
  );
}

function TagEditor({ id, tags, onChange }: { id: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const hint = "Short words your team uses, such as “cash buyer” or “Harare”. Press Enter or “Add tag”.";

  function add() {
    const tag = draft.trim();
    if (!tag) return;
    if (tag.length > TAG_MAX) {
      setError(`A tag can be at most ${TAG_MAX} characters.`);
      return;
    }
    setError(undefined);
    onChange(cleanList([...tags, tag]));
    setDraft("");
    input.current?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag instead of sending the form.
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div>
      <Field id={id} label="Tags" optional hint={hint} error={error}>
        <div className="flex gap-2">
          <Input
            ref={input}
            id={id}
            value={draft}
            maxLength={TAG_MAX + 10}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKey}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy(id, { hint, error })}
          />
          <Button variant="secondary" className="shrink-0" onClick={add}>
            Add tag
          </Button>
        </div>
      </Field>
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags added">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line-strong bg-surface pl-4 text-sm text-ink">
                {tag}
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onChange(tags.filter((item) => item !== tag))}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function recordedBy(value: MarketingPermission["recorded_by"]): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.name;
}

/** "Granted 12 Nov 2026, 14:05 by Rudo Moyo · source: signed form", or "Not granted". */
export function MarketingSummary({ marketing }: { marketing: MarketingPermission | null | undefined }) {
  if (!marketing) return <p className="text-sm text-muted">No marketing permission recorded.</p>;
  const by = recordedBy(marketing.recorded_by);
  return (
    <p className="text-sm text-ink">
      <Badge tone={marketing.granted ? "success" : "neutral"}>{marketing.granted ? "Agreed to marketing" : "No marketing"}</Badge>{" "}
      {marketing.granted_at && <span className="text-muted">Recorded {formatWhen(marketing.granted_at)}</span>}
      {by && <span className="text-muted"> by {by}</span>}
      {marketing.source && <span className="text-muted"> · how: {marketing.source}</span>}
    </p>
  );
}

type Props = {
  idPrefix: string;
  initial: ContactDetails;
  labels: ContactLabels;
  submitLabel: string;
  busyLabel: string;
  /** Sends the details; resolves to the API's failure, or null when it worked. */
  onSubmit: (details: ContactDetails) => Promise<ApiFailure | null>;
  disabled?: boolean;
  /** Fields only the new-contact form has (stage, owner, first note), under the details. */
  extra?: ReactNode;
  /** The marketing permission as stored, shown above its checkbox. */
  marketing?: MarketingPermission | null;
  /** Shown above the submit button: the duplicate banner. */
  banner?: ReactNode;
  successText?: string;
};

export function ContactForm({ idPrefix, initial, labels, submitLabel, busyLabel, onSubmit, disabled, extra, marketing, banner, successText }: Props) {
  const [details, setDetails] = useState<ContactDetails>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const uid = useId();
  const id = (name: string) => `${idPrefix}-${name}`;
  const set = (patch: Partial<ContactDetails>) => {
    setDetails((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const typeOptions: SelectOption[] = [
    { value: "", label: "Choose a type…" },
    ...Object.entries(labels.types).map(([value, label]) => ({ value, label })),
  ];
  if (details.type && !labels.types[details.type]) typeOptions.push({ value: details.type, label: details.type });
  const sourceOptions: SelectOption[] = [
    { value: "", label: "Not recorded" },
    ...Object.entries(labels.sources).map(([value, label]) => ({ value, label })),
  ];
  if (details.source && !labels.sources[details.source]) {
    sourceOptions.push({ value: details.source, label: sourceLabel(labels, details.source) });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setSaved(false);
    const found = validateDetails(details, labels);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      summary.current?.focus();
      return;
    }
    setPending(true);
    const answer = await onSubmit(details);
    setPending(false);
    if (!answer) {
      setSaved(true);
      return;
    }
    const fieldErrors = errorsFromFailure(answer);
    setErrors(fieldErrors);
    // A duplicate is shown by the banner, not as a failure.
    if (answer.code !== "CONTACT_DUPLICATE") setFailure(answer);
    summary.current?.focus();
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby={`${uid}-summary`}>
      <div ref={summary} id={`${uid}-summary`} tabIndex={-1} className="outline-none">
        {errorCount > 0 && (
          <Alert title={errorCount === 1 ? "Check the field marked below." : `Check the ${errorCount} fields marked below.`} />
        )}
      </div>
      {/* Disabled for Agency Staff: every control inside, the add and remove buttons too. */}
      <fieldset disabled={disabled} className="min-w-0">
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <Field id={id("name")} label="Name" error={errors.name}>
          <Input
            id={id("name")}
            autoComplete="off"
            maxLength={NAME_MAX + 20}
            value={details.name}
            onChange={(event) => set({ name: event.target.value })}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={fieldDescribedBy(id("name"), { error: errors.name })}
            disabled={disabled}
          />
        </Field>
        <Field id={id("type")} label="Type" error={errors.type}>
          <SearchableSelect
            id={id("type")}
            options={typeOptions}
            value={details.type}
            onValueChange={(type) => set({ type })}
            aria-invalid={Boolean(errors.type)}
            aria-describedby={fieldDescribedBy(id("type"), { error: errors.type })}
            disabled={disabled}
          />
        </Field>
        <ListEditor
          id={id("emails")}
          label="Email addresses"
          noun="email address"
          values={details.emails}
          onChange={(emails) => set({ emails })}
          errors={errors}
          type="email"
          inputMode="email"
          autoComplete="off"
        />
        <ListEditor
          id={id("phones")}
          label="Phone numbers"
          noun="phone number"
          hint="With the country code: +263 77 123 4567."
          values={details.phones}
          onChange={(phones) => set({ phones })}
          errors={errors}
          type="tel"
          inputMode="tel"
          autoComplete="off"
        />
        <TagEditor id={id("tags")} tags={details.tags} onChange={(tags) => set({ tags })} />
        <Field id={id("source")} label="Where they came from" optional error={errors.source}>
          <SearchableSelect
            id={id("source")}
            options={sourceOptions}
            value={details.source}
            onValueChange={(source) => set({ source })}
            aria-invalid={Boolean(errors.source)}
            aria-describedby={fieldDescribedBy(id("source"), { error: errors.source })}
            disabled={disabled}
          />
        </Field>
      </div>

      <fieldset className="mt-6 rounded-md border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">Marketing permission</legend>
        {marketing !== undefined && <MarketingSummary marketing={marketing} />}
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={details.marketing.granted}
            onChange={(event) => set({ marketing: { ...details.marketing, granted: event.target.checked } })}
            disabled={disabled}
          />
          <span className="text-ink">They agreed to receive marketing from your organisation</span>
        </label>
        <Field
          id={id("marketing-source")}
          label="How they agreed"
          optional
          hint="For example “signed form at the viewing” or “said yes on the phone”. The date and who recorded it are kept."
          error={errors["marketing.source"]}
          className="mt-2"
        >
          <Input
            id={id("marketing-source")}
            maxLength={200}
            value={details.marketing.source}
            onChange={(event) => set({ marketing: { ...details.marketing, source: event.target.value } })}
            aria-invalid={Boolean(errors["marketing.source"])}
            aria-describedby={fieldDescribedBy(id("marketing-source"), {
              error: errors["marketing.source"],
              hint: "For example “signed form at the viewing” or “said yes on the phone”. The date and who recorded it are kept.",
            })}
            disabled={disabled}
          />
        </Field>
      </fieldset>
      </fieldset>

      {extra && <div className="mt-6">{extra}</div>}

      {banner && <div className="mt-6">{banner}</div>}

      {!disabled && (
        <Button type="submit" size="lg" className="mt-6" disabled={pending} aria-busy={pending}>
          {pending ? busyLabel : submitLabel}
        </Button>
      )}
      <div aria-live="polite" className="mt-3">
        {saved && successText && <Alert tone="success" title={successText} />}
        {failure && <Alert title={failure.message} traceId={failure.traceId} />}
      </div>
    </form>
  );
}
