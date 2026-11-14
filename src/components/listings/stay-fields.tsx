"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { addDays, isNight, MAX_STAY_NIGHTS, todayIn } from "@/lib/nights";

const noop = () => () => {};

type Props = {
  defaults: { check_in?: string; check_out?: string; guests_min?: number };
  /** The API's message for a parameter it refused, by parameter name. */
  errors?: Record<string, string>;
};

/** The API names parameters by their code; a visitor knows them by their label. */
const inWords = (message: string) =>
  message.replaceAll("check_in", "the first night").replaceAll("check_out", "the day you leave");

/**
 * The stay filters of the listing search: first night, day of leaving and
 * guests. Native date inputs named for the API's parameters, so the form
 * submits them as it is without JavaScript. With it, the two dates keep each
 * other in order (the day of leaving after the first night, at most 90
 * nights later) and each is required once the other is set: both or neither.
 * The API checks the same rules, and its message is shown under the control.
 */
export function StayFields({ defaults, errors = {} }: Props) {
  // The earliest "today" anywhere on Earth, so the boxes never refuse a night that some listing can still
  // take. Read in the browser: the server’s page must not depend on the clock.
  const today = useSyncExternalStore(noop, () => todayIn("Etc/GMT+12"), () => undefined);
  const [checkIn, setCheckIn] = useState(defaults.check_in ?? "");
  const [checkOut, setCheckOut] = useState(defaults.check_out ?? "");
  const checkInError = errors.check_in ? `First night ${inWords(errors.check_in)}.` : undefined;
  const checkOutError = errors.check_out ? `Day you leave ${inWords(errors.check_out)}.` : undefined;
  const guestsError = errors.guests_min ? `Guests ${errors.guests_min}.` : undefined;
  const checkOutHint = `After the first night, at most ${MAX_STAY_NIGHTS} nights later.`;
  const guestsHint = "Places that sleep at least this many.";

  return (
    <>
      <Field id="search-check-in" label="First night" error={checkInError}>
        <Input
          id="search-check-in"
          name="check_in"
          type="date"
          min={today}
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
          required={checkOut !== ""}
          aria-invalid={Boolean(checkInError)}
          aria-describedby={fieldDescribedBy("search-check-in", { error: checkInError })}
        />
      </Field>
      <Field id="search-check-out" label="Day you leave" hint={checkOutHint} error={checkOutError}>
        <Input
          id="search-check-out"
          name="check_out"
          type="date"
          min={isNight(checkIn) ? addDays(checkIn, 1) : today && addDays(today, 1)}
          max={isNight(checkIn) ? addDays(checkIn, MAX_STAY_NIGHTS) : undefined}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
          required={checkIn !== ""}
          aria-invalid={Boolean(checkOutError)}
          aria-describedby={fieldDescribedBy("search-check-out", { hint: checkOutHint, error: checkOutError })}
        />
      </Field>
      <Field id="search-guests" label="Guests" hint={guestsHint} error={guestsError}>
        <Input
          id="search-guests"
          name="guests_min"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          defaultValue={defaults.guests_min ?? ""}
          aria-invalid={Boolean(guestsError)}
          aria-describedby={fieldDescribedBy("search-guests", { hint: guestsHint, error: guestsError })}
        />
      </Field>
    </>
  );
}
