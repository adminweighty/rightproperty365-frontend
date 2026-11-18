"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LegalLink } from "@/components/legal/legal-link";
import { chosenSpan, emptyChoice, QuoteTable, rateText, SlotPicker, SpanLines, useVenueAvailability, type SlotChoice } from "@/components/venues/slot-picker";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import type { ApiFailure } from "@/lib/api/http";
import { createVenueQuote, requestVenueBooking } from "@/lib/api/venues";
import type { VenueBooking } from "@/lib/venue-bookings";
import { refusalReason, slotUnavailableText } from "@/lib/venue-bookings";
import { expiryText, formatAmount, type VenueQuote } from "@/lib/venue-quote";
import { minutesText } from "@/lib/venue-settings";
import { visitorZone as readVisitorZone, zoneText } from "@/lib/venue-time";

/*
 * "Book by the hour" on a venue's listing page (API 0.33.0, BR-007): a client
 * island, so the cached page stays the same for everyone. It reads the
 * availability in the browser, builds the choices from it, asks the API for
 * a quote of the chosen time and sends a booking request. Enquiry mode: the
 * host confirms, nothing is held before that and no payment is taken.
 */

const MESSAGE_MAX = 1000;

/** The quote step: nothing chosen yet, waiting, the estimate, or why there is none. */
type QuoteState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; quote: VenueQuote }
  | { status: "refused"; text: string; traceId?: string };

/** What a refused quote or request means for the visitor. */
function refusalText(failure: ApiFailure): string {
  if (failure.code === "SLOT_UNAVAILABLE") return slotUnavailableText(refusalReason(failure.body, failure.fields), failure.message);
  if (failure.code === "VALIDATION_FAILED") {
    return failure.fields?.start || failure.fields?.end
      ? `${failure.fields.start ?? failure.fields.end} Choose another time.`
      : failure.message;
  }
  return failure.message;
}

const noSubscription = () => () => {};

/** The time in the address after signing in (`book_date`, `book_start`, `book_minutes`), if any. */
function restoredChoice(): SlotChoice {
  if (typeof window === "undefined") return emptyChoice;
  const params = new URLSearchParams(window.location.search);
  const date = params.get("book_date");
  const start = params.get("book_start");
  const minutes = params.get("book_minutes");
  return date && start && minutes ? { date, start, minutes } : emptyChoice;
}

