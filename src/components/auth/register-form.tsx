"use client";

import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { LegalLink } from "@/components/legal/legal-link";
import { Captcha, useCaptcha } from "@/components/auth/captcha";
import { RoleSelect } from "@/components/auth/role-select";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { register, type AccountRole, type AccountRoleGroup } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { captchaAnswerProblem, hasProblems, registerProblems, type Problems } from "@/lib/auth-validation";

export const PASSWORD_HINT = "At least 10 characters. A short phrase works well.";

/** Each field, in the order of the form, and the control that takes focus when it is invalid. */
const FIELDS = {
  name: "#name",
  email: "#email",
  password: "#password",
  roles: "#roles input:not(:disabled)",
  consent: "#consent",
  captcha: "#captcha-answer:not(:disabled), #captcha-retry",
};

/** Controls whose `name` is not the name of their field. */
const ALIASES = { account_kind: "roles", captcha_answer: "captcha" };

/** The API's field errors under this form's field names. */
function serverProblems(fields: Record<string, string> | undefined): Problems {
  if (!fields) return {};
  return {
    name: fields.name,
    email: fields.email,
    password: fields.password,
    roles: fields.roles,
    consent: fields["consent.accepted"] ?? fields.consent,
    captcha: fields.captcha ?? fields["captcha.answer"] ?? fields["captcha.captcha_id"],
  };
}

/** `roleGroups` is the API's `account_roles` reference set, loaded by the page. */
export function RegisterForm({ roleGroups }: { roleGroups: AccountRoleGroup[] }) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { form, errors, show, onChange } = useFieldErrors(FIELDS, ALIASES);
  const captcha = useCaptcha();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      // Only the checkboxes of the chosen kind of account are enabled, so only those are here.
      roles: data.getAll("roles") as AccountRole[],
      consent: data.get("consent") === "on",
    };
    const answer = captcha.answer.trim();

    const problems = registerProblems(input, roleGroups);
    if (captcha.status === "failed") {
      problems.captcha = "We cannot create the account until the question has loaded. Choose “Try again”.";
    } else if (!captcha.challenge) {
      problems.captcha = "The question is still loading. Try again in a moment.";
    } else if (captcha.isExpired()) {
      problems.captcha = "That question ran out of time. Answer the new one.";
      captcha.reload();
    } else {
      problems.captcha = captchaAnswerProblem(answer);
    }

    setFailure(null);
    if (hasProblems(problems) || !captcha.challenge) {
      show(problems);
      return;
    }

    setPending(true);
    const result = await register({
      name: input.name,
      email: input.email,
      password: input.password,
      roles: input.roles,
      accepted: input.consent,
      captcha: { captcha_id: captcha.challenge.id, answer },
    });
    setPending(false);

    if (result.ok) {
      setSentTo(input.email);
      return;
    }
    // A question can be answered once, so every failed attempt needs a new one.
    captcha.reload();
    const fromServer = serverProblems(result.failure.fields);
    // The message goes beside its field; anything else (no fields, or only
    // fields this form does not have) is shown above the button.
    setFailure(hasProblems(fromServer) ? null : result.failure);
    show(fromServer);
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

  const captchaUnavailable = captcha.status === "failed";

  return (
    <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
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
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={fieldDescribedBy("password", { hint: PASSWORD_HINT, error: errors.password })}
        />
      </Field>

      <RoleSelect groups={roleGroups} error={errors.roles} />

      <div>
        <label className="flex min-h-11 items-start gap-3 py-2 text-sm leading-relaxed text-muted">
          <input
            id="consent"
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <span>
            I agree to the <LegalLink to="termsAndConditions" /> and <LegalLink to="privacyPolicy" />.
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" className="text-sm text-danger">
            {errors.consent}
          </p>
        )}
      </div>

      <Captcha captcha={captcha} error={errors.captcha} />

      {failure && <Alert title={failure.message} traceId={failure.traceId} />}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        aria-busy={pending}
        aria-describedby={captchaUnavailable ? "register-blocked" : undefined}
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>
      {captchaUnavailable && (
        <p id="register-blocked" className="text-sm text-muted">
          You can create the account once the security question above has loaded.
        </p>
      )}
    </form>
  );
}
