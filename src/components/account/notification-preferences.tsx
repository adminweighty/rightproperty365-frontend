"use client";

import { Lock } from "lucide-react";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { MarketingPreferencesSection } from "@/components/account/marketing-preferences";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ApiFailure } from "@/lib/api/http";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreference,
} from "@/lib/api/notifications";
import { cn } from "@/lib/cn";
import { changedPreferences, essentialReason, preferenceErrorsByType } from "@/lib/notifications";

/** The loading state, also the page's Suspense fallback. */
export function NotificationPreferencesSkeleton() {
  return <LoadingBlock label="Loading your notification preferences" rows={4} />;
}

type Channel = "email" | "push";

const box = "size-5 shrink-0 accent-primary disabled:opacity-60";
const choice = "inline-flex min-h-11 items-center gap-2 text-ink";

/** One kind of notification: its name, In-app (always on), Email and Push. */
function PreferenceRow({
  item,
  disabled,
  error,
  onChange,
}: {
  item: NotificationPreference;
  disabled: boolean;
  error?: string;
  onChange: (type: string, channel: Channel, value: boolean) => void;
}) {
  const id = `pref-${item.type}`;
  const reasonId = `${id}-reason`;
  const errorId = `${id}-error`;
  const reason = essentialReason(item);

  return (
    <fieldset
      aria-describedby={cn(item.essential && reasonId, error && errorId) || undefined}
      className={cn("rounded-lg border bg-surface p-4", error ? "border-danger" : "border-line")}
    >
      {/* Floated so the legend sits inside the panel like a heading, not on its border. */}
      <legend className="float-left w-full font-medium text-ink">{item.label}</legend>
      <div className="clear-both flex flex-wrap gap-x-6 pt-1">
        <label className={choice}>
          <input type="checkbox" className={box} checked disabled aria-describedby="in-app-note" />
          In-app
          <span className="text-sm text-muted">(always on)</span>
        </label>
        {(["email", "push"] as const).map((channel) => (
          <label key={channel} className={choice}>
            <input
              type="checkbox"
              name={`${item.type}.${channel}`}
              className={box}
              checked={item[channel]}
              disabled={disabled || item.essential}
              aria-describedby={item.essential ? reasonId : undefined}
              onChange={(event) => onChange(item.type, channel, event.currentTarget.checked)}
            />
            {channel === "email" ? "Email" : "Push"}
          </label>
        ))}
      </div>
      {item.essential && (
        <p id={reasonId} className="mt-1 flex items-start gap-2 text-sm text-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {reason}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Editor({ saved, onSaved, pushNote }: { saved: NotificationPreference[]; onSaved: (items: NotificationPreference[]) => void; pushNote: ReactNode }) {
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  const [failure, setFailure] = useState<{ failure: ApiFailure; sent: { type: string }[] } | null>(null);

  const changes = changedPreferences(saved, draft);
  const rowErrors = failure ? preferenceErrorsByType(failure.failure.fields, failure.sent) : {};

  function change(type: string, channel: Channel, value: boolean) {
    setOutcome(null);
    setDraft((items) => items.map((item) => (item.type === type && !item.essential ? { ...item, [channel]: value } : item)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (changes.length === 0) {
      setOutcome({ tone: "info", text: "Nothing has changed since you last saved." });
      return;
    }
    setSaving(true);
    setOutcome(null);
    const result = await saveNotificationPreferences(changes);
    setSaving(false);
    if (!result.ok) {
      setFailure({ failure: result.failure, sent: changes });
      return;
    }
    const next = result.data ?? draft;
    setDraft(next);
    onSaved(next);
    setOutcome({ tone: "success", text: "Your preferences are saved. They apply from the next notification we send." });
  }

  const essential = draft.filter((item) => item.essential);
  const optional = draft.filter((item) => !item.essential);

  return (
    <form onSubmit={submit} noValidate className="mt-4">
      <p id="in-app-note" className="text-sm text-muted">
        In-app notifications are always on: this list is the record of what we told you.
      </p>
      {pushNote}

      {optional.length > 0 && (
        <section aria-labelledby="optional-heading" className="mt-8">
          <h3 id="optional-heading" className="text-xl">
            You choose
          </h3>
          <div className="mt-4 space-y-3">
            {optional.map((item) => (
              <PreferenceRow key={item.type} item={item} disabled={saving} error={rowErrors[item.type]} onChange={change} />
            ))}
          </div>
        </section>
      )}

      {essential.length > 0 && (
        <section aria-labelledby="essential-heading" className="mt-8">
          <h3 id="essential-heading" className="text-xl">
            Always sent
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These are about your account&apos;s security, contracts and invoices, so they cannot be switched off.
          </p>
          <div className="mt-4 space-y-3">
            {essential.map((item) => (
              <PreferenceRow key={item.type} item={item} disabled={saving} error={rowErrors[item.type]} onChange={change} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-4">
        {failure && (
          <Alert
            title={
              failure.failure.status === 400
                ? Object.keys(rowErrors).length > 0
                  ? "We could not save your preferences, so nothing was changed. The reason is under each type it concerns."
                  : `We could not save your preferences, so nothing was changed. ${failure.failure.message}`
                : failure.failure.message
            }
            traceId={failure.failure.traceId}
          />
        )}
        {outcome && <Alert tone={outcome.tone} title={outcome.text} />}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          <p className="text-sm text-muted" aria-live="polite">
            {changes.length === 0 ? "No unsaved changes" : changes.length === 1 ? "1 unsaved change" : `${changes.length} unsaved changes`}
          </p>
        </div>
      </div>
    </form>
  );
}

function Preferences({ pushNote }: { pushNote: ReactNode }) {
  const load = useCallback(() => getNotificationPreferences(), []);
  const { state, reload, replace } = useApi(load);

  return (
    <>
      <BackLink href="/account/notifications">Notifications</BackLink>
      <h1 className="mt-2 text-4xl">Communication preferences</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Choose whether we send you marketing, and how we tell you about each kind of update.
      </p>

      <MarketingPreferencesSection />

      <section aria-labelledby="notifications-heading" className="mt-12">
        <h2 id="notifications-heading" className="text-2xl">
          Notifications
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          How we tell you about each kind of update. Changes apply from the next notification we send.
        </p>

        {state.status === "loading" && (
          <div className="mt-8">
            <NotificationPreferencesSkeleton />
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-8">
            <LoadError failure={state.failure} onRetry={reload} />
          </div>
        )}
        {state.status === "ready" &&
          (state.data.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="There are no notification settings for your account yet" />
            </div>
          ) : (
            // The draft starts from this answer; a save hands the saved list back with `replace`.
            <Editor saved={state.data} onSaved={replace} pushNote={pushNote} />
          ))}
      </section>
    </>
  );
}

/**
 * `/account/notification-preferences` ("Communication preferences"): the
 * Marketing section, then Email and Push for each kind of notification,
 * In-app always on, essential kinds locked on with the reason.
 * `pushNote` is rendered by the server page (it holds the app store links).
 */
export function NotificationPreferences({ pushNote }: { pushNote: ReactNode }) {
  return <RequireAuth>{() => <Preferences pushNote={pushNote} />}</RequireAuth>;
}
