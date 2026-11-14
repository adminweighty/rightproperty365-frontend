"use client";

import { CircleCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useStay } from "@/components/availability/stay-calendar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  submitPropertyRequest,
  type ApiFailure,
  type ContactMethod,
  type PropertyRequestReceipt,
  type RequestType,
} from "@/lib/api/property-requests";
import type { Money, Option } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import {
  addDays,
  formatNight,
  formatStay,
  isNight,
  MAX_STAY_NIGHTS,
  nightsBetween,
  stayEstimate,
  stayProblems,
  type StayProblems,
} from "@/lib/nights";
import { LegalLink } from "@/components/legal/legal-link";
import { PRIVACY_NOTICE_VERSION } from "@/lib/env";

type Props = {
  listingId: string;
  listingReference: string;
  advertiserName: string;
  /** The API's `request_types` and `contact_methods` reference sets, in display order. */
  requestTypes: Option[];
  contactMethods: Option[];
  /** A short stay's price per night, for the estimate. The stay itself comes from `StayProvider`. */
  nightlyPrice?: Money;
};

// Behaviour tied to API codes (not lists): these request types can carry a
// preferred time, and only an email reply needs no phone number.
const slotTypes: RequestType[] = ["VIEWING_REQUEST", "CONSULTATION_REQUEST"];
/** A request to stay: valid only on a short stay, and it carries the dates and the number of guests. */
const STAY_REQUEST: RequestType = "STAY_REQUEST";
const EMAIL: ContactMethod = "EMAIL";

// Field names the API may report, mapped to the control that should show them.
const apiFieldToControl: Record<string, string> = {
  "guest_contact.name": "name",
  "guest_contact.email": "email",
  "guest_contact.phone": "phone",
  message: "message",
  request_type: "request_type",
  preferred_contact_method: "preferred_contact_method",
  preferred_slot_utc: "preferred_slot",
  check_in: "check_in",
  check_out: "check_out",
  guests: "guests",
  "consent.accepted": "consent",
  consent: "consent",
};

