"use client";

import { BadgeCheck, Check, ChevronLeft, FileText, Minus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { fieldDisplay, fieldSpec, shownDetailNames, type FieldLists } from "@/components/onboarding/fields";
import { PrivateImage } from "@/components/ui/private-image";
import { LOGO_DOCUMENT } from "@/lib/logo-rules";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { membershipRoleLabel, organisationKindLabel } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import {
  adminDocumentUrl,
  approveApplication,
  formatFileSize,
  getApplication,
  onboardingStatusLabel,
  onboardingStatusLabels,
  onboardingStatusTones,
  rejectApplication,
  requestChanges,
  type OnboardingAdminApplication,
  type OnboardingApproval,
  type OnboardingRequirements,
} from "@/lib/api/onboarding";

type Props = {
  id: string;
  /** What each role has to provide and what approving it creates, from the API. */
  requirements: OnboardingRequirements[];
  /** Cities, trades and agencies, to show labels for the codes in the details. */
  lists: FieldLists;
  /** code -> label of the API's directory kinds. */
  directoryLabels: Record<string, string>;
  /** code -> label of the API's `organisation_kinds` reference set. */
  organisationKindLabels: Record<string, string>;
};

type State =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; application: OnboardingAdminApplication };

type Action = "approve" | "changes" | "reject";

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** What approving this application creates, in plain words. */
function outcomeText(
  application: OnboardingAdminApplication,
  requirement: OnboardingRequirements | undefined,
  directoryLabels: Record<string, string>,
  organisationKindLabels: Record<string, string>,
): string {
  const directory = requirement?.directory_kind
    ? (directoryLabels[requirement.directory_kind] ?? requirement.directory_kind)
    : null;
  const profile = directory ? ` and a public profile under Professionals, in “${directory}”, with a Verified badge` : "";
  if (application.outcome === "ORGANISATION") {
    // The kind is a title from the API: "Law Firm", "Real Estate Agency".
    const kind = requirement?.organisation_kind
      ? organisationKindLabel(requirement.organisation_kind, organisationKindLabels)
      : "organisation";
    const name = application.details.business_name ? ` “${application.details.business_name}”` : "";
    return `a new organisation of the kind ${kind}${name}, with the applicant as its principal${profile}. The role becomes active.`;
  }
  if (application.outcome === "AGENCY_MEMBER") {
    const agency = application.agency?.name ?? "the agency they named";
    return `a membership for the applicant in ${agency}${profile}. The role becomes active.`;
  }
  return "nothing new. The role becomes active on the applicant’s account.";
}

const actionCopy: Record<Action, { open: string; heading: string; confirm: string; pending: string; explain: string }> = {
  approve: {
    open: "Approve",
    heading: "Approve this application",
    confirm: "Confirm approval",
    pending: "Approving…",
    explain: "The applicant is emailed. This cannot be undone from this screen.",
  },
  changes: {
    open: "Request changes",
    heading: "Ask the applicant for changes",
    confirm: "Send request",
    pending: "Sending…",
    explain: "The applicant is emailed your reason and can edit and resubmit the application.",
  },
  reject: {
    open: "Reject",
    heading: "Reject this application",
    confirm: "Confirm rejection",
    pending: "Rejecting…",
    explain: "The applicant is emailed your reason. They can start a new application for the role.",
  },
};

