"use client";

import { CalendarClock, Plus, Trash2, Video } from "lucide-react";
import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  archiveConsultationService,
  createConsultationService,
  getAppointmentSettings,
  listConsultationServices,
  saveAppointmentSettings,
  updateConsultationService,
} from "@/lib/api/appointment-availability";
import type { ApiResult } from "@/lib/api/http";
import {
  availabilityErrorText,
  BUFFERS,
  channelLabel,
  CHANNELS,
  clockOptions,
  HORIZONS,
  hoursErrors,
  LEAD_TIMES,
  leadTimeText,
  minutesText,
  SERVICE_LENGTHS,
  settingsBody,
  SLOT_LENGTHS,
  WEEKDAYS,
  type AppointmentSettings,
  type ConsultationService,
} from "@/lib/appointment-availability";

type Outcome = { tone: "success" | "danger"; text: string; traceId?: string } | null;

const OPENS = clockOptions(false);
const CLOSES = clockOptions(true);
const opts = (values: string[]) => values.map((value) => ({ value, label: value }));

function failure<T>(answer: ApiResult<T>): { fields: Record<string, string>; outcome: Outcome } {
  if (answer.ok) return { fields: {}, outcome: null };
  const code = answer.failure.status === 429 ? "RATE_LIMITED" : answer.failure.code;
  return {
    fields: answer.failure.fields ?? {},
    outcome: answer.failure.fields
      ? { tone: "danger", text: "Some fields need your attention." }
      : { tone: "danger", text: availabilityErrorText(code) ?? answer.failure.message, traceId: answer.failure.traceId },
  };
}

function zones(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}

