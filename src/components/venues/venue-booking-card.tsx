"use client";

import { Clock, Users } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { emptyChoice, chosenSpan, QuoteTable, SlotPicker, SpanLines, useVenueAvailability, type SlotChoice } from "@/components/venues/slot-picker";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import type { CalendarSource } from "@/lib/calendar";
import { createVenueQuote } from "@/lib/api/venues";
import {
  refusalReason,
  SLOT_TAKEN_TEXT,
  slotUnavailableText,
  statusMeaning,
  statusTone,
  type VenueBooking,
} from "@/lib/venue-bookings";
import { formatAmount } from "@/lib/venue-quote";
import { formatWhen } from "@/components/portal/portal-ui";
import { durationText, venueSpanText, visitorTimeNote } from "@/lib/venue-time";

/**
 * One thing a person can do with an hourly booking. `needs` opens a step in
 * place first: "are you sure", a reason, or a new time (the host's proposal,
 * which is quoted before it is sent).
 */
export type BookingAction = {
  key: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  needs?: "confirmation" | "reason" | "optional-reason" | "time";
  heading?: string;
  confirm?: string;
  explain?: ReactNode;
  run: (input: string) => Promise<ApiResult<VenueBooking>>;
};

type Props = {
  booking: VenueBooking;
  viewer: "CUSTOMER" | "HOST";
  actions: BookingAction[];
  /** The visitor's own zone, for the "your time" note. */
  visitorZone: string | null;
  /** Reads the single booking, which carries the events. */
  loadEvents: (id: string) => Promise<VenueBooking | null>;
  /** After an action, or a refusal because the booking changed. */
  onChanged: (booking?: VenueBooking) => void;
  children?: ReactNode;
  /** Where "Add to calendar" downloads from; shown only while confirmed and to come. */
  calendar?: CalendarSource;
};

const actorWords: Record<string, string> = { CUSTOMER: "the customer", HOST: "the host", SYSTEM: "RightProperty365" };

/** A refused action in plain words. */
function refusalOf(failure: ApiFailure, viewer: "CUSTOMER" | "HOST"): string {
  switch (failure.code) {
    case "SLOT_TAKEN":
      return viewer === "HOST"
        ? SLOT_TAKEN_TEXT
        : "Another booking for this time was confirmed first, so this time cannot be accepted. Ask the host for another time.";
    case "SLOT_UNAVAILABLE":
      return slotUnavailableText(refusalReason(failure.body, failure.fields), failure.message);
    case "INVALID_BOOKING_TRANSITION":
      return "This booking changed while the page was open. The list has been read again.";
    case "QUOTE_EXPIRED":
      return "The estimate for the new time expired. Choose the time again.";
    case "QUOTE_ALREADY_USED":
      return "That estimate was already used. Choose the time again.";
    default:
      return failure.message;
  }
}

/** The host's "Propose another time": the venue's free times, a quote, then the proposal. */
function ProposeStep({
  booking,
  action,
  onDone,
  onCancel,
}: {
  booking: VenueBooking;
  action: BookingAction;
  onDone: (result: ApiResult<VenueBooking>) => void;
  onCancel: () => void;
}) {
  const listingId = booking.listing?.id ?? "";
  const { state, reload } = useVenueAvailability(listingId);
  const [choice, setChoice] = useState<SlotChoice>(emptyChoice);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const idPrefix = `propose-${booking.id}`;

  if (!listingId) return <Alert title="This booking names no listing, so no new time can be chosen here." />;
  if (state.status === "loading") return <p className="text-sm text-muted" role="status">Loading the free times…</p>;
  if (state.status === "off") return <Alert tone="warning" title="Hourly booking is switched off for this listing, so no new time can be proposed." />;
  if (state.status === "error") {
    return (
      <>
        <Alert title={state.failure.message} traceId={state.failure.traceId} />
        <Button variant="secondary" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </>
    );
  }

  const span = chosenSpan(state.availability, choice, state.at);

  async function send() {
    if (!span) {
      setProblem("Choose a date, a start time and how long.");
      return;
    }
    setPending(true);
    setProblem(null);
    const quote = await createVenueQuote(listingId, span.start, span.end);
    if (!quote.ok) {
      setPending(false);
      setProblem(refusalOf(quote.failure, "HOST"));
      if (quote.failure.code === "SLOT_UNAVAILABLE") reload();
      return;
    }
    const result = await action.run(quote.data.id);
    setPending(false);
    onDone(result);
  }

  return (
    <div className="grid gap-4">
      <SlotPicker
        idPrefix={idPrefix}
        availability={state.availability}
        now={state.at}
        choice={choice}
        onChoice={(next) => {
          setChoice(next);
          setProblem(null);
        }}
        disabled={pending}
      />
      {span && <SpanLines start={span.start} end={span.end} timeZone={state.availability.timeZone} visitorZone={null} />}
      {problem && <Alert title={problem} />}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void send()} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Sending…" : (action.confirm ?? "Send the new time")}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Keep as it is
        </Button>
      </div>
    </div>
  );
}

