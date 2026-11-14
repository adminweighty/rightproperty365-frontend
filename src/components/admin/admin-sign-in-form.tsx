"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { adminLogin } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";

/**
 * Sign-in for platform administrators only. The API answers every failure the
 * same way, so this form must not hint at whether an address is an admin.
 */
export function AdminSignInForm() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setPending(true);
    setFailure(null);
    const result = await adminLogin(
      String(data.get("email") ?? "").trim(),
      String(data.get("password") ?? ""),
    );
    setPending(false);

    if (result.ok) {
      setSession(result.data);
      router.push("/admin");
    } else {
      setFailure(result.failure);
    }
  }

  const errors = failure?.fields ?? {};
  const credentialFailure = failure?.code === "INVALID_CREDENTIALS";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="admin-email" label="Work email address" error={errors.email}>
        <Input
          id="admin-email"
          name="email"
          type="email"
          required
          autoComplete="username"
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
