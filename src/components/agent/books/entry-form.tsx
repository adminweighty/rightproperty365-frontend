"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  categoryOptions,
  ContactPicker,
  useCategories,
  useLedgerOptions,
  useListingOptions,
} from "@/components/agent/books/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import {
  BRANCH_MAX,
  currencyMinorUnits,
  DESCRIPTION_MAX,
  directionLabel,
  entryBody,
  entryFormProblems,
  entryTypeLabel,
  fixedDirection,
  FORM_ENTRY_TYPES,
  methodLabel,
  METHODS,
  NOTE_MAX,
  REASON_MAX,
  REFERENCE_MAX,
  categoriesFor,
  entryHref,
  isMemoType,
  type EntryForm,
} from "@/lib/ledger";

/*
 * The form that records an entry, a transfer or an opening balance, and the
 * same form pre-filled to correct an entry. Checked in the browser in the
 * words under each control (the amount against the currency's minor units);
 * the API's field errors land under the same controls; a summary with
 * `role="alert"` takes focus when something is wrong.
 */

const FIELD_ORDER = [
  "type",
  "direction",
  "category",
  "method",
  "transfer_to",
  "amount",
  "currency",
  "effective_date",
  "description",
  "reference",
  "contact_id",
  "listing_id",
  "branch",
  "notes",
  "reason",
] as const;

const FIELD_NAMES: Record<string, string> = {
  type: "Type",
  direction: "Money in or out",
  category: "Category",
  method: "Method",
  transfer_to: "Where the money went",
  amount: "Amount",
  currency: "Currency",
  effective_date: "Date",
  description: "Description",
  reference: "Reference",
  contact_id: "Contact",
  listing_id: "Listing",
  branch: "Branch",
  notes: "Notes",
  reason: "Why",
};

const controlId = (key: string) => `entry-${key.replace(/_/g, "-")}`;

function amountHint(currency: string, minorUnits?: number) {
  const units = typeof minorUnits === "number" ? minorUnits : currencyMinorUnits(currency || "USD");
  const unit = units === 0 ? "a whole number, no decimal places" : `up to ${units} decimal place${units === 1 ? "" : "s"}`;
  return `In ${currency || "the currency"}: ${unit}. Figures only, with a full stop for the decimals.`;
}

type Props = {
  org: string;
  initial: EntryForm;
  currencies: SelectOption[];
  mode: "create" | "correct";
  /** The contact already linked, for its name before anyone searches. */
  contactLabel?: string | null;
  /** The words for the entry a payment settles ("receivable of USD 250.00"). */
  settlesLabel?: string | null;
  submitLabel: string;
  busyLabel: string;
  send: (body: Record<string, unknown>) => Promise<ApiResult<unknown>>;
  onSent: (data: unknown) => void;
  onCancel?: () => void;
};

