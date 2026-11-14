"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { authLinkClass } from "@/components/auth/auth-shell";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { login, resendVerification } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { hasProblems, signInProblems } from "@/lib/auth-validation";

/** Each field, in the order of the form, and the control that takes focus when it is invalid. */
const FIELDS = { email: "#email", password: "#password" };

/** Only same-site paths are accepted, so `next` cannot send people elsewhere. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { setSession } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { form, errors, show, onChange } = useFieldErrors(FIELDS);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setFailure(null);
    setUnverifiedEmail(null);
    setResent(false);
    const problems = signInProblems({ email, password });
    show(problems);
    if (hasProblems(problems)) return;

    setPending(true);
    const result = await login(email, password);
    setPending(false);

    if (result.ok) {
      setSession(result.data);
      router.push(next);
      return;
    }
    if (result.failure.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(email);
    setFailure(result.failure);
    show(result.failure.fields ?? {});
  }

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      <Field id="email" label="Email address" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
