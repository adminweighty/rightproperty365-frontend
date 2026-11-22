"use client";

import { ChevronDown, Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMarketingPreferences, saveMarketingPreference, type MarketingPreferences } from "@/lib/api/marketing";
import { cn } from "@/lib/cn";
import { canSwitchOn, historyLines, HISTORY_LIMIT, isStaleWording, lastChangedText } from "@/lib/marketing-preferences";
import { useDisplayZone } from "@/components/time/use-display-zone";
import { currentViewerZone } from "@/lib/display-zone";
import { zoneLabel } from "@/lib/time-zone";

type Message = { tone: "success" | "info" | "danger"; text: string; traceId?: string };

/** "Switched on" / "Switched off" with when and how, newest first, in a native disclosure. */
function History({ prefs }: { prefs: MarketingPreferences }) {
  const { viewer } = useDisplayZone();
  const lines = historyLines(prefs.history, HISTORY_LIMIT, viewer, zoneLabel(viewer));
  return (
    <details className="group mt-4 rounded-md border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-medium text-ink [&::-webkit-details-marker]:hidden">
        Recent changes
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-3 py-3">
        {lines.length === 0 ? (
          <p className="text-sm text-muted">There are no changes yet.</p>
        ) : (
          <>
            <ol className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="text-sm">
                  <span className="font-medium text-ink">{line.title}</span>{" "}
                  <time dateTime={line.dateTime} className="text-muted">
                    {line.when}
                  </time>
                  {line.detail && <span className="block text-muted">{line.detail}</span>}
                </li>
              ))}
            </ol>
            {prefs.history.length > HISTORY_LIMIT && (
              <p className="mt-3 text-sm text-muted">
                Showing the last {HISTORY_LIMIT} of {prefs.history.length} changes.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

/**
 * The marketing switch. Its label is the API's wording (`consent_text.text`),
 * never text written here. On and Off are said in words as well as by the
 * thumb's place and colour.
 */
function MarketingSwitch({
  prefs,
  on,
  busy,
  onToggle,
  switchRef,
}: {
  prefs: MarketingPreferences;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
  switchRef: RefObject<HTMLButtonElement | null>;
}) {
  const wording = prefs.consent_text;
  const locked = !on && !canSwitchOn(prefs);

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={wording ? "marketing-wording" : "marketing-heading"}
        aria-describedby="marketing-last-changed marketing-service-note"
        aria-disabled={busy || locked || undefined}
        aria-busy={busy || undefined}
        onClick={onToggle}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-1 text-sm font-medium text-ink",
          (busy || locked) && "cursor-not-allowed",
          locked && "opacity-60",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors",
            on ? "border-primary bg-primary" : "border-control bg-sunken",
          )}
        >
          <span
            className={cn(
              "absolute size-5 rounded-full bg-surface shadow-xs transition-transform",
              on ? "translate-x-[1.375rem]" : "translate-x-0.5",
              !on && "border border-control",
            )}
          />
        </span>
        <span aria-hidden="true" className="w-7">
          {on ? "On" : "Off"}
        </span>
      </button>
      {wording ? (
        <p id="marketing-wording" className="min-w-0 pt-2.5 break-words text-ink">
          {wording.text}
        </p>
      ) : (
        <p className="min-w-0 pt-2.5 text-muted">
          {on
            ? "We cannot show the wording of this choice right now. You can still switch marketing off."
            : "We cannot show the wording of this choice right now, so marketing cannot be switched on. Please try again later."}
        </p>
      )}
    </div>
  );
}

/**
 * The "Marketing" section of `/account/notification-preferences`
 * (API 0.37.1): one switch whose label is the API's wording, when and where
 * it was last changed, the recent changes, and the note that service and
 * account messages are not affected. A change saves at once: the switch moves
 * straight away and goes back if the save fails. A 400 on a stale wording
 * reads the wording again and asks again.
 */
export function MarketingPreferencesSection() {
  const load = useCallback(() => getMarketingPreferences(), []);
  const { state, reload, replace } = useApi(load);
  /** The value being saved, shown before the answer comes back; null when nothing is being saved. */
  const [pending, setPending] = useState<boolean | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  /** Set when the wording was read again after a stale save, so focus goes back to the switch. */
  const refocus = useRef(false);

  useEffect(() => {
    if (state.status === "ready" && refocus.current) {
      refocus.current = false;
      switchRef.current?.focus();
    }
  }, [state.status]);

  async function toggle(prefs: MarketingPreferences) {
    if (pending !== null) return;
    const next = !prefs.marketing_opt_in;
    if (next && !canSwitchOn(prefs)) return;
    setMessage(null);
    setPending(next);
    const result = await saveMarketingPreference(next, next ? (prefs.consent_text?.version ?? null) : null);
    setPending(null);
    if (result.ok) {
      replace(result.data);
      setMessage({ tone: "success", text: result.data.marketing_opt_in ? "Saved. Marketing is on." : "Saved. Marketing is off." });
      return;
    }
    if (isStaleWording(result.failure)) {
      setMessage({
        tone: "info",
        text: "The wording of this choice has changed since the page opened, so nothing was saved. Read it again, then switch marketing on if you still agree.",
      });
      refocus.current = true;
      reload();
      return;
    }
    setMessage({
      tone: "danger",
      text: `We could not save your choice, so nothing was changed. ${result.failure.message}`,
      traceId: result.failure.traceId,
    });
  }

  return (
    <section aria-labelledby="marketing-heading" className="mt-8">
      <h2 id="marketing-heading" className="text-2xl">
        Marketing
      </h2>

      <div className="mt-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
        {state.status === "loading" && <LoadingBlock label="Loading your marketing choice" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <>
            <MarketingSwitch
              prefs={state.data}
              on={pending ?? state.data.marketing_opt_in}
              busy={pending !== null}
              onToggle={() => toggle(state.data)}
              switchRef={switchRef}
            />
            <p id="marketing-last-changed" className="mt-3 text-sm text-muted">
              {lastChangedText(state.data, currentViewerZone(), zoneLabel(currentViewerZone()))}
            </p>
            {!state.data.consent_text && (
              <Button variant="secondary" className="mt-3" onClick={reload}>
                Try again
              </Button>
            )}
            <History prefs={state.data} />
          </>
        )}

        <p className="sr-only" aria-live="polite">
          {pending !== null ? "Saving your choice…" : ""}
        </p>
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} className="mt-4" />}

        <p id="marketing-service-note" className="mt-4 flex items-start gap-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Service and account messages, such as security alerts, bookings and replies to your requests, are not
            marketing and cannot be turned off here. How they reach you is set under Notifications.
          </span>
        </p>
      </div>
    </section>
  );
}
