"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NightCalendar } from "@/components/availability/night-calendar";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import { getVenueAvailability } from "@/lib/api/venues";
import { cn } from "@/lib/cn";
import { formatAmount, quoteRows, type VenueQuote } from "@/lib/venue-quote";
import {
  addDaysTo,
  dateText,
  durationChoices,
  localDateOf,
  openDates,
  rulesOf,
  startChoices,
  venueSpanText,
  visitorTimeNote,
  type VenueAvailability,
  type VenueDay,
} from "@/lib/venue-time";

/*
 * Choosing a time at a venue let by the hour (API 0.33.0): the availability
 * read in the browser, a date (only open days can be chosen), then a start
 * time and a duration as `SearchableSelect`s built from that answer. Shared
 * by the listing's "Book by the hour" and the host's "Propose another time".
 */

/** The API answers at most 62 days at a time. */
const SPAN_DAYS = 61;

export type AvailabilityState =
  | { status: "loading" }
  | { status: "off" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; availability: VenueAvailability; loadedTo: string; at: number };

/**
 * The venue's availability from today (the visitor's yesterday, so no zone is
 * ahead of it) for 62 days; `more` reads the next 62 up to the horizon, and
 * `reload` reads everything again (after a refusal). A 404 means hourly
 * booking is off or the listing is not public: `off`.
 */
export function useVenueAvailability(listingId: string) {
  const [state, setState] = useState<AvailabilityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busyMore, setBusyMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const from = addDaysTo(new Date().toISOString().slice(0, 10), -1);
    const to = addDaysTo(from, SPAN_DAYS);
    getVenueAvailability(listingId, from, to).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "ready", availability: result.data, loadedTo: to, at: Date.now() });
      else setState(result.failure.status === 404 ? { status: "off" } : { status: "error", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const more = useCallback(async () => {
    if (state.status !== "ready") return;
    setBusyMore(true);
    const from = addDaysTo(state.loadedTo, 1);
    const to = addDaysTo(from, SPAN_DAYS);
    const result = await getVenueAvailability(listingId, from, to);
    setBusyMore(false);
    if (!result.ok) return;
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            loadedTo: to,
            availability: {
              ...current.availability,
              days: [...current.availability.days, ...result.data.days.filter((day) => day.date > current.loadedTo)],
            },
          }
        : current,
    );
  }, [listingId, state]);

  const hasMore =
    state.status === "ready" &&
    state.availability.latestEnd !== null &&
    localDateOf(state.availability.latestEnd, state.availability.timeZone) > state.loadedTo;

  return { state, reload, more, hasMore, busyMore };
}

export type SlotChoice = { date: string; start: string; minutes: string };

export const emptyChoice: SlotChoice = { date: "", start: "", minutes: "" };

/** The chosen slot as instants, when all three parts are chosen and still on offer. */
export function chosenSpan(availability: VenueAvailability, choice: SlotChoice, now: number): { start: string; end: string } | null {
  const day = availability.days.find((item) => item.date === choice.date);
  if (!day || !choice.start || !choice.minutes) return null;
  const rules = rulesOf(availability, now);
  const start = Date.parse(choice.start);
  if (!startChoices(day, rules, availability.timeZone).some((option) => option.value === choice.start)) return null;
  if (!durationChoices(day, start, rules, availability.timeZone).some((option) => option.value === choice.minutes)) return null;
  return { start: new Date(start).toISOString(), end: new Date(start + Number(choice.minutes) * 60_000).toISOString() };
}

type PickerProps = {
  /** Prefix of the controls' ids: "book", "propose-<id>". */
  idPrefix: string;
  availability: VenueAvailability;
  /** When the availability was read: starts before the lead time and in the past are not offered. */
  now: number;
  choice: SlotChoice;
  onChoice: (choice: SlotChoice) => void;
  /** Show the month grid as well as the date field (the listing page). */
  calendar?: { label: string };
  errors?: Partial<Record<keyof SlotChoice, string>>;
  disabled?: boolean;
};

