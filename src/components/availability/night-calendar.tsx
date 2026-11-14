"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { addDays, addMonths, formatMonth, formatNight, monthOf, monthWeeks, nightsBetween } from "@/lib/nights";

/**
 * What a night is. The public calendar knows only the first two; the lister's
 * also knows why a night is not available.
 */
export type NightKind = "available" | "unavailable" | "booked" | "blocked";

export const nightKindLabels: Record<NightKind, string> = {
  available: "Available",
  unavailable: "Not available",
  booked: "Booked",
  blocked: "Blocked",
};

type Props = {
  /** Names the calendar for assistive technology: "Availability of Safari lodge". */
  label: string;
  /** The first and last day the calendar covers. Days outside are shown but cannot be reached. */
  first: string;
  last: string;
  /** Today in the listing's time zone. */
  today: string;
  kindOf: (night: string) => NightKind;
  /** Whether choosing this day does anything now. A day that cannot be picked is `aria-disabled`. */
  canPick: (day: string) => boolean;
  /** The chosen span, inclusive. `to` is null while only the first day is chosen. */
  selected: { from: string | null; to: string | null };
  /** What the two ends of the span are called in a day's accessible name. */
  ends?: { from: string; to: string };
  onPick: (day: string) => void;
  /** Write the kind in each cell that is not available ("Booked", "Blocked"): the lister's calendar. */
  showKinds?: boolean;
  /** The kinds to explain under the calendar, in order. */
  legend: NightKind[];
  className?: string;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const kindClass: Record<NightKind, string> = {
  available: "bg-surface text-ink",
  // Struck through, so it does not rest on colour.
  unavailable: "bg-sunken text-subtle line-through",
  booked: "bg-info-soft text-ink",
  // Hatched, so "blocked" and "booked" differ by pattern as well as by word.
  blocked:
    "bg-sunken text-ink bg-[repeating-linear-gradient(135deg,transparent_0,transparent_5px,var(--color-line-strong)_5px,var(--color-line-strong)_6px)]",
};

/** The same day of another month, or its last day where it is shorter (31 January to 28 February). */
function sameDayOf(month: string, day: string): string {
  const days = nightsBetween(`${month}-01`, `${addMonths(month, 1)}-01`);
  return `${month}-${String(Math.min(Number(day.slice(8)), days)).padStart(2, "0")}`;
}

const navButton =
  "flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";

/**
 * A month calendar of nights: two months side by side from `md`, one on
 * phones, with previous and next inside the window it covers.
 *
 * It shows state and reports picks; it holds no rules. The parent says what
 * each night is (`kindOf`), which days can be picked now (`canPick`) and what
 * is selected, so the same grid serves a visitor choosing a stay and a lister
 * choosing a range to change.
 *
 * Each month is a table with `role="grid"`: weekday column headers, a row
 * header per week, and one cell per day carrying `aria-selected` and
 * `aria-disabled`. One cell is in the tab order; arrow keys move by a day or
 * a week, Home and End to the ends of the week, Page Up and Page Down by a
 * month, and Enter or Space picks. State is never colour alone: an
 * unavailable night is struck through, a blocked one hatched, and every cell's
 * accessible name says what it is.
 *
 * It renders on the server, so the first months are readable without
 * JavaScript; picking and the month buttons need it.
 */
export function NightCalendar({
  label,
  first,
  last,
  today,
  kindOf,
  canPick,
  selected,
  ends,
  onPick,
  showKinds = false,
  legend,
  className,
}: Props) {
  const firstMonth = monthOf(first);
  const lastMonth = monthOf(last);
  const [month, setMonth] = useState(() => monthOf(selected.from ?? first));
  // The one day in the tab order. It follows the keyboard, not the mouse.
  const [focusDay, setFocusDay] = useState(() => selected.from ?? first);
  const moveFocus = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  // The window moves on at midnight and when the parent reads the calendar again.
  const shownMonth = month < firstMonth ? firstMonth : month > lastMonth ? lastMonth : month;
  const tabDay = focusDay < first ? first : focusDay > last ? last : focusDay;
  const months = [shownMonth, addMonths(shownMonth, 1)].filter((item) => item <= lastMonth);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    root.current?.querySelector<HTMLElement>(`[data-night="${tabDay}"]`)?.focus();
  }, [tabDay, shownMonth]);

  /** Moves the keyboard focus to a day, turning the page when it is not on show. */
  function focusOn(day: string) {
    const target = day < first ? first : day > last ? last : day;
    const targetMonth = monthOf(target);
    // On phones one month is on show; from `md`, two.
    const twoUp = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    const lastShown = twoUp ? addMonths(shownMonth, 1) : shownMonth;
    if (targetMonth < shownMonth) setMonth(targetMonth);
    else if (targetMonth > lastShown) setMonth(twoUp ? addMonths(targetMonth, -1) : targetMonth);
    moveFocus.current = true;
    setFocusDay(target);
  }

  function handleKey(event: KeyboardEvent<HTMLTableCellElement>, day: string) {
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekday),
      End: () => addDays(day, 6 - weekday),
      PageUp: () => sameDayOf(addMonths(monthOf(day), -1), day),
      PageDown: () => sameDayOf(addMonths(monthOf(day), 1), day),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      focusOn(move());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (canPick(day)) onPick(day);
    }
  }

  const inSpan = (day: string) =>
    selected.from !== null && (selected.to === null ? day === selected.from : day >= selected.from && day <= selected.to);

  /** "Tuesday 17 November 2026, available, first night". */
  function describe(day: string, kind: NightKind, outside: boolean): string {
    const parts = [formatNight(day, "long")];
    if (day === today) parts.push("today");
    parts.push(outside ? "outside the booking window" : nightKindLabels[kind].toLowerCase());
    if (day === selected.from) parts.push(ends?.from ?? "selected");
    else if (selected.to !== null && day === selected.to) parts.push(ends?.to ?? "selected");
    else if (inSpan(day)) parts.push("selected");
    return parts.join(", ");
  }

  return (
    <div ref={root} role="group" aria-label={label} className={className}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={navButton}
          onClick={() => setMonth(addMonths(shownMonth, -1))}
          disabled={shownMonth <= firstMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          <span className="sr-only">Showing </span>
          {formatMonth(months[0])}
          {/* The second month is on show from `md` only. */}
          {months[1] && <span className="hidden md:inline"> and {formatMonth(months[1])}</span>}
        </p>
        <button
          type="button"
          className={navButton}
          onClick={() => setMonth(addMonths(shownMonth, 1))}
          disabled={shownMonth >= lastMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {months.map((item, index) => {
          const headingId = `${label.replace(/\W+/g, "-").toLowerCase()}-${item}`;
          return (
            // The second month is for wider screens; a phone pages through one at a time.
            <div key={item} className={index === 1 ? "hidden md:block" : undefined}>
              <h3 id={headingId} className="text-center font-sans text-base font-semibold tracking-normal text-ink">
                {formatMonth(item)}
              </h3>
              <table
                role="grid"
                aria-labelledby={headingId}
                aria-multiselectable="true"
                className="mt-2 w-full table-fixed border-separate border-spacing-0.5"
              >
                {/* The row headers are for assistive technology: their column takes no room. */}
                <colgroup>
                  <col className="w-0" />
                  <col span={7} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="w-0 p-0">
                      <span className="sr-only">Week</span>
                    </th>
                    {WEEKDAYS.map((weekday) => (
                      <th key={weekday} scope="col" abbr={weekday} className="pb-1 text-xs font-medium text-muted">
                        <span aria-hidden="true">{weekday.slice(0, 2)}</span>
                        <span className="sr-only">{weekday}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthWeeks(item).map((week) => {
                    const firstDay = week.find((day) => day !== null) ?? item;
                    return (
                      <tr key={firstDay}>
                        <th scope="row" className="w-0 p-0">
                          <span className="sr-only">Week of {formatNight(firstDay)}</span>
                        </th>
                        {week.map((day, column) => {
                          if (day === null) return <td key={`empty-${column}`} role="gridcell" aria-hidden="true" />;
                          const outside = day < first || day > last;
                          const kind = outside ? "unavailable" : kindOf(day);
                          const pickable = !outside && canPick(day);
                          const chosen = inSpan(day);
                          const end = day === selected.from || (selected.to !== null && day === selected.to);
                          const mark = showKinds && !outside && kind !== "available" ? nightKindLabels[kind] : null;
                          return (
                            <td
                              key={day}
                              role="gridcell"
                              data-night={day}
                              tabIndex={!outside && day === tabDay ? 0 : -1}
                              aria-selected={chosen}
                              aria-disabled={!pickable}
                              aria-current={day === today ? "date" : undefined}
                              aria-label={describe(day, kind, outside)}
                              onClick={() => {
                                if (outside) return;
                                setFocusDay(day);
                                if (pickable) onPick(day);
                              }}
                              onKeyDown={(event) => handleKey(event, day)}
                              className={cn(
                                "relative h-11 select-none rounded-md border p-0 text-center align-middle text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                                // One look at a time, so a selected night never keeps the fill of its kind.
                                end
                                  ? "border-primary bg-primary font-semibold text-on-primary"
                                  : chosen
                                    ? "border-primary bg-primary-soft font-medium text-primary-ink"
                                    : outside
                                      ? "border-transparent text-subtle"
                                      : cn("border-line", kindClass[kind]),
                                pickable ? "cursor-pointer hover:border-primary" : !outside && "cursor-not-allowed",
                                // Today is ringed and bold, whatever else it is.
                                day === today && "font-bold shadow-[inset_0_0_0_2px_var(--color-ink)]",
                              )}
                            >
                              <span aria-hidden="true" className="block leading-tight">
                                {Number(day.slice(8))}
                              </span>
                              {mark && (
                                <span aria-hidden="true" className="block text-[0.625rem] leading-none tracking-tight no-underline">
                                  {mark}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Key">
        {legend.map((kind) => (
          <li key={kind} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("flex size-6 items-center justify-center rounded-sm border border-line text-xs", kindClass[kind])}
            >
              {kind === "unavailable" ? "12" : ""}
            </span>
            {nightKindLabels[kind]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-6 rounded-sm bg-surface shadow-[inset_0_0_0_2px_var(--color-ink)]" />
          Today
        </li>
      </ul>
    </div>
  );
}
