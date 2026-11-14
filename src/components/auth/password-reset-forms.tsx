"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PASSWORD_HINT } from "@/components/auth/register-form";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { emailProblem, newPasswordProblem } from "@/lib/auth-validation";

/** The one field of each form, and the control that takes focus when it is invalid. */
const EMAIL_FIELD = { email: "#email" };
const PASSWORD_FIELD = { password: "#password" };

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { form, errors, show, onChange } = useFieldErrors(EMAIL_FIELD);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setFailure(null);
    const problem = emailProblem(email);
    show({ email: problem });
    if (problem) return;

    setPending(true);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (result.ok) {
      setSentTo(email);
      return;
    }
    setFailure(result.failure);
    show({ email: result.failure.fields?.email });
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

  const error = errors.email;

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
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
  const { form, errors, show, onChange } = useFieldErrors(PASSWORD_FIELD);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setFailure(null);
    const problem = newPasswordProblem(password);
    show({ password: problem });
    if (problem) return;

    setPending(true);
    const result = await confirmPasswordReset(token, password);
    setPending(false);
    if (result.ok) {
      setDone(true);
      return;
    }
    setFailure(result.failure);
    show({ password: result.failure.fields?.password });
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

  const error = errors.password;

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      <Field id="password" label="New password" hint={PASSWORD_HINT} error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          required
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
