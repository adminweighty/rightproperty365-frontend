"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { saveTimeZone } from "@/lib/api/time-zone";
import { setDisplayZone } from "@/lib/display-zone";
import {
  deviceZone,
  formatCalendarDate,
  formatInstant,
  formatPlaceTime,
  readTimeZoneSetting,
  supportedZones,
  viewerZone,
  zoneLabel,
  zoneOptionLabel,
  type TimeZoneMode,
} from "@/lib/time-zone";

type Message = { tone: "success" | "danger"; text: string; traceId?: string };

const radio = "mt-1 size-5 shrink-0 accent-primary";

const noSubscription = () => () => {};
/** When this page was first opened in the browser: the moment the examples and offsets are shown for. */
let openedAtMs: number | null = null;
const pageOpenedAt = () => (openedAtMs ??= Date.now());

/**
 * `/account/time-zone` (API 0.62.0): how times are shown. Market time is the
 * default (Harare time for Zimbabwe); the device's zone or a named zone are
 * the alternatives. Display only: nothing stored changes, and dates such as
 * rent due dates never move.
 */
function TimeZoneForm() {
  const { user, refresh } = useAuth();
  const current = readTimeZoneSetting(user?.time_zone);
  const [mode, setMode] = useState<TimeZoneMode>(current.mode);
  const [zone, setZone] = useState<string>(current.zone ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Read in the browser only: the server does not know this device's zone or clock.
  const device = useSyncExternalStore(noSubscription, deviceZone, () => null);
  const openedAt = useSyncExternalStore(noSubscription, pageOpenedAt, () => null);
  const now = useMemo(() => (openedAt === null ? null : new Date(openedAt)), [openedAt]);

  const options: SelectOption[] = useMemo(() => {
    const at = now ?? new Date(0);
    return supportedZones().map((name) => ({ value: name, label: zoneOptionLabel(name, at), keywords: [name.replaceAll("_", " ")] }));
  }, [now]);

  const market = current.market_zone;
  const chosen = viewerZone({ ...current, mode, zone: mode === "ZONE" ? zone || null : null }, device);
  const example = now ? formatInstant(now, chosen) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setProblem(null);
    if (mode === "ZONE" && !zone) {
      setProblem("Choose a time zone from the list.");
      return;
    }
    setBusy(true);
    const result = await saveTimeZone(mode, mode === "ZONE" ? zone : null);
    setBusy(false);
    if (!result.ok) {
      const fieldError = result.failure.fields?.zone ?? result.failure.fields?.mode;
      if (fieldError) setProblem(fieldError);
      else setMessage({ tone: "danger", text: result.failure.message, traceId: result.failure.traceId });
      return;
    }
    setDisplayZone(result.data);
    await refresh();
    setMessage({ tone: "success", text: "Times on the site now use this setting." });
  }

  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-2 text-4xl">Time zone</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Choose the time zone the site shows times in: when something was sent, replied to, paid or signed. Everything
        is shown in {zoneLabel(market)} unless you choose otherwise.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 grid max-w-2xl gap-6">
        <fieldset className="grid gap-4">
          <legend className="text-lg font-medium text-ink">Show times in</legend>
          <label className="flex items-start gap-3">
            <input type="radio" name="mode" value="MARKET" className={radio} checked={mode === "MARKET"} onChange={() => setMode("MARKET")} />
            <span>
              <span className="font-medium text-ink">Use market time (default)</span>
              <span className="block text-sm text-muted">
                {zoneLabel(market)}, the time of {current.market_code === "ZW" ? "Zimbabwe" : "your market"}.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="radio" name="mode" value="DEVICE" className={radio} checked={mode === "DEVICE"} onChange={() => setMode("DEVICE")} />
            <span>
              <span className="font-medium text-ink">Use this device&apos;s time zone</span>
              <span className="block text-sm text-muted">
                {device ? `On this device that is ${zoneLabel(device)} (${device}). ` : ""}Each phone or computer uses its own, so
                times follow you when you travel.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="radio" name="mode" value="ZONE" className={radio} checked={mode === "ZONE"} onChange={() => setMode("ZONE")} />
            <span>
              <span className="font-medium text-ink">Choose a time zone</span>
              <span className="block text-sm text-muted">The same on every device you sign in on.</span>
            </span>
          </label>
        </fieldset>

        {mode === "ZONE" && (
          <Field id="time-zone" label="Time zone" hint="Type a city or region, for example London or New York." error={problem ?? undefined}>
            <SearchableSelect
              id="time-zone"
              name="zone"
              options={[{ value: "", label: "Choose a time zone" }, ...options]}
              value={zone}
              onValueChange={setZone}
              required
              aria-invalid={Boolean(problem)}
              aria-describedby={fieldDescribedBy("time-zone", { hint: "Type a city or region, for example London or New York.", error: problem ?? undefined })}
            />
          </Field>
        )}
        {mode !== "ZONE" && problem && <Alert tone="danger" title="This could not be saved">{problem}</Alert>}

        <div className="rounded-lg border border-line bg-sunken p-4 text-sm text-ink">
          <p className="font-medium">What changes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>When things happened, such as messages, payments and signatures{example ? `: now is ${example}` : ""}.</li>
            <li>
              Appointments, viewings, bookings and inspections stay in the time of the place, with yours alongside
              {now && chosen !== market ? `, for example ${formatPlaceTime(now, market, chosen, { date: false })}` : ""}.
            </li>
            <li>
              Dates do not move: rent and invoice due dates, tenancy dates and expiry days stay as they are
              {now ? ` (for example ${formatCalendarDate("2026-12-01")})` : ""}. Reports, &quot;today&quot; and emails stay in market time.
            </li>
          </ul>
        </div>

        {message && (
          <Alert tone={message.tone} title={message.tone === "success" ? "Time zone saved" : "This could not be saved"} traceId={message.traceId}>
            {message.text}
          </Alert>
        )}
        <div>
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </>
  );
}

export function TimeZonePreferences() {
  return <RequireAuth>{() => <TimeZoneForm />}</RequireAuth>;
}
