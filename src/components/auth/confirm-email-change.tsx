"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { confirmEmailChange } from "@/lib/api/security";
import { securityErrorText } from "@/lib/account-security";

/** `/confirm-email-change?token=`: confirms a new email address (API 0.50.0). Works signed out. */
export function ConfirmEmailChange() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<{ status: "working" } | { status: "done"; email: string } | { status: "failed"; text: string }>(
    token ? { status: "working" } : { status: "failed", text: "This link is incomplete. Open the link from the email again." },
  );
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    confirmEmailChange(token).then((answer) => {
      if (answer.ok) setState({ status: "done", email: answer.data.user.email });
      else setState({ status: "failed", text: securityErrorText(answer.failure.code) ?? answer.failure.message });
    });
  }, [token]);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl">Confirm your new email address</h1>
      <div className="mt-6" aria-live="polite">
        {state.status === "working" && <p className="text-muted">Confirming…</p>}
        {state.status === "done" && (
          <>
            <Alert tone="success" title={`Your email address is now ${state.email}.`}>
              Use it the next time you sign in. We told your previous address about the change.
            </Alert>
            <ButtonLink href="/account" className="mt-6">
              Go to your account
            </ButtonLink>
          </>
        )}
        {state.status === "failed" && (
          <>
            <Alert title={state.text} />
            <ButtonLink href="/account/security" variant="secondary" className="mt-6">
              Account security
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
