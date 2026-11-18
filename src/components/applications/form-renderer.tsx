"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/cn";
import {
  dateLimits,
  dayText,
  maxLengthFor,
  numberAnswer,
  visibleKeys,
  type AnswerValue,
  type Answers,
  type FormField,
  type FormSection,
} from "@/lib/questionnaires";

/*
 * A questionnaire as the applicant fills it in: sections as cards, each
 * question with its own control, and questions whose `visible_if` is not met
 * left out. Used by the apply page and by the form builder's preview, so both
 * show exactly the same thing.
 */

/** Up to this many choices are radio buttons, all visible; more are a SearchableSelect. */
const RADIO_MAX = 5;

const choiceRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-sunken has-checked:border-primary has-checked:bg-tint has-disabled:cursor-not-allowed has-disabled:opacity-60";

export const questionId = (prefix: string, key: string) => `${prefix}-q-${key}`;

function hintFor(field: FormField): string | undefined {
  const parts: string[] = [];
  if (field.help) parts.push(field.help);
  if (field.type === "number") {
    const min = field.min ?? null;
    const max = field.max ?? null;
    if (min !== null && max !== null) parts.push(`From ${min} to ${max}.`);
    else if (min !== null) parts.push(`${min} or more.`);
    else if (max !== null) parts.push(`${max} or less.`);
  }
  if (field.type === "date") {
    const days = dateLimits(field);
    if (days.min) parts.push(`${dayText(days.min)} or later.`);
    if (days.max) parts.push(`${dayText(days.max)} or earlier.`);
  }
  if (field.type === "multiple_choice") {
    if (field.min && field.max) parts.push(`Choose ${field.min} to ${field.max}.`);
    else if (field.min) parts.push(`Choose at least ${field.min}.`);
    else if (field.max) parts.push(`Choose up to ${field.max}.`);
    else parts.push("Choose all that apply.");
  }
  if ((field.type === "short_text" || field.type === "long_text") && field.max_length) parts.push(`Up to ${field.max_length} characters.`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

type QuestionProps = {
  field: FormField;
  value: AnswerValue | undefined;
  error?: string;
  disabled?: boolean;
  /** Ids of every control start with this, so two forms on a page never clash. */
  idPrefix: string;
  onChange: (value: AnswerValue) => void;
  /** Typing has stopped in a text box (saves at once instead of waiting). */
  onBlur?: () => void;
  /** The control for a file question; without it a note says files are added on the application page. */
  renderFile?: (field: FormField, describedBy: string | undefined) => ReactNode;
};

/** One question and its control, label, hint and error. */
export function Question({ field, value, error, disabled, idPrefix, onChange, onBlur, renderFile }: QuestionProps) {
  const id = questionId(idPrefix, field.key);
  const hint = hintFor(field);
  const describedBy = fieldDescribedBy(id, { hint, error });
  const optional = !field.required;
  const text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);

  if (field.type === "single_choice" || field.type === "multiple_choice" || field.type === "file") {
    const options = field.options ?? [];
    if (field.type === "single_choice" && options.length > RADIO_MAX) {
      return (
        <Field id={id} label={field.label || "Untitled question"} hint={hint} error={error} optional={optional}>
          <SearchableSelect
            id={id}
            options={[{ value: "", label: "Choose…" }, ...options.map((option) => ({ value: option.value, label: option.label }))]}
            value={typeof value === "string" ? value : ""}
            onValueChange={(next) => onChange(next || null)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
          />
        </Field>
      );
    }
    const chosen = Array.isArray(value) ? value.map(String) : value === null || value === undefined ? [] : [String(value)];
    return (
      <fieldset id={id} tabIndex={-1} aria-describedby={describedBy} aria-invalid={Boolean(error) || undefined} className="min-w-0 outline-none">
        <legend className="text-sm font-medium text-ink">
          {field.label || "Untitled question"}
          {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
        </legend>
        {hint && (
          <p id={`${id}-hint`} className={cn("mt-1 text-sm text-muted", error && "sr-only")}>
            {hint}
          </p>
        )}
        {field.type === "file" ? (
          <div className="mt-2">
            {renderFile ? (
              renderFile(field, describedBy)
            ) : (
              <p className="rounded-md border border-dashed border-line-strong p-3 text-sm text-muted">
                Applicants upload files here. Nothing is uploaded from the preview.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            {options.map((option, index) => (
              <label key={`${option.value}-${index}`} className={choiceRow}>
                <input
                  type={field.type === "single_choice" ? "radio" : "checkbox"}
                  name={id}
                  value={option.value}
                  checked={chosen.includes(option.value)}
                  disabled={disabled}
                  onChange={(event) => {
                    if (field.type === "single_choice") onChange(option.value);
                    else {
                      const next = event.currentTarget.checked ? [...chosen, option.value] : chosen.filter((item) => item !== option.value);
                      // Kept in the question's own order.
                      onChange(options.map((item) => item.value).filter((item) => next.includes(item)));
                    }
                  }}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="text-ink">{option.label || option.value}</span>
              </label>
            ))}
            {field.type === "single_choice" && !field.required && chosen.length > 0 && !disabled && (
              <button type="button" onClick={() => onChange(null)} className="min-h-11 justify-self-start rounded-md px-1 text-sm font-medium text-primary-ink hover:underline">
                Clear the answer
                <span className="sr-only"> to {field.label}</span>
              </button>
            )}
          </div>
        )}
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <Field id={id} label={field.label || "Untitled question"} hint={hint} error={error} optional={optional}>
      {field.type === "long_text" ? (
        <Textarea
          id={id}
          rows={5}
          value={text}
          maxLength={maxLengthFor(field)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={field.required || undefined}
        />
      ) : field.type === "number" ? (
        <NumberBox
          id={id}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
          invalid={Boolean(error)}
          describedBy={describedBy}
          required={field.required}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : "text"}
          autoComplete="off"
          value={text}
          min={field.type === "date" ? (dateLimits(field).min ?? undefined) : undefined}
          max={field.type === "date" ? (dateLimits(field).max ?? undefined) : undefined}
          maxLength={field.type === "short_text" ? maxLengthFor(field) : undefined}
          disabled={disabled}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? null : next);
          }}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={field.required || undefined}
          className={field.type === "date" ? "max-w-xs" : undefined}
        />
      )}
    </Field>
  );
}

/**
 * A number typed as text, so "1." or "1,200" stay as typed while the answer
 * is the number (or the text itself, which the checks then refuse).
 */
function NumberBox({
  id,
  value,
  disabled,
  onChange,
  onBlur,
  invalid,
  describedBy,
  required,
}: {
  id: string;
  value: AnswerValue | undefined;
  disabled?: boolean;
  onChange: (value: AnswerValue) => void;
  onBlur?: () => void;
  invalid: boolean;
  describedBy?: string;
  required: boolean;
}) {
  const outside = value === null || value === undefined ? "" : String(value);
  const [text, setText] = useState(outside);
  // A value set from outside (a reload) replaces what is shown, unless it is what was typed.
  const [seen, setSeen] = useState(outside);
  if (outside !== seen) {
    setSeen(outside);
    if (String(numberAnswer(text) ?? "") !== outside) setText(outside);
  }
  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={disabled}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setText(next);
        onChange(numberAnswer(next));
      }}
      onBlur={onBlur}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className="max-w-xs"
    />
  );
}