function HoursForm({ initial }: { initial: AppointmentSettings }) {
  const [form, setForm] = useState<AppointmentSettings>(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const zoneOptions = useMemo(() => opts(zones(initial.timezone)), [initial.timezone]);
  const local = hoursErrors(form.working_hours);
  const update = (patch: Partial<AppointmentSettings>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(local).length > 0) {
      setOutcome({ tone: "danger", text: "Some hours need your attention." });
      return;
    }
    setBusy(true);
    const answer = await saveAppointmentSettings(settingsBody(form));
    setBusy(false);
    if (answer.ok) {
      setForm(answer.data);
      setFields({});
      setOutcome({
        tone: "success",
        text: answer.data.enabled ? "Saved. Customers now choose from your offered times." : "Saved. Customers can ask for any time.",
      });
      return;
    }
    const f = failure(answer);
    setFields(f.fields);
    setOutcome(f.outcome);
  }

  const number = (id: string, label: string, value: number, values: number[], text: (n: number) => string, key: keyof AppointmentSettings, hint?: string) => (
    <Field id={id} label={label} hint={hint} error={fields[key as string]}>
      <SearchableSelect
        id={id}
        value={String(value)}
        onValueChange={(v) => update({ [key]: Number(v) } as Partial<AppointmentSettings>)}
        options={(values.includes(value) ? values : [...values, value].sort((a, b) => a - b)).map((n) => ({ value: String(n), label: text(n) }))}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl">
          <CalendarClock className="size-5 text-primary-ink" aria-hidden="true" />
          Your bookable hours
        </h2>
        <Badge tone={form.enabled ? "success" : "neutral"}>{form.enabled ? "Customers choose from your times" : "Any time can be asked for"}</Badge>
      </div>
      <label className="flex items-start gap-3 text-ink">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          className="mt-1 size-5 shrink-0 accent-(--rp-color-primary-base)"
          aria-describedby="availability-enabled-hint"
        />
        <span>
          <span className="font-medium">Offer only these times</span>
          <span id="availability-enabled-hint" className="block text-sm text-muted">
            Customers then pick a free slot for viewings and consultations sent to you. You can still confirm or propose any time yourself.
          </span>
        </span>
      </label>
      {fields.working_hours && <p className="text-sm text-danger">{fields.working_hours}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="av-zone" label="Time zone" error={fields.timezone}>
          <SearchableSelect id="av-zone" value={form.timezone} onValueChange={(v) => update({ timezone: v })} options={zoneOptions} />
        </Field>
        {number("av-slot", "Slot length", form.slot_minutes, SLOT_LENGTHS, minutesText, "slot_minutes", "Also the step between start times.")}
        {number("av-buffer", "Break between appointments", form.buffer_minutes, BUFFERS, (n) => (n === 0 ? "None" : minutesText(n)), "buffer_minutes")}
        {number("av-lead", "Notice needed", form.lead_time_hours, LEAD_TIMES, leadTimeText, "lead_time_hours")}
        {number("av-horizon", "Bookable ahead", form.horizon_days, HORIZONS, (n) => `${n} days`, "horizon_days")}
        {number("av-max", "Most appointments a day", form.max_per_day, [0, 1, 2, 3, 4, 5, 6, 8, 10, 12], (n) => (n === 0 ? "No limit" : String(n)), "max_per_day")}
      </div>

      <fieldset className="min-w-0 border-t border-line pt-5">
        <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Working hours</legend>
        <p className="mt-1 text-sm text-muted">In the time zone above. A day can have several ranges. A day with no hours is not offered.</p>
        <ul className="mt-4 divide-y divide-line">
          {WEEKDAYS.map((name, dayIndex) => {
            const weekday = dayIndex + 1;
            const rows = form.working_hours.map((range, index) => ({ range, index })).filter(({ range }) => range.weekday === weekday);
            return (
              <li key={name} className="grid gap-3 py-3 md:grid-cols-[8rem_1fr]">
                <p className="pt-2 font-medium text-ink">{name}</p>
                <div className="grid gap-3">
                  {rows.length === 0 && <p className="pt-2 text-sm text-muted">Not offered</p>}
                  {rows.map(({ range, index }) => {
                    const id = `av-hours-${index}`;
                    const error = local[index] ?? fields[`working_hours[${index}]`] ?? fields[`working_hours[${index}].closes`] ?? fields[`working_hours[${index}].opens`];
                    const set = (patch: Partial<typeof range>) =>
                      update({ working_hours: form.working_hours.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
                    return (
                      <div key={index} className="grid gap-1.5">
                        <div className="flex flex-wrap items-end gap-3">
                          <Field id={id} label="From" className="min-w-0 flex-1 basis-28">
                            <SearchableSelect id={id} value={range.opens} onValueChange={(v) => set({ opens: v })} options={opts(OPENS)}
                              aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
                          </Field>
                          <Field id={`${id}-to`} label="To" className="min-w-0 flex-1 basis-28">
                            <SearchableSelect id={`${id}-to`} value={range.closes} onValueChange={(v) => set({ closes: v })} options={opts(CLOSES)}
                              aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
                          </Field>
                          <Button variant="secondary" className="size-11 px-0"
                            onClick={() => update({ working_hours: form.working_hours.filter((_, i) => i !== index) })}>
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="sr-only">Remove {name} {range.opens} to {range.closes}</span>
                          </Button>
                        </div>
                        {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
                      </div>
                    );
                  })}
                  <Button variant="ghost" size="md" className="justify-self-start px-2 text-primary-ink"
                    onClick={() => {
                      const last = rows.at(-1)?.range;
                      const opens = last ? (last.closes === "24:00" ? "23:00" : last.closes) : "09:00";
                      const closes = last ? (CLOSES.find((c) => c > opens && c >= `${String(Number(opens.slice(0, 2)) + 1).padStart(2, "0")}:00`) ?? "24:00") : "17:00";
                      update({ working_hours: [...form.working_hours, { weekday, opens, closes }] });
                    }}>
                    <Plus className="size-4" aria-hidden="true" />
                    {rows.length === 0 ? `Offer ${name}` : `Add hours on ${name}`}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="min-w-0 border-t border-line pt-5">
        <legend className="font-sans text-lg font-semibold tracking-normal text-ink">Days off and other hours</legend>
        <p className="mt-1 text-sm text-muted">Holidays, leave, or a day with different hours. They replace that day’s usual hours.</p>
        {form.exceptions.length === 0 && <p className="mt-3 text-sm text-muted">No dates yet.</p>}
        <ul className="mt-4 grid gap-4">
          {form.exceptions.map((entry, index) => {
            const key = `exceptions[${index}]`;
            const id = `av-exc-${index}`;
            const set = (patch: Partial<typeof entry>) => update({ exceptions: form.exceptions.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
            return (
              <li key={index} className="rounded-lg border border-line p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${id}-date`} label="Date" error={fields[`${key}.date`]}>
                    <Input id={`${id}-date`} type="date" value={entry.date} onChange={(e) => set({ date: e.target.value })}
                      aria-invalid={Boolean(fields[`${key}.date`])} aria-describedby={fieldDescribedBy(`${id}-date`, { error: fields[`${key}.date`] })} />
                  </Field>
                  <label className="flex items-center gap-3 self-end pb-2.5 text-ink">
                    <input type="checkbox" checked={entry.closed} onChange={(e) => set({ closed: e.target.checked })}
                      className="size-5 shrink-0 accent-(--rp-color-primary-base)" />
                    Not available all day
                  </label>
                  {!entry.closed && (
                    <>
                      <Field id={`${id}-opens`} label="From" error={fields[`${key}.opens`]}>
                        <SearchableSelect id={`${id}-opens`} value={entry.opens ?? ""} onValueChange={(v) => set({ opens: v })}
                          options={[{ value: "", label: "Choose…" }, ...opts(OPENS)]} />
                      </Field>
                      <Field id={`${id}-closes`} label="To" error={fields[`${key}.closes`]}>
                        <SearchableSelect id={`${id}-closes`} value={entry.closes ?? ""} onValueChange={(v) => set({ closes: v })}
                          options={[{ value: "", label: "Choose…" }, ...opts(CLOSES)]} />
                      </Field>
                    </>
                  )}
                  <Field id={`${id}-note`} label="Note" optional hint="For you, such as “Public holiday”." error={fields[`${key}.note`]} className="sm:col-span-2">
                    <Input id={`${id}-note`} maxLength={120} value={entry.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
                  </Field>
                </div>
                <Button variant="ghost" size="md" className="mt-2 px-2 text-danger"
                  onClick={() => update({ exceptions: form.exceptions.filter((_, i) => i !== index) })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove this date
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" className="mt-4"
          onClick={() => update({ exceptions: [...form.exceptions, { date: "", closed: true, opens: "", closes: "", note: "" }] })}>
          <Plus className="size-4" aria-hidden="true" />
          Add a date
        </Button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save hours"}
        </Button>
      </div>
      <div aria-live="polite">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
    </form>
  );
}

const blankService = { name: "", duration_minutes: 60, channel: "IN_PERSON", location: "", notes: "" };

function ServiceForm({ initial, submitLabel, onSaved, onCancel, save }: {
  initial: typeof blankService;
  submitLabel: string;
  onSaved: (s: ConsultationService) => void;
  onCancel?: () => void;
  save: (body: typeof blankService) => Promise<ApiResult<{ service: ConsultationService }>>;
}) {
  const [form, setForm] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const idBase = `svc-${useId().replace(/:/g, "")}`;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await save(form);
    setBusy(false);
    if (answer.ok) {
      setFields({});
      setOutcome(null);
      onSaved(answer.data.service);
      return;
    }
    const f = failure(answer);
    setFields(f.fields);
    setOutcome(f.outcome);
  }
  const id = (name: string) => `${idBase}-${name}`;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field id={id("name")} label="Name" error={fields.name} hint="Such as “Valuation” or “First meeting”." className="sm:col-span-2">
        <Input id={id("name")} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-invalid={Boolean(fields.name)} aria-describedby={fieldDescribedBy(id("name"), { hint: "x", error: fields.name })} />
      </Field>
      <Field id={id("length")} label="Length" error={fields.duration_minutes}>
        <SearchableSelect id={id("length")} value={String(form.duration_minutes)} onValueChange={(v) => setForm({ ...form, duration_minutes: Number(v) })}
          options={SERVICE_LENGTHS.map((n) => ({ value: String(n), label: minutesText(n) }))} />
      </Field>
      <Field id={id("channel")} label="How you meet" error={fields.channel}>
        <SearchableSelect id={id("channel")} value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS} />
      </Field>
      <Field id={id("location")} label="Place or link" optional error={fields.location} className="sm:col-span-2"
        hint="Shown on the confirmed appointment, such as your office address.">
        <Input id={id("location")} maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
          aria-describedby={fieldDescribedBy(id("location"), { hint: "x", error: fields.location })} />
      </Field>
      <Field id={id("notes")} label="What to expect" optional error={fields.notes} className="sm:col-span-2">
        <Textarea id={id("notes")} rows={3} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <p className="text-sm text-muted sm:col-span-2">Consultations are free for now. Paid consultations are not available yet.</p>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
      <div aria-live="polite" className="sm:col-span-2">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
    </form>
  );
}

function Services() {
  const load = useCallback(() => listConsultationServices(), []);
  const { state, reload } = useApi(load);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  async function setActive(s: ConsultationService, active: boolean) {
    const answer = active ? await updateConsultationService(s.id, { active: true }) : await archiveConsultationService(s.id);
    if (!answer.ok) {
      setOutcome(failure(answer).outcome);
      return;
    }
    setOutcome({ tone: "success", text: active ? `${s.name} is offered again.` : `${s.name} is archived. Customers no longer see it.` });
    reload();
  }
  return (
    <section aria-labelledby="services-heading" className="space-y-4">
      <h2 id="services-heading" className="flex items-center gap-2 text-xl">
        <Video className="size-5 text-primary-ink" aria-hidden="true" />
        Consultation services
      </h2>
      <p className="text-sm text-muted">What customers can book with you as a consultation, and how long it takes. Viewings use your slot length.</p>
      <div aria-live="polite">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
      {state.status === "loading" && <LoadingBlock label="Loading your services" rows={2} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" && (
        <>
          {state.data.items.length === 0 && <p className="text-sm text-muted">No services yet.</p>}
          <ul className="divide-y divide-line rounded-lg border border-line">
            {state.data.items.map((s) => (
              <li key={s.id} className="px-4 py-3">
                {editing === s.id ? (
                  <ServiceForm
                    initial={{ name: s.name, duration_minutes: s.duration_minutes, channel: s.channel, location: s.location ?? "", notes: s.notes ?? "" }}
                    submitLabel="Save the service"
                    save={(body) => updateConsultationService(s.id, body)}
                    onSaved={(saved) => {
                      setEditing(null);
                      setOutcome({ tone: "success", text: `${saved.name} is saved.` });
                      reload();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {s.name}
                        {!s.active && <Badge tone="neutral">Archived</Badge>}
                      </p>
                      <p className="text-sm text-muted">
                        {minutesText(s.duration_minutes)} · {channelLabel(s.channel)}
                        {s.location ? ` · ${s.location}` : ""}
                      </p>
                    </div>
                    {s.active && (
                      <Button size="sm" variant="secondary" onClick={() => setEditing(s.id)}>
                        Edit<span className="sr-only"> {s.name}</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => void setActive(s, !s.active)}>
                      {s.active ? "Archive" : "Offer again"}<span className="sr-only"> {s.name}</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {adding ? (
            <Card>
              <h3 className="mb-4 text-lg">New service</h3>
              <ServiceForm
                initial={blankService}
                submitLabel="Add the service"
                save={(body) => createConsultationService(body)}
                onSaved={(saved) => {
                  setAdding(false);
                  setOutcome({ tone: "success", text: `${saved.name} is offered.` });
                  reload();
                }}
                onCancel={() => setAdding(false)}
              />
            </Card>
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add a service
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function Page() {
  const load = useCallback(() => getAppointmentSettings(), []);
  const { state, reload } = useApi(load);
  return (
    <>
      <BackLink href="/agent/appointments">Appointments</BackLink>
      <h1 className="mt-1 text-4xl">Availability</h1>
      <p className="mt-2 max-w-2xl text-muted">
        When customers can book viewings and consultations with you, and the consultations you offer. Customers see the free times only, never your other appointments.
      </p>
      <div className="mt-8 grid gap-6">
        <Card>
          {state.status === "loading" && <LoadingBlock label="Loading your hours" rows={4} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && <HoursForm initial={state.data} />}
        </Card>
        <Card>
          <Services />
        </Card>
      </div>
    </>
  );
}

/** `/agent/availability` (API 0.51.0). */
export function AppointmentAvailability() {
  return <RequireAuth>{() => <Page />}</RequireAuth>;
}
