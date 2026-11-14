"use client";

import { CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import {
  formatInZone,
  zonedTimeToUtc,
  type Appointment,
  type AppointmentStatus,
  type AppointmentTimelineEntry,
} from "@/lib/api/appointments";
import { titleFromCode } from "@/lib/api/auth";
import type { ApiFailure, ApiResult } from "@/lib/api/http";

const tones: Record<AppointmentStatus, "info" | "success" | "warning" | "neutral" | "danger"> = {
  REQUESTED: "info",
  CONFIRMED: "success",
  RESCHEDULE_REQUESTED: "warning",
  COMPLETED: "neutral",
  NO_SHOW: "danger",
  CANCELLED: "neutral",
};

/**
 * One thing a person can do with an appointment. `needs` opens a confirmation
 * step in place: a new time, a reason, or only "are you sure".
 */
export type AppointmentAction = {
  key: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  needs?: "time" | "reason" | "optional-reason" | "confirmation";
  /** The heading and the button of the confirmation step. */
  heading?: string;
  confirm?: string;
  explain?: string;
  run: (input: string) => Promise<ApiResult<unknown>>;
};

type Props<T extends Appointment> = {
  appointment: T;
  /** Who is looking: decides how a proposed time is worded. */
  viewer: "CUSTOMER" | "PROFESSIONAL";
  actions: AppointmentAction[];
  /** Reads the single appointment, which carries the timeline. */
  loadTimeline: (id: string) => Promise<AppointmentTimelineEntry[] | null>;
  /** Called after an action succeeded, or failed because the appointment changed. */
  onChanged: () => void;
  /** Extra rows for this viewer (the customer's contact details in the professional's list). */
  children?: ReactNode;
};

const conflictMessages: Record<string, string> = {
  SLOT_TAKEN: "You already have a confirmed appointment at that time. Propose a different time.",
  INVALID_STATE: "This appointment changed while the page was open. The list has been refreshed.",
};

const actors: Record<string, string> = { CUSTOMER: "the customer", PROFESSIONAL: "the professional", SYSTEM: "RightProperty365" };

/**
 * An appointment in a list: type and status, when (in the appointment's own
 * time zone, named), what it is about, where to meet, the actions the API
 * allows, and a "History" expander with the timeline.
 */
export function AppointmentCard<T extends Appointment>({
  appointment,
  viewer,
  actions,
  loadTimeline,
  onChanged,
  children,
}: Props<T>) {
  const [open, setOpen] = useState<AppointmentAction | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<AppointmentTimelineEntry[] | "loading" | "failed" | null>(null);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const { id, timezone } = appointment;
  const headingId = `appointment-${id}`;

  async function run(action: AppointmentAction, value = "") {
    setPending(true);
    setFailure(null);
    const result = await action.run(value);
    setPending(false);
    if (result.ok) {
      setOpen(null);
      onChanged();
      return;
    }
    const failed: ApiFailure = result.failure;
    setFailure(conflictMessages[failed.code] ?? failed.message);
    if (failed.code === "INVALID_STATE") {
      setOpen(null);
      onChanged();
    }
  }

  function submit(action: AppointmentAction) {
    const raw = input.current?.value.trim() ?? "";
    if (action.needs === "time") {
      const utc = zonedTimeToUtc(raw, timezone);
      if (!utc) return setInputError("Choose a date and a time.");
      if (new Date(utc).getTime() <= Date.now()) return setInputError("Choose a time in the future.");
      setInputError(null);
      return run(action, utc);
    }
    if (action.needs === "reason" && raw.length === 0) return setInputError("Say why, in a few words. The other person is shown this.");
    setInputError(null);
    return run(action, raw);
  }

  const inputId = `${headingId}-input`;
  // A colleague may have acted for the professional's side, so that side is "your organisation".
  const own = viewer === "CUSTOMER" ? "you" : "your organisation";
  const proposer =
    appointment.proposed_by === viewer
      ? `${own.charAt(0).toUpperCase()}${own.slice(1)}`
      : appointment.proposed_by === "CUSTOMER"
        ? "The customer"
        : "The professional";

  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{titleFromCode(appointment.type)}</Badge>
        <Badge tone={tones[appointment.status]}>{appointment.status_label}</Badge>
        <span className="ml-auto font-mono text-xs text-subtle">{appointment.reference}</span>
      </div>

      <h3 id={headingId} className="mt-3 flex items-start gap-2 font-sans text-base font-semibold tracking-normal text-ink">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden="true" />
        <span>
          {formatInZone(appointment.start_utc, timezone)}
          <span className="font-normal text-muted"> · {appointment.duration_minutes} minutes</span>
        </span>
      </h3>

      {appointment.proposed_start_utc && (
        <p className="mt-2 rounded-md bg-warning-soft p-3 text-sm text-ink">
          {proposer} proposed a new time: <strong>{formatInZone(appointment.proposed_start_utc, timezone)}</strong>.
          {appointment.proposed_by === viewer ? " Waiting for the other person to accept it." : ""}
        </p>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        {appointment.listing && (
          <div>
            <dt className="sr-only">Listing</dt>
            <dd>
              <Link href={`/listings/${appointment.listing.slug}`} className="font-medium text-primary-ink hover:underline">
                {appointment.listing.title}
              </Link>
              <span className="text-muted"> · {appointment.listing.reference}</span>
            </dd>
          </div>
        )}
        {appointment.with && (
          <div>
            <dt className="sr-only">With</dt>
            <dd className="text-muted">
              With{" "}
              <Link href={`/directory/${appointment.with.kind}/${appointment.with.slug}`} className="font-medium text-primary-ink hover:underline">
                {appointment.with.name}
              </Link>
            </dd>
          </div>
        )}
        {appointment.location_note && (
          <div className="flex items-start gap-1.5 text-ink">
            <dt className="sr-only">Where to meet</dt>
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
            <dd>{appointment.location_note}</dd>
          </div>
        )}
        {appointment.note && (
          <div>
            <dt className="sr-only">Note</dt>
            <dd className="whitespace-pre-line text-muted">{appointment.note}</dd>
          </div>
        )}
        {appointment.cancel_reason && (
          <div>
            <dt className="sr-only">Reason for cancelling</dt>
            <dd className="text-muted">Cancelled: {appointment.cancel_reason}</dd>
          </div>
        )}
      </dl>

      {children}

      {failure && <Alert title={failure} className="mt-4" />}

      {open ? (
        <form
          className="mt-4 rounded-md border border-line-strong p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(open);
          }}
        >
          <h4 className="text-base font-semibold text-ink">{open.heading ?? open.label}</h4>
          {open.explain && <p className="mt-1 text-sm text-muted">{open.explain}</p>}
          {open.needs === "time" && (
            <Field
              id={inputId}
              label={`New date and time (${timezone} time)`}
              hint="The other person has to accept it before it is confirmed."
              error={inputError ?? undefined}
              className="mt-3"
            >
              <Input
                id={inputId}
                ref={input}
                type="datetime-local"
                required
                autoFocus
                aria-invalid={Boolean(inputError)}
                aria-describedby={fieldDescribedBy(inputId, { hint: "hint", error: inputError ?? undefined })}
              />
            </Field>
          )}
          {(open.needs === "reason" || open.needs === "optional-reason") && (
            <Field
              id={inputId}
              label="Reason"
              optional={open.needs === "optional-reason"}
              hint="The other person is shown this."
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
            <Button type="submit" variant={open.variant === "danger" ? "danger" : "primary"} disabled={pending} aria-busy={pending}>
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
      ) : (
        actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant === "primary" ? "primary" : "secondary"}
                disabled={pending}
                aria-busy={pending}
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
          if (!event.currentTarget.open || timeline) return;
          setTimeline("loading");
          setTimeline((await loadTimeline(id)) ?? "failed");
        }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary-ink">History</summary>
        {timeline === "loading" && <p className="pb-2 text-sm text-muted" role="status">Loading the history…</p>}
        {timeline === "failed" && <p className="pb-2 text-sm text-danger" role="alert">The history could not be loaded. Close this and open it again to retry.</p>}
        {Array.isArray(timeline) && (
          <ol className="space-y-3 border-l border-line pb-2 pl-4">
            {timeline.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-sm">
                <p className="text-ink">
                  <span className="font-medium">{entry.event === "ASSIGNED" ? "Assigned" : entry.to_label}</span>
                  <span className="text-muted"> by {entry.actor === viewer ? own : (actors[entry.actor] ?? "someone")}</span>
                </p>
                <p className="text-muted">
                  {formatInZone(entry.at, timezone)}
                  {entry.start_utc && entry.event !== "CANCELLED" && ` · for ${formatInZone(entry.start_utc, timezone)}`}
                </p>
                {entry.note && <p className="whitespace-pre-line text-muted">{entry.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  );
}