export function SlotPicker({ idPrefix, availability, now, choice, onChoice, calendar, errors = {}, disabled }: PickerProps) {
  const zone = availability.timeZone;
  const rules = useMemo(() => rulesOf(availability, now), [availability, now]);
  const open = useMemo(() => new Set(openDates(availability.days, rules)), [availability, rules]);
  const first = availability.days[0]?.date ?? localDateOf(now, zone);
  const last = availability.days.at(-1)?.date ?? first;
  const today = localDateOf(now, zone);
  const day: VenueDay | undefined = availability.days.find((item) => item.date === choice.date);
  const starts = day && open.has(day.date) ? startChoices(day, rules, zone) : [];
  const start = choice.start ? Date.parse(choice.start) : null;
  const durations = day && start !== null ? durationChoices(day, start, rules, zone) : [];
  const [dateError, setDateError] = useState<string | undefined>();
  const id = (name: string) => `${idPrefix}-${name}`;
  const dateProblem = errors.date ?? dateError;
  const dateHint = `Times are in ${zone} time. Only days with a free time can be chosen.`;

  const pickDate = (date: string) => {
    if (date && !open.has(date)) {
      const note = availability.days.find((item) => item.date === date)?.note;
      setDateError(
        date < first || date > last
          ? `Choose a date from ${dateText(first)} to ${dateText(last)}.`
          : `There is no free time on ${dateText(date)}${note ? ` (${note})` : ""}. Choose another day.`,
      );
      onChoice({ date, start: "", minutes: "" });
      return;
    }
    setDateError(undefined);
    onChoice({ date, start: "", minutes: "" });
  };

  return (
    <div className="grid gap-4">
      {calendar && (
        <NightCalendar
          className="-mx-3 sm:mx-0"
          label={calendar.label}
          first={first > today ? first : today}
          last={last}
          today={today}
          kindOf={(date) => (open.has(date) ? "available" : "unavailable")}
          canPick={(date) => open.has(date) && !disabled}
          selected={{ from: choice.date && open.has(choice.date) ? choice.date : null, to: null }}
          ends={{ from: "chosen date", to: "chosen date" }}
          onPick={pickDate}
          legend={["available", "unavailable"]}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id("date")} label="Date" hint={dateHint} error={dateProblem}>
          <Input
            id={id("date")}
            type="date"
            min={first > today ? first : today}
            max={last}
            value={choice.date}
            disabled={disabled}
            onChange={(event) => pickDate(event.target.value)}
            aria-invalid={Boolean(dateProblem)}
            aria-describedby={fieldDescribedBy(id("date"), { hint: dateHint, error: dateProblem })}
          />
        </Field>
        <Field
          id={id("start")}
          label="Start time"
          hint={choice.date && open.has(choice.date) ? `${starts.length} start times free.` : "Choose a date first."}
          error={errors.start}
        >
          <SearchableSelect
            id={id("start")}
            value={choice.start}
            disabled={disabled || starts.length === 0}
            onValueChange={(value) => onChoice({ ...choice, start: value, minutes: "" })}
            aria-invalid={Boolean(errors.start)}
            aria-describedby={fieldDescribedBy(id("start"), { hint: "x", error: errors.start })}
            options={[{ value: "", label: "Choose…" }, ...starts]}
          />
        </Field>
        <Field id={id("minutes")} label="How long" hint={start === null ? "Choose a start time first." : undefined} error={errors.minutes}>
          <SearchableSelect
            id={id("minutes")}
            value={choice.minutes}
            disabled={disabled || durations.length === 0}
            onValueChange={(value) => onChoice({ ...choice, minutes: value })}
            aria-invalid={Boolean(errors.minutes)}
            aria-describedby={fieldDescribedBy(id("minutes"), { hint: start === null ? "x" : undefined, error: errors.minutes })}
            options={[{ value: "", label: "Choose…" }, ...durations]}
          />
        </Field>
      </div>
    </div>
  );
}

/** The chosen time in the venue's zone, and on the visitor's own clock when that reads differently. */
export function SpanLines({ start, end, timeZone, visitorZone, className }: { start: string; end: string; timeZone: string; visitorZone: string | null; className?: string }) {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const note = visitorTimeNote(from, to, timeZone, visitorZone);
  return (
    <div className={className}>
      <p className="font-medium text-ink">{venueSpanText(from, to, timeZone)}</p>
      {note && <p className="text-sm text-muted">That is {note}.</p>}
    </div>
  );
}

/** The itemised quote: each line, the estimated total, the deposit apart, and the no-payment notice. */
export function QuoteTable({ quote, className }: { quote: Pick<VenueQuote, "currency" | "lines" | "subtotal" | "deposit" | "totalExcludingDeposit" | "notice">; className?: string }) {
  const rows = quoteRows(quote);
  return (
    <div className={className}>
      <table className="w-full text-sm">
        <caption className="sr-only">Estimate, in {quote.currency}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={cn(row.total && "border-t border-line-strong font-semibold", row.aside && "text-muted")}>
              <th scope="row" className={cn("py-1.5 pr-3 text-left font-normal", row.total && "font-semibold text-ink")}>
                {row.label}
              </th>
              <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 rounded-md bg-sunken p-3 text-sm leading-relaxed text-ink">{quote.notice}</p>
    </div>
  );
}

/** "USD 50.00 per hour": what the venue charges before a time is chosen. */
export const rateText = (availability: VenueAvailability) =>
  availability.ratePerHour && availability.currency ? `${formatAmount(availability.ratePerHour, availability.currency)} per hour` : null;
