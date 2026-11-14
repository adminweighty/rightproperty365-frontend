"use client";

import { ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { NoAccess, RequireAuth } from "@/components/auth/require-auth";
import { NightCalendar, type NightKind } from "@/components/availability/night-calendar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  changeMyAvailability,
  getMyAvailability,
  setStayRules,
  type AvailabilityReason,
  type ListerAvailability,
  type ListerRange,
} from "@/lib/api/availability";
import type { ApiFailure } from "@/lib/api/http";
import {
  changeFieldOf,
  formatNight,
  formatRange,
  isNight,
  nightCount,
  nightsBetween,
  orderedRange,
  type AvailabilityStatus,
} from "@/lib/nights";

/** What can be done to a run of nights, in the words of the form. An enum of the API. */
const actions: { value: AvailabilityStatus; label: string; done: string }[] = [
  { value: "BOOKED", label: "Mark as booked", done: "marked as booked" },
  { value: "BLOCKED", label: "Block", done: "blocked" },
  { value: "AVAILABLE", label: "Make available", done: "made available" },
];

const reasonLabels: Record<AvailabilityReason, string> = { BOOKED: "Booked", BLOCKED: "Blocked" };
const reasonKinds: Record<AvailabilityReason, NightKind> = { BOOKED: "booked", BLOCKED: "blocked" };

const NOTE_MAX = 200;

type State =
  | { status: "loading" }
  | { status: "ready"; calendar: ListerAvailability }
  | { status: "forbidden" }
  /** No such listing, one the caller may not manage, or one that is not a short stay. */
  | { status: "unavailable"; title: string; text: string }
  | { status: "error"; failure: ApiFailure };

function stateOf(failure: ApiFailure): State {
  if (failure.status === 403) return { status: "forbidden" };
  if (failure.status === 404) {
    return {
      status: "unavailable",
      title: "We could not find that listing",
      text: "It does not exist, or it is not one you manage.",
    };
  }
  if (failure.code === "NOT_SHORT_STAY") {
    return {
      status: "unavailable",
      title: "This listing has no availability calendar",
      text: "Only short stays, which are let by the night, have one.",
    };
  }
  return { status: "error", failure };
}

