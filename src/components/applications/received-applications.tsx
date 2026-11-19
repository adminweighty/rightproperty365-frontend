"use client";

import { Eye, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnswersView } from "@/components/applications/answers-view";
import { Timeline } from "@/components/applications/my-applications";
import { managesForms, OrganisationShell, withOrg } from "@/components/applications/organisation-shell";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScanPolling } from "@/components/ui/scan-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import {
  addApplicationNote,
  getReceivedApplication,
  listReceivedApplications,
  receivedFileUrl,
  requestApplicationInfo,
  setApplicationStatus,
  type Application,
  type ReceivedFilters,
} from "@/lib/api/applications";
import { listMyListings } from "@/lib/api/availability";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import {
  AGENT_ACTION_LABELS,
  agentStatusActions,
  APPLICATION_STATUSES,
  applicationStatusLabel,
  applicationStatusTone,
  canRequestInfo,
  isApplicationStatus,
  isFinalStatus,
  listingTakesApplications,
} from "@/lib/questionnaires";

/*
 * The receiving organisation's applications (API 0.32.0): the inbox at
 * `/agent/applications` and one application at `/agent/applications/<id>`.
 * OWNER, MANAGER and the listing's assigned AGENT read them; the API answers
 * 404 to anyone else. Every read of the answers and every file opened is
 * recorded in the audit trail (FR-018), and the page says so.
 */

export const RECEIVED_PATH = "/agent/applications";

const NOTE_MAX = 2000;
const QUERY_MAX = 100;

/** The inbox's filters from the address. Drafts never reach the organisation, so they are not a filter. */
function parseFilters(search: string): ReceivedFilters {
  const params = new URLSearchParams(search);
  const status = params.get("status") ?? "";
  const listing = params.get("listing") ?? "";
  const q = (params.get("q") ?? "").trim().slice(0, QUERY_MAX);
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  return {
    status: isApplicationStatus(status) && status !== "DRAFT" ? status : undefined,
    listing: /^[0-9a-f-]{36}$/i.test(listing) ? listing : undefined,
    q: q || undefined,
    page,
  };
}

const filterHref = (orgId: string, filters: Partial<ReceivedFilters>) =>
  withOrg(RECEIVED_PATH, orgId, {
    status: filters.status,
    listing: filters.listing,
    q: filters.q,
    page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
  });

