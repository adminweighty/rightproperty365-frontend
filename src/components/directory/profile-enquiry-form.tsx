"use client";

import { CircleCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Select, Textarea } from "@/components/ui/field";
import {
  submitBusinessEnquiry,
  type BusinessEnquiryReceipt,
} from "@/lib/api/business-enquiries";
import type { ApiFailure } from "@/lib/api/http";
import { contactMethods, type ContactMethod } from "@/lib/api/property-requests";
import type { DirectoryKind } from "@/lib/data/directory";
import { PRIVACY_NOTICE_VERSION } from "@/lib/env";

type Props = {
  kind: DirectoryKind;
  slug: string;
  name: string;
  services: string[];
};

// Field names the API may report, mapped to the control that should show them.
const apiFieldToControl: Record<string, string> = {
  "guest_contact.name": "name",
  "guest_contact.email": "email",
  "guest_contact.phone": "phone",
  message: "message",
  service: "service",
  preferred_contact_method: "preferred_contact_method",
  "consent.accepted": "consent",
  consent: "consent",
};

/**
 * The only way to contact a directory profile. Ids are prefixed with "enquiry-"
 * so the form can share a page with other forms.
 */
export function ProfileEnquiryForm({ kind, slug, name, services }: Props) {
  const { user } = useAuth();
  const [contactMethod, setContactMethod] = useState<ContactMethod>("EMAIL");
  const phoneRequired = contactMethod !== "EMAIL";
  const phoneHint = phoneRequired
    ? "Needed so they can reach you. Include the country code, for example +263 77 123 4567."
    : "Include the country code, for example +263 77 123 4567.";
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [receipt, setReceipt] = useState<BusinessEnquiryReceipt | null>(null);

  // One key per logical enquiry: a retry of unchanged content reuses it so the
  // API cannot create a duplicate; any edit starts a new enquiry.
  const idempotencyKey = useRef<string | null>(null);

  const errors: Record<string, string> = {};
  for (const [apiField, message] of Object.entries(failure?.fields ?? {})) {
    errors[apiFieldToControl[apiField] ?? apiField] = message;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();

    idempotencyKey.current ??= crypto.randomUUID();
    setPending(true);
    setFailure(null);

    const result = await submitBusinessEnquiry({
      recipient: { kind, slug },
      service: text("service") || undefined,
      message: text("message"),
      preferred_contact_method: contactMethod,
      idempotency_key: idempotencyKey.current,
      guest_contact: {
        name: user ? undefined : text("name"),
        email: user ? undefined : text("email"),
        // The API expects E.164, so drop the spaces and dashes people type.
        phone: text("phone").replace(/[\s()-]/g, "") || undefined,
      },
      consent: { privacy_version: PRIVACY_NOTICE_VERSION, accepted: data.get("consent") === "on" },
    });

    setPending(false);
    if (result.ok) {
      idempotencyKey.current = null;
      setReceipt(result.receipt);
    } else {
      setFailure(result.failure);
    }
  }

  if (receipt) {
    return (
      <div role="status" className="rounded-lg bg-success-soft p-5">
        <p className="flex items-center gap-2 font-medium text-success">
          <CircleCheck className="size-5" aria-hidden="true" />
          Enquiry received
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          We have saved your enquiry and are passing it to {name}. They will reply using the contact
          method you chose. Keep this reference in case you need to follow up:
        </p>
        <p className="mt-3 font-mono text-lg font-medium text-ink">{receipt.reference}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setReceipt(null)}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        idempotencyKey.current = null;
      }}
      className="flex flex-col gap-4"
    >
      {services.length > 0 && (
        <Field id="enquiry-service" label="What do you need?" optional error={errors.service}>
          <Select id="enquiry-service" name="service" defaultValue="">
            <option value="">Not sure yet</option>
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {user ? (
        <p className="rounded-md bg-sunken p-3 text-sm text-muted">
          Sending as <span className="font-medium text-ink">{user.name}</span>{" "}
          <span className="break-all">({user.email})</span>
        </p>
      ) : (
        <>
          <Field id="enquiry-name" label="Full name" error={errors.name}>
            <Input
              id="enquiry-name"
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy("enquiry-name", { error: errors.name })}
            />
          </Field>

          <Field id="enquiry-email" label="Email address" error={errors.email}>
            <Input
              id="enquiry-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy("enquiry-email", { error: errors.email })}
            />
          </Field>
        </>
      )}

      <Field
        id="enquiry-contact-method"
        label="How should they reply?"
        error={errors.preferred_contact_method}
      >
        <Select
          id="enquiry-contact-method"
          name="preferred_contact_method"
          value={contactMethod}
          onChange={(event) => setContactMethod(event.target.value as ContactMethod)}
        >
          {contactMethods.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="enquiry-phone" label="Phone number" optional={!phoneRequired} hint={phoneHint} error={errors.phone}>
        <Input
          id="enquiry-phone"
          name="phone"
          type="tel"
          required={phoneRequired}
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={fieldDescribedBy("enquiry-phone", { hint: phoneHint, error: errors.phone })}
        />
      </Field>

      <Field
        id="enquiry-message"
        label="Message"
        hint="Say what you need, where, and when."
        error={errors.message}
      >
        <Textarea
          id="enquiry-message"
          name="message"
          required
          maxLength={2000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={fieldDescribedBy("enquiry-message", {
            hint: "hint",
            error: errors.message,
          })}
        />
      </Field>

      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
            aria-describedby={errors.consent ? "enquiry-consent-error" : undefined}
          />
          <span>
            I agree that RightProperty365 may share these details with {name} so they can answer
            this enquiry.
          </span>
        </label>
        {errors.consent && (
          <p id="enquiry-consent-error" className="mt-1.5 text-sm text-danger">
            {errors.consent}
          </p>
        )}
      </div>

      {failure && <Alert title={failure.message} traceId={failure.traceId} />}

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
