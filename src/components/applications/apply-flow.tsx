"use client";

import { CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnswersView } from "@/components/applications/answers-view";
import { FileQuestion } from "@/components/applications/file-question";
import { FormSections, questionId } from "@/components/applications/form-renderer";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  closedReasonOf,
  deleteApplicationFile,
  getApplicationForm,
  getOwnApplication,
  getPublicListingForApply,
  listOwnApplications,
  ownFileUrl,
  saveApplicationAnswers,
  sendApplication,
  startApplication,
  type Application,
  type ApplicationFile,
  type ApplyListing,
  type PublicApplicationForm,
} from "@/lib/api/applications";
import type { ApiFailure } from "@/lib/api/http";
import {
  allFields,
  answerProblem,
  APPLICANT_STATUS_EXPLAINED,
  applicantCanEdit,
  applicationStatusLabel,
  applicationStatusTone,
  closedKind,
  isApplicationStatus,
  keptAnswers,
  submitProblems,
  visibleKeys,
  type AnswerValue,
  type Answers,
  type FormDefinition,
} from "@/lib/questionnaires";

/*
 * `/apply/<listing slug>` (API 0.32.0, FR-015, FR-019): the form attached to
 * a listing, answered by a signed-in customer. A preview of what is asked
 * and why comes first; "Start your application" makes the draft (or opens
 * the one already started). Answers save as they are typed; files upload
 * with progress; "Check your answers" runs the same checks as the API, then
 * a review of exactly what will be sent; "Send the application" gives the
 * reference. Paused, closed and expired intake is said plainly.
 */

type Listing = ApplyListing;

type Loaded =
  | { status: "loading" }
  | { status: "failed"; failure: ApiFailure }
  | { status: "missing" }
  | { status: "no-form"; listing: Listing }
  | { status: "ready"; listing: Listing; form: PublicApplicationForm; existing: Application | null };

const APPLICATIONS = "/account/applications";

function ClosedMessage({ message, kind, listing }: { message?: string | null; kind: "paused" | "closed" | "expired"; listing: Listing }) {
  const title =
    kind === "paused"
      ? "Applications are paused for this property"
      : kind === "expired"
        ? "Applications have ended for this property"
        : "Applications are closed for this property";
  return (
    <EmptyState
      title={title}
      action={
        <ButtonLink href={`/listings/${listing.slug}`} variant="secondary">
          Back to the listing
        </ButtonLink>
      }
    >
      {message ? <p>{message}</p> : null}
      <p className={message ? "mt-2" : undefined}>
        {kind === "paused"
          ? "The advertiser is not taking applications at the moment. A draft you started is kept; you can send it if they open again."
          : "The advertiser is no longer taking applications. You can still ask them about the property from the listing."}
      </p>
    </EmptyState>
  );
}

function Intro({ form, listing, children }: { form: PublicApplicationForm; listing: Listing; children?: ReactNode }) {
  const definition = form.form;
  const files = allFields(definition).filter((field) => field.type === "file");
  return (
    <Card>
      <h2 className="text-2xl">Before you start</h2>
      <dl className="mt-4 grid gap-4 text-sm">
        <div>
          <dt className="font-medium text-ink">Why the advertiser asks</dt>
          <dd className="mt-1 whitespace-pre-line text-muted">{definition.purpose}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Privacy notice</dt>
          <dd className="mt-1 whitespace-pre-line text-muted">{definition.privacy_notice}</dd>
        </div>
        {definition.retention_days !== null && (
          <div>
            <dt className="font-medium text-ink">How long it is kept</dt>
            <dd className="mt-1 text-muted">
              Your answers and files are deleted {definition.retention_days} days after the application is decided or withdrawn. A
              short record with the reference and status stays.
            </dd>
          </div>
        )}
        <div>
          <dt className="font-medium text-ink">What you will be asked</dt>
          <dd className="mt-1 text-muted">
            {allFields(definition).length} questions in {definition.sections.length === 1 ? "1 section" : `${definition.sections.length} sections`}
            {files.length > 0 && <>, including documents to upload: {files.map((field) => field.label).join(", ")}</>}.
          </dd>
        </div>
      </dl>
      <p className="mt-4 flex items-start gap-2 rounded-md bg-sunken p-3 text-sm text-ink">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        Only the team that advertises {listing.title ? <>&ldquo;{listing.title}&rdquo;</> : "this property"} sees your application. Other applicants never do.
      </p>
      {children}
    </Card>
  );
}

