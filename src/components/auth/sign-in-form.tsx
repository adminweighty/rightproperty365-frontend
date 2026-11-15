"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { authLinkClass } from "@/components/auth/auth-shell";
import { SignInCodeStep } from "@/components/auth/sign-in-code-step";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { login, resendVerification, type SessionResponse } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { hasProblems, signInProblems } from "@/lib/auth-validation";
import { landingPath } from "@/lib/portal";
import { isSignInChallenge, type SignInChallenge } from "@/lib/sign-in-code";

/** Each field, in the order of the form, and the control that takes focus when it is invalid. */
const FIELDS = { email: "#email", password: "#password" };

/**
 * Two steps: email and password, then the code we email (when the API asks
 * for one). An API without the code step answers the first step with the
 * session, and that is a successful sign-in too.
 */
export function SignInForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const { setSession } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [challenge, setChallenge] = useState<SignInChallenge | null>(null);
  const [email, setEmail] = useState("");
  const [startAgain, setStartAgain] = useState<string | null>(null);
  const returning = useRef(false);
  const { form, errors, show, onChange } = useFieldErrors(FIELDS);

  // Back from the code step: focus the email field, which still holds the last address.
  useEffect(() => {
    if (challenge || !returning.current) return;
    returning.current = false;
    form.current?.querySelector<HTMLInputElement>("#email")?.focus();
  }, [challenge, form]);

  function signedIn(response: SessionResponse) {
    setSession(response);
    router.push(landingPath(response.session?.scope ?? "customer", nextParam));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const typedEmail = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setFailure(null);
    setUnverifiedEmail(null);
    setResent(false);
    setStartAgain(null);
    const problems = signInProblems({ email: typedEmail, password });
    show(problems);
    if (hasProblems(problems)) return;

    setPending(true);
    const result = await login(typedEmail, password);
    setPending(false);

    if (result.ok) {
      setEmail(typedEmail);
      if (isSignInChallenge(result.data)) setChallenge(result.data);
      else signedIn(result.data);
      return;
    }
    if (result.failure.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(typedEmail);
    setFailure(result.failure);
    show(result.failure.fields ?? {});
  }

  if (challenge) {
    return (
      <SignInCodeStep
        scope="customer"
        challenge={challenge}
        onSignedIn={signedIn}
        onStartAgain={(message) => {
          returning.current = true;
          setStartAgain(message ?? null);
          setChallenge(null);
        }}
      />
    );
  }

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      {startAgain && <Alert tone="warning" title={startAgain} />}

      <Field id="email" label="Email address" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={fieldDescribedBy("email", { error: errors.email })}
        />
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={fieldDescribedBy("password", { error: errors.password })}
        />
      </Field>

      <Link href="/forgot-password" className={`${authLinkClass} self-start text-sm`}>
        Forgot your password?
      </Link>

      {failure && !unverifiedEmail && (
        <Alert
          title={
            failure.code === "INVALID_CREDENTIALS"
              ? "That email and password do not match."
              : failure.message
          }
          traceId={failure.code === "INVALID_CREDENTIALS" ? undefined : failure.traceId}
        />
      )}

      {unverifiedEmail && (
        <Alert tone="warning" title="Confirm your email address first">
          <p>We sent a link to {unverifiedEmail} when you registered.</p>
          {resent ? (
            <p className="mt-2 font-medium">A new link is on its way.</p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await resendVerification(unverifiedEmail);
                setResent(true);
              }}
            >
              Send a new link
            </Button>
          )}
        </Alert>
      )}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
