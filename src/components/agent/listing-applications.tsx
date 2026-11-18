"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getIntake, listForms, saveIntake, type Intake, type QuestionnaireForm } from "@/lib/api/applications";
import type { ApiFailure } from "@/lib/api/http";
import type { ManagedListing } from "@/lib/api/manage-listings";
import {
  INTAKE_LABELS,
  isoToLocalDateTime,
  listingTakesApplications,
  localDateTimeToIso,
  type IntakeStatus,
} from "@/lib/questionnaires";

/*
 * The listing editor's "Applications" section (API 0.32.0, FR-019): which
 * published form of the listing's organisation and country applicants
 * answer, whether the listing is taking applications now, and when it stops.
 * Saved with its own button, apart from the listing's autosave, because
 * opening intake is a decision that reaches the public page at once.
 */

const STATUSES: IntakeStatus[] = ["OPEN", "PAUSED", "CLOSED", "NONE"];

/** Why the effective status is CLOSED although OPEN was set. */
const CLOSED_REASONS: Record<string, string> = {
  CLOSES_AT_PASSED: "The closing time has passed.",
  FORM_EXPIRED: "The form has expired. Attach a current form to open applications again.",
  FORM_RETIRED: "The form was retired. Attach a published form to open applications again.",
};

const intakeTone = (status: IntakeStatus) => (status === "OPEN" ? "success" : status === "PAUSED" ? "warning" : "neutral");

/** `at`: when the forms were read, to leave out those that had expired by then. */
type Loaded = { intake: Intake; forms: QuestionnaireForm[] | null; formsFailure: ApiFailure | null; at: number };