export function EntryEditor({ org, initial, currencies, mode, contactLabel, settlesLabel, submitLabel, busyLabel, send, onSent, onCancel }: Props) {
  const [form, setForm] = useState<EntryForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [contactName, setContactName] = useState<string | null>(contactLabel ?? null);
  const summary = useRef<HTMLDivElement>(null);
  const categories = useCategories(org);
  const listings = useListingOptions();
  const options = useLedgerOptions(org);
  const types = options?.types.length ? options.types : undefined;
  const minorUnits = options?.minorUnits ?? {};
  const kind = form.kind;
  const memo = kind === "entry" && isMemoType(form.type);
  const hint = amountHint(form.currency, minorUnits[form.currency]);

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    const apiKey = key === "effectiveDate" ? "effective_date" : key === "contactId" ? "contact_id" : key === "listingId" ? "listing_id" : key === "transferToMethod" || key === "transferToBranch" ? "transfer_to" : key;
    if (errors[apiKey]) setErrors((current) => ({ ...current, [apiKey]: "" }));
  };

  const fixed = kind === "entry" ? fixedDirection(form.type, types) : kind === "transfer" ? "OUT" : null;
  /** A new type brings its default category, unless one was chosen. */
  const chooseType = (type: string) => {
    const fallback = types?.find((item) => item.code === type)?.category ?? "";
    setForm((current) => ({ ...current, type, category: current.category && current.category !== types?.find((item) => item.code === current.type)?.category ? current.category : fallback }));
    if (errors.type) setErrors((current) => ({ ...current, type: "" }));
  };
  const currencyOptions = currencies.some((option) => option.value === form.currency) ? currencies : [...currencies, { value: form.currency, label: form.currency }];
  const typeCodes = types ? types.map((item) => item.code).filter((code) => code !== "TRANSFER" && code !== "OPENING_BALANCE") : [...FORM_ENTRY_TYPES];
  const typeOptions: SelectOption[] = typeCodes.map((type) => {
    const direction = fixedDirection(type, types);
    return {
      value: type,
      label: types?.find((item) => item.code === type)?.label ?? entryTypeLabel(type),
      secondary: isMemoType(type) ? "An amount owed, no money moves" : direction ? directionLabel(direction) : undefined,
    };
  });
  if (!typeCodes.includes(form.type)) typeOptions.push({ value: form.type, label: entryTypeLabel(form.type) });
  const methodOptions: SelectOption[] = METHODS.map((method) => ({ value: method, label: methodLabel(method) }));
  const listingOptions: SelectOption[] = [{ value: "", label: "No listing" }, ...(listings.status === "ready" ? listings.options : [])];
  if (form.listingId && !listingOptions.some((option) => option.value === form.listingId)) listingOptions.push({ value: form.listingId, label: "The listing linked before" });
  const shownErrors = FIELD_ORDER.filter((key) => errors[key]);
  const usableCategories: typeof categories =
    categories.status === "ready" ? { status: "ready", items: categoriesFor(categories.items, kind === "entry" ? fixed : kind === "opening" ? form.direction : null) } : categories;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const problems = entryFormProblems(form, mode, { types, minorUnits });
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setErrors({});
    setBusy(true);
    const answer = await send(entryBody(form, mode, types));
    setBusy(false);
    if (answer.ok) {
      onSent(answer.data);
      return;
    }
    const fields = answer.failure.fields ?? {};
    const mappedFields: Record<string, string> = {};
    for (const [key, message] of Object.entries(fields)) {
      const name = key.startsWith("transfer_to") ? "transfer_to" : key;
      mappedFields[(FIELD_ORDER as readonly string[]).includes(name) ? name : "summary"] = message;
    }
    setErrors(mappedFields);
    setFailure(answer.failure);
    requestAnimationFrame(() => summary.current?.focus());
  }

  const err = (key: string) => errors[key] || undefined;
  const details = (failure?.body as { error?: { details?: { existing_entry_id?: unknown } } } | undefined)?.error?.details;
  const existingOpening = failure?.code === "LEDGER_OPENING_BALANCE_EXISTS" && typeof details?.existing_entry_id === "string" ? details.existing_entry_id : null;
  const describe = (key: string, hint?: string) => fieldDescribedBy(controlId(key), { hint, error: err(key) });

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {(shownErrors.length > 0 || failure) && (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-md border-l-4 border-danger bg-danger-soft p-4 text-sm text-danger">
          <p className="font-medium">{failure && shownErrors.length === 0 ? failure.message : "Check the entry before saving it"}</p>
          {shownErrors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {shownErrors.map((key) => (
                <li key={key}>
                  <a href={`#${controlId(key)}`} className="underline">
                    {FIELD_NAMES[key]}: {errors[key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {errors.summary && <p className="mt-2">{errors.summary}</p>}
          {existingOpening && (
            <p className="mt-2">
              <Link href={entryHref(existingOpening, org)} className="underline">
                Open the opening balance already recorded
              </Link>{" "}
              to reverse it first.
            </p>
          )}
          {failure?.traceId && <p className="mt-1 text-xs">Support reference: {failure.traceId}</p>}
        </div>
      )}

      {form.settles && (
        <Alert tone="info" title="A payment against an amount owed">
          It settles <Link href={entryHref(form.settles, org)} className="underline">the {settlesLabel ?? "entry owed"}</Link>, and lowers what is
          still open in the receivables report.
        </Alert>
      )}
      {mode === "correct" && (
        <Alert tone="info" title="The original entry stays in your books">
          Saving creates a reversal of the original entry and this corrected entry, linked to both. Nothing is deleted or
          changed, and your team&rsquo;s activity log records who corrected it.
        </Alert>
      )}
      {kind === "opening" && (
        <Alert tone="info" title="One opening balance per currency, method and branch">
          It is the balance you start these books with, for example the cash in the safe today. To change it later, reverse
          it and record it again.
        </Alert>
      )}
      {kind === "transfer" && (
        <Alert tone="info" title="A transfer moves money within your books">
          It is recorded as two linked entries: money out of where it came from, and money in where it went.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "entry" && (
          <Field id={controlId("type")} label="Type" error={err("type")}>
            <SearchableSelect
              id={controlId("type")}
              options={typeOptions}
              value={form.type}
              onValueChange={chooseType}
              aria-invalid={Boolean(err("type"))}
              aria-describedby={describe("type")}
            />
          </Field>
        )}
        {fixed ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Money in or out</span>
            <p className="flex min-h-11 items-center text-ink">
              {kind === "transfer"
                ? "Out of where it came from, into where it went"
                : memo
                  ? form.type === "RECEIVABLE"
                    ? "Owed to you. No money moves until it is paid."
                    : "Owed by you. No money moves until you pay it."
                  : `${directionLabel(fixed)}, set by the type`}
            </p>
          </div>
        ) : (
          <fieldset className="min-w-0" aria-describedby={err("direction") ? `${controlId("direction")}-error` : undefined}>
            <legend className="text-sm font-medium text-ink">{kind === "opening" ? "The balance is" : "Money in or out"}</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["IN", "OUT"] as const).map((direction) => (
                <label
                  key={direction}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3 has-checked:border-primary has-checked:bg-tint"
                >
                  <input
                    type="radio"
                    name="direction"
                    id={direction === "IN" ? controlId("direction") : undefined}
                    value={direction}
                    checked={form.direction === direction}
                    onChange={() => set("direction", direction)}
                    className="size-5 accent-primary"
                  />
                  <span className="text-ink">
                    {kind === "opening" ? (direction === "IN" ? "Money held (in credit)" : "Overdrawn (owed)") : directionLabel(direction)}
                  </span>
                </label>
              ))}
            </div>
            {err("direction") && (
              <p id={`${controlId("direction")}-error`} className="mt-1.5 text-sm text-danger">
                {err("direction")}
              </p>
            )}
          </fieldset>
        )}

        <Field id={controlId("category")} label="Category" optional={kind !== "entry"} error={err("category")}>
          <SearchableSelect
            id={controlId("category")}
            options={categoryOptions(usableCategories, form.category, kind === "entry" ? (types?.find((item) => item.code === form.type)?.category ? "The type’s usual category" : undefined) : "No category")}
            value={form.category}
            onValueChange={(value) => set("category", value)}
            aria-invalid={Boolean(err("category"))}
            aria-describedby={describe("category")}
          />
        </Field>
        {!memo && (
          <Field id={controlId("method")} label={kind === "transfer" ? "From" : "Method"} error={err("method")}>
            <SearchableSelect
              id={controlId("method")}
              options={methodOptions}
              value={form.method}
              onValueChange={(value) => set("method", value)}
              aria-invalid={Boolean(err("method"))}
              aria-describedby={describe("method")}
            />
          </Field>
        )}

        {kind === "transfer" && (
          <>
            <Field id={controlId("transfer_to")} label="To" hint="Another method, or the same method at another branch" error={err("transfer_to")}>
              <SearchableSelect
                id={controlId("transfer_to")}
                options={[{ value: "", label: "Same method, another branch" }, ...methodOptions]}
                value={form.transferToMethod}
                onValueChange={(value) => set("transferToMethod", value)}
                aria-invalid={Boolean(err("transfer_to"))}
                aria-describedby={describe("transfer_to", "Another method, or the same method at another branch")}
              />
            </Field>
            <Field id="entry-transfer-branch" label="To branch" optional>
              <Input id="entry-transfer-branch" maxLength={BRANCH_MAX} value={form.transferToBranch} onChange={(event) => set("transferToBranch", event.target.value)} />
            </Field>
          </>
        )}

        <Field id={controlId("amount")} label="Amount" hint={hint} error={err("amount")}>
          <Input
            id={controlId("amount")}
            inputMode="decimal"
            autoComplete="off"
            value={form.amount}
            onChange={(event) => set("amount", event.target.value)}
            aria-invalid={Boolean(err("amount"))}
            aria-describedby={describe("amount", hint)}
          />
        </Field>
        <Field id={controlId("currency")} label="Currency" error={err("currency")}>
          <SearchableSelect
            id={controlId("currency")}
            options={currencyOptions}
            value={form.currency}
            onValueChange={(value) => set("currency", value)}
            aria-invalid={Boolean(err("currency"))}
            aria-describedby={describe("currency")}
          />
        </Field>
        <Field id={controlId("effective_date")} label="Date" hint="The day the money moved" error={err("effective_date")}>
          <Input
            id={controlId("effective_date")}
            type="date"
            value={form.effectiveDate}
            onChange={(event) => set("effectiveDate", event.target.value)}
            aria-invalid={Boolean(err("effective_date"))}
            aria-describedby={describe("effective_date", "The day the money moved")}
          />
        </Field>
        <Field id={controlId("reference")} label="Reference" optional hint="A receipt or slip number" error={err("reference")}>
          <Input
            id={controlId("reference")}
            maxLength={REFERENCE_MAX}
            value={form.reference}
            onChange={(event) => set("reference", event.target.value)}
            aria-invalid={Boolean(err("reference"))}
            aria-describedby={describe("reference", "A receipt or slip number")}
          />
        </Field>
      </div>

      <Field id={controlId("description")} label="Description" optional={kind === "opening"} error={err("description")}>
        <Input
          id={controlId("description")}
          maxLength={DESCRIPTION_MAX}
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          aria-invalid={Boolean(err("description"))}
          aria-describedby={describe("description")}
        />
      </Field>

      {kind !== "opening" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ContactPicker
            id={controlId("contact_id")}
            org={org}
            value={form.contactId}
            valueLabel={contactName}
            error={err("contact_id")}
            onChange={(id, label) => {
              set("contactId", id);
              setContactName(label);
            }}
          />
          <Field id={controlId("listing_id")} label="Listing" optional error={err("listing_id")} hint={listings.status === "failed" ? "Your listings could not be read." : undefined}>
            <SearchableSelect
              id={controlId("listing_id")}
              options={listingOptions}
              value={form.listingId}
              onValueChange={(value) => set("listingId", value)}
              aria-invalid={Boolean(err("listing_id"))}
              aria-describedby={describe("listing_id", listings.status === "failed" ? "Your listings could not be read." : undefined)}
            />
          </Field>
        </div>
      )}

      <Field id={controlId("branch")} label={kind === "transfer" ? "From branch" : "Branch"} optional hint="Leave empty for the main office" error={err("branch")}>
        <Input
          id={controlId("branch")}
          maxLength={BRANCH_MAX}
          value={form.branch}
          onChange={(event) => set("branch", event.target.value)}
          aria-invalid={Boolean(err("branch"))}
          aria-describedby={describe("branch", "Leave empty for the main office")}
        />
      </Field>

      <Field id={controlId("notes")} label="Notes" optional hint="Only your team sees notes. More can be added later; none can be changed." error={err("notes")}>
        <Textarea
          id={controlId("notes")}
          rows={3}
          maxLength={NOTE_MAX}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
          aria-invalid={Boolean(err("notes"))}
          aria-describedby={describe("notes", "Only your team sees notes. More can be added later; none can be changed.")}
        />
      </Field>

      {mode === "correct" && (
        <Field id={controlId("reason")} label="Why is it being corrected?" error={err("reason")} hint="Kept with both entries in the history">
          <Textarea
            id={controlId("reason")}
            rows={2}
            maxLength={REASON_MAX}
            value={form.reason}
            onChange={(event) => set("reason", event.target.value)}
            aria-invalid={Boolean(err("reason"))}
            aria-describedby={describe("reason", "Kept with both entries in the history")}
          />
        </Field>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
