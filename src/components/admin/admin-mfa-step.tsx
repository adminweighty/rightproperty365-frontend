"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authLinkClass } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  mfaFailureOutcome,
  normaliseCode,
  normaliseRecoveryCode,
  recoveryCodeProblem,
  totpCodeProblem,
  type MfaMethod,
} from "@/lib/admin-mfa";
import { submitSignInMfa } from "@/lib/api/admin-mfa";
import type { SessionResponse } from "@/lib/api/auth";

type Props = {
  challengeId: string;
  method: MfaMethod;
  onSwitchMethod: (method: MfaMethod) => void;
  /** The code was right: the API has started the session. */
  onSignedIn: (session: SessionResponse) => void;
  /** The challenge ended (expired, or locked after too many wrong codes). */
  onStartAgain: (message: string) => void;
};

const words: Record<MfaMethod, { heading: string; intro: string; label: string; hint: string; other: string }> = {
  totp: {
    heading: "Enter the code from your authenticator app",
    intro: "Open the authenticator app you set up for RightProperty365 and enter the 6-digit code it shows now.",
    label: "6-digit code",
    hint: "The code changes every 30 seconds. Each code can be used once.",
    other: "Use a recovery code instead",
  },
  recovery_code: {
    heading: "Enter a recovery code",
    intro: "Use one of the recovery codes you saved when you set up your authenticator app. Each code works once, and we email you when one is used.",
    label: "Recovery code",
    hint: "Like abcde-fghij. Capitals, spaces and dashes do not matter.",
    other: "Use your authenticator app instead",
  },
};

/**
 * The third step of the administrator sign-in, after the emailed code: a code
 * from the authenticator app, or one of the recovery codes. Focus moves to
 * the field when the step opens and when the kind of code changes.
 */
export function AdminMfaStep({ challengeId, method, onSwitchMethod, onSignedIn, onStartAgain }: Props) {
  const id = method === "totp" ? "admin-mfa-code" : "admin-mfa-recovery";
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [alert, setAlert] = useState<{ message: string; traceId?: string; tone: "danger" | "warning" } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    input.current?.focus();
  }, [method]);

  function switchTo(next: MfaMethod) {
    setError(undefined);
    setAlert(null);
    onSwitchMethod(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const raw = String(new FormData(event.currentTarget).get("code") ?? "");
    setAlert(null);
    const problem = method === "totp" ? totpCodeProblem(raw) : recoveryCodeProblem(raw);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await submitSignInMfa(
      challengeId,
      method === "totp" ? { code: normaliseCode(raw) } : { recovery_code: normaliseRecoveryCode(raw) },
    );
    setPending(false);
    if (result.ok) {
      onSignedIn(result.data);
      return;
    }
    const outcome = mfaFailureOutcome(result.failure, method);
    if (outcome.kind === "start-again") {
      onStartAgain(outcome.message);
      return;
    }
    if (outcome.kind === "field") {
      setError(outcome.message);
      input.current?.select();
      input.current?.focus();
      return;
    }
    setAlert({
      message: outcome.message,
      traceId: outcome.kind === "alert" ? result.failure.traceId : undefined,
      tone: outcome.kind === "wait" ? "warning" : "danger",
    });
  }

  const text = words[method];
  const describedBy = error ? `${id}-error` : `${id}-hint`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-labelledby="admin-mfa-heading">
      <div>
        <h2 id="admin-mfa-heading" className="font-sans text-xl font-semibold tracking-normal">
          {text.heading}
        </h2>
        <p className="mt-1 leading-relaxed text-muted">{text.intro}</p>
      </div>

      <Field id={id} label={text.label} hint={text.hint} error={error}>
        {method === "totp" ? (
          <Input
            key="totp"
            ref={input}
            id={id}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            // Room for the spaces people copy with the code; they are removed before sending.
            maxLength={12}
            className="max-w-48 font-mono text-lg tracking-widest"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        ) : (
          <Input
            key="recovery"
            ref={input}
            id={id}
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            className="max-w-64 font-mono text-lg tracking-wider"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      {alert && <Alert tone={alert.tone} title={alert.message} traceId={alert.traceId} />}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>

      <button
        type="button"
        onClick={() => switchTo(method === "totp" ? "recovery_code" : "totp")}
        className={`${authLinkClass} min-h-11 self-start text-sm`}
      >
        {text.other}
      </button>

      <p className="text-sm leading-relaxed text-muted">
        Lost your phone and your recovery codes? Ask a Super Administrator to reset your two-step sign-in.
      </p>

      <button
        type="button"
        onClick={() => onStartAgain("")}
        className={`${authLinkClass} min-h-11 self-start text-sm`}
      >
        Use a different account
      </button>
    </form>
  );
}