function Review({ id, requirements, lists, directoryLabels, organisationKindLabels }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approval, setApproval] = useState<OnboardingApproval["created"] | null>(null);

  const read = useCallback(async () => {
    const result = await getApplication(id);
    setState(
      result.ok
        ? { status: "ready", application: result.data.application }
        : { status: "error", failure: result.failure },
    );
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(read, 0);
    return () => window.clearTimeout(timer);
  }, [read, attempt]);

  const back = (
    <Link
      href="/admin/verifications"
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-ink hover:underline"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      Verifications
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading the application" className="space-y-4">
        <div className="h-10 max-w-sm rounded-md bg-sunken" />
        <div className="h-72 rounded-lg bg-sunken" />
      </div>
    );
  }

  if (state.status === "error") {
    const missing = state.failure.status === 404;
    return (
      <>
        {back}
        <h1 className="mt-2 text-3xl md:text-4xl">{missing ? "Application not found" : "Application"}</h1>
        <Alert
          title={
            missing
              ? "There is no application at this address, or it belongs to a market you do not administer."
              : state.failure.message
          }
          traceId={missing ? undefined : state.failure.traceId}
          className="mt-6"
        />
        {!missing && (
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
        )}
      </>
    );
  }

  const { application } = state;
  const requirement = requirements.find((item) => item.role === application.role);
  const outcome = outcomeText(application, requirement, directoryLabels, organisationKindLabels);
  const decidable = application.status === "SUBMITTED";
  const requiredMissing =
    application.requirements.fields.some((item) => item.required && !item.provided) ||
    application.requirements.documents.some((item) => item.required && !item.provided);

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const text = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setPending(true);
    setFailure(null);
    setNotice(null);

    const result =
      action === "approve"
        ? await approveApplication(id, text || undefined)
        : action === "reject"
          ? await rejectApplication(id, text)
          : await requestChanges(id, text);

    setPending(false);
    if (result.ok) {
      setState({ status: "ready", application: result.data.application });
      if (action === "approve") setApproval((result.data as OnboardingApproval).created);
      setNotice(
        action === "approve"
          ? "Application approved."
          : action === "reject"
            ? "Application rejected. The applicant has been told why."
            : "Changes requested. The applicant has been told what to change.",
      );
      setAction(null);
      window.scrollTo({ top: 0 });
      return;
    }

    const { failure: problem } = result;
    if (problem.status === 409) {
      // Someone else decided it, or the applicant's agency lost its verification.
      setFailure({
        ...problem,
        message:
          problem.code === "AGENCY_NOT_VERIFIED"
            ? "This cannot be approved: the agency the applicant named is not verified. Request changes or reject it."
            : "This application is no longer waiting for a decision. It may have been decided by someone else. We have loaded its current state.",
      });
      setAction(null);
      await read();
    } else {
      setFailure(problem);
    }
  }

  return (
    <>
      {back}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl md:text-4xl">{application.applicant.name}</h1>
        <Badge tone="primary">{application.role_label}</Badge>
        <Badge tone={onboardingStatusTones[application.status]}>{onboardingStatusLabel(application)}</Badge>
      </div>

      <div className="mt-6 space-y-4">
        {notice && (
          <Alert tone="success" title={notice}>
            {approval && (
              <ul className="list-disc space-y-1 pl-5">
                {approval.organisation_id && <li>An organisation was created for the applicant.</li>}
                {approval.membership_role && (
                  <li>
                    The applicant is now a member with the role{" "}
                    {membershipRoleLabel({ role: approval.membership_role })}.
                  </li>
                )}
                {approval.profile ? (
                  <li>
                    A verified public profile was published. It can take about a minute to appear
                    under Professionals.
                  </li>
                ) : (
                  <li>No public profile was created for this role.</li>
                )}
              </ul>
            )}
          </Alert>
        )}
        {failure && <Alert tone={failure.status === 409 ? "warning" : "danger"} title={failure.message} traceId={failure.status === 409 ? undefined : failure.traceId} />}
      </div>

      {application.profile && (
        <ButtonLink href={`/directory/${application.profile.kind}/${application.profile.slug}`} variant="secondary" className="mt-4">
          <BadgeCheck className="size-4" aria-hidden="true" />
          View the public profile
        </ButtonLink>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-2xl">Applicant</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Name</dt>
                <dd className="text-ink">{application.applicant.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Email</dt>
                <dd className="flex flex-wrap items-center gap-2 text-ink">
                  <span className="break-all">{application.applicant.email}</span>
                  {application.applicant.email_verified ? (
                    <Badge tone="success">Confirmed</Badge>
                  ) : (
                    <Badge tone="warning">Not confirmed</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Account created</dt>
                <dd className="text-ink">{formatWhen(application.applicant.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Country</dt>
                <dd className="text-ink">
                  {application.market_code
                    ? (lists.countries.find((country) => country.value === application.market_code)?.label ??
                      application.market_code)
                    : "None yet"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 rounded-md bg-sunken p-3 text-sm leading-relaxed text-ink">
              <span className="font-semibold">Approving creates:</span> {outcome}
            </p>
          </Card>

          <Card>
            <h2 className="text-2xl">Details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {shownDetailNames(
                application.requirements.fields.map(({ name }) => name),
                application.details,
              ).map((name) => {
                const required = application.requirements.fields.find((field) => field.name === name)?.required;
                const spec = fieldSpec(name);
                const value =
                  name === "agency_slug" && application.agency
                    ? application.agency.name
                    : fieldDisplay(application.details, name, lists);
                return (
                  <div key={name} className={spec.kind === "textarea" ? "sm:col-span-2" : undefined}>
                    <dt className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      {spec.label}
                      {/* Said in words, not by colour: these never appear on the public profile. */}
                      {spec.private && <Badge tone="warning">Private</Badge>}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line break-words text-ink">
                      {value || (
                        <span className="text-subtle">{required ? "Not given (required)" : "Not given"}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          <Card>
            <h2 className="text-2xl">Documents</h2>
            <p className="mt-2 text-sm text-muted">
              Files download in a new tab. Every time a file is opened it is recorded in the audit log.
            </p>
            <ul className="mt-4 space-y-3">
              {application.requirements.documents.map((type) => {
                const file = application.documents.find((item) => item.type.code === type.code);
                return (
                  <li key={type.code} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <h3 className="font-sans text-base font-semibold tracking-normal">
                          {type.label}
                          {!type.required && <span className="ml-1 font-normal text-subtle">(optional)</span>}
                        </h3>
                        <p className="mt-1 text-sm text-muted">{type.description}</p>
                      </div>
                      {file ? (
                        <Badge tone="success">Attached</Badge>
                      ) : (
                        <Badge tone={type.required ? "danger" : "neutral"}>
                          {type.required ? "Missing" : "Not attached"}
                        </Badge>
                      )}
                    </div>
                    {/* The logo is an image and will be public: the reviewer sees it, not only its file name. */}
                    {file && type.code === LOGO_DOCUMENT && (
                      <PrivateImage
                        src={adminDocumentUrl(application.id, file.id)}
                        alt={`The logo uploaded by the applicant, ${file.file_name}`}
                        className="mt-3 size-28"
                      />
                    )}
                    {file && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="flex min-w-0 flex-1 basis-48 items-start gap-2 text-sm">
                          <FileText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="break-all font-medium text-ink">{file.file_name}</span>
                            <span className="text-muted">
                              {" "}
                              · {formatFileSize(file.size_bytes)} · uploaded {formatWhen(file.uploaded_at)}
                            </span>
                          </span>
                        </p>
                        <a
                          href={adminDocumentUrl(application.id, file.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClasses("secondary")}
                        >
                          Open
                          <span className="sr-only"> {file.file_name} (downloads in a new tab)</span>
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
              {application.documents
                .filter((file) => !application.requirements.documents.some((type) => type.code === file.type.code))
                .map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4">
                    <p className="min-w-0 flex-1 basis-48 text-sm">
                      <span className="font-semibold text-ink">{file.type.label}</span>
                      <span className="block break-all text-muted">
                        {file.file_name} · {formatFileSize(file.size_bytes)}
                      </span>
                    </p>
                    <a
                      href={adminDocumentUrl(application.id, file.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses("secondary")}
                    >
                      Open
                      <span className="sr-only"> {file.file_name} (downloads in a new tab)</span>
                    </a>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-2xl">History</h2>
            {application.history.length === 0 ? (
              <p className="mt-3 text-muted">Nothing has happened yet. The application has not been submitted.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-line pl-5">
                {application.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <p className="text-ink">
                      <span className="font-medium">{entry.to_label || onboardingStatusLabels[entry.to]}</span>
                      <span className="text-muted">
                        {" "}
                        (was {entry.from_label || onboardingStatusLabels[entry.from]})
                      </span>
                    </p>
                    <p className="text-sm text-muted">
                      {entry.actor_name || "An account that no longer exists"} · {formatWhen(entry.at)}
                    </p>
                    {entry.reason && (
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{entry.reason}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside aria-labelledby="decision-heading" className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <h2 id="decision-heading" className="text-2xl">
              Decision
            </h2>

            <h3 className="mt-4 text-sm font-medium tracking-normal text-muted">Requirement checklist</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[
                ...application.requirements.fields.map((item) => ({ ...item, label: fieldSpec(item.name).label, key: item.name })),
                ...application.requirements.documents.map((item) => ({ ...item, key: item.code })),
              ].map((item) => (
                <li key={item.key} className="flex items-start gap-2">
                  {item.provided ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                  )}
                  <span className="text-ink">
                    {item.label}
                    <span className="text-muted">
                      {" "}
                      {item.provided ? "provided" : item.required ? "missing (required)" : "not provided (optional)"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {!decidable && (
              <p className="mt-5 rounded-md bg-sunken p-3 text-sm leading-relaxed text-ink" role="status">
                {application.status === "DRAFT"
                  ? "The applicant has not submitted this yet, so there is nothing to decide."
                  : application.status === "CHANGES_REQUESTED"
                    ? "Changes were requested. There is nothing to decide until the applicant submits it again."
                  : `This application was ${application.status === "APPROVED" ? "approved" : "rejected"}${
                      application.decision.decided_at ? ` on ${formatWhen(application.decision.decided_at)}` : ""
                    }.`}
              </p>
            )}

            {decidable && action === null && (
              <div className="mt-5 flex flex-col gap-2">
                {requiredMissing && (
                  <p className="text-sm text-warning">Something required is missing. Check before approving.</p>
                )}
                <Button onClick={() => setAction("approve")}>{actionCopy.approve.open}</Button>
                <Button variant="secondary" onClick={() => setAction("changes")}>
                  {actionCopy.changes.open}
                </Button>
                <Button variant="danger" onClick={() => setAction("reject")}>
                  {actionCopy.reject.open}
                </Button>
              </div>
            )}

            {decidable && action !== null && (
              // The confirmation step: says in words what will happen before anything is sent.
              <form onSubmit={decide} className="mt-5 rounded-md border border-line-strong p-4" aria-labelledby="confirm-heading">
                <h3 id="confirm-heading" className="font-sans text-lg font-semibold tracking-normal">
                  {actionCopy[action].heading}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {action === "approve" && <>Approving creates {outcome} </>}
                  {actionCopy[action].explain}
                </p>
                <Field
                  id="decision-reason"
                  label={action === "approve" ? "Note for the applicant" : "Reason, shown to the applicant"}
                  optional={action === "approve"}
                  hint={action === "approve" ? undefined : "At least 5 characters. Say exactly what is wrong or what to change."}
                  error={failure?.fields?.reason ?? failure?.fields?.note}
                  className="mt-4"
                >
                  <Textarea
                    id="decision-reason"
                    name="reason"
                    required={action !== "approve"}
                    minLength={action === "approve" ? undefined : 5}
                    maxLength={500}
                    autoFocus
                    aria-invalid={Boolean(failure?.fields?.reason)}
                    aria-describedby={fieldDescribedBy("decision-reason", {
                      hint: action === "approve" ? undefined : "hint",
                      error: failure?.fields?.reason ?? failure?.fields?.note,
                    })}
                  />
                </Field>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant={action === "reject" ? "danger" : "primary"}
                    disabled={pending}
                    aria-busy={pending}
                  >
                    {pending ? actionCopy[action].pending : actionCopy[action].confirm}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setAction(null);
                      setFailure(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

/** One onboarding application as a platform administrator reviews it. */
export function ReviewDetail(props: Props) {
  return <AdminGate>{() => <Review {...props} />}</AdminGate>;
}