export function ListingApplications({ listing, editable }: { listing: ManagedListing; editable: boolean }) {
  const orgId = listing.owner.organisation_id;
  const market = listing.content.country;
  const eligible = listingTakesApplications(listing.content.category);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [formId, setFormId] = useState("");
  const [status, setStatus] = useState<IntakeStatus>("OPEN");
  const [closesAt, setClosesAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eligible || !orgId) return;
    let cancelled = false;
    Promise.all([getIntake(listing.id), listForms(orgId, { status: "PUBLISHED" })]).then(([intake, forms]) => {
      if (cancelled) return;
      if (!intake.ok) {
        setFailure(intake.failure);
        return;
      }
      setFailure(null);
      setLoaded({ intake: intake.data, forms: forms.ok ? forms.data : null, formsFailure: forms.ok ? null : forms.failure, at: Date.now() });
      setFormId(intake.data.form_id ?? "");
      setStatus(intake.data.stored_status === "NONE" ? "OPEN" : intake.data.stored_status);
      setClosesAt(isoToLocalDateTime(intake.data.closes_at));
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, orgId, listing.id, attempt]);

  const headingId = "section-applications";
  const intro = "People answer your application form and send private documents. Only your organisation sees them.";

  const shell = (body: ReactNode) => (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} tabIndex={-1} className="text-2xl">
          Applications
        </h2>
        <p className="mt-1 text-sm text-muted">{intro}</p>
        <div className="mt-5 grid gap-5">{body}</div>
      </Card>
    </section>
  );

  if (!eligible) return shell(<p className="text-sm text-muted">Short stays do not take applications. Guests ask to stay with the request form instead.</p>);
  if (!orgId) {
    return shell(
      <p className="text-sm text-muted">
        Application forms belong to an organisation, so a listing you advertise as a direct owner cannot take applications yet.
      </p>,
    );
  }
  if (failure) {
    return shell(
      <div>
        <Alert title={failure.status === 403 ? "You cannot change applications for this listing." : failure.message} traceId={failure.traceId} />
        {failure.status !== 403 && (
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
        )}
      </div>,
    );
  }
  if (loaded && !loaded.intake.eligible) return shell(<p className="text-sm text-muted">This listing cannot take applications. Short stays use the request form instead.</p>);
  if (!loaded) return shell(<div className="h-24 rounded-md bg-sunken" aria-busy="true" aria-label="Loading the application settings" />);

  const usable = (loaded.forms ?? []).filter(
    (form) => (!market || !form.market_code || form.market_code === market) && (!form.expires_at || Date.parse(form.expires_at) > loaded.at),
  );
  const attached = loaded.intake.form_id;
  const attachedMissing = attached && !usable.some((form) => form.id === attached);
  const options = [
    { value: "", label: "Choose a form…" },
    ...(attachedMissing
      ? [{ value: attached as string, label: `${loaded.intake.form_name ?? "The attached form"}${loaded.intake.form_version ? `, version ${loaded.intake.form_version}` : ""}`, secondary: "attached now" }]
      : []),
    ...usable.map((form) => ({ value: form.id, label: `${form.name}, version ${form.version}`, secondary: form.market_code })),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!formId && status !== "NONE") found.form_id = "Choose the form applicants answer.";
    const iso = closesAt ? localDateTimeToIso(closesAt) : null;
    if (closesAt && !iso) found.closes_at = "Enter a date and time.";
    else if (iso && Date.parse(iso) <= Date.now()) found.closes_at = "Choose a time in the future.";
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.form_id ? "intake-form" : "intake-closes")?.focus();
      return;
    }
    setBusy(true);
    const answer = await saveIntake(listing.id, status === "NONE" ? { form_id: null, status: "NONE" } : { form_id: formId, status, closes_at: iso });
    setBusy(false);
    if (answer.ok) {
      setLoaded((current) => (current ? { ...current, intake: answer.data } : current));
      setMessage({
        tone: "success",
        text:
          answer.data.status === "OPEN"
            ? "Saved. The listing is taking applications."
            : answer.data.status === "PAUSED"
              ? "Saved. Applications are paused; drafts are kept."
              : answer.data.status === "NONE"
                ? "Saved. The form is no longer attached to this listing."
                : "Saved. The listing is not taking applications.",
      });
    } else if (answer.failure.fields && Object.keys(answer.failure.fields).length > 0) {
      setErrors(answer.failure.fields);
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
    } else {
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
    }
    result.current?.focus();
  }

  const current = loaded.intake;

  return shell(
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span className="text-muted">Now:</span>
        <Badge tone={intakeTone(current.status)}>{INTAKE_LABELS[current.status]}</Badge>
        {current.closes_at && current.status === "OPEN" && <span className="text-muted">until {formatWhen(current.closes_at)}</span>}
      </p>
      {current.status === "CLOSED" && current.stored_status === "OPEN" && current.closed_reason && CLOSED_REASONS[current.closed_reason] && (
        <p className="text-sm text-warning">{CLOSED_REASONS[current.closed_reason]}</p>
      )}
      {loaded.formsFailure && <Alert title={loaded.formsFailure.status === 403 ? "You cannot read your organisation's forms." : loaded.formsFailure.message} />}
      {loaded.forms && usable.length === 0 && !attached ? (
        <p className="text-sm text-muted">
          There is no published form for {market ?? "this listing's country"} yet.{" "}
          <Link href={`/agent/forms?org=${encodeURIComponent(orgId)}`} className="font-medium text-primary-ink hover:underline">
            Create one in Application forms
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-5">
          <fieldset disabled={!editable || busy} className="grid min-w-0 gap-5">
            <Field id="intake-form" label="Application form" hint="Published forms of your organisation for this country." error={errors.form_id}>
              <SearchableSelect
                id="intake-form"
                options={options}
                value={formId}
                onValueChange={setFormId}
                disabled={!editable || busy}
                aria-invalid={Boolean(errors.form_id)}
                aria-describedby={fieldDescribedBy("intake-form", { hint: "x", error: errors.form_id })}
              />
            </Field>
            <Field id="intake-status" label="Taking applications" error={errors.status}>
              <SearchableSelect
                id="intake-status"
                options={STATUSES.map((value) => ({ value, label: INTAKE_LABELS[value] }))}
                value={status}
                onValueChange={(value) => value && setStatus(value as IntakeStatus)}
                disabled={!editable || busy}
                aria-invalid={Boolean(errors.status)}
                aria-describedby={errors.status ? "intake-status-error" : undefined}
              />
            </Field>
            <Field
              id="intake-closes"
              label="Stop taking applications at"
              optional
              hint="Your time zone. Applications sent after it are refused with an explanation."
              error={errors.closes_at}
            >
              <Input
                id="intake-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.currentTarget.value)}
                aria-invalid={Boolean(errors.closes_at)}
                aria-describedby={fieldDescribedBy("intake-closes", { hint: "x", error: errors.closes_at })}
                className="max-w-xs"
              />
            </Field>
          </fieldset>
          {status === "PAUSED" && <p className="text-sm text-muted">While paused, applicants keep their drafts but cannot send them. The listing page says applications are paused.</p>}
          {editable && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy || undefined}>
                {busy ? "Saving…" : "Save the application settings"}
              </Button>
              <Link href={`/agent/applications?org=${encodeURIComponent(orgId)}&listing=${encodeURIComponent(listing.id)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary-ink hover:underline">
                Applications for this listing
              </Link>
            </div>
          )}
        </form>
      )}
      <div ref={result} tabIndex={-1} className="outline-none" aria-live="polite">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
    </>,
  );
}