/** "Central Africa Time (Africa/Harare)". */
function zoneName(timezone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return name ? `${name} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}

type Saved = { tone: "success"; text: string } | { tone: "danger"; failure: ApiFailure } | null;

function Editor({ listingId }: { listingId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // The range being changed: the form's two dates, which the calendar also sets.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState<AvailabilityStatus>("BOOKED");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [changeResult, setChangeResult] = useState<Saved>(null);
  const [changeErrors, setChangeErrors] = useState<Record<string, string>>({});
  const [rulesResult, setRulesResult] = useState<Saved>(null);
  const [rulesErrors, setRulesErrors] = useState<Record<string, string>>({});
  const changeStatus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // The default span is enough: the response carries every stored range and the booking window.
    getMyAvailability(listingId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", calendar: result.data } : stateOf(result.failure));
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, attempt]);

  const calendar = state.status === "ready" ? state.calendar : null;
  /** night -> the stored range it is in. */
  const rangeOf = useMemo(() => {
    const ranges = calendar?.ranges ?? [];
    return (night: string): ListerRange | undefined =>
      ranges.find((range) => night >= range.first_night && night <= range.last_night);
  }, [calendar]);

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading the calendar" className="space-y-4">
        <div className="h-10 max-w-sm rounded-md bg-sunken" />
        <div className="h-96 rounded-lg bg-sunken" />
      </div>
    );
  }
  if (state.status === "forbidden") return <NoAccess />;
  if (state.status === "unavailable") {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">{state.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{state.text}</p>
        <ButtonLink href="/agent/listings" variant="secondary" className="mt-6">
          Back to your listings
        </ButtonLink>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <h1 className="text-3xl md:text-4xl">Availability</h1>
        <Alert title={state.failure.message} traceId={state.failure.traceId} className="mt-6" />
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </Button>
      </>
    );
  }

  const { listing, window: bookingWindow, timezone, ranges } = state.calendar;
  const inWindow = (night: string) => night >= bookingWindow.from && night <= bookingWindow.to;
  const selected = { from: isNight(from) ? from : null, to: isNight(from) && isNight(to) ? to : null };
  const nights = selected.from && selected.to ? nightsBetween(selected.from, selected.to) + 1 : 0;
  const noteAllowed = action !== "AVAILABLE";

  /** Sends one change and shows the calendar the API answers with. */
  async function apply(change: { from: string; to: string; status: AvailabilityStatus; note?: string }, key: string) {
    setPending(key);
    setChangeResult(null);
    setChangeErrors({});
    const result = await changeMyAvailability(listingId, [change]);
    setPending(null);
    if (result.ok) {
      // The answer is the calendar as it now is, read after the change was stored.
      setState({ status: "ready", calendar: result.data });
      const done = actions.find((item) => item.value === change.status)?.done ?? "changed";
      setChangeResult({ tone: "success", text: `Saved. ${formatRange(change.from, change.to)} ${done}.` });
      setFrom("");
      setTo("");
      setNote("");
    } else {
      const errors: Record<string, string> = {};
      for (const [path, message] of Object.entries(result.failure.fields ?? {})) {
        // One change is sent at a time, so `changes[0].to` is this form's "to".
        const field = changeFieldOf(path)?.field ?? path;
        errors[field] = message;
      }
      setChangeErrors(errors);
      setChangeResult({ tone: "danger", failure: result.failure });
    }
    // The result is announced where it is shown, and is in view on a phone.
    globalThis.setTimeout(() => changeStatus.current?.scrollIntoView({ block: "nearest" }), 0);
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!isNight(from)) errors.from = "Choose the first night.";
    else if (!inWindow(from)) errors.from = `Choose a night from ${formatNight(bookingWindow.from)} to ${formatNight(bookingWindow.to)}.`;
    if (!isNight(to)) errors.to = "Choose the last night.";
    else if (isNight(from) && to < from) errors.to = "The last night cannot be before the first.";
    else if (!inWindow(to)) errors.to = `Choose a night up to ${formatNight(bookingWindow.to)}.`;
    setChangeErrors(errors);
    if (Object.keys(errors).length > 0) {
      setChangeResult(null);
      document.getElementById(errors.from ? "change-from" : "change-to")?.focus();
      return;
    }
    const text = note.trim();
    void apply({ from, to, status: action, ...(noteAllowed && text && { note: text }) }, "change");
  }

  async function handleRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minNights = Number(data.get("min_nights"));
    const maxGuests = Number(data.get("max_guests"));
    const current = state.status === "ready" ? state.calendar : null;
    // Only what changed is sent; a key that is absent is left as it is.
    const rules = {
      ...(minNights !== current?.min_nights && { min_nights: minNights }),
      ...(maxGuests !== current?.max_guests && { max_guests: maxGuests }),
    };
    setRulesErrors({});
    if (Object.keys(rules).length === 0) {
      setRulesResult({ tone: "success", text: "Nothing to save: these are the rules already." });
      return;
    }
    setPending("rules");
    setRulesResult(null);
    const result = await setStayRules(listingId, rules);
    setPending(null);
    if (result.ok) {
      const { min_nights, max_guests } = result.data.listing;
      setState((previous) =>
        previous.status === "ready"
          ? { status: "ready", calendar: { ...previous.calendar, min_nights: min_nights ?? 1, max_guests } }
          : previous,
      );
      setRulesResult({ tone: "success", text: "Saved. Visitors see the new rules on the listing within a minute." });
    } else {
      setRulesErrors(result.failure.fields ?? {});
      setRulesResult({ tone: "danger", failure: result.failure });
    }
  }

  const fromError = changeErrors.from;
  const toError = changeErrors.to;
  const noteError = changeErrors.note;
  const noteHint = noteAllowed
    ? "Only you and your organisation see it. For example the guest’s name."
    : "A note is kept only for nights that are booked or blocked.";
  const minError = rulesErrors.min_nights ? `Shortest stay ${rulesErrors.min_nights}.` : undefined;
  const maxError = rulesErrors.max_guests ? `Guests ${rulesErrors.max_guests}.` : undefined;

  return (
    <>
      <Link href="/agent/listings" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Your listings
      </Link>
      <h1 className="mt-2 text-3xl md:text-4xl">Availability</h1>
      <p className="mt-2 text-lg text-ink">
        <Link href={`/listings/${listing.slug}`} className="font-medium hover:underline">
          {listing.title}
        </Link>
        <span className="text-muted"> · Reference {listing.reference}</span>
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Time zone of the dates</dt>
          <dd className="text-ink">{zoneName(timezone)}</dd>
        </div>
        <div>
          <dt className="text-muted">Booking window</dt>
          <dd className="text-ink">
            {formatNight(bookingWindow.from)} to {formatNight(bookingWindow.to)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-start gap-3 rounded-md bg-sunken p-4 text-sm leading-relaxed text-ink">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <p>
          <span className="font-medium">Reasons and notes are private.</span> Visitors only see whether a night is
          available or not. Every night is available until you say otherwise.{" "}
          <span className="font-medium">A request to stay does not block any nights:</span> when you agree a stay with a
          guest, mark its nights as booked here.
        </p>
      </div>

      <Card className="mt-8">
        <h2 className="text-2xl">Calendar</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Choose the first night of a range, then the last. Then say below what to do with those nights. With a
          keyboard, the arrow keys move between days and Enter or Space chooses one.
        </p>
        <NightCalendar
          // On a phone the grid uses the card’s padding too, so "Blocked" fits in a cell.
          className="-mx-3 mt-5 sm:mx-0"
          label={`Availability calendar of ${listing.title}`}
          first={bookingWindow.from}
          last={bookingWindow.to}
          today={bookingWindow.from}
          kindOf={(night) => {
            const range = rangeOf(night);
            return range ? reasonKinds[range.reason] : "available";
          }}
          canPick={inWindow}
          selected={selected}
          ends={{ from: "first night of the range", to: "last night of the range" }}
          onPick={(day) => {
            setChangeResult(null);
            setChangeErrors({});
            // The first pick, or a pick after a finished range, starts a range; the next ends it.
            if (!selected.from || selected.to) {
              setFrom(day);
              setTo("");
            } else {
              const range = orderedRange(selected.from, day);
              setFrom(range.from);
              setTo(range.to);
            }
          }}
          showKinds
          legend={["available", "booked", "blocked"]}
        />

        <form onSubmit={handleChange} noValidate className="mt-6 border-t border-line pt-5">
          <h3 className="font-sans text-lg font-semibold tracking-normal text-ink">Change nights</h3>
          <p className="mt-1 text-sm text-muted">
            {nights > 0
              ? `${formatRange(from, to)} · ${nightCount(nights)} chosen.`
              : "Choose the nights in the calendar, or type the dates here."}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="change-from" label="First night" error={fromError}>
              <Input
                id="change-from"
                name="from"
                type="date"
                required
                min={bookingWindow.from}
                max={bookingWindow.to}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-invalid={Boolean(fromError)}
                aria-describedby={fieldDescribedBy("change-from", { error: fromError })}
              />
            </Field>
            <Field id="change-to" label="Last night" hint="Included. For one night, the same date." error={toError}>
              <Input
                id="change-to"
                name="to"
                type="date"
                required
                min={isNight(from) ? from : bookingWindow.from}
                max={bookingWindow.to}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-invalid={Boolean(toError)}
                aria-describedby={fieldDescribedBy("change-to", { hint: "hint", error: toError })}
              />
            </Field>
            <Field id="change-status" label="What to do with these nights" error={changeErrors.status}>
              <SearchableSelect
                id="change-status"
                name="status"
                value={action}
                onValueChange={(value) => setAction(value as AvailabilityStatus)}
                aria-invalid={Boolean(changeErrors.status)}
                aria-describedby={fieldDescribedBy("change-status", { error: changeErrors.status })}
                options={actions.map(({ value, label }) => ({ value, label }))}
              />
            </Field>
            <Field id="change-note" label="Private note" optional hint={noteHint} error={noteError}>
              <Input
                id="change-note"
                name="note"
                maxLength={NOTE_MAX}
                autoComplete="off"
                disabled={!noteAllowed}
                value={noteAllowed ? note : ""}
                onChange={(event) => setNote(event.target.value)}
                aria-invalid={Boolean(noteError)}
                aria-describedby={fieldDescribedBy("change-note", { hint: noteHint, error: noteError })}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending !== null} aria-busy={pending === "change"}>
              {pending === "change" ? "Saving…" : (actions.find((item) => item.value === action)?.label ?? "Save")}
            </Button>
            {(from || to) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setChangeErrors({});
                }}
              >
                Clear the dates
              </Button>
            )}
          </div>
          <div ref={changeStatus} className="mt-4 scroll-mt-24">
            {changeResult?.tone === "success" && <Alert tone="success" title={changeResult.text} />}
            {changeResult?.tone === "danger" && (
              <Alert title={changeResult.failure.message} traceId={changeResult.failure.traceId}>
                {changeErrors.changes && <p>{changeErrors.changes}</p>}
              </Alert>
            )}
          </div>
        </form>
      </Card>

      <section aria-labelledby="ranges-heading" className="mt-10">
        <h2 id="ranges-heading" className="text-2xl">
          Nights that are not available
        </h2>
        {ranges.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
            Every night in the booking window is available.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {ranges.map((range) => {
              const count = nightsBetween(range.first_night, range.last_night) + 1;
              const words = formatRange(range.first_night, range.last_night);
              return (
                <li key={range.id}>
                  <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {words}
                        <span className="font-normal text-muted">{nightCount(count)}</span>
                        <Badge tone={range.reason === "BOOKED" ? "primary" : "neutral"}>{reasonLabels[range.reason]}</Badge>
                      </p>
                      {range.note && (
                        <p className="mt-1 break-words text-sm text-muted">
                          <span className="sr-only">Private note: </span>
                          {range.note}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending !== null}
                      aria-busy={pending === range.id}
                      onClick={() =>
                        void apply({ from: range.first_night, to: range.last_night, status: "AVAILABLE" }, range.id)
                      }
                    >
                      Make available
                      <span className="sr-only">: {words}</span>
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rules-heading" className="mt-10">
        <Card>
          <h2 id="rules-heading" className="text-2xl">
            Stay rules
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Shown on the listing. A request to stay must be at least the shortest stay and for no more guests than
            this.
          </p>
          <form
            // The stored rules are the starting values; a save starts the form again from them.
            key={`${state.calendar.min_nights}-${state.calendar.max_guests}`}
            onSubmit={handleRules}
            className="mt-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rules-min-nights" label="Shortest stay, in nights" hint="1 to 365." error={minError}>
                <Input
                  id="rules-min-nights"
                  name="min_nights"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={365}
                  step={1}
                  defaultValue={state.calendar.min_nights}
                  aria-invalid={Boolean(minError)}
                  aria-describedby={fieldDescribedBy("rules-min-nights", { hint: "hint", error: minError })}
                />
              </Field>
              <Field id="rules-max-guests" label="Guests, at most" hint="1 to 50." error={maxError}>
                <Input
                  id="rules-max-guests"
                  name="max_guests"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={50}
                  step={1}
                  defaultValue={state.calendar.max_guests ?? ""}
                  aria-invalid={Boolean(maxError)}
                  aria-describedby={fieldDescribedBy("rules-max-guests", { hint: "hint", error: maxError })}
                />
              </Field>
            </div>
            <Button type="submit" className="mt-4" disabled={pending !== null} aria-busy={pending === "rules"}>
              {pending === "rules" ? "Saving…" : "Save stay rules"}
            </Button>
            <div className="mt-4">
              {rulesResult?.tone === "success" && <Alert tone="success" title={rulesResult.text} />}
              {rulesResult?.tone === "danger" && (
                <Alert title={rulesResult.failure.message} traceId={rulesResult.failure.traceId} />
              )}
            </div>
          </form>
        </Card>
      </section>

      <p className="mt-8 text-sm text-muted">
        A change can take up to a minute to show on{" "}
        <Link href={`/listings/${listing.slug}`} className="font-medium text-primary-ink hover:underline">
          the public listing
        </Link>
        . Search results that ask for dates follow straight away.
      </p>
    </>
  );
}

/**
 * The availability calendar of one short stay, for whoever manages it: choose
 * a range of nights in the grid or by date, then mark it booked, block it or
 * make it available again; remove a stored range; set the stay rules. Every
 * save goes to the API, which answers with the calendar as it now is.
 */
export function AvailabilityEditor({ listingId }: { listingId: string }) {
  return <RequireAuth>{() => <Editor listingId={listingId} />}</RequireAuth>;
}