/**
 * An hourly booking in a list: status, reference, the time in the venue's
 * zone (and the viewer's own when it differs), the listing, the estimate,
 * the cancellation policy, any proposed time, the actions allowed now, and
 * a "History" expander with the audit events.
 */
export function VenueBookingCard({ booking, viewer, actions, visitorZone, loadEvents, onChanged, children, calendar }: Props) {
  const [open, setOpen] = useState<BookingAction | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [events, setEvents] = useState<VenueBooking["events"] | "loading" | "failed" | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const headingId = `venue-booking-${booking.id}`;
  const inputId = `${headingId}-input`;
  const start = Date.parse(booking.start);
  const end = Date.parse(booking.end);
  const minutes = Number.isNaN(start) || Number.isNaN(end) ? null : Math.round((end - start) / 60_000);

  function finish(result: ApiResult<VenueBooking>) {
    if (result.ok) {
      setOpen(null);
      setEvents(null);
      onChanged(result.data);
      return;
    }
    setFailure({ text: refusalOf(result.failure, viewer), traceId: result.failure.traceId });
    if (result.failure.code === "INVALID_BOOKING_TRANSITION") {
      setOpen(null);
      onChanged();
    }
  }

  async function run(action: BookingAction, value = "") {
    setPending(true);
    setFailure(null);
    const result = await action.run(value);
    setPending(false);
    finish(result);
  }

  function submit(action: BookingAction) {
    const raw = input.current?.value.trim() ?? "";
    if (action.needs === "reason" && raw.length === 0) {
      setInputError(viewer === "HOST" ? "Say why, in a few words. The customer is shown this." : "Say why, in a few words.");
      input.current?.focus();
      return;
    }
    setInputError(null);
    void run(action, raw);
  }

  const ownTime = Number.isNaN(start) || Number.isNaN(end) ? null : visitorTimeNote(start, end, booking.timeZone, visitorZone);
  const proposedOwnTime = booking.proposed
    ? visitorTimeNote(Date.parse(booking.proposed.start), Date.parse(booking.proposed.end), booking.timeZone, visitorZone)
    : null;
  const proposedByViewer = booking.proposed && (booking.proposed.by ?? "HOST").toUpperCase() === viewer;
  const total = booking.totalExcludingDeposit && booking.currency ? formatAmount(booking.totalExcludingDeposit, booking.currency) : null;

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">Hourly booking</Badge>
        <Badge tone={statusTone(booking.status)}>{booking.statusLabel}</Badge>
        <span className="ml-auto font-mono text-xs text-subtle">{booking.reference}</span>
      </div>

      <h3 id={headingId} className="mt-3 flex items-start gap-2 font-sans text-base font-semibold tracking-normal text-ink">
        <Clock className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden="true" />
        <span>
          {Number.isNaN(start) || Number.isNaN(end) ? "Time not known" : venueSpanText(start, end, booking.timeZone)}
          {minutes !== null && <span className="font-normal text-muted"> · {durationText(minutes)}</span>}
        </span>
      </h3>
      {ownTime && <p className="mt-1 pl-7 text-sm text-muted">That is {ownTime}.</p>}
      <p className="mt-2 text-sm text-muted">{statusMeaning(booking.status, viewer)}</p>

      {booking.proposed && booking.status === "RESCHEDULE_REQUESTED" && (
        <div className="mt-3 rounded-md bg-warning-soft p-3 text-sm text-ink">
          <p>
            {proposedByViewer ? (viewer === "HOST" ? "You proposed" : "You asked for") : viewer === "HOST" ? "The customer asked for" : "The host proposed"} a new
            time: <strong>{venueSpanText(Date.parse(booking.proposed.start), Date.parse(booking.proposed.end), booking.timeZone)}</strong>
            {booking.proposed.totalExcludingDeposit && booking.currency && <> · estimate {formatAmount(booking.proposed.totalExcludingDeposit, booking.currency)}</>}.
            {proposedByViewer ? " Waiting for an answer." : ""}
          </p>
          {proposedOwnTime && <p className="mt-1 text-muted">That is {proposedOwnTime}.</p>}
        </div>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {booking.listing && (
          <div className="sm:col-span-2">
            <dt className="sr-only">Venue</dt>
            <dd>
              {booking.listing.slug ? (
                <Link href={`/listings/${booking.listing.slug}`} className="font-medium text-primary-ink hover:underline">
                  {booking.listing.title}
                </Link>
              ) : (
                <span className="font-medium text-ink">{booking.listing.title}</span>
              )}
              {booking.listing.reference && <span className="text-muted"> · {booking.listing.reference}</span>}
            </dd>
          </div>
        )}
        {total && (
          <div>
            <dt className="text-muted">Estimate</dt>
            <dd className="text-ink">
              {total}
              {booking.deposit && booking.currency && <span className="text-muted"> · deposit {formatAmount(booking.deposit, booking.currency)}, payable to the host if confirmed</span>}
            </dd>
          </div>
        )}
        {booking.attendees !== null && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">People attending</dt>
            <Users className="size-4 text-muted" aria-hidden="true" />
            <dd className="text-ink">{booking.attendees === 1 ? "1 person" : `${booking.attendees} people`}</dd>
          </div>
        )}
        {booking.message && (
          <div className="sm:col-span-2">
            <dt className="sr-only">Message</dt>
            <dd className="whitespace-pre-line text-muted">{booking.message}</dd>
          </div>
        )}
        {booking.reason && (booking.status === "CANCELLED" || booking.status === "DECLINED") && (
          <div className="sm:col-span-2">
            <dt className="sr-only">Reason</dt>
            <dd className="text-muted">
              {booking.status === "DECLINED" ? "Declined" : "Cancelled"}
              {booking.cancellation?.by ? ` by ${booking.cancellation.by.toUpperCase() === viewer ? "you" : actorWords[booking.cancellation.by.toUpperCase()] ?? "someone"}` : ""}: {booking.reason}
            </dd>
          </div>
        )}
      </dl>

      {booking.lines.length > 0 && booking.currency && (
        <details className="mt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary-ink">The estimate, line by line</summary>
          <QuoteTable
            quote={{
              currency: booking.currency,
              lines: booking.lines,
              subtotal: null,
              deposit: booking.deposit,
              totalExcludingDeposit: booking.totalExcludingDeposit,
              notice: "This is an estimate. No payment is taken on RightProperty365; the host confirms and arranges payment with you.",
            }}
            className="pb-2"
          />
        </details>
      )}

      {booking.cancellationPolicy && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary-ink">Cancellation policy</summary>
          <p className="whitespace-pre-line pb-2 text-muted">{booking.cancellationPolicy}</p>
        </details>
      )}

      {children}

      {calendar && (
        <AddToCalendar source={calendar} fileKind="venue-booking" reference={booking.reference} status={booking.status} start={booking.start} end={booking.end} />
      )}

      {failure &&<Alert title={failure.text} traceId={failure.traceId} className="mt-4" />}

      {open ? (
        <div className="mt-4 rounded-md border border-line-strong p-4">
          <h4 className="text-base font-semibold text-ink">{open.heading ?? open.label}</h4>
          {open.explain && <div className="mt-1 text-sm text-muted">{open.explain}</div>}
          {open.needs === "time" ? (
            <div className="mt-3">
              <ProposeStep
                booking={booking}
                action={open}
                onDone={finish}
                onCancel={() => {
                  setOpen(null);
                  setFailure(null);
                }}
              />
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(open);
              }}
            >
              {(open.needs === "reason" || open.needs === "optional-reason") && (
                <Field
                  id={inputId}
                  label="Reason"
                  optional={open.needs === "optional-reason"}
                  hint={viewer === "HOST" ? "The customer is shown this." : "The host is shown this."}
                  error={inputError ?? undefined}
                  className="mt-3"
                >
                  <Textarea
                    id={inputId}
                    ref={input}
                    rows={2}
                    maxLength={500}
                    autoFocus
                    aria-invalid={Boolean(inputError)}
                    aria-describedby={fieldDescribedBy(inputId, { hint: "hint", error: inputError ?? undefined })}
                  />
                </Field>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="submit" variant={open.variant === "danger" ? "danger" : "primary"} disabled={pending} aria-busy={pending || undefined} autoFocus={open.needs === "confirmation"}>
                  {pending ? "Saving…" : (open.confirm ?? open.label)}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setOpen(null);
                    setInputError(null);
                  }}
                >
                  Keep as it is
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant === "primary" ? "primary" : "secondary"}
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={() => {
                  setFailure(null);
                  if (action.needs) setOpen(action);
                  else void run(action);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )
      )}

      <details
        className="mt-3 border-t border-line pt-1"
        onToggle={async (event) => {
          if (!event.currentTarget.open || events) return;
          setEvents("loading");
          const full = await loadEvents(booking.id);
          setEvents(full ? full.events : "failed");
        }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-ink">History</summary>
        {events === "loading" && <p className="pb-2 text-sm text-muted" role="status">Loading the history…</p>}
        {events === "failed" && <p className="pb-2 text-sm text-danger" role="alert">The history could not be loaded. Close this and open it again to retry.</p>}
        {Array.isArray(events) && events.length === 0 && <p className="pb-2 text-sm text-muted">Nothing recorded yet.</p>}
        {Array.isArray(events) && events.length > 0 && (
          <ol className="space-y-3 border-l border-line pb-2 pl-4">
            {events.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-sm">
                <p className="text-ink">
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-muted">
                    {" "}
                    by {entry.actor === viewer ? "you" : (entry.actorName ?? actorWords[entry.actor] ?? "someone")}
                  </span>
                </p>
                <p className="text-muted">
                  <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
                  {entry.start && entry.end && entry.action !== "CANCELLED" && ` · for ${venueSpanText(Date.parse(entry.start), Date.parse(entry.end), booking.timeZone)}`}
                </p>
                {entry.reason && <p className="whitespace-pre-line text-muted">{entry.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  );
}
