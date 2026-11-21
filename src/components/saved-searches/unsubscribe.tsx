"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { unsubscribeSavedSearch } from "@/lib/api/saved-searches";
import { savedSearchErrorText } from "@/lib/saved-searches";

type State = { status: "working" } | { status: "done"; name: string } | { status: "failed"; text: string };

/** `/saved-searches/unsubscribe?token=`: the alert email's one-click link (API 0.52.0). Works signed out. */
export function UnsubscribeSavedSearch() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>(
    token ? { status: "working" } : { status: "failed", text: "This link is incomplete. Open the link from the email again." },
  );
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    unsubscribeSavedSearch(token).then((answer) => {
      if (answer.ok) setState({ status: "done", name: answer.data.name });
      else setState({ status: "failed", text: savedSearchErrorText(answer.failure.code) ?? answer.failure.message });
    });
  }, [token]);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl">Stop search alerts</h1>
      <div className="mt-6" aria-live="polite">
        {state.status === "working" && <p className="text-muted">Switching the alerts off…</p>}
        {state.status === "done" && (
          <Alert tone="success" title={`You will no longer get emails for “${state.name}”.`}>
            The search is still saved. You can switch its alerts back on, or delete it, from your saved searches.
          </Alert>
        )}
        {state.status === "failed" && <Alert title={state.text} />}
        {state.status !== "working" && (
          <ButtonLink href="/account/saved-searches" variant="secondary" className="mt-6">
            Your saved searches
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
