"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getSlots, type SlotTarget } from "@/lib/api/appointment-availability";
import {
  channelLabel,
  dayLabel,
  firstOpenDay,
  minutesText,
  nextDate,
  slotTime,
  zoneName,
  type SlotAnswer,
} from "@/lib/appointment-availability";
import { cn } from "@/lib/cn";

const PAGE_DAYS = 14;

type Props = {
  target: SlotTarget;
  /** The chosen start (UTC ISO), or "". */
  value: string;
  onChange: (startUtc: string) => void;
  serviceId: string;
  onServiceChange: (id: string) => void;
  /** Called once the API says whether the professional offers slots. */
  onConfigured: (configured: boolean) => void;
  error?: string;
};

/**
 * The offered times of a viewing or consultation (API 0.51.0): days, then
 * the free times of the chosen day, in the market's time zone (named). When
 * the professional has no calendar, it renders nothing and the form keeps its
 * free date-and-time field.
 */
export function SlotPicker({ target, value, onChange, serviceId, onServiceChange, onConfigured, error }: Props) {
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [answer, setAnswer] = useState<SlotAnswer | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const key = JSON.stringify(target);

  useEffect(() => {
    let cancelled = false;
    getSlots(JSON.parse(key) as SlotTarget, { from, days: PAGE_DAYS, serviceId: serviceId || undefined }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        // Slots are a convenience: on any failure, fall back to the free field.
        onConfigured(false);
        setAnswer(null);
        return;
      }
      onConfigured(result.data.configured);
      setAnswer(result.data);
      setDay((current) => (current && result.data.days.some((d) => d.date === current) ? current : firstOpenDay(result.data.days)));
    });
    return () => {
      cancelled = true;
    };
  }, [key, from, serviceId, onConfigured]);

  if (!answer?.configured) return null;
  const zone = answer.timezone;
  const today = answer.days.find((d) => d.date === day);
  const errorId = error ? "preferred_slot-error" : undefined;
  const service = answer.services.find((s) => s.id === serviceId);

  return (
    <div className="grid gap-4">
      {answer.services.length > 0 && (
        <Field id="service_id" label="Consultation" optional hint={service?.notes ?? "Choose what you would like to discuss."}>
          <SearchableSelect
            id="service_id"
            value={serviceId}
            onValueChange={(id) => {
              onServiceChange(id);
              onChange("");
            }}
            options={[
              { value: "", label: "A general consultation" },
              ...answer.services.map((s) => ({ value: s.id, label: `${s.name} · ${minutesText(s.duration_minutes)} · ${channelLabel(s.channel)}` })),
            ]}
          />
        </Field>
      )}
      <fieldset className="min-w-0" aria-describedby={errorId}>
        <legend className="text-sm font-medium text-ink">
          Choose a time <span className="font-normal text-muted">(optional)</span>
        </legend>
        <p className="mt-1 text-sm text-muted">
          Free times in {zoneName(zone)} ({zone}), {minutesText(answer.slot_minutes ?? 30)} each. The agent confirms it.
        </p>
        <div role="group" aria-label="Days" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {answer.days.map((d) => (
            <button
              key={d.date}
              type="button"
              disabled={d.slots.length === 0}
              aria-pressed={d.date === day}
              onClick={() => setDay(d.date)}
              className={cn(
                "min-h-11 shrink-0 rounded-md border px-3 py-1.5 text-sm",
                d.date === day ? "border-primary bg-primary-soft font-medium text-primary-ink" : "border-line bg-surface text-ink",
                d.slots.length === 0 && "cursor-not-allowed text-muted line-through opacity-60",
              )}
            >
              {dayLabel(d.date)}
              <span className="sr-only">{d.slots.length === 0 ? ", no free times" : `, ${d.slots.length} free times`}</span>
            </button>
          ))}
        </div>
        {today && today.slots.length > 0 ? (
          <div role="radiogroup" aria-label={`Times on ${dayLabel(today.date)}`} className="mt-3 flex flex-wrap gap-2">
            {today.slots.map((s) => {
              const picked = s.start_utc === value;
              return (
                <button
                  key={s.start_utc}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => onChange(picked ? "" : s.start_utc)}
                  className={cn(
                    "min-h-11 min-w-20 rounded-md border px-3 py-1.5 text-sm tabular-nums",
                    picked ? "border-primary bg-primary font-medium text-on-primary" : "border-line bg-surface text-ink hover:border-primary",
                  )}
                >
                  {slotTime(s.start_utc, zone)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No free times in these days.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {from && (
            <Button variant="ghost" size="sm" onClick={() => setFrom(undefined)}>
              Earliest dates
            </Button>
          )}
          {answer.days.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFrom(nextDate(answer.days[answer.days.length - 1].date))}>
              Later dates
            </Button>
          )}
        </div>
        {error && (
          <p id="preferred_slot-error" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
}
