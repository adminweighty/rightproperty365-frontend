"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { AdminMfaStep } from "@/components/admin/admin-mfa-step";
import { useAuth } from "@/components/auth/auth-provider";
import { SignInCodeStep } from "@/components/auth/sign-in-code-step";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { ENROLMENT_REQUIRED_PATH, isEnrolmentOnly, signInReducer, START_STEP } from "@/lib/admin-mfa";
import { adminLogin, type SessionResponse } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { hasProblems, signInProblems } from "@/lib/auth-validation";
import { landingPath } from "@/lib/portal";
import { isSignInChallenge, type SignInChallenge } from "@/lib/sign-in-code";

/** Each field, in the order of the form, and the control that takes focus when it is invalid. */
const FIELDS = { email: "#admin-email", password: "#admin-password" };

/**
 * Sign-in for platform administrators only. The API answers every failure the
 * same way, so this form must not hint at whether an address is an admin.
 * Like the customer sign-in it has a second step, the emailed code, and an
 * API without that step answering with the session is a success too. An
 * administrator with an authenticator app has a third step (API 0.40.0), and
 * an enrolment-only session goes straight to /admin/security. The steps are
 * `signInReducer` in src/lib/admin-mfa.ts.
 */
export function AdminSignInForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const { setSession } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [challenge, setChallenge] = useState<SignInChallenge | null>(null);
  const [step, dispatch] = useReducer(signInReducer, START_STEP);
  const [email, setEmail] = useState("");
  const [startAgain, setStartAgain] = useState<string | null>(null);
  const returning = useRef(false);
  const { form, errors, show, onChange } = useFieldErrors(FIELDS);

  useEffect(() => {
    if (step.step !== "credentials" || !returning.current) return;
    returning.current = false;
    form.current?.querySelector<HTMLInputElement>("#admin-email")?.focus();
  }, [step.step, form]);

  function signedIn(response: SessionResponse) {
    dispatch({ type: "answer", data: response });
    setSession(response);
    // An enrolment-only session can do nothing else until an authenticator is set up.
    router.push(isEnrolmentOnly(response) ? ENROLMENT_REQUIRED_PATH : landingPath("admin", nextParam));
  }

  function backToStart(message?: string) {
    returning.current = true;
    setStartAgain(message || null);
    setChallenge(null);
    dispatch({ type: "start-again", message });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const typedEmail = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setFailure(null);
    setStartAgain(null);
    const problems = signInProblems({ email: typedEmail, password });
    show(problems);
    if (hasProblems(problems)) return;

    setPending(true);
    const result = await adminLogin(typedEmail, password);
    setPending(false);

    if (result.ok) {
      setEmail(typedEmail);
      if (isSignInChallenge(result.data)) {
        setChallenge(result.data);
        dispatch({ type: "answer", data: result.data });
      } else signedIn(result.data);
    } else {
      setFailure(result.failure);
      show(result.failure.fields ?? {});
    }
  }

  if (step.step === "signed-in" || step.step === "enrol") {
    return (
      <p role="status" aria-busy="true" className="text-muted">
        {step.step === "enrol" ? "Signed in. Opening two-step sign-in setup…" : "Signed in. Opening the admin area…"}
      </p>
    );
  }

  if (step.step === "mfa") {
    return (
      <AdminMfaStep
        challengeId={step.challengeId}
        method={step.method}
        onSwitchMethod={(method) => dispatch({ type: "switch-method", method })}
        onSignedIn={signedIn}
        onStartAgain={backToStart}
      />
    );
  }

  if (step.step === "email-code" && challenge) {
    return (
      <SignInCodeStep
        scope="admin"
        challenge={challenge}
        onSignedIn={signedIn}
        onMfaRequired={(mfa) => dispatch({ type: "answer", data: mfa })}
        onStartAgain={backToStart}
      />
    );
  }

  const credentialFailure = failure?.code === "INVALID_CREDENTIALS";

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      {startAgain && <Alert tone="warning" title={startAgain} />}

      <Field id="admin-email" label="Work email address" error={errors.email}>
        <Input
          id="admin-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={fieldDescribedBy("admin-email", { error: errors.email })}
        />
      </Field>

      <Field id="admin-password" label="Password" error={errors.password}>
        <Input
          id="admin-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={fieldDescribedBy("admin-password", { error: errors.password })}
        />
      </Field>

      {failure && !failure.fields && (
        <Alert
          title={credentialFailure ? "That email and password do not match." : failure.message}
          traceId={credentialFailure ? undefined : failure.traceId}
        />
      )}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-sm leading-relaxed text-muted">
        Forgotten your password? Ask a Super Administrator to reset it. Administrator passwords
        cannot be reset by email.
      </p>
    </form>
  );
}
