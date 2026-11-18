"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import { getHourlySettings, saveHourlySettings, type HourlySettings } from "@/lib/api/venues";
import {
  bufferOptions,
  checkHourlyForm,
  clockOptions,
  formKeyOf,
  INCREMENTS,
  lengthOptions,
  minutesText,
  WEEKDAYS,
  type HourlyForm,
} from "@/lib/venue-settings";

/*
 * The listing editor's "Hourly booking" section (API 0.33.0, BR-007,
 * FR-023): the rate, the blocks a booking is made of, opening hours with
 * exceptions, fees and taxes with their dates, and the cancellation policy.
 * Shown only for a property type that can be let by the hour. Saved with its
 * own button (a full `PUT`), apart from the listing's autosave: these are
 * operational settings, not reviewed listing content, and reach the public
 * page at once. Requests wait for the host; no payment is taken.
 */

const FEE_KIND_LABELS: Record<string, string> = {
  PERCENT: "Percentage of the subtotal",
  FIXED: "Fixed amount per booking",
  PER_HOUR: "Amount per hour",
};

/** `opening_hours[2]` -> `hourly-opening_hours-2`: a safe id for a field path. */
const idOf = (path: string) => `hourly-${path.replace(/[^\w]+/g, "-").replace(/-+$/, "")}`;

type Props = {
  listingId: string;
  /** From the reference data: true or false when `property_types` carries `hourly_bookable`, null when it does not say. */
  eligibleByType: boolean | null;
  /** The listing's own currency, until the API names the market's. */
  fallbackCurrency: string;
  editable: boolean;
};

type Message = { tone: "success" | "danger"; title: string; body?: string; traceId?: string } | null;