/** The organisation's listings that can take applications, for the filter. */
function useListingOptions() {
  const [options, setOptions] = useState<SelectOption[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listMyListings(1).then((result) => {
      if (cancelled) return;
      setOptions(
        result.ok
          ? result.data.items
              .filter((item) => listingTakesApplications(item.category?.code))
              .map((item) => ({ value: item.id, label: item.title || item.reference, secondary: item.reference, keywords: [item.reference] }))
          : [],
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

function Inbox({ organisation }: { organisation: DashboardOrganisation }) {
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseFilters(search), [search]);
  const load = useCallback(() => listReceivedApplications(organisation.id, filters), [organisation.id, filters]);
  const { state, reload } = useApi(load);
  const listings = useListingOptions();
  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.status_counts ?? [];
  const narrowed = Boolean(filters.status || filters.listing || filters.q);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={withOrg("/agent/forms", organisation.id)} variant="secondary" size="sm">
          Application forms
        </ButtonLink>
        <ButtonLink href="/agent/listings" variant="ghost" size="sm">
          Your listings
        </ButtonLink>
      </div>

      {counts.length > 0 && (
        <div className="mt-6">
          <ChipNav
            label="Applications by status"
            items={[
              { key: "all", href: filterHref(organisation.id, { ...filters, status: undefined, page: 1 }), label: "All", count: counts.reduce((sum, item) => sum + item.count, 0), current: !filters.status },
              ...counts
                .filter((item) => item.status !== "DRAFT")
                .map((item) => ({
                  key: item.status,
                  href: filterHref(organisation.id, { ...filters, status: item.status, page: 1 }),
                  label: applicationStatusLabel(item.status, item.label),
                  count: item.count,
                  current: filters.status === item.status,
                })),
            ]}
          />
        </div>
      )}

      {/* A GET form: it works without JavaScript and keeps the filters in the address. */}
      <form method="get" action={RECEIVED_PATH} className="mt-6 grid gap-4 rounded-lg border border-line bg-soft p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <input type="hidden" name="org" value={organisation.id} />
        <Field id="received-q" label="Search" hint="Name, email or reference.">
          <Input id="received-q" name="q" type="search" defaultValue={filters.q ?? ""} maxLength={QUERY_MAX} aria-describedby="received-q-hint" />
        </Field>
        <Field id="received-status" label="Status">
          <SearchableSelect
            id="received-status"
            name="status"
            options={[{ value: "", label: "Any status" }, ...APPLICATION_STATUSES.filter((item) => item !== "DRAFT").map((item) => ({ value: item, label: applicationStatusLabel(item) }))]}
            defaultValue={filters.status ?? ""}
          />
        </Field>
        <Field id="received-listing" label="Listing">
          <SearchableSelect
            id="received-listing"
            name="listing"
            options={[{ value: "", label: "Any listing" }, ...(listings ?? []), ...(filters.listing && listings && !listings.some((item) => item.value === filters.listing) ? [{ value: filters.listing, label: "The chosen listing" }] : [])]}
            defaultValue={filters.listing ?? ""}
          />
        </Field>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          `${(state.data.total ?? state.data.items.length) === 1 ? "1 application" : `${state.data.total ?? state.data.items.length} applications`}${narrowed ? " match" : ""}${
            state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : ""
          }, newest first`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the applications" rows={3} />}
        {state.status === "error" &&
          (state.failure.code === "ORGANISATION_NOT_FOUND" ? (
            <EmptyState title={`You cannot read ${organisation.name}'s applications`}>
              Applications are open to the organisation&rsquo;s owner and managers and to the agent assigned to each listing.
            </EmptyState>
          ) : (
            <LoadError failure={state.failure} onRetry={reload} />
          ))}
        {state.status === "ready" && state.data.items.length === 0 &&
          (filters.page > 1 ? (
            <EmptyState title={`There is no page ${filters.page} of these applications`} action={<ButtonLink href={filterHref(organisation.id, { ...filters, page: 1 })} variant="secondary">Go to page 1</ButtonLink>} />
          ) : narrowed ? (
            <EmptyState title="No applications match these filters" action={<ButtonLink href={withOrg(RECEIVED_PATH, organisation.id)} variant="secondary">Clear filters</ButtonLink>} />
          ) : (
            <EmptyState
              title="No applications yet"
              action={managesForms(organisation) ? <ButtonLink href={withOrg("/agent/forms", organisation.id)} variant="secondary">Application forms</ButtonLink> : undefined}
            >
              Publish an application form, attach it to a listing in the listing&rsquo;s Applications section and open intake.
              Applications people send appear here.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={applicationStatusTone(item.status)}>{applicationStatusLabel(item.status, item.status_label)}</Badge>
                      {item.submitted_at && <span className="ml-auto text-sm text-muted">Sent {formatWhen(item.submitted_at)}</span>}
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                      <Link href={withOrg(`${RECEIVED_PATH}/${item.id}`, organisation.id)} className="text-primary-ink hover:underline">
                        {item.applicant?.name || item.reference || "Applicant"}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">{item.listing?.title ? `For ${item.listing.title}` : "For a listing"}</p>
                    {item.reference && <p className="mt-3 font-mono text-xs text-subtle">{item.reference}</p>}
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination className="mt-8" page={state.data.page} totalPages={state.data.total_pages} hrefFor={(value) => filterHref(organisation.id, { ...filters, page: value })} label="Applications" />
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/applications`: applications sent to the organisation's listings. */
export function ReceivedApplications() {
  return (
    <OrganisationShell
      path={RECEIVED_PATH}
      title="Applications"
      intro={<p>Applications people sent for your organisation&rsquo;s listings. Only your team sees them; applicants never see each other.</p>}
      empty={{
        title: "Applications belong to an organisation",
        body: "Applications are received by a Real Estate Agency or another business that lists property. Ask the Agency Principal to add you to the team.",
      }}
    >
      {(organisation) => <Inbox organisation={organisation} />}
    </OrganisationShell>
  );
}

// ---- One application ---------------------------------------------------------------------

type Message = { tone: "success" | "warning" | "danger"; text: string; traceId?: string };

function StatusControl({ organisation, application, onChanged, onConflict }: { organisation: DashboardOrganisation; application: Application; onChanged: (next: Application) => void; onConflict: () => void }) {
  const actions = agentStatusActions(application.status, application.allowed_transitions);
  const [chosen, setChosen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = useRef<HTMLDivElement>(null);

  async function move() {
    setBusy(true);
    const answer = await setApplicationStatus(organisation.id, application.id, chosen, note.trim() || undefined);
    setBusy(false);
    setConfirming(false);
    if (answer.ok) {
      onChanged(answer.data);
      setMessage({ tone: "success", text: `Now ${applicationStatusLabel(answer.data.status, answer.data.status_label).toLowerCase()}. The applicant has been told.` });
      setChosen("");
      setNote("");
    } else if (answer.failure.code === "INVALID_APPLICATION_TRANSITION" || answer.failure.status === 409) {
      setMessage({ tone: "warning", text: "The application changed while the page was open, so that could not be done. We have read it again: check its status and choose again." });
      onConflict();
    } else {
      setMessage({ tone: "danger", text: answer.failure.fields?.status ?? answer.failure.message, traceId: answer.failure.traceId });
    }
    result.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!chosen) {
      setError("Choose what happens next.");
      event.currentTarget.querySelector<HTMLInputElement>("input[name=status]")?.focus();
      return;
    }
    setError(undefined);
    if (isFinalStatus(chosen)) setConfirming(true);
    else void move();
  }

  return (
    <section aria-labelledby="application-status">
      <h2 id="application-status" className="text-xl">
        Status
      </h2>
      <p className="mt-2 text-ink">
        Now: <Badge tone={applicationStatusTone(application.status)}>{applicationStatusLabel(application.status, application.status_label)}</Badge>
      </p>
      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {isFinalStatus(application.status)
            ? "This application is decided and cannot change."
            : application.status === "MORE_INFO"
              ? "Waiting for the applicant to answer your request. It comes back as sent when they do."
              : "Nothing can be changed from here."}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4">
          <fieldset aria-describedby={error ? "status-error" : "status-hint"}>
            <legend className="text-sm font-medium text-ink">What happens next</legend>
            <p id="status-hint" className="mt-1 text-sm text-muted">
              The applicant sees the new status and is emailed when it is shortlisted, accepted or declined.
            </p>
            <div className="mt-2 grid gap-1">
              {actions.map((status) => (
                <label key={status} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
                  <input type="radio" name="status" value={status} checked={chosen === status} onChange={() => setChosen(status)} className="size-4 accent-primary" />
                  <span className="text-ink">{AGENT_ACTION_LABELS[status] ?? applicationStatusLabel(status)}</span>
                </label>
              ))}
            </div>
            {error && (
              <p id="status-error" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}
          </fieldset>
          <Field id="status-note" label="Note for the record" optional hint="Kept with the change in the history." className="mt-4">
            <Textarea id="status-note" rows={2} maxLength={NOTE_MAX} value={note} onChange={(event) => setNote(event.currentTarget.value)} aria-describedby="status-note-hint" />
          </Field>
          <Button type="submit" className="mt-4" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "Saving…" : "Change the status"}
          </Button>
        </form>
      )}
      <div ref={result} tabIndex={-1} className="mt-3 outline-none" aria-live="polite">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
      <ConfirmDialog
        open={confirming}
        title={chosen === "ACCEPTED" ? "Accept this application?" : "Decline this application?"}
        confirmLabel={chosen === "ACCEPTED" ? "Yes, accept it" : "Yes, decline it"}
        busyLabel="Saving…"
        tone={chosen === "ACCEPTED" ? "primary" : "danger"}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void move()}
      >
        The applicant is emailed. This is final: the application cannot be moved again.
      </ConfirmDialog>
    </section>
  );
}

function RequestInfo({ organisation, application, onChanged }: { organisation: DashboardOrganisation; application: Application; onChanged: (next: Application) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  if (!canRequestInfo(application.status, application.allowed_transitions)) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    setMessage(null);
    if (!value) {
      setError("Say what you need from the applicant.");
      box.current?.focus();
      return;
    }
    setError(undefined);
    setBusy(true);
    const answer = await requestApplicationInfo(organisation.id, application.id, value);
    setBusy(false);
    if (answer.ok) {
      setText("");
      onChanged(answer.data);
      setMessage({ tone: "success", text: "Request sent. The applicant is emailed and can change their answers and send them again." });
    } else if (answer.failure.fields?.message) {
      setError(answer.failure.fields.message);
      box.current?.focus();
    } else {
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
    }
  }

  return (
    <section aria-labelledby="application-request-info">
      <h2 id="application-request-info" className="text-xl">
        Ask for more information
      </h2>
      <form onSubmit={submit} noValidate className="mt-3">
        <Field id="request-info" label="What you need" hint="The applicant sees this and is emailed." error={error}>
          <Textarea
            ref={box}
            id="request-info"
            rows={3}
            maxLength={NOTE_MAX}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("request-info", { hint: "x", error })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-3" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send the request"}
        </Button>
        <div aria-live="polite" className="mt-3">
          {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
        </div>
      </form>
    </section>
  );
}

function Notes({ organisation, application, onSaved }: { organisation: DashboardOrganisation; application: Application; onSaved: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<Message | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const hint = `${text.length} of ${NOTE_MAX} characters`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    setFailure(null);
    setSaved(false);
    if (!value) {
      setError("Write the note first.");
      box.current?.focus();
      return;
    }
    setError(undefined);
    setBusy(true);
    const answer = await addApplicationNote(organisation.id, application.id, value);
    if (answer.ok) {
      await onSaved();
      setBusy(false);
      setText("");
      setSaved(true);
      return;
    }
    setBusy(false);
    if (answer.failure.fields?.text) {
      setError(answer.failure.fields.text);
      box.current?.focus();
      return;
    }
    setFailure({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
  }

  return (
    <section aria-labelledby="application-notes">
      <h2 id="application-notes" className="text-xl">
        Notes
      </h2>
      <p className="mt-2 flex items-center gap-2 rounded-md bg-sunken p-3 text-sm text-ink">
        <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Only your team can see notes. The applicant never does.
      </p>
      {application.notes.length === 0 ? (
        <p className="mt-3 text-muted">No notes yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {application.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line p-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{note.mine ? "You" : (note.author ?? "A colleague")}</span>
                {note.at && <>, {formatWhen(note.at)}</>}
              </p>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-ink">{note.text}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} noValidate className="mt-4">
        <Field id="application-note" label="Add a note" error={error} hint={hint}>
          <Textarea
            ref={box}
            id="application-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("application-note", { error, hint })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-3" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : "Save the note"}
        </Button>
        <div aria-live="polite" className="mt-3">
          {saved && <Alert tone="success" title="Note saved." />}
          {failure && <Alert title={failure.text} traceId={failure.traceId} />}
        </div>
      </form>
    </section>
  );
}

function Detail({ organisation, id }: { organisation: DashboardOrganisation; id: string }) {
  const load = useCallback(() => getReceivedApplication(organisation.id, id), [organisation.id, id]);
  const { state, reload, replace } = useApi(load);

  const readAgain = useCallback(async () => {
    const result = await getReceivedApplication(organisation.id, id);
    if (result.ok) replace(result.data);
  }, [organisation.id, id, replace]);
  // While a file is checked for viruses, read the application again quietly.
  useScanPolling(state.status === "ready" ? state.data.files.map((file) => file.scan_status) : [], readAgain);

  if (state.status === "loading") return <LoadingBlock label="Loading the application" rows={4} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState title="We could not find that application" action={<ButtonLink href={withOrg(RECEIVED_PATH, organisation.id)} variant="secondary">All applications</ButtonLink>}>
          Applications are open to the organisation&rsquo;s owner and managers and to the agent assigned to the listing. It may also belong to another organisation.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const application = state.data;
  // A change answers with the application; its answers and notes may be left out, so the page reads it again.
  const changed = (next: Application) => {
    replace({ ...application, ...next, answers: Object.keys(next.answers).length ? next.answers : application.answers, form: next.form ?? application.form, notes: next.notes.length ? next.notes : application.notes });
    void readAgain();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={applicationStatusTone(application.status)}>{applicationStatusLabel(application.status, application.status_label)}</Badge>
        {application.reference && <span className="font-mono text-xs text-subtle">{application.reference}</span>}
      </div>
      <h1 className="mt-2 break-words text-3xl md:text-4xl">{application.applicant?.name || "Applicant"}</h1>
      <p className="mt-2 text-muted">
        {application.listing?.title ? (
          <>
            For{" "}
            {application.listing.slug ? (
              <Link href={`/listings/${application.listing.slug}`} className="font-medium text-primary-ink hover:underline">
                {application.listing.title}
              </Link>
            ) : (
              application.listing.title
            )}
          </>
        ) : (
          "For a listing"
        )}
        {application.submitted_at && <> · sent {formatWhen(application.submitted_at)}</>}
      </p>
      <p className="mt-3 flex items-start gap-2 text-sm text-muted">
        <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Opening this application and its files is recorded in your organisation&rsquo;s activity log.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <h2 className="text-2xl">Answers</h2>
          {application.form && (
            <p className="mt-1 text-sm text-muted">
              As asked in {application.form.name}, version {application.form.version}
            </p>
          )}
          <div className="mt-4">
            {application.form && application.form.sections.length > 0 && !application.erased ? (
              <AnswersView
                sections={application.form.sections}
                answers={application.answers}
                files={application.files}
                fileHref={(fileId) => receivedFileUrl(organisation.id, application.id, fileId)}
                showHidden
                idPrefix="received"
                headingLevel={3}
              />
            ) : (
              <p className="text-muted">The answers are no longer kept: the form&rsquo;s retention period has ended. The reference, status and dates stay.</p>
            )}
          </div>
        </div>
        <div className="grid content-start gap-6">
          {application.applicant && (application.applicant.email || application.applicant.phone) && (
            <Card>
              <h2 className="text-xl">Contact</h2>
              <ul className="mt-3 grid gap-1 text-sm">
                {application.applicant.email && (
                  <li>
                    <a href={`mailto:${application.applicant.email}`} className="inline-flex min-h-11 items-center gap-2 break-all font-medium text-primary-ink hover:underline">
                      <Mail className="size-4 shrink-0" aria-hidden="true" />
                      {application.applicant.email}
                    </a>
                  </li>
                )}
                {application.applicant.phone && (
                  <li>
                    <a href={`tel:${application.applicant.phone}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-primary-ink hover:underline">
                      <Phone className="size-4 shrink-0" aria-hidden="true" />
                      {application.applicant.phone}
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          )}
          <Card>
            <StatusControl organisation={organisation} application={application} onChanged={changed} onConflict={() => void readAgain()} />
          </Card>
          {canRequestInfo(application.status, application.allowed_transitions) && (
            <Card>
              <RequestInfo organisation={organisation} application={application} onChanged={changed} />
            </Card>
          )}
          <Card>
            <Notes organisation={organisation} application={application} onSaved={readAgain} />
          </Card>
          <Card>
            <h2 className="text-xl">History</h2>
            <Timeline entries={application.timeline} empty="Nothing has happened since it was sent." />
          </Card>
        </div>
      </div>
    </>
  );
}

/** `/agent/applications/<id>`: the answers in the version they were given on, files, status, requests and notes. */
export function ReceivedApplicationDetail({ id }: { id: string }) {
  return (
    <OrganisationShell
      path={`${RECEIVED_PATH}/${id}`}
      back={{ href: RECEIVED_PATH, label: "Applications" }}
      empty={{ title: "Applications belong to an organisation", body: "Ask the Agency Principal to add you to the team." }}
    >
      {(organisation) => <Detail organisation={organisation} id={id} />}
    </OrganisationShell>
  );
}
