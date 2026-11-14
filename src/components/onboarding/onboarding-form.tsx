"use client";

import { BadgeCheck, ChevronLeft, CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { DocumentUploader } from "@/components/onboarding/document-uploader";
import {
  cityFieldFor,
  fieldDisplay,
  fieldOptions,
  fieldSpec,
  fieldText,
  fieldValue,
  shownDetailNames,
  type FieldLists,
} from "@/components/onboarding/fields";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LegalLink } from "@/components/legal/legal-link";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import {
  listMyApplications,
  onboardingStatusLabel,
  onboardingStatusTones,
  saveApplication,
  submitApplication,
  type OnboardingApplication,
  type OnboardingDetailsPatch,
  type OnboardingRequirements,
} from "@/lib/api/onboarding";

type Props = {
  /** What this role has to provide, from GET /v1/onboarding/requirements. */
  requirement: OnboardingRequirements;
  /** Cities, trades and verified agencies to choose from, loaded from the API by the page. */
  lists: FieldLists;
};

type State =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  /** The signed-in user did not choose this role. */
  | { status: "none" }
  | { status: "ready"; application: OnboardingApplication };

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

/** What an approval leads to, in plain words. */
function outcomeText(requirement: OnboardingRequirements): string {
  if (requirement.outcome === "ORGANISATION") {
    return requirement.directory_kind
      ? "When we approve it, your business appears under Professionals with a public profile and a Verified badge."
      : "When we approve it, your business is set up on RightProperty365.";
  }
  if (requirement.outcome === "AGENCY_MEMBER") {
    return requirement.directory_kind
      ? "When we approve it, you are added to your agency and get a public profile with a Verified badge."
      : "When we approve it, you are added to your agency.";
  }
  return "When we approve it, the role becomes active on your account.";
}