export function HourlyBookingSection({ listingId, eligibleByType, fallbackCurrency, editable }: Props) {
  const [settings, setSettings] = useState<HourlySettings | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<HourlyForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eligibleByType === false) return;
    let cancelled = false;
    getHourlySettings(listingId, fallbackCurrency).then((answer) => {
      if (cancelled) return;
      if (answer.ok) {
        setSettings(answer.data);
        setForm(answer.data.form);
        setFailure(null);
      } else {
        setFailure(answer.failure);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, fallbackCurrency, eligibleByType, attempt]);

  // A type that cannot be let by the hour has no section: from the reference data, or from the API.
  if (eligibleByType === false) return null;
  if (settings && !settings.eligible) return null;
  // An API build before 0.33 has no hourly settings: nothing to show either.
  if (failure && failure.status === 404 && eligibleByType === null) return null;

  const wrap = (body: ReactNode) => (
    <section aria-labelledby="section-hourly">
      <Card>
        <h2 id="section-hourly" tabIndex={-1} className="text-2xl">
          Hourly booking
        </h2>
        <p className="mt-1 text-sm text-muted">
          Customers choose a time and send a booking request. Nothing is held until you confirm it, and no payment
          is taken on RightProperty365: you arrange payment with the customer.
        </p>
        <div className="mt-5">{body}</div>
      </Card>
    </section>
  );

  if (failure && !form) {
    return wrap(
      <>
        <Alert title={failure.status === 403 ? "You can see this listing but not its hourly booking settings." : failure.message} traceId={failure.traceId} />
        {failure.status !== 403 && (
          <Button variant="secondary" className="mt-4" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
        )}
      </>,
    );
  }
  if (!form || !settings) {
    return wrap(<div aria-busy="true" aria-label="Loading the hourly booking settings" className="h-40 rounded-lg bg-sunken" />);
  }

  const err = (key: string) => errors[key] || undefined;
  const update = (patch: Partial<HourlyForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setMessage(null);
  };
  const lengths = lengthOptions(form.increment_minutes);
  const opens = clockOptions(form.increment_minutes);
  const closes = clockOptions(form.increment_minutes, { closing: true });
  const withValue = (list: string[], value: string) => (value && !list.includes(value) ? [value, ...list] : list);
  const currencies = settings.currencies.includes(form.currency) || !form.currency ? settings.currencies : [form.currency, ...settings.currencies];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !settings) return;
    const checked = checkHourlyForm(form, settings.currencies);
    setErrors(checked.errors);
    if (!checked.body) {
      const count = Object.keys(checked.errors).length;
      setMessage({ tone: "danger", title: count === 1 ? "One setting needs a change." : `${count} settings need a change.`, body: "Each is marked under its field." });
      const first = Object.keys(checked.errors)[0];
      globalThis.setTimeout(() => document.getElementById(idOf(first))?.focus(), 0);
      return;
    }
    setBusy(true);
    setMessage(null);
    const answer = await saveHourlySettings(listingId, checked.body, fallbackCurrency);
    setBusy(false);
    if (answer.ok) {
      setSettings(answer.data);
      setForm(answer.data.form);
      setErrors({});
      setMessage({
        tone: "success",
        title: answer.data.form.enabled ? "Saved. Visitors can send hourly booking requests." : "Saved. Hourly booking is switched off.",
      });
    } else {
      const fields: Record<string, string> = {};
      for (const [path, text] of Object.entries(answer.failure.fields ?? {})) fields[formKeyOf(path)] = text;
      setErrors(fields);
      setMessage({
        tone: "danger",
        title: answer.failure.code === "LISTING_NOT_ELIGIBLE" ? "This property type cannot be let by the hour." : answer.failure.message,
        traceId: answer.failure.traceId,
      });
    }
    globalThis.setTimeout(() => result.current?.scrollIntoView({ block: "nearest" }), 0);
  }

  const number = (key: "capacity" | "free_cancellation_hours" | "lead_time_hours" | "horizon_days", label: string, hint: string, max: number) => (
    <Field id={idOf(key)} label={label} hint={hint} error={err(key)}>
      <Input
        id={idOf(key)}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={form[key]}
        onChange={(event) => update({ [key]: event.target.value })}
        aria-invalid={Boolean(err(key))}
        aria-describedby={fieldDescribedBy(idOf(key), { hint, error: err(key) })}
      />
    </Field>
  );

  return wrap(
    <form onSubmit={save} noValidate>
      <fieldset disabled={!editable || busy} className="grid min-w-0 gap-6">
        <legend className="sr-only">Hourly booking settings</legend>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={settings.form.enabled ? "success" : "neutral"}>{settings.form.enabled ? "Taking requests" : "Switched off"}</Badge>
          {settings.timeZone && <span className="text-muted">Times are in {settings.timeZone} time, the listing’s country.</span>}
          {settings.updatedAt && <span className="text-muted">Last saved {formatWhen(settings.updatedAt)}.</span>}
        </div>

        <label className="flex items-start gap-3 text-ink">
          <input
            id={idOf("enabled")}
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
          />
          <span>
            <span className="font-medium">Take hourly booking requests</span>
            <span className="block text-sm text-muted">Visitors see “Book by the hour” on the listing while it is public.</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={idOf("rate_per_hour")} label="Rate per hour" hint="Before fees and taxes, such as 50.00." error={err("rate_per_hour")}>
            <Input
              id={idOf("rate_per_hour")}
              inputMode="decimal"
              autoComplete="off"
              value={form.rate_per_hour}
              onChange={(event) => update({ rate_per_hour: event.target.value })}
              aria-invalid={Boolean(err("rate_per_hour"))}
              aria-describedby={fieldDescribedBy(idOf("rate_per_hour"), { hint: "x", error: err("rate_per_hour") })}
            />
          </Field>
          <Field
            id={idOf("currency")}
            label="Currency"
            hint="Fees, the deposit and every quote are in this currency."
            error={err("currency")}
          >
            <SearchableSelect
              id={idOf("currency")}
              value={form.currency}
              onValueChange={(value) => update({ currency: value })}
              disabled={!editable}
              aria-invalid={Boolean(err("currency"))}
              aria-describedby={fieldDescribedBy(idOf("currency"), { hint: "x", error: err("currency") })}
              options={currencies.map((code) => ({ value: code, label: code }))}
            />
          </Field>
          <Field id={idOf("increment_minutes")} label="Bookings are made in blocks of" error={err("increment_minutes")}>
            <SearchableSelect
              id={idOf("increment_minutes")}
              value={String(form.increment_minutes)}
              disabled={!editable}
              onValueChange={(value) => {
                const increment = Number(value);
                // Lengths stay on the new grid.
                const round = (minutes: number) => Math.max(increment, Math.ceil(minutes / increment) * increment);
                update({ increment_minutes: increment, min_minutes: round(form.min_minutes), max_minutes: round(form.max_minutes) });
              }}
              aria-invalid={Boolean(err("increment_minutes"))}
              aria-describedby={fieldDescribedBy(idOf("increment_minutes"), { error: err("increment_minutes") })}
              options={INCREMENTS.map((minutes) => ({ value: String(minutes), label: minutesText(minutes) }))}
            />
          </Field>
          <Field id={idOf("cleaning_buffer_minutes")} label="Cleaning time between bookings" hint="Kept free after each confirmed booking." error={err("cleaning_buffer_minutes")}>
            <SearchableSelect
              id={idOf("cleaning_buffer_minutes")}
              value={String(form.cleaning_buffer_minutes)}
              disabled={!editable}
              onValueChange={(value) => update({ cleaning_buffer_minutes: Number(value) })}
              aria-invalid={Boolean(err("cleaning_buffer_minutes"))}
              aria-describedby={fieldDescribedBy(idOf("cleaning_buffer_minutes"), { hint: "x", error: err("cleaning_buffer_minutes") })}
              options={[...new Set([...bufferOptions(), form.cleaning_buffer_minutes])]
                .sort((a, b) => a - b)
                .map((minutes) => ({ value: String(minutes), label: minutesText(minutes) }))}
            />
          </Field>
          <Field id={idOf("min_minutes")} label="Shortest booking" error={err("min_minutes")}>
            <SearchableSelect
              id={idOf("min_minutes")}
              value={String(form.min_minutes)}
              disabled={!editable}
              onValueChange={(value) => update({ min_minutes: Number(value) })}
              aria-invalid={Boolean(err("min_minutes"))}
              aria-describedby={fieldDescribedBy(idOf("min_minutes"), { error: err("min_minutes") })}
              options={[...new Set([...lengths, form.min_minutes])].sort((a, b) => a - b).map((minutes) => ({ value: String(minutes), label: minutesText(minutes) }))}
            />
          </Field>
          <Field id={idOf("max_minutes")} label="Longest booking" error={err("max_minutes")}>
            <SearchableSelect
              id={idOf("max_minutes")}
              value={String(form.max_minutes)}
              disabled={!editable}
              onValueChange={(value) => update({ max_minutes: Number(value) })}
              aria-invalid={Boolean(err("max_minutes"))}
              aria-describedby={fieldDescribedBy(idOf("max_minutes"), { error: err("max_minutes") })}
              options={[...new Set([...lengths, form.max_minutes])].sort((a, b) => a - b).map((minutes) => ({ value: String(minutes), label: minutesText(minutes) }))}
            />
          </Field>
          {number("capacity", "Bookings at the same time", "Usually 1: the whole venue for one customer.", 1000)}
          <Field id={idOf("deposit")} label="Deposit" optional hint="Payable to the host if confirmed. Shown in the quote, apart from the total." error={err("deposit")}>
            <Input
              id={idOf("deposit")}
              inputMode="decimal"
              autoComplete="off"
              value={form.deposit}
              onChange={(event) => update({ deposit: event.target.value })}
              aria-invalid={Boolean(err("deposit"))}
              aria-describedby={fieldDescribedBy(idOf("deposit"), { hint: "x", error: err("deposit") })}
            />
          </Field>
        </div>

        <fieldset className="min-w-0 border-t border-line pt-5">
          <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Opening hours</legend>
          <p className="mt-1 text-sm text-muted">
            In the venue’s own time. A day can have several ranges, such as 08:00 to 12:00 and 13:00 to 18:00. A day
            with no hours is closed.
          </p>
          {err("opening_hours") && (
            <p id={idOf("opening_hours")} tabIndex={-1} className="mt-2 text-sm text-danger">
              {err("opening_hours")}
            </p>
          )}
          <ul className="mt-4 divide-y divide-line">
            {WEEKDAYS.map((name, dayIndex) => {
              const weekday = dayIndex + 1;
              const rows = form.opening_hours.map((range, index) => ({ range, index })).filter(({ range }) => range.weekday === weekday);
              return (
                <li key={name} className="grid gap-3 py-3 md:grid-cols-[8rem_1fr]">
                  <p className="pt-2 font-medium text-ink">{name}</p>
                  <div className="grid gap-3">
                    {rows.length === 0 && <p className="pt-2 text-sm text-muted">Closed</p>}
                    {rows.map(({ range, index }) => {
                      const key = `opening_hours[${index}]`;
                      const error = err(key);
                      const rowId = idOf(key);
                      return (
                        <div key={index} className="grid gap-1.5">
                          <div className="flex flex-wrap items-end gap-3">
                            <Field id={rowId} label="Opens" className="min-w-0 flex-1 basis-28">
                              <SearchableSelect
                                id={rowId}
                                value={range.opens}
                                disabled={!editable}
                                onValueChange={(value) =>
                                  update({ opening_hours: form.opening_hours.map((item, i) => (i === index ? { ...item, opens: value } : item)) })
                                }
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? `${rowId}-row-error` : undefined}
                                options={withValue(opens, range.opens).map((value) => ({ value, label: value }))}
                              />
                            </Field>
                            <Field id={`${rowId}-closes`} label="Closes" className="min-w-0 flex-1 basis-28">
                              <SearchableSelect
                                id={`${rowId}-closes`}
                                value={range.closes}
                                disabled={!editable}
                                onValueChange={(value) =>
                                  update({ opening_hours: form.opening_hours.map((item, i) => (i === index ? { ...item, closes: value } : item)) })
                                }
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? `${rowId}-row-error` : undefined}
                                options={withValue(closes, range.closes).map((value) => ({ value, label: value }))}
                              />
                            </Field>
                            <Button
                              variant="secondary"
                              className="size-11 px-0"
                              onClick={() => update({ opening_hours: form.opening_hours.filter((_, i) => i !== index) })}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              <span className="sr-only">
                                Remove {name} {range.opens} to {range.closes}
                              </span>
                            </Button>
                          </div>
                          {error && (
                            <p id={`${rowId}-row-error`} className="text-sm text-danger">
                              {error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="md"
                      className="justify-self-start px-2 text-primary-ink"
                      onClick={() => {
                        const last = rows.at(-1)?.range;
                        const start = last ? last.closes : "09:00";
                        const next = last ? (closes.find((value) => value > start && value >= addHour(start)) ?? "24:00") : "17:00";
                        update({ opening_hours: [...form.opening_hours, { weekday, opens: start === "24:00" ? "23:00" : start, closes: next }] });
                      }}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {rows.length === 0 ? `Open on ${name}` : `Add hours on ${name}`}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="min-w-0 border-t border-line pt-5">
          <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Dates with other hours</legend>
          <p className="mt-1 text-sm text-muted">A public holiday, or a day with special hours. They replace that day’s usual hours.</p>
          {form.exceptions.length === 0 && <p className="mt-3 text-sm text-muted">No dates yet.</p>}
          <ul className="mt-4 grid gap-4">
            {form.exceptions.map((entry, index) => {
              const key = `exceptions[${index}]`;
              const set = (patch: Partial<typeof entry>) =>
                update({ exceptions: form.exceptions.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
              return (
                <li key={index} className="rounded-lg border border-line p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id={idOf(`${key}.date`)} label="Date" error={err(`${key}.date`)}>
                      <Input
                        id={idOf(`${key}.date`)}
                        type="date"
                        value={entry.date}
                        onChange={(event) => set({ date: event.target.value })}
                        aria-invalid={Boolean(err(`${key}.date`))}
                        aria-describedby={fieldDescribedBy(idOf(`${key}.date`), { error: err(`${key}.date`) })}
                      />
                    </Field>
                    <label className="flex items-center gap-3 self-end pb-2.5 text-ink">
                      <input
                        type="checkbox"
                        checked={entry.closed}
                        onChange={(event) => set({ closed: event.target.checked })}
                        className="size-5 shrink-0 accent-(--rp-color-primary-base)"
                      />
                      Closed all day
                    </label>
                    {!entry.closed && (
                      <>
                        <Field id={idOf(`${key}.opens`)} label="Opens" error={err(`${key}.opens`)}>
                          <SearchableSelect
                            id={idOf(`${key}.opens`)}
                            value={entry.opens}
                            disabled={!editable}
                            onValueChange={(value) => set({ opens: value })}
                            aria-invalid={Boolean(err(`${key}.opens`))}
                            aria-describedby={fieldDescribedBy(idOf(`${key}.opens`), { error: err(`${key}.opens`) })}
                            options={[{ value: "", label: "Choose…" }, ...withValue(opens, entry.opens).map((value) => ({ value, label: value }))]}
                          />
                        </Field>
                        <Field id={idOf(`${key}.closes`)} label="Closes" error={err(`${key}.closes`)}>
                          <SearchableSelect
                            id={idOf(`${key}.closes`)}
                            value={entry.closes}
                            disabled={!editable}
                            onValueChange={(value) => set({ closes: value })}
                            aria-invalid={Boolean(err(`${key}.closes`))}
                            aria-describedby={fieldDescribedBy(idOf(`${key}.closes`), { error: err(`${key}.closes`) })}
                            options={[{ value: "", label: "Choose…" }, ...withValue(closes, entry.closes).map((value) => ({ value, label: value }))]}
                          />
                        </Field>
                      </>
                    )}
                    <Field id={idOf(`${key}.note`)} label="Note" optional hint="Customers see it, such as “Public holiday”." error={err(`${key}.note`)} className="sm:col-span-2">
                      <Input
                        id={idOf(`${key}.note`)}
                        maxLength={200}
                        value={entry.note}
                        onChange={(event) => set({ note: event.target.value })}
                        aria-invalid={Boolean(err(`${key}.note`))}
                        aria-describedby={fieldDescribedBy(idOf(`${key}.note`), { hint: "x", error: err(`${key}.note`) })}
                      />
                    </Field>
                  </div>
                  <Button variant="secondary" className="mt-3" onClick={() => update({ exceptions: form.exceptions.filter((_, i) => i !== index) })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove this date<span className="sr-only">: {entry.date || "no date yet"}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => update({ exceptions: [...form.exceptions, { date: "", closed: true, opens: "", closes: "", note: "" }] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a date
          </Button>
        </fieldset>

        <fieldset className="min-w-0 border-t border-line pt-5">
          <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Fees and taxes</legend>
          <p className="mt-1 text-sm text-muted">
            In {form.currency || "the listing’s currency"}. A charge applies to bookings that start between its first and
            last day. A tax is a charge with the code TAX. Percentages are of the rate and the other charges.
          </p>
          {form.fees.length === 0 && <p className="mt-3 text-sm text-muted">No fees or taxes.</p>}
          <ul className="mt-4 grid gap-4">
            {form.fees.map((fee, index) => {
              const key = `fees[${index}]`;
              const set = (patch: Partial<typeof fee>) => update({ fees: form.fees.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
              const field = (name: "code" | "label" | "amount", label: string, hint?: string, extra: Partial<Parameters<typeof Input>[0]> = {}) => (
                <Field id={idOf(`${key}.${name}`)} label={label} hint={hint} error={err(`${key}.${name}`)}>
                  <Input
                    id={idOf(`${key}.${name}`)}
                    autoComplete="off"
                    value={fee[name]}
                    onChange={(event) => set({ [name]: event.target.value })}
                    aria-invalid={Boolean(err(`${key}.${name}`))}
                    aria-describedby={fieldDescribedBy(idOf(`${key}.${name}`), { hint, error: err(`${key}.${name}`) })}
                    {...extra}
                  />
                </Field>
              );
              return (
                <li key={index} className="rounded-lg border border-line p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("label", "Name customers see", undefined, { maxLength: 80 })}
                    {field("code", "Code", "TAX for a tax; otherwise a short code such as CLEANING.", { maxLength: 32, spellCheck: false })}
                    <Field id={idOf(`${key}.kind`)} label="How it is charged" error={err(`${key}.kind`)}>
                      <SearchableSelect
                        id={idOf(`${key}.kind`)}
                        value={fee.kind}
                        disabled={!editable}
                        onValueChange={(value) => set({ kind: value })}
                        aria-invalid={Boolean(err(`${key}.kind`))}
                        aria-describedby={fieldDescribedBy(idOf(`${key}.kind`), { error: err(`${key}.kind`) })}
                        options={Object.entries(FEE_KIND_LABELS).map(([value, label]) => ({ value, label }))}
                      />
                    </Field>
                    {field(
                      "amount",
                      fee.kind === "PERCENT" ? "Percentage" : `Amount in ${form.currency || "the currency"}`,
                      fee.kind === "PERCENT" ? "Such as 15 for 15%." : undefined,
                      { inputMode: "decimal" },
                    )}
                    <Field id={idOf(`${key}.effective_from`)} label="First day it applies" error={err(`${key}.effective_from`)}>
                      <Input
                        id={idOf(`${key}.effective_from`)}
                        type="date"
                        value={fee.effective_from}
                        onChange={(event) => set({ effective_from: event.target.value })}
                        aria-invalid={Boolean(err(`${key}.effective_from`))}
                        aria-describedby={fieldDescribedBy(idOf(`${key}.effective_from`), { error: err(`${key}.effective_from`) })}
                      />
                    </Field>
                    <Field id={idOf(`${key}.effective_to`)} label="Last day it applies" optional hint="Leave empty while it still applies." error={err(`${key}.effective_to`)}>
                      <Input
                        id={idOf(`${key}.effective_to`)}
                        type="date"
                        min={fee.effective_from || undefined}
                        value={fee.effective_to}
                        onChange={(event) => set({ effective_to: event.target.value })}
                        aria-invalid={Boolean(err(`${key}.effective_to`))}
                        aria-describedby={fieldDescribedBy(idOf(`${key}.effective_to`), { hint: "x", error: err(`${key}.effective_to`) })}
                      />
                    </Field>
                  </div>
                  <Button variant="secondary" className="mt-3" onClick={() => update({ fees: form.fees.filter((_, i) => i !== index) })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove this charge<span className="sr-only">: {fee.label || fee.code || "unnamed"}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() =>
              update({
                fees: [
                  ...form.fees,
                  { code: form.fees.some((fee) => fee.code === "TAX") ? "" : "TAX", label: "", kind: "PERCENT", amount: "", effective_from: new Date().toISOString().slice(0, 10), effective_to: "" },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a fee or tax
          </Button>
        </fieldset>

        <fieldset className="grid min-w-0 gap-4 border-t border-line pt-5">
          <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Cancellation and notice</legend>
          <Field
            id={idOf("cancellation_policy")}
            label="Cancellation policy"
            hint="Customers see it before they send a request and when they cancel."
            error={err("cancellation_policy")}
            className="mt-3"
          >
            <Textarea
              id={idOf("cancellation_policy")}
              maxLength={2000}
              value={form.cancellation_policy}
              onChange={(event) => update({ cancellation_policy: event.target.value })}
              aria-invalid={Boolean(err("cancellation_policy"))}
              aria-describedby={fieldDescribedBy(idOf("cancellation_policy"), { hint: "x", error: err("cancellation_policy") })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            {number("free_cancellation_hours", "Free cancellation until, in hours before the start", "0 for no free window.", 8760)}
            {number("lead_time_hours", "Notice needed, in hours", "How soon before the start a request can be sent.", 8760)}
            {number("horizon_days", "Bookable ahead, in days", "1 to 365. Usually 90.", 365)}
          </div>
        </fieldset>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={!editable || busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : "Save the hourly booking settings"}
        </Button>
        {!editable && <p className="text-sm text-muted">Only someone who may edit this listing can change these settings.</p>}
      </div>
      <div ref={result} className="mt-4 scroll-mt-24">
        {message && (
          <Alert tone={message.tone} title={message.title} traceId={message.traceId}>
            {message.body}
          </Alert>
        )}
      </div>
    </form>,
  );
}

/** "09:00" plus one hour, capped at "24:00". */
function addHour(clock: string): string {
  const minutes = Math.min(1440, Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5)) + 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
