"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { NightCalendar } from "@/components/availability/night-calendar";
import { getPublicAvailability } from "@/lib/api/availability";
import {
  addDays,
  canCheckIn,
  canCheckOut,
  formatNight,
  formatStay,
  guestCount,
  isNight,
  nightCount,
  pickStayDay,
  todayIn,
  type StayRules,
  type StaySelection,
} from "@/lib/nights";
import { toStayCalendarData, type StayCalendarData } from "@/lib/stay-calendar";

type Stay = {
  calendar: StayCalendarData;
  rules: StayRules;
  selection: StaySelection;
  setSelection: (selection: StaySelection) => void;
  guests: string;
  setGuests: (guests: string) => void;
  /** Reads the calendar again from the API: after a request the API refused because a night was taken. */
  refresh: () => Promise<void>;
};

const StayContext = createContext<Stay | null>(null);

/** The stay being chosen on a short-stay listing page. Null on any other listing. */
export const useStay = () => useContext(StayContext);

const noop = () => () => {};

/**
 * Holds the dates and guests a visitor is choosing on a short-stay listing,
 * shared by the availability calendar and the request form. They start from
 * the address (`?check_in=…&check_out=…&guests=…`, as the search results link
 * to a listing), read in the browser so the page itself stays cacheable.
 */
export function StayProvider({ calendar: initial, children }: { calendar: StayCalendarData; children: ReactNode }) {
  const [calendar, setCalendar] = useState(initial);
  const [selection, setSelection] = useState<StaySelection>({ checkIn: null, checkOut: null });
  const [guests, setGuests] = useState("");
  // The page may have been rendered yesterday: the listing's today is read in the browser.
  const clientToday = useSyncExternalStore(noop, () => todayIn(calendar.timezone), () => calendar.from);
  const today = clientToday > calendar.from ? clientToday : calendar.from;

  const rules = useMemo<StayRules>(() => {
    const taken = new Set(calendar.unavailable);
    return {
      today,
      lastNight: calendar.to,
      minNights: calendar.minNights,
      maxGuests: calendar.maxGuests,
      isTaken: (night) => night < today || night > calendar.to || taken.has(night),
    };
  }, [calendar, today]);

  useEffect(() => {
    // After the effect has returned, so the first render matches the server's.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const checkIn = params.get("check_in");
      const checkOut = params.get("check_out");
      const wanted = params.get("guests");
      if (isNight(checkIn)) setSelection({ checkIn, checkOut: isNight(checkOut) && checkOut > checkIn ? checkOut : null });
      if (wanted && /^[1-9][0-9]?$/.test(wanted)) setGuests(wanted);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getPublicAvailability(calendar.slug, todayIn(calendar.timezone), calendar.to);
    if (result.ok) setCalendar(toStayCalendarData(result.data));
  }, [calendar.slug, calendar.timezone, calendar.to]);

  const value = useMemo(
    () => ({ calendar, rules, selection, setSelection, guests, setGuests, refresh }),
    [calendar, rules, selection, guests, refresh],
  );
  return <StayContext.Provider value={value}>{children}</StayContext.Provider>;
}

/** "Central Africa Time (Africa/Harare)", or the zone's own name when the browser has no words for it. */
function zoneName(timezone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, timeZoneName: "long" })
      .formatToParts(new Date(0))
      .find((part) => part.type === "timeZoneName")?.value;
    return name ? `${name} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}

/** The day the host last changed the calendar, in the listing's time zone. */
function updatedOn(updatedAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "long", year: "numeric" }).format(
      new Date(updatedAt),
    );
  } catch {
    return formatNight(updatedAt.slice(0, 10));
  }
}

type Props = {
  listingTitle: string;
  /** The first available night, from the listing. Null when none is free. */
  nextAvailable: string | null;
  /** The id of the request form's heading, to jump to once dates are chosen. */
  formId: string;
};

/**
 * "Availability" on a short-stay listing: the rules of a stay in words, then
 * the month calendar. Choosing the first night and then the day of leaving
 * fills in the request form. It reserves nothing, and says so.
 */
export function StayCalendar({ listingTitle, nextAvailable, formId }: Props) {
  const stay = useStay();
  if (!stay) return null;
  const { calendar, rules, selection, setSelection } = stay;
  const choosingEnd = selection.checkIn !== null && selection.checkOut === null;
  const taken = new Set(calendar.unavailable);
  // The first free night as the calendar now has it; the listing's own value until it is read again.
  const firstFree = nextAvailable !== null && nextAvailable >= rules.today && !rules.isTaken(nextAvailable) ? nextAvailable : null;

  return (
    <section aria-labelledby="availability-heading" className="mt-10">
      <h2 id="availability-heading" className="text-2xl">
        Availability
      </h2>
      <ul className="mt-3 space-y-1 text-muted">
        <li>
          Shortest stay: <span className="font-medium text-ink">{nightCount(calendar.minNights)}</span>
          {calendar.maxGuests !== null && (
            <>
              {" · "}Sleeps up to <span className="font-medium text-ink">{guestCount(calendar.maxGuests)}</span>
            </>
          )}
        </li>
        <li>
          {firstFree ? (
            <>
              Next available night: <span className="font-medium text-ink">{formatNight(firstFree)}</span>
            </>
          ) : (
            "No night is marked as available at the moment."
          )}
        </li>
        <li>
          {calendar.updatedAt
            ? `Updated ${updatedOn(calendar.updatedAt, calendar.timezone)}.`
            : "The host has not updated the calendar yet."}{" "}
          Dates are nights in the listing’s time zone, {zoneName(calendar.timezone)}.
        </li>
      </ul>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
        This is the host’s own calendar. Choose your first night, then the day you leave, to fill in the request
        form. Choosing dates does not book or hold them.
      </p>

      <NightCalendar
        className="mt-5"
        label={`Availability of ${listingTitle}`}
        first={rules.today}
        // The day after the last night can still be the day of leaving.
        last={addDays(calendar.to, 1)}
        today={rules.today}
        kindOf={(night) => (night > calendar.to || taken.has(night) ? "unavailable" : "available")}
        canPick={(day) => (choosingEnd && canCheckOut(selection.checkIn!, day, rules)) || canCheckIn(day, rules)}
        selected={{ from: selection.checkIn, to: selection.checkOut }}
        ends={{ from: "first night", to: "day you leave" }}
        onPick={(day) => setSelection(pickStayDay(selection, day, rules))}
        legend={["available", "unavailable"]}
      />

      <p className="mt-4 text-sm text-ink" role="status">
        {selection.checkIn && selection.checkOut ? (
          <>
            <span className="font-medium">{formatStay(selection.checkIn, selection.checkOut)}</span> chosen.{" "}
            <a href={`#${formId}`} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
              Go to the request form
            </a>
          </>
        ) : selection.checkIn ? (
          <>
            First night <span className="font-medium">{formatNight(selection.checkIn)}</span>. Now choose the day you leave.
          </>
        ) : null}
      </p>
      {(selection.checkIn || selection.checkOut) && (
        <button
          type="button"
          className="mt-1 min-h-11 text-sm font-semibold text-primary-ink hover:underline"
          onClick={() => setSelection({ checkIn: null, checkOut: null })}
        >
          Clear dates
        </button>
      )}
    </section>
  );
}
