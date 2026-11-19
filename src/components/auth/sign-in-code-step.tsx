"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authLinkClass } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { resendSignInCode, verifySignInCode, type SessionResponse, type SignInScope } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { isMfaChallenge, type MfaChallenge } from "@/lib/admin-mfa";
import { env } from "@/lib/env";
import {
  CODE_MAX,
  cleanCode,
  codeProblem,
  formatCountdown,
  hasExpired,
  RESEND_WAIT_SECONDS,
  secondsLeft,
  type SignInChallenge,
} from "@/lib/sign-in-code";

type Props = {
  scope: SignInScope;
  challenge: SignInChallenge;
  /** The code was right: the API has started the session. */
  onSignedIn: (session: SessionResponse) => void;
  /** Administrators with an authenticator: the code was right and the second factor is next (no session yet). */
  onMfaRequired?: (challenge: MfaChallenge) => void;
  /** Back to the email and password, with a message to show there (an expired code). */
  onStartAgain: (message?: string) => void;
};

const timeOf = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(at);
};

/**
 * The second step of signing in: the code we emailed. Used by the customer
 * and the administrator sign-in alike. Focus moves to the code field when the
 * step opens, and to the message when something goes wrong.
 */
export function SignInCodeStep({ scope, challenge: first, onSignedIn, onMfaRequired, onStartAgain }: Props) {
  const id = scope === "admin" ? "admin-sign-in-code" : "sign-in-code";
  const input = useRef<HTMLInputElement>(null);
  const [challenge, setChallenge] = useState(first);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  // Both are set from effects and the timer, never read from the clock while rendering.
  const [now, setNow] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);

  useEffect(() => {
    input.current?.focus();
    // The first tick also starts the wait before "Send a new code" can be used.
    const tick = () => {
      const at = Date.now();
      setNow(at);
      setResendAt((current) => current ?? at + RESEND_WAIT_SECONDS * 1000);
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const expired = now !== null && hasExpired(challenge.expires_at, now);
  const wait = now !== null && resendAt !== null ? secondsLeft(resendAt, now) : RESEND_WAIT_SECONDS;
  const until = timeOf(challenge.expires_at);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("code") ?? "");
    setFailure(null);
    setNotice(null);
    const problem = codeProblem(raw);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await verifySignInCode(scope, challenge.challenge_id, cleanCode(raw));
    setPending(false);
    if (result.ok) {
      if (isMfaChallenge(result.data)) {
        if (onMfaRequired) onMfaRequired(result.data);
        else setFailure({ code: "MFA_REQUIRED", status: 200, message: "Sign in from the administrator sign-in page." });
        return;
      }
      onSignedIn(result.data);
      return;
    }
    if (result.failure.code === "CODE_EXPIRED") {
      onStartAgain("That code has expired. Enter your email and password again and we will send a new one.");
      return;
    }
    if (result.failure.fields?.code) {
      setError(result.failure.fields.code);
      input.current?.select();
      input.current?.focus();
      return;
    }
    setFailure(result.failure);
  }

  async function resend() {
    if (wait > 0 || resending) return;
    setFailure(null);
    setNotice(null);
    setResending(true);
    const result = await resendSignInCode(scope, challenge.challenge_id);
    setResending(false);
    const start = Date.now();
    if (result.ok) {
      setChallenge(result.data);
      setError(undefined);
      setNotice(`We sent a new code to ${result.data.sent_to ?? challenge.sent_to}.`);
      setResendAt(start + RESEND_WAIT_SECONDS * 1000);
      if (input.current) input.current.value = "";
      input.current?.focus();
      return;
    }
    if (result.failure.status === 429) {
      setResendAt(start + (result.failure.retryAfter ?? RESEND_WAIT_SECONDS) * 1000);
      setNotice("You asked for a code a moment ago. Please wait a little before asking again.");
      return;
    }
    if (result.failure.code === "CODE_EXPIRED") {
      onStartAgain("That sign-in has expired. Enter your email and password again and we will send a new code.");
      return;
    }
    setFailure(result.failure);
  }

  const hintId = `${id}-hint`;
  const describedBy = [error ? `${id}-error` : hintId, env.testSite ? `${id}-demo` : null].filter(Boolean).join(" ");

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-labelledby={`${id}-heading`}>
      <div>
        <h2 id={`${id}-heading`} className="font-sans text-xl font-semibold tracking-normal">
          Check your email
        </h2>
        <p className="mt-1 leading-relaxed text-muted">
          We sent a code to <span className="font-medium text-ink">{challenge.sent_to}</span>. Enter it here to
          finish signing in.
        </p>
      </div>

      <Field
        id={id}
        label="Code from the email"
        hint={until ? `The code works until ${until}.` : undefined}
        error={error}
      >
        <Input
          ref={input}
          id={id}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          // Room for the spaces people copy with the code; they are removed before sending.
          maxLength={CODE_MAX + 4}
          className="max-w-48 font-mono text-lg tracking-widest"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
        />
      </Field>
      {env.testSite && (
        <p id={`${id}-demo`} className="-mt-2 text-sm text-warning">
          Test site: you can use the demo code 1234.
        </p>
      )}

      {/* Always in the page, so screen readers announce what is put in it; empty, it takes no room. */}
      <div aria-live="polite" role="status" className="empty:-mt-4">
        {notice && <p className="rounded-md bg-info-soft p-3 text-sm text-info">{notice}</p>}
      </div>

      {expired && (
        <Alert tone="warning" title="This code has expired">
          <p>Send a new code, or use a different account to start again.</p>
        </Alert>
      )}
      {failure && <Alert title={failure.message} traceId={failure.traceId} />}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={resend}
          aria-disabled={wait > 0 || resending}
          aria-describedby={wait > 0 ? `${id}-wait` : undefined}
          className="-ml-4"
        >
          {resending ? "Sending…" : "Send a new code"}
        </Button>
        {wait > 0 && (
          <span id={`${id}-wait`} className="text-sm text-muted tabular-nums">
            Available in {formatCountdown(wait)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onStartAgain()}
        className={`${authLinkClass} min-h-11 self-start text-sm`}
      >
        Use a different account
      </button>
    </form>
  );
}