type SectionsProps = Omit<QuestionProps, "field" | "value" | "error" | "onChange"> & {
  sections: FormSection[];
  answers: Answers;
  errors?: Record<string, string>;
  onAnswer: (key: string, value: AnswerValue) => void;
  /** The heading level of each section's title. */
  headingLevel?: 2 | 3;
};

/** Every section with its shown questions. A section with none shown is left out. */
export function FormSections({ sections, answers, errors = {}, onAnswer, headingLevel = 2, idPrefix, ...rest }: SectionsProps) {
  const shown = visibleKeys({ sections }, answers);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="grid gap-6">
      {sections.map((section, index) => {
        const fields = section.fields.filter((field) => shown.has(field.key));
        if (fields.length === 0) return null;
        const headingId = `${idPrefix}-section-${index}`;
        return (
          <section key={`${section.key}-${index}`} aria-labelledby={headingId}>
            <Card>
              <Heading id={headingId} className={headingLevel === 2 ? "text-2xl" : "text-xl"}>
                {section.title || `Section ${index + 1}`}
              </Heading>
              {section.description && <p className="mt-1 whitespace-pre-line text-sm text-muted">{section.description}</p>}
              <div className="mt-5 grid gap-6">
                {fields.map((field) => (
                  <Question
                    key={field.key}
                    field={field}
                    value={answers[field.key]}
                    error={errors[field.key]}
                    idPrefix={idPrefix}
                    onChange={(value) => onAnswer(field.key, value)}
                    {...rest}
                  />
                ))}
              </div>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
