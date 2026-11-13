"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PASSWORD_HINT } from "@/components/auth/register-form";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setFailure(null);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (result.ok) setSentTo(email);
    else setFailure(result.failure);
  }

  if (sentTo) {
    return (
      <Alert tone="success" title="Check your email">
        <p>
          If an account exists for {sentTo}, we have sent a link to choose a new password. The link
          works for one hour.
        </p>
      </Alert>
    );
  }

  const error = failure?.fields?.email;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="email" label="Email address" error={error}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy("email", { error })}
        />
      </Field>
      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setFailure(null);
    const result = await confirmPasswordReset(token, password);
    setPending(false);
    if (result.ok) setDone(true);
    else setFailure(result.failure);
  }

  if (done) {
    return (
      <>
        <Alert tone="success" title="Your password has been changed">
          <p>You have been signed out on every device. Sign in with your new password.</p>
        </Alert>
        <ButtonLink href="/sign-in" className="mt-6 w-full">
          Sign in
        </ButtonLink>
      </>
    );
  }

  if (!token || failure?.code === "INVALID_TOKEN") {
    return (
      <>
        <Alert title="This link has expired or was already used." />
        <ButtonLink href="/forgot-password" variant="secondary" className="mt-6 w-full">
          Request a new link
        </ButtonLink>
      </>
    );
  }

  const error = failure?.fields?.password;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="password" label="New password" hint={PASSWORD_HINT} error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy("password", { hint: PASSWORD_HINT, error })}
        />
      </Field>
      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