export function PropertyRequestForm({
  listingId,
  listingReference,
  advertiserName,
  requestTypes: everyRequestType,
  contactMethods,
  nightlyPrice,
}: Props) {
  const { user } = useAuth();
  // Present on a short-stay listing only. Anywhere else a request to stay is not offered.
  const stay = useStay();
  const requestTypes = stay
    ? [...everyRequestType].sort((a, b) => Number(b.value === STAY_REQUEST) - Number(a.value === STAY_REQUEST))
    : everyRequestType.filter((type) => type.value !== STAY_REQUEST);
  const [requestType, setRequestType] = useState<RequestType>(requestTypes[0]?.value ?? "");
  const asksToStay = stay !== null && requestType === STAY_REQUEST;
  const [stayErrors, setStayErrors] = useState<StayProblems>({});
  const [contactMethod, setContactMethod] = useState<ContactMethod>(contactMethods[0]?.value ?? "");
  const phoneRequired = contactMethod !== EMAIL;
  const phoneHint = phoneRequired
    ? "Needed so they can reach you. Include the country code, for example +263 77 123 4567."
    : "Include the country code, for example +263 77 123 4567.";
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [receipt, setReceipt] = useState<PropertyRequestReceipt | null>(null);

  // One key per logical request: a retry of unchanged content reuses it so the
  // API cannot create a duplicate lead; any edit starts a new request.
  const idempotencyKey = useRef<string | null>(null);

  const errors: Record<string, string> = { ...stayErrors };
  for (const [apiField, message] of Object.entries(failure?.fields ?? {})) {
    errors[apiFieldToControl[apiField] ?? apiField] = message;
  }
  // The API names the first taken night inside a sentence of its own; say it plainly.
  if (failure?.code === "DATES_UNAVAILABLE") {
    const taken = /\d{4}-\d{2}-\d{2}/.exec(failure.fields?.check_in ?? "")?.[0];
    errors.check_in = taken
      ? `The night of ${formatNight(taken)} is no longer available. Choose other dates.`
      : "One of these nights is no longer available. Choose other dates.";
  }

  const checkIn = stay?.selection.checkIn ?? "";
  const checkOut = stay?.selection.checkOut ?? "";
  const nights = isNight(checkIn) && isNight(checkOut) ? nightsBetween(checkIn, checkOut) : 0;
  const estimate = nightlyPrice && nights > 0 ? stayEstimate(nightlyPrice.amount, nights) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const slot = text("preferred_slot");

    if (asksToStay) {
      const problems = stayProblems({ checkIn, checkOut, guests: stay.guests }, stay.rules);
      setStayErrors(problems);
      if (Object.keys(problems).length > 0) {
        setFailure(null);
        const firstControl = (["check_in", "check_out", "guests"] as const).find((name) => problems[name]);
        if (firstControl) document.getElementById(firstControl)?.focus();
        return;
      }
    }

    idempotencyKey.current ??= crypto.randomUUID();
    setPending(true);
    setFailure(null);

    const result = await submitPropertyRequest({
      listing_id: listingId,
      request_type: requestType,
      message: text("message"),
      preferred_contact_method: contactMethod,
      // datetime-local is the visitor's local time; the API stores UTC.
      preferred_slot_utc:
        slot && slotTypes.includes(requestType) ? new Date(slot).toISOString() : undefined,
      ...(asksToStay && { check_in: checkIn, check_out: checkOut, guests: Number(stay.guests) }),
      idempotency_key: idempotencyKey.current,
      // Signed-in customers send no name or email; the API uses their profile.
      guest_contact: {
        name: user ? undefined : text("name"),
        email: user ? undefined : text("email"),
        // The API expects E.164, so drop the spaces and dashes people type.
        phone: text("phone").replace(/[\s()-]/g, "") || undefined,
      },
      consent: { privacy_version: PRIVACY_NOTICE_VERSION, accepted: data.get("consent") === "on" },
    });

    setPending(false);
    if (result.ok) {
      idempotencyKey.current = null;
      setReceipt(result.receipt);
    } else {
      setFailure(result.failure);
      // A night was taken since the calendar was read: show it as it is now.
      if (result.failure.code === "DATES_UNAVAILABLE") void stay?.refresh();
    }
  }

  const sentStay = receipt && asksToStay && nights > 0;

  if (receipt) {
    return (
      <div role="status" className="rounded-lg bg-success-soft p-5">
        <p className="flex items-center gap-2 font-medium text-success">
          <CircleCheck className="size-5" aria-hidden="true" />
          Request received
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          We have saved your request and are passing it to {advertiserName}. Keep this reference in
          case you need to follow up:
        </p>
        <p className="mt-3 font-mono text-lg font-medium text-ink">{receipt.reference}</p>
        {sentStay && (
          <p className="mt-3 text-sm leading-relaxed text-ink">
            You asked to stay <span className="font-medium">{formatStay(checkIn, checkOut)}</span>.{" "}
            <strong className="font-semibold">These dates are not reserved</strong> until {advertiserName} confirms
            them with you. Nothing has been booked, and no payment is taken through RightProperty365.
          </p>
        )}
        {receipt.appointment && (
          <p className="mt-3 text-sm leading-relaxed text-ink">
            Your preferred time was saved as appointment{" "}
            <span className="font-mono font-medium">{receipt.appointment.reference}</span>. It is not
            confirmed until {advertiserName} accepts it.{" "}
            {user && (
              <Link href="/account/appointments" className="font-medium text-primary-ink underline-offset-2 hover:underline">
                See your appointments
              </Link>
            )}
          </p>
        )}
        <p className="mt-3 text-sm">
          <Link href={sentStay ? "/faq#is-a-stay-request-a-booking" : "/faq#what-happens-after-enquiry"} target="_blank" rel="noopener" className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
            What happens next?
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setReceipt(null)}>
          Send another request
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        idempotencyKey.current = null;
      }}
      // The stay's own checks replace the browser's bubbles, so every message sits under its control.
      noValidate={asksToStay}
      className="flex flex-col gap-4"
    >
      <Field id="request_type" label="What would you like to do?" error={errors.request_type}>
        <SearchableSelect
          id="request_type"
          name="request_type"
          value={requestType}
          onValueChange={setRequestType}
          aria-invalid={Boolean(errors.request_type)}
          aria-describedby={fieldDescribedBy("request_type", { error: errors.request_type })}
          options={requestTypes.map(({ value, label }) => ({ value, label }))}
        />
      </Field>

      {asksToStay && (
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">Your stay</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field id="check_in" label="First night" error={errors.check_in} className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
              <Input
                id="check_in"
                name="check_in"
                type="date"
                required
                min={stay.rules.today}
                max={stay.rules.lastNight}
                value={checkIn}
                onChange={(event) => {
                  const value = event.target.value;
                  setStayErrors({});
                  // A first night on or after the day of leaving starts the stay again.
                  stay.setSelection({ checkIn: value || null, checkOut: checkOut && value && checkOut > value ? checkOut : null });
                }}
                aria-invalid={Boolean(errors.check_in)}
                aria-describedby={fieldDescribedBy("check_in", { error: errors.check_in })}
              />
            </Field>
            <Field id="check_out" label="Day you leave" error={errors.check_out} className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
              <Input
                id="check_out"
                name="check_out"
                type="date"
                required
                min={isNight(checkIn) ? addDays(checkIn, 1) : addDays(stay.rules.today, 1)}
                max={isNight(checkIn) ? addDays(checkIn, MAX_STAY_NIGHTS) : addDays(stay.rules.lastNight, 1)}
                value={checkOut}
                onChange={(event) => {
                  setStayErrors({});
                  stay.setSelection({ checkIn: checkIn || null, checkOut: event.target.value || null });
                }}
                aria-invalid={Boolean(errors.check_out)}
                aria-describedby={fieldDescribedBy("check_out", { error: errors.check_out })}
              />
            </Field>
          </div>
          <Field
            id="guests"
            label="Guests"
            hint={stay.rules.maxGuests !== null ? `This place sleeps up to ${stay.rules.maxGuests}.` : undefined}
            error={errors.guests}
          >
            <Input
              id="guests"
              name="guests"
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={stay.rules.maxGuests ?? 100}
              step={1}
              value={stay.guests}
              onChange={(event) => {
                setStayErrors({});
                stay.setGuests(event.target.value);
              }}
              aria-invalid={Boolean(errors.guests)}
              aria-describedby={fieldDescribedBy("guests", {
                hint: stay.rules.maxGuests !== null ? "hint" : undefined,
                error: errors.guests,
              })}
            />
          </Field>
          {nights > 0 && (
            <div className="rounded-md bg-sunken p-3 text-sm text-ink" role="status">
              <p className="font-medium">{formatStay(checkIn, checkOut)}</p>
              {estimate && nightlyPrice && (
                <>
                  <p className="mt-1 tabular-nums">
                    {nights} × {formatMoney(nightlyPrice)} ={" "}
                    <span className="font-semibold">{formatMoney({ amount: estimate, currency: nightlyPrice.currency })}</span>
                  </p>
                  <p className="mt-1 text-muted">Estimate. The host confirms the final price.</p>
                </>
              )}
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted">
            This asks the host whether you can stay. It is not a booking: the dates are not held, and no payment is
            taken through RightProperty365.
          </p>
        </fieldset>
      )}

      {slotTypes.includes(requestType) && (
        <Field
          id="preferred_slot"
          label="Preferred date and time"
          optional
          hint="In your local time. The agent will confirm or suggest another slot."
          error={errors.preferred_slot}
        >
          <Input
            id="preferred_slot"
            name="preferred_slot"
            type="datetime-local"
            aria-invalid={Boolean(errors.preferred_slot)}
            aria-describedby={fieldDescribedBy("preferred_slot", {
              hint: "hint",
              error: errors.preferred_slot,
            })}
          />
        </Field>
      )}

      {user ? (
        <p className="rounded-md bg-sunken p-3 text-sm text-muted">
          Sending as <span className="font-medium text-ink">{user.name}</span>{" "}
          <span className="break-all">({user.email})</span>
        </p>
      ) : (
        <>
          <Field id="name" label="Full name" error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy("name", { error: errors.name })}
            />
          </Field>

          <Field id="email" label="Email address" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy("email", { error: errors.email })}
            />
          </Field>
        </>
      )}

      <Field id="preferred_contact_method" label="How should they reply?" error={errors.preferred_contact_method}>
        <SearchableSelect
          id="preferred_contact_method"
          name="preferred_contact_method"
          value={contactMethod}
          onValueChange={setContactMethod}
          aria-invalid={Boolean(errors.preferred_contact_method)}
          aria-describedby={fieldDescribedBy("preferred_contact_method", { error: errors.preferred_contact_method })}
          options={contactMethods.map(({ value, label }) => ({ value, label }))}
        />
      </Field>

      <Field
        id="phone"
        label="Phone number"
        optional={!phoneRequired}
        hint={phoneHint}
        error={errors.phone}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          required={phoneRequired}
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={fieldDescribedBy("phone", { hint: phoneHint, error: errors.phone })}
        />
      </Field>

      <Field id="message" label="Message" error={errors.message}>
        <Textarea
          id="message"
          name="message"
          required
          maxLength={2000}
          defaultValue={
            stay
              ? `Hello, I would like to ask about staying at ${listingReference}.`
              : `Hello, I am interested in ${listingReference}. Please send me more details.`
          }
          aria-invalid={Boolean(errors.message)}
          aria-describedby={fieldDescribedBy("message", { error: errors.message })}
        />
      </Field>

      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <span>
            I agree that RightProperty365 may share these details with {advertiserName} so they can
            answer this request, as the <LegalLink to="privacyPolicy" /> explains.
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" className="mt-1.5 text-sm text-danger">
            {errors.consent}
          </p>
        )}
      </div>

      {failure && <Alert title={failure.message} traceId={failure.traceId} />}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : asksToStay ? "Send request to stay" : "Send request"}
      </Button>
    </form>
  );
}
