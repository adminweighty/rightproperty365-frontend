"use client";

import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { RoleSelect } from "@/components/auth/role-select";
import { register, type AccountRole } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";

export const PASSWORD_HINT = "At least 10 characters. A short phrase works well.";

export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const roles = data.getAll("roles") as AccountRole[];

    if (roles.length === 0) {
      setRolesError("Choose at least one option.");
      return;
    }

    setPending(true);
    setFailure(null);
    setRolesError(null);
    const result = await register({
      name: String(data.get("name") ?? "").trim(),
      email,
      password: String(data.get("password") ?? ""),
      roles,
      accepted: data.get("consent") === "on",
    });
    setPending(false);

    if (result.ok) setSentTo(email);
    else setFailure(result.failure);
  }

  if (sentTo) {
    // The API answers the same way whether or not the address already has an
    // account, so this copy must not claim an account was created.
    return (
      <div role="status">
        <MailCheck className="size-8 text-primary-ink" aria-hidden="true" />
        <h2 className="mt-4 text-2xl">Check your email</h2>
        <p className="mt-2 leading-relaxed text-muted">
          If {sentTo} can be registered, we have sent it a link to confirm the address. The link
          works for 24 hours.
        </p>
        <p className="mt-4 text-sm text-muted">
          Nothing arrived? Check your spam folder, or sign in to request a new link.
        </p>
      </div>
    );
  }

  const errors = failure?.fields ?? {};
  const consentError = errors["consent.accepted"] ?? errors.consent;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="name" label="Full name" error={errors.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={fieldDescribedBy("name", { error: errors.name })}
        />
      </Field>

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

      <Field id="password" label="Password" hint={PASSWORD_HINT} error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={fieldDescribedBy("password", { hint: PASSWORD_HINT, error: errors.password })}
        />
      </Field>

      <RoleSelect error={rolesError ?? errors.roles} />

      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
            aria-describedby={consentError ? "consent-error" : undefined}
          />
          <span>I agree to the RightProperty365 terms and privacy notice.</span>
        </label>
        {consentError && (
          <p id="consent-error" className="mt-1.5 text-sm text-danger">
            {consentError}
          </p>
        )}
      </div>

      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