type SaveState = { status: "idle" } | { status: "pending" } | { status: "saving" } | { status: "saved"; at: Date } | { status: "failed"; failure: ApiFailure };

const timeText = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(at);

/** API field errors keyed `answers.<key>` or `<key>`, as question keys. */
function fieldErrors(fields: Record<string, string> | undefined, definition: FormDefinition): Record<string, string> {
  if (!fields) return {};
  const keys = new Set(allFields(definition).map((field) => field.key));
  const found: Record<string, string> = {};
  for (const [name, message] of Object.entries(fields)) {
    const key = name.replace(/^answers[.[]/, "").replace(/\]$/, "");
    if (keys.has(key)) found[key] = message;
  }
  return found;
}

function Editor({ listing, initial, definition }: { listing: Listing; initial: Application; definition: FormDefinition }) {
  const [application, setApplication] = useState(initial);
  const [answers, setAnswersState] = useState<Answers>(initial.answers);
  const [files, setFiles] = useState<ApplicationFile[]>(initial.files);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [step, setStep] = useState<"answers" | "review" | "sent">("answers");
  const [summary, setSummary] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendFailure, setSendFailure] = useState<ApiFailure | null>(null);
  const [closed, setClosed] = useState<{ message: string; kind: "paused" | "closed" | "expired" } | null>(null);
  const session = useRef({ answers: initial.answers, dirty: false, inFlight: false, again: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const top = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    const s = session.current;
    for (;;) {
      clearTimeout(s.timer);
      if (!s.dirty) return true;
      if (s.inFlight) {
        s.again = true;
        return true;
      }
      s.inFlight = true;
      s.dirty = false;
      setSave({ status: "saving" });
      // An answer that breaks its question's rules is said under it and not sent.
      const sendable: Answers = {};
      for (const field of allFields(definition)) {
        const value = s.answers[field.key];
        if (value !== undefined && !answerProblem(field, value)) sendable[field.key] = value;
      }
      const result = await saveApplicationAnswers(application.id, sendable);
      s.inFlight = false;
      if (!result.ok) {
        s.dirty = true;
        setSave({ status: "failed", failure: result.failure });
        const found = fieldErrors(result.failure.fields, definition);
        if (Object.keys(found).length > 0) setErrors((current) => ({ ...current, ...found }));
        if (result.failure.code === "APPLICATIONS_CLOSED") setClosed({ message: result.failure.message, kind: closedKind(result.failure.message, closedReasonOf(result.failure)) });
        return false;
      }
      setApplication(result.data);
      if (result.data.files.length > 0) setFiles((current) => [...result.data.files, ...current.filter((file) => !result.data.files.some((item) => item.id === file.id))]);
      if (!s.again && !s.dirty) {
        setSave({ status: "saved", at: new Date() });
        return true;
      }
      s.again = false;
    }
  }, [application.id, definition]);

  const setAnswers = useCallback(
    (next: Answers, delay = 800) => {
      const s = session.current;
      s.answers = next;
      s.dirty = true;
      setAnswersState(next);
      setSave({ status: "pending" });
      clearTimeout(s.timer);
      s.timer = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (session.current.dirty || session.current.inFlight) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const answer = (key: string, value: AnswerValue, delay?: number) => {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setAnswers({ ...session.current.answers, [key]: value }, delay);
  };

  // Problems shown while answering: only for questions already touched, never "required" yet.
  const shown = visibleKeys(definition, answers);
  const live: Record<string, string> = {};
  for (const field of allFields(definition)) {
    if (!shown.has(field.key) || !touched.has(field.key)) continue;
    const problem = answerProblem(field, answers[field.key]);
    if (problem) live[field.key] = problem;
  }
  const visibleErrors = { ...live, ...errors };

  function focusQuestion(key: string) {
    const field = allFields(definition).find((item) => item.key === key);
    const target = field?.type === "file" ? document.getElementById(`file-${key}-choose`) : null;
    (target ?? document.getElementById(questionId("apply", key)))?.focus();
  }

  async function review() {
    setSendFailure(null);
    const problems = submitProblems(definition, answers);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setSummary(Object.keys(problems));
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSummary(null);
    await flush();
    setStep("review");
    requestAnimationFrame(() => top.current?.focus());
  }

  async function send() {
    setSending(true);
    setSendFailure(null);
    const saved = await flush();
    if (!saved) {
      setSending(false);
      return;
    }
    const result = await sendApplication(application.id);
    setSending(false);
    if (result.ok) {
      setApplication(result.data);
      setStep("sent");
      requestAnimationFrame(() => top.current?.focus());
      return;
    }
    if (result.failure.code === "APPLICATIONS_CLOSED") {
      setClosed({ message: result.failure.message, kind: closedKind(result.failure.message, closedReasonOf(result.failure)) });
      return;
    }
    const found = fieldErrors(result.failure.fields, definition);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSummary(Object.keys(found));
      setStep("answers");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSendFailure(result.failure);
  }

  if (closed) {
    return (
      <>
        <ClosedMessage message={closed.message} kind={closed.kind} listing={listing} />
        <p className="mt-4 text-center text-sm text-muted">
          Your answers so far are saved in{" "}
          <Link href={APPLICATIONS} className="font-medium text-primary-ink hover:underline">
            your applications
          </Link>
          .
        </p>
      </>
    );
  }

  if (step === "sent") {
    return (
      <div ref={top} tabIndex={-1} className="outline-none">
        <Card>
          <p className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
            <span className="text-2xl font-semibold">Application sent</span>
          </p>
          {application.reference && (
            <p className="mt-3 text-ink">
              Keep this reference: <span className="font-mono font-semibold">{application.reference}</span>
            </p>
          )}
          <p className="mt-2 text-muted">
            The advertiser has your application. We have emailed you a copy of the reference. You can follow it, and answer if they ask
            for more, in your applications.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`${APPLICATIONS}/${application.id}`}>See your application</ButtonLink>
            <ButtonLink href={`/listings/${listing.slug}`} variant="secondary">
              Back to the listing
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const saveLine = (
    <p role="status" className="text-sm">
      {save.status === "idle" && <span className="text-muted">Your answers are saved as you go.</span>}
      {save.status === "pending" && <span className="text-muted">Changes not saved yet…</span>}
      {save.status === "saving" && <span className="text-muted">Saving…</span>}
      {save.status === "saved" && <span className="text-success">All changes saved at {timeText(save.at)}.</span>}
      {save.status === "failed" && (
        <span className="text-danger">
          Not saved: {save.failure.message}{" "}
          <button
            type="button"
            className="min-h-11 font-medium text-primary-ink underline"
            onClick={() => {
              session.current.dirty = true;
              void flush();
            }}
          >
            Try saving again
          </button>
        </span>
      )}
    </p>
  );

  if (step === "review") {
    const kept = keptAnswers(definition, answers);
    return (
      <div ref={top} tabIndex={-1} className="grid gap-6 outline-none">
        <div>
          <h2 className="text-2xl">Check your answers</h2>
          <p className="mt-1 text-muted">This is what the advertiser will see. Questions that did not apply to you are left out.</p>
        </div>
        <AnswersView sections={definition.sections} answers={kept} files={files} fileHref={(fileId) => ownFileUrl(application.id, fileId)} idPrefix="review" headingLevel={3} />
        {sendFailure && <Alert title={sendFailure.message} traceId={sendFailure.traceId} />}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => void send()} disabled={sending} aria-busy={sending || undefined}>
            {sending ? "Sending…" : application.status === "MORE_INFO" ? "Send it again" : "Send the application"}
          </Button>
          <Button size="lg" variant="secondary" disabled={sending} onClick={() => setStep("answers")}>
            Change your answers
          </Button>
        </div>
        {saveLine}
      </div>
    );
  }

  return (
    <div ref={top} tabIndex={-1} className="grid gap-6 outline-none">
      {application.status === "MORE_INFO" && (
        <Alert tone="warning" title="The advertiser asked for more information">
          {application.info_request?.message && <p className="whitespace-pre-line">{application.info_request.message}</p>}
          <p className="mt-1">Change your answers or add documents, then send the application again.</p>
        </Alert>
      )}
      <div className="rounded-md border border-line bg-soft px-4 py-2">{saveLine}</div>
      {summary && summary.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border-l-4 border-danger bg-danger-soft p-4 outline-none">
          <p className="font-medium text-danger">{summary.length === 1 ? "There is 1 thing to fix before you send it" : `There are ${summary.length} things to fix before you send it`}</p>
          <ul className="mt-2 grid gap-1">
            {summary.map((key) => (
              <li key={key}>
                <button type="button" onClick={() => focusQuestion(key)} className="min-h-11 text-left text-sm font-medium text-ink underline">
                  {errors[key] ?? live[key]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormSections
        sections={definition.sections}
        answers={answers}
        errors={visibleErrors}
        idPrefix="apply"
        onAnswer={(key, value) => {
          const field = allFields(definition).find((item) => item.key === key);
          // A choice is saved at once; typing a moment after it stops.
          answer(key, value, field && (field.type === "single_choice" || field.type === "multiple_choice" || field.type === "date") ? 0 : 800);
        }}
        onBlur={() => void flush()}
        renderFile={(field, describedBy) => {
          const value = answers[field.key];
          const ids = Array.isArray(value) ? value.map(String) : typeof value === "string" && value ? [value] : [];
          return (
            <FileQuestion
              field={field}
              applicationId={application.id}
              value={ids}
              known={files}
              describedBy={describedBy}
              onAttached={(file) => {
                setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]);
                answer(field.key, [...ids, file.id], 0);
              }}
              onRemove={async (fileId) => {
                const removed = await deleteApplicationFile(application.id, fileId);
                if (removed.ok) {
                  // The API took the file off the answer: keep the rest of what is on screen.
                  setFiles((current) => current.filter((item) => item.id !== fileId));
                  const next = { ...session.current.answers, [field.key]: ids.filter((id) => id !== fileId) };
                  session.current.answers = next;
                  setAnswersState(next);
                  return null;
                }
                // An API build without DELETE: take it off the answer instead.
                if (removed.failure.status === 404 || removed.failure.status === 405) {
                  answer(field.key, ids.filter((id) => id !== fileId), 0);
                  return null;
                }
                return removed.failure.message;
              }}
            />
          );
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => void review()}>
          Check your answers
        </Button>
        <ButtonLink href={APPLICATIONS} variant="secondary" size="lg">
          Finish later
        </ButtonLink>
      </div>
    </div>
  );
}

function Apply({ slug }: { slug: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [application, setApplication] = useState<Application | null>(null);
  const [starting, setStarting] = useState(false);
  const [startFailure, setStartFailure] = useState<ApiFailure | null>(null);
  const [closed, setClosed] = useState<{ message: string; kind: "paused" | "closed" | "expired" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [listing, form] = await Promise.all([getPublicListingForApply(slug), getApplicationForm(slug)]);
      if (cancelled) return;
      if (!listing.ok) {
        setLoaded(listing.failure.status === 404 || listing.failure.status === 410 ? { status: "missing" } : { status: "failed", failure: listing.failure });
        return;
      }
      if (!form.ok) {
        setLoaded(form.failure.status === 404 ? { status: "no-form", listing: listing.data } : { status: "failed", failure: form.failure });
        return;
      }
      // An application already started for this listing opens again.
      const mine = await listOwnApplications({ pageSize: 100 });
      if (cancelled) return;
      const match = mine.ok
        ? mine.data.items
            .filter((item) => item.listing?.id === listing.data.id || item.listing?.slug === slug)
            .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
            .find((item) => item.status !== "WITHDRAWN") ?? null
        : null;
      let existing = match;
      if (match && applicantCanEdit(match.status) && match.can_edit !== false) {
        const full = await getOwnApplication(match.id);
        if (cancelled) return;
        if (full.ok) existing = full.data;
      }
      setLoaded({ status: "ready", listing: listing.data, form: form.data, existing });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  if (loaded.status === "loading") return <LoadingBlock label="Loading the application form" rows={3} />;
  if (loaded.status === "failed") return <LoadError failure={loaded.failure} onRetry={() => setAttempt((value) => value + 1)} />;
  if (loaded.status === "missing") {
    return (
      <EmptyState title="This listing is no longer available" action={<ButtonLink href="/listings" variant="secondary">Browse current listings</ButtonLink>}>
        Applications can no longer be sent for it.
      </EmptyState>
    );
  }
  if (loaded.status === "no-form") {
    return (
      <EmptyState title="This property does not take applications" action={<ButtonLink href={`/listings/${loaded.listing.slug}`} variant="secondary">Back to the listing</ButtonLink>}>
        Ask the advertiser about it from the listing instead.
      </EmptyState>
    );
  }

  const { listing, form, existing } = loaded;
  const current = application ?? existing;
  // The application's own version when it has one; the listing's published version otherwise.
  const definition: FormDefinition = current?.form && current.form.sections.length > 0 ? current.form : form.form;

  const header = (
    <>
      <BackLink href={`/listings/${listing.slug}`}>{listing.title || "Back to the listing"}</BackLink>
      <p className="mt-2 text-sm font-medium text-muted">Application</p>
      <h1 className="mt-1 break-words text-3xl md:text-4xl">{definition.name || "Apply for this property"}</h1>
      {listing.title && <p className="mt-2 text-muted">For {listing.title}{listing.reference ? ` (${listing.reference})` : ""}</p>}
    </>
  );

  if (closed) {
    return (
      <>
        {header}
        <div className="mt-8">
          <ClosedMessage message={closed.message} kind={closed.kind} listing={listing} />
        </div>
      </>
    );
  }

  // Already sent: say where it stands.
  if (current && (!applicantCanEdit(current.status) || current.can_edit === false)) {
    const status = current.status;
    return (
      <>
        {header}
        <Card className="mt-8">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={applicationStatusTone(status)}>{applicationStatusLabel(status, current.status_label)}</Badge>
            {current.reference && <span className="font-mono text-xs text-subtle">{current.reference}</span>}
          </p>
          <h2 className="mt-3 text-2xl">You have applied for this property</h2>
          <p className="mt-2 text-muted">
            {isApplicationStatus(status) ? APPLICANT_STATUS_EXPLAINED[status] : ""}
            {current.submitted_at && <> Sent {formatWhen(current.submitted_at)}.</>}
          </p>
          <ButtonLink href={`${APPLICATIONS}/${current.id}`} className="mt-6">
            See your application
          </ButtonLink>
        </Card>
      </>
    );
  }

  const intakeOpen = form.applications ? form.applications.open : listing.applications ? listing.applications.open : true;

  if (!current) {
    if (!intakeOpen) {
      const kind = closedKind(null, form.applications?.closed_reason ?? form.applications?.status ?? "CLOSED");
      return (
        <>
          {header}
          <div className="mt-8">
            <ClosedMessage kind={kind} listing={listing} />
          </div>
        </>
      );
    }
    const start = async () => {
      setStarting(true);
      setStartFailure(null);
      const result = await startApplication(listing.id);
      setStarting(false);
      if (result.ok) {
        // The answer may be the summary only: read the whole application.
        const full = result.data.form ? result : await getOwnApplication(result.data.id);
        setApplication(full.ok ? full.data : result.data);
        return;
      }
      if (result.failure.code === "APPLICATIONS_CLOSED") {
        setClosed({ message: result.failure.message, kind: closedKind(result.failure.message, closedReasonOf(result.failure)) });
        return;
      }
      setStartFailure(result.failure);
    };
    return (
      <>
        {header}
        <div className="mt-8 grid gap-6">
          <Intro form={form} listing={listing}>
            {startFailure && <Alert title={startFailure.message} traceId={startFailure.traceId} className="mt-4" />}
            <Button size="lg" className="mt-6" onClick={() => void start()} disabled={starting} aria-busy={starting || undefined}>
              {starting ? "Starting…" : "Start your application"}
            </Button>
            <p className="mt-2 text-sm text-muted">Nothing is sent until you check your answers and choose to send them.</p>
          </Intro>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mt-6">
        <details className="rounded-lg border border-line bg-surface p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink">Why the advertiser asks, and your privacy</summary>
          <div className="mt-2 grid gap-2 text-sm text-muted">
            <p className="whitespace-pre-line">{definition.purpose}</p>
            <p className="whitespace-pre-line">{definition.privacy_notice}</p>
          </div>
        </details>
      </div>
      <div className="mt-6">
        <Editor key={current.id} listing={listing} initial={current} definition={definition} />
      </div>
    </>
  );
}

/** `/apply/<slug>`: signed in only; signed out, the sign-in prompt comes back here. */
export function ApplyFlow({ slug }: { slug: string }) {
  return <RequireAuth>{() => <Apply slug={slug} />}</RequireAuth>;
}