export function BookByTheHour({ listingId, slug, title }: { listingId: string; slug: string; title: string }) {
  const { status: authStatus } = useAuth();
  const { state, reload, more, hasMore, busyMore } = useVenueAvailability(listingId);
  // After signing in, the time chosen before is in the address it came back to. The picker
  // renders only in the browser, after the availability is read, so the server never sees it.
  const [choice, setChoice] = useState<SlotChoice>(restoredChoice);
  /** The last quote answer, for the time it was asked for. */
  const [quoted, setQuoted] = useState<{ key: string; state: QuoteState } | null>(null);
  /** Why the last time could not be booked; stays while the free times are read again. */
  const [slotNotice, setSlotNotice] = useState<{ text: string; traceId?: string } | null>(null);
  // The visitor's own zone is read in the browser, never on the cached page.
  const zone = useSyncExternalStore(noSubscription, readVisitorZone, () => null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sent, setSent] = useState<VenueBooking | null>(null);
  const receipt = useRef<HTMLDivElement>(null);
  const quoteRef = useRef(0);

  const ready = state.status === "ready" ? state : null;
  const span = ready ? chosenSpan(ready.availability, choice, ready.at) : null;
  const spanKey = span ? `${span.start}/${span.end}` : "";
  const quote: QuoteState = !spanKey ? { status: "none" } : quoted?.key === spanKey ? quoted.state : { status: "loading" };
  const setQuote = (next: QuoteState) => setQuoted({ key: spanKey, state: next });

  // A quote for every complete choice; an answer to an earlier choice is dropped.
  useEffect(() => {
    if (!spanKey) return;
    const [start, end] = spanKey.split("/");
    const ticket = ++quoteRef.current;
    createVenueQuote(listingId, start, end).then((result) => {
      if (ticket !== quoteRef.current) return;
      if (result.ok) {
        setQuoted({
          key: spanKey,
          state: result.data.mixedCurrency
            ? { status: "refused", text: "This estimate mixes currencies, so we cannot show it. Please ask the host." }
            : { status: "ready", quote: result.data },
        });
      } else if (result.failure.code === "SLOT_UNAVAILABLE") {
        // The time was taken or closed meanwhile: say why, and show the venue as it is now.
        setSlotNotice({ text: refusalText(result.failure), traceId: result.failure.traceId });
        setQuoted({ key: spanKey, state: { status: "none" } });
        reload();
      } else {
        setQuoted({ key: spanKey, state: { status: "refused", text: refusalText(result.failure), traceId: result.failure.traceId } });
      }
    });
  }, [listingId, spanKey, reload]);

  if (state.status === "off") return null;

  const nextHref = (() => {
    const params = new URLSearchParams();
    if (choice.date && choice.start && choice.minutes) {
      params.set("book_date", choice.date);
      params.set("book_start", choice.start);
      params.set("book_minutes", choice.minutes);
    }
    const query = params.toString();
    return `/listings/${slug}${query ? `?${query}` : ""}#book-by-the-hour`;
  })();

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quote.status !== "ready") return;
    const data = new FormData(event.currentTarget);
    const message = String(data.get("message") ?? "").trim();
    const attendeesText = String(data.get("attendees") ?? "").trim();
    const accepted = data.get("consent") === "on";
    const problems: Record<string, string> = {};
    const attendees = attendeesText === "" ? undefined : Number(attendeesText);
    if (attendees !== undefined && !(Number.isInteger(attendees) && attendees >= 1 && attendees <= 10000)) {
      problems.attendees = "Enter a whole number from 1 to 10,000, or leave it empty.";
    }
    if (message.length > MESSAGE_MAX) problems.message = `Keep the message to ${MESSAGE_MAX} characters.`;
    if (!accepted) problems.consent = "Tick the box to agree, so the host can answer your request.";
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      document.getElementById(problems.attendees ? "book-attendees" : problems.message ? "book-message" : "book-consent")?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    const result = await requestVenueBooking({ quoteId: quote.quote.id, message, attendees, accepted });
    setSending(false);
    if (result.ok) {
      setSent(result.data);
      globalThis.setTimeout(() => receipt.current?.focus(), 0);
      return;
    }
    const { code } = result.failure;
    if (code === "SLOT_UNAVAILABLE") {
      setSlotNotice({ text: refusalText(result.failure), traceId: result.failure.traceId });
      setQuote({ status: "none" });
      reload();
    } else if (code === "QUOTE_EXPIRED" && span) {
      // A new estimate for the same time; the visitor sends again after reading it.
      setFailure({ ...result.failure, message: "The estimate expired, so here is a new one. Check it and send the request again." });
      const again = await createVenueQuote(listingId, span.start, span.end);
      setQuote(again.ok ? { status: "ready", quote: again.data } : { status: "refused", text: refusalText(again.failure) });
    } else {
      const fields: Record<string, string> = {};
      for (const [path, text] of Object.entries(result.failure.fields ?? {})) fields[path.startsWith("consent") ? "consent" : path] = text;
      setErrors(fields);
      setFailure(result.failure);
    }
  }

  return (
    <section id="book-by-the-hour" aria-labelledby="hourly-heading" className="mt-10 scroll-mt-24">
      <h2 id="hourly-heading" className="flex items-center gap-2 text-2xl">
        <Clock className="size-5 text-primary-ink" aria-hidden="true" />
        Book by the hour
      </h2>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading the free times" className="mt-4 space-y-3">
          <div className="h-6 max-w-sm rounded-md bg-sunken" />
          <div className="h-72 rounded-lg bg-sunken" />
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4">
          <Alert title="We could not load the free times." traceId={state.failure.traceId}>
            {state.failure.message}
          </Alert>
          <Button variant="secondary" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {ready && sent && (
        <div ref={receipt} tabIndex={-1} role="status" className="mt-4 rounded-lg bg-success-soft p-5 outline-none">
          <p className="font-semibold text-success">Booking request sent. Keep this reference: {sent.reference}</p>
          <SpanLines start={sent.start} end={sent.end} timeZone={sent.timeZone} visitorZone={zone} className="mt-2" />
          <p className="mt-2 text-ink">
            <strong>The time is not held until the host confirms it.</strong> We email you when they answer. No payment is
            taken on RightProperty365.
          </p>
          <ButtonLink href="/account/venue-bookings" variant="secondary" className="mt-4">
            See your hourly bookings
          </ButtonLink>
        </div>
      )}

      {ready && !sent && (
        <div className="mt-4 grid gap-5">
          <ul className="grid gap-1 text-sm text-ink">
            {rateText(ready.availability) && <li className="text-base font-semibold">{rateText(ready.availability)}</li>}
            <li>
              Bookings of {minutesText(ready.availability.minMinutes ?? ready.availability.incrementMinutes)}
              {ready.availability.maxMinutes ? ` to ${minutesText(ready.availability.maxMinutes)}` : ""}, in blocks of{" "}
              {minutesText(ready.availability.incrementMinutes)}.
            </li>
            {ready.availability.deposit && ready.availability.currency && (
              <li>Deposit {formatAmount(ready.availability.deposit, ready.availability.currency)}, payable to the host if confirmed.</li>
            )}
            <li className="text-muted">
              Times are in {zoneText(ready.availability.timeZone)}
              {zone && zone !== ready.availability.timeZone ? `; where your own clock differs, we say so beside the time.` : "."}
            </li>
          </ul>

          <SlotPicker
            idPrefix="book"
            availability={ready.availability}
            now={ready.at}
            choice={choice}
            onChoice={(next) => {
              setChoice(next);
              setFailure(null);
              setSlotNotice(null);
            }}
            calendar={{ label: `Free days at ${title}` }}
            disabled={sending}
          />
          {hasMore && (
            <Button variant="secondary" className="justify-self-start" onClick={() => void more()} disabled={busyMore} aria-busy={busyMore || undefined}>
              {busyMore ? "Loading…" : "Show later dates"}
            </Button>
          )}

          <div aria-live="polite" className="grid gap-4">
            {slotNotice && (
              <Alert tone="warning" title="That time cannot be booked" traceId={slotNotice.traceId}>
                {slotNotice.text}
              </Alert>
            )}
            {quote.status === "loading" && <p className="text-sm text-muted">Working out the estimate…</p>}
            {quote.status === "refused" && (
              <Alert tone="warning" title="This time cannot be booked" traceId={quote.traceId}>
                {quote.text}
              </Alert>
            )}
            {quote.status === "ready" && (
              <div className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-sans text-lg font-semibold tracking-normal text-ink">Your estimate</h3>
                <SpanLines start={quote.quote.start || span?.start || ""} end={quote.quote.end || span?.end || ""} timeZone={ready.availability.timeZone} visitorZone={zone} className="mt-2" />
                <QuoteTable quote={quote.quote} className="mt-3" />
                {expiryText(quote.quote.expiresAt, ready.at) && <p className="mt-2 text-xs text-muted">{expiryText(quote.quote.expiresAt, ready.at)}</p>}
              </div>
            )}
          </div>

          {ready.availability.cancellationPolicy && (
            <details className="rounded-md border border-line p-3 text-sm">
              <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">Cancellation policy</summary>
              <p className="mt-2 whitespace-pre-line text-muted">{ready.availability.cancellationPolicy}</p>
              {ready.availability.freeCancellationHours !== null && ready.availability.freeCancellationHours > 0 && (
                <p className="mt-2 text-ink">Free cancellation until {ready.availability.freeCancellationHours} hours before the start.</p>
              )}
            </details>
          )}

          {quote.status === "ready" &&
            (authStatus === "anonymous" ? (
              <div className="rounded-lg bg-sunken p-4">
                <p className="text-sm text-ink">Sign in to send the request. You come back here with this time chosen.</p>
                <ButtonLink href={`/sign-in?next=${encodeURIComponent(nextHref)}`} size="lg" className="mt-3 w-full sm:w-auto">
                  Sign in to send a booking request
                </ButtonLink>
              </div>
            ) : (
              <form onSubmit={send} noValidate className="grid gap-4">
                <Field id="book-attendees" label="People attending" optional error={errors.attendees}>
                  <Input
                    id="book-attendees"
                    name="attendees"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    className="max-w-40"
                    aria-invalid={Boolean(errors.attendees)}
                    aria-describedby={fieldDescribedBy("book-attendees", { error: errors.attendees })}
                  />
                </Field>
                <Field id="book-message" label="Message to the host" optional hint="What the space is for, set-up you need." error={errors.message}>
                  <Textarea
                    id="book-message"
                    name="message"
                    rows={3}
                    maxLength={MESSAGE_MAX}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={fieldDescribedBy("book-message", { hint: "x", error: errors.message })}
                  />
                </Field>
                <div>
                  <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                    <input
                      id="book-consent"
                      type="checkbox"
                      name="consent"
                      required
                      className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? "book-consent-error" : undefined}
                    />
                    <span>
                      I agree that RightProperty365 may share my name, email and this request with the host so they can
                      answer it, as the <LegalLink to="privacyPolicy" /> explains.
                    </span>
                  </label>
                  {errors.consent && (
                    <p id="book-consent-error" className="mt-1.5 text-sm text-danger">
                      {errors.consent}
                    </p>
                  )}
                </div>
                {failure && <Alert tone={failure.code === "QUOTE_EXPIRED" ? "warning" : "danger"} title={failure.message} traceId={failure.traceId} />}
                <p className="text-sm text-muted">
                  This is a request, not a booking: the time is not held until the host confirms it.
                </p>
                <Button type="submit" size="lg" disabled={sending || authStatus === "loading"} aria-busy={sending || undefined} className="w-full sm:w-auto sm:justify-self-start">
                  {sending ? "Sending…" : "Send booking request"}
                </Button>
              </form>
            ))}
          <p className="text-sm text-muted">
            Already asked?{" "}
            <Link href="/account/venue-bookings" className="font-medium text-primary-ink hover:underline">
              See your hourly bookings
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