function Details({ requirement, lists }: Props) {
  const { refresh } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<"save" | "submit" | "reapply" | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  // The country picked in the form; null until it is changed, when the stored one applies.
  const [pickedCountry, setPickedCountry] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const { role } = requirement;

  const read = useCallback(async () => {
    const result = await listMyApplications();
    if (!result.ok) return setState({ status: "error", failure: result.failure });
    const application = result.data.applications.find((item) => item.role === role);
    setState(application ? { status: "ready", application } : { status: "none" });
  }, [role]);

  useEffect(() => {
    // Read after the effect has returned, so the first render is not interrupted.
    const timer = window.setTimeout(read, 0);
    return () => window.clearTimeout(timer);
  }, [read, attempt]);

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading your application" className="space-y-4">
        <div className="h-10 max-w-sm rounded-md bg-sunken" />
        <div className="h-72 rounded-lg bg-sunken" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <h1 className="text-3xl md:text-4xl">{requirement.label}</h1>
        <Alert title={state.failure.message} traceId={state.failure.traceId} className="mt-6" />
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </Button>
      </>
    );
  }

  if (state.status === "none") {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You have no {requirement.label.toLowerCase()} application</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          This step is for accounts that chose this role when they signed up.
        </p>
        <ButtonLink href="/onboarding" variant="secondary" className="mt-6">
          Back to your applications
        </ButtonLink>
      </div>
    );
  }

  const { application } = state;
  const editable = application.can_edit;
  const fieldNames = requirement.fields.map(({ name }) => name);
  const asksCountry = fieldNames.includes("country");
  const country = pickedCountry ?? application.details.country ?? "";
  // The city is a choice or a text box, depending on the country (see `cityFieldFor`).
  const cityField = cityFieldFor(fieldNames, country, lists);
  const documentFor = (code: string) => application.documents.find((item) => item.type.code === code);
  // Files of a type the role no longer asks for are still listed, so they can be removed.
  const otherDocuments = application.documents.filter(
    (item) => !requirement.documents.some((type) => type.code === item.type.code),
  );

  /** Everything in the form, as the API expects it. */
  function readForm(): OnboardingDetailsPatch {
    const data = new FormData(form.current ?? undefined);
    const patch: OnboardingDetailsPatch = {};
    for (const { name } of requirement.fields) {
      (patch as Record<string, unknown>)[name] = fieldValue(name, String(data.get(name) ?? ""));
    }
    return patch;
  }

  /** Shows the API's field errors and moves focus to the first one. */
  function showProblems(result: ApiFailure, prefix: string) {
    const next: Record<string, string> = {};
    for (const [key, message] of Object.entries(result.fields ?? {})) {
      // Saving reports "city"; submitting reports "details.city" and "documents.CODE".
      const full = key.includes(".") ? key : `${prefix}${key}`;
      const [group, name] = full.split(".");
      // The API says only "is required"; say what to do about it.
      next[full] =
        message !== "is required"
          ? message
          : group === "documents"
            ? "Attach this document before you submit."
            : `Enter ${fieldSpec(name).label.toLowerCase()} before you submit.`;
    }
    setErrors(next);
    setFailure(result);
    const firstKey = [
      ...requirement.fields.map(({ name }) => `details.${name}`),
      ...requirement.documents.map(({ code }) => `documents.${code}`),
    ].find((key) => next[key]);
    if (firstKey) {
      const [group, name] = firstKey.split(".");
      const target = document.getElementById(group === "details" ? `ob-${name}` : `doc-${name}-upload`);
      // After React has drawn the messages, so the control is described when it is focused.
      window.setTimeout(() => target?.focus(), 0);
    }
  }

  async function save(): Promise<boolean> {
    setFailure(null);
    setErrors({});
    setSaved(null);
    const result = await saveApplication(role, readForm());
    if (!result.ok) {
      showProblems(result.failure, "details.");
      return false;
    }
    setState({ status: "ready", application: result.data.application });
    return true;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("save");
    if (await save()) setSaved("Draft saved. Nothing has been sent for review yet.");
    setPending(null);
  }

  async function handleSubmit() {
    setPending("submit");
    if (await save()) {
      const result = await submitApplication(role);
      if (result.ok) {
        setState({ status: "ready", application: result.data.application });
        await refresh();
        window.scrollTo({ top: 0 });
      } else if (result.failure.code === "INVALID_STATE") {
        setFailure({ ...result.failure, message: "This application can no longer be changed. We have loaded its current state." });
        await read();
      } else {
        showProblems(
          result.failure.fields
            ? { ...result.failure, message: "Some things are still missing. Check the marked details and documents." }
            : result.failure,
          "details.",
        );
      }
    }
    setPending(null);
  }

  /** After a rejection, saving the details again starts a new application for the role. */
  async function handleReapply() {
    setPending("reapply");
    setFailure(null);
    const previous: OnboardingDetailsPatch = {};
    for (const { name } of requirement.fields) {
      (previous as Record<string, unknown>)[name] = fieldValue(name, fieldText(application.details, name));
    }
    const result = await saveApplication(role, previous);
    if (result.ok) {
      setState({ status: "ready", application: result.data.application });
      setSaved("A new application was started with your earlier details. Attach your documents again, then submit.");
      await refresh();
    } else {
      setFailure(result.failure);
    }
    setPending(null);
  }

  return (
    <>
      <Link
        href="/onboarding"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-ink hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Your applications
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl md:text-4xl">{application.role_label}</h1>
        <Badge tone={onboardingStatusTones[application.status]}>
          {onboardingStatusLabel(application)}
        </Badge>
      </div>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        {editable
          ? `Tell us about ${requirement.outcome === "ORGANISATION" ? "your business" : "yourself"} and attach the documents below. Our team checks every application before the role is confirmed. `
          : ""}
        {application.status !== "APPROVED" && outcomeText(requirement)}
      </p>

      <div className="mt-6 space-y-4">
        {application.status === "SUBMITTED" && (
          <Alert tone="info" title={onboardingStatusLabel(application)}>
            <p>
              We received your application
              {application.submitted_at && ` on ${formatWhen(application.submitted_at)}`}. Our team
              will check it and email you the result. The role is not active until it is approved,
              and you cannot change the application while it is being reviewed.
            </p>
          </Alert>
        )}
        {application.status === "APPROVED" && (
          <Alert tone="success" title="Approved">
            <p>
              This role is active on your account.
              {application.profile && " Your public profile is live with a Verified badge."}
            </p>
            {application.decision.reason && <p className="mt-1">Note from our team: {application.decision.reason}</p>}
          </Alert>
        )}
        {application.status === "CHANGES_REQUESTED" && (
          <Alert tone="warning" title="Our team asked for changes">
            <p className="whitespace-pre-line">{application.decision.reason}</p>
            <p className="mt-1">Make the changes below, then submit the application again.</p>
          </Alert>
        )}
        {application.status === "REJECTED" && (
          <Alert tone="danger" title="This application was rejected">
            <p className="whitespace-pre-line">{application.decision.reason}</p>
            <p className="mt-1">
              You can apply again. Your earlier details are kept; documents have to be attached again.
            </p>
          </Alert>
        )}
        {saved && <Alert tone="success" title={saved} />}
      </div>

      {application.status === "APPROVED" && application.profile && (
        <ButtonLink href={`/directory/${application.profile.kind}/${application.profile.slug}`} className="mt-6">
          <BadgeCheck className="size-4" aria-hidden="true" />
          View your public profile
        </ButtonLink>
      )}
      {application.can_reapply && (
        <Button className="mt-6" disabled={pending !== null} aria-busy={pending === "reapply"} onClick={handleReapply}>
          {pending === "reapply" ? "Starting…" : "Apply again"}
        </Button>
      )}

      {editable ? (
        <form ref={form} onSubmit={handleSave} noValidate className="mt-8 space-y-8">
          <Card>
            <h2 className="text-2xl">Details</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {requirement.fields.map(({ name, required: flagged }) => {
                const isCity = name === "city" || name === "city_name";
                if (isCity && name !== cityField) return null;
                const spec = fieldSpec(name);
                const id = `ob-${name}`;
                // The API reports a missing city under whichever of the two names it expected.
                const error =
                  errors[`details.${name}`] ?? (isCity ? (errors["details.city"] ?? errors["details.city_name"]) : undefined);
                // Exactly one of the two city fields is needed, which the API cannot flag on either.
                const required = flagged || (isCity && asksCountry);
                const hint =
                  name === "country" && !country && cityField === null
                    ? `${spec.hint} Choose the country first, then the city or town.`
                    : spec.hint;
                const stored = fieldText(application.details, name);
                const options = fieldOptions(spec.kind, lists).filter(
                  (option) => name !== "city" || !asksCountry || option.country === country,
                );
                const described = fieldDescribedBy(id, { hint, error });
                const common = {
                  id,
                  name,
                  // A stored city of another country is not offered again.
                  defaultValue: name === "city" && !options.some((option) => option.value === stored) ? "" : stored,
                  "aria-invalid": Boolean(error),
                  "aria-describedby": described,
                  "aria-required": required,
                };
                const wide = spec.kind === "textarea" || spec.kind === "list" || spec.kind === "phone";
                return (
                  <Field
                    // A new country is a new list of cities: start the choice again.
                    key={isCity ? `${name}-${country}` : name}
                    id={id}
                    label={spec.label}
                    hint={hint}
                    error={error}
                    optional={!required}
                    className={wide ? "sm:col-span-2" : undefined}
                  >
                    {spec.kind === "textarea" ? (
                      <Textarea {...common} maxLength={spec.maxLength} rows={5} />
                    ) : spec.kind === "country" ? (
                      <SearchableSelect
                        {...common}
                        defaultValue={undefined}
                        value={country}
                        onValueChange={setPickedCountry}
                        options={[{ value: "", label: "Choose a country…" }, ...options.map(({ value, label, keywords }) => ({ value, label, keywords }))]}
                      />
                    ) : spec.kind === "city" || spec.kind === "trade" || spec.kind === "agency" ? (
                      <SearchableSelect
                        {...common}
                        options={[{ value: "", label: "Choose…" }, ...options.map(({ value, label }) => ({ value, label }))]}
                      />
                    ) : (
                      <Input
                        {...common}
                        type={spec.kind === "phone" ? "tel" : "text"}
                        maxLength={spec.maxLength}
                        autoComplete={spec.autoComplete ?? "off"}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl">Documents</h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Your documents are private. Only you and our verification team can open them, and
                they are handled as the <LegalLink to="privacyPolicy" /> describes. Each file is saved
                as soon as it is uploaded.
              </span>
            </p>
            <ul className="mt-5 space-y-3">
              {requirement.documents.map((type) => (
                <DocumentUploader
                  key={type.code}
                  role={role}
                  type={type}
                  document={documentFor(type.code)}
                  editable
                  error={errors[`documents.${type.code}`]}
                  onChanged={read}
                />
              ))}
              {otherDocuments.map((item) => (
                <DocumentUploader
                  key={item.id}
                  role={role}
                  type={{ ...item.type, description: "No longer asked for. You can remove it.", required: false }}
                  document={item}
                  editable
                  onChanged={read}
                />
              ))}
            </ul>
          </Card>

          <div>
            {failure && <Alert title={failure.message} traceId={failure.fields ? undefined : failure.traceId} className="mb-4" />}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="secondary" size="lg" disabled={pending !== null} aria-busy={pending === "save"}>
                {pending === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button size="lg" disabled={pending !== null} aria-busy={pending === "submit"} onClick={handleSubmit}>
                {pending === "submit" ? "Submitting…" : "Submit for review"}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted">
              You can save and come back later. After you submit, the application cannot be changed
              unless our team asks for changes.
            </p>
          </div>
        </form>
      ) : (
        <div className="mt-8 space-y-8">
          {failure && <Alert title={failure.message} traceId={failure.traceId} />}
          <Card>
            <h2 className="text-2xl">Details</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {shownDetailNames(fieldNames, application.details).map((name) => {
                const spec = fieldSpec(name);
                const value = fieldDisplay(application.details, name, lists);
                return (
                  <div key={name} className={spec.kind === "textarea" ? "sm:col-span-2" : undefined}>
                    <dt className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      {spec.label}
                      {spec.private && <Badge>Private</Badge>}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line break-words text-ink">
                      {value || <span className="text-subtle">Not given</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          <Card>
            <h2 className="text-2xl">Documents</h2>
            {application.documents.length === 0 ? (
              <p className="mt-3 text-muted">No documents are attached.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {[...requirement.documents.filter((type) => documentFor(type.code)), ...otherDocuments.map((item) => ({ ...item.type, description: "", required: false }))].map(
                  (type) => (
                    <DocumentUploader
                      key={type.code}
                      role={role}
                      type={type}
                      document={documentFor(type.code)}
                      editable={false}
                      onChanged={read}
                    />
                  ),
                )}
              </ul>
            )}
          </Card>
        </div>
      )}

      {application.status === "SUBMITTED" && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <CircleCheck className="size-4" aria-hidden="true" />
          Nothing more is needed from you right now.
        </p>
      )}
    </>
  );
}

/**
 * One onboarding application: the details and documents a role has to give
 * before RightProperty365 confirms it. What is asked comes from the API.
 */
export function OnboardingForm(props: Props) {
  return <RequireAuth>{() => <Details {...props} />}</RequireAuth>;
}
