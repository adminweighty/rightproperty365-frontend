"use client";

import { CalendarDays, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CreateContactButton } from "@/components/agent/contacts/create-contact-button";
import { stageTones } from "@/components/agent/request-inbox";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Conversation } from "@/components/requests/conversation";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectGroup, type SelectOption } from "@/components/ui/searchable-select";
import {
  addAgentPropertyRequestNote,
  assignAgentPropertyRequest,
  getAgentPropertyRequest,
  moveAgentPropertyRequest,
  replyToAgentPropertyRequest,
  type LeadStage,
  type ReceivedPropertyRequest,
  type RequestTimelineEntry,
} from "@/lib/api/agent";
import { canUseInbox } from "@/lib/api/auth";
import { getDashboard } from "@/lib/api/dashboard";
import { listTeamMembers } from "@/lib/api/team";
import { teamMessage } from "@/lib/team-messages";
import { formatStay, guestCount } from "@/lib/nights";

type Labels = Record<string, string>;

const NOTE_MAX = 2000;

type Message = { tone: "success" | "danger" | "warning"; text: string; traceId?: string };

function StageControl({
  request,
  onChanged,
  onConflict,
}: {
  request: ReceivedPropertyRequest;
  onChanged: (request: ReceivedPropertyRequest) => void;
  onConflict: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | undefined>();
  const result = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stage = new FormData(event.currentTarget).get("stage");
    setMessage(null);
    if (!stage) {
      setError("Choose where the request is now.");
      event.currentTarget.querySelector<HTMLInputElement>("input[name=stage]")?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const answer = await moveAgentPropertyRequest(request.request_id, stage as LeadStage);
    setPending(false);
    if (answer.ok) {
      onChanged(answer.data.request);
      setMessage({ tone: "success", text: `Moved to ${answer.data.request.stage_label ?? stage}.` });
    } else if (answer.failure.code === "INVALID_STAGE_TRANSITION" || answer.failure.status === 409) {
      setMessage({
        tone: "warning",
        text: "Someone moved this request while the page was open, so that change could not be made. We have refreshed it: check the stage and choose again.",
      });
      onConflict();
    } else if (answer.failure.fields?.stage) {
      setError(answer.failure.fields.stage);
    } else {
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
    }
    result.current?.focus();
  }

  return (
    <section aria-labelledby="request-stage">
      <h2 id="request-stage" className="text-xl">
        Stage
      </h2>
      <p className="mt-2 text-ink">
        Now: <Badge tone={stageTones[request.stage ?? ""] ?? "neutral"}>{request.stage_label ?? request.stage}</Badge>
        {request.stage_changed_at && (
          <span className="ml-2 text-sm text-muted">since {formatWhen(request.stage_changed_at)}</span>
        )}
      </p>
      {request.allowed_stages.length === 0 ? (
        <p className="mt-3 text-muted">This request cannot be moved to another stage.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <fieldset aria-describedby={error ? "stage-error" : "stage-hint"}>
            <legend className="text-sm font-medium text-ink">Move it to</legend>
            <p id="stage-hint" className="mt-1 text-sm text-muted">
              The customer sees a simpler status, never the stage itself.
            </p>
            {/* key: the choices are new after every move, so nothing stays chosen. */}
            <div key={`${request.stage}-${request.updated_at}`} className="mt-2 grid gap-1 sm:grid-cols-2">
              {request.allowed_stages.map((option) => (
                <label
                  key={option.stage}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint"
                >
                  <input type="radio" name="stage" value={option.stage} className="size-4 accent-primary" />
                  <span className="text-ink">{option.label}</span>
                </label>
              ))}
            </div>
            {error && (
              <p id="stage-error" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}
          </fieldset>
          <Button type="submit" className="mt-4" disabled={pending} aria-busy={pending}>
            {pending ? "Moving…" : "Move the request"}
          </Button>
        </form>
      )}
      <div ref={result} tabIndex={-1} className="mt-3 outline-none" aria-live="polite">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
    </section>
  );
}

/** The value of "nobody": the request waits in the organisation's inbox. */
const UNASSIGNED = "";
const ASSIGN_HINT = "They are emailed. A new request moves to Assigned.";

type Assignees = { status: "ready"; options: (SelectOption | SelectGroup)[]; ids: Set<string> } | { status: "failed" };

/**
 * The people a request can be given to: the ACTIVE members who hold leads in
 * each team the caller manages. The request does not say which organisation
 * received it, so with several teams the members are grouped by team (the
 * API refuses anyone outside the receiving one).
 */
function useAssignees(enabled: boolean): Assignees | null {
  const [assignees, setAssignees] = useState<Assignees | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const dashboard = await getDashboard();
      if (!dashboard.ok) {
        if (!cancelled) setAssignees({ status: "failed" });
        return;
      }
      const teams = dashboard.data.organisations.filter((item) => item.can_manage_team ?? item.can_assign_work);
      const lists = await Promise.all(teams.map((team) => listTeamMembers(team.id)));
      if (cancelled) return;
      if (lists.every((list) => !list.ok)) {
        setAssignees({ status: "failed" });
        return;
      }
      const ids = new Set<string>();
      const groups: SelectGroup[] = [];
      lists.forEach((list, index) => {
        if (!list.ok) return;
        const options = list.data.items
          .filter((member) => member.can_hold_leads && member.status === "ACTIVE" && !ids.has(member.user_id))
          .map((member) => {
            ids.add(member.user_id);
            return {
              value: member.user_id,
              label: member.is_you ? `${member.name} (you)` : member.name,
              secondary: member.job_title ?? member.role_label,
            };
          });
        if (options.length > 0) groups.push({ label: teams[index].name, options });
      });
      const none: SelectOption = { value: UNASSIGNED, label: "Unassigned (team inbox)" };
      setAssignees({
        status: "ready",
        options: groups.length === 1 ? [none, ...groups[0].options] : [none, ...groups],
        ids,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return assignees;
}

/** Who holds the request, and (for the team's owner or manager) a picker to change it. */
function AssignControl({
  request,
  onChanged,
  onStale,
}: {
  request: ReceivedPropertyRequest;
  onChanged: (request: ReceivedPropertyRequest) => void;
  onStale: () => void;
}) {
  const canAssign = Boolean(request.can_assign);
  const assignees = useAssignees(canAssign);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<Message | null>(null);
  const result = useRef<HTMLDivElement>(null);
  const current = request.assigned_to?.user_id ?? UNASSIGNED;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = String(new FormData(event.currentTarget).get("assignee") ?? UNASSIGNED);
    setMessage(null);
    if (assignees?.status === "ready" && chosen !== UNASSIGNED && !assignees.ids.has(chosen)) {
      setError("Choose someone from the list.");
      return;
    }
    setError(undefined);
    if (chosen === current) {
      setMessage({
        tone: "warning",
        text: request.assigned_to ? `It is already assigned to ${request.assigned_to.name}.` : "It is already in the team inbox.",
      });
      result.current?.focus();
      return;
    }
    setPending(true);
    const answer = await assignAgentPropertyRequest(request.request_id, chosen === UNASSIGNED ? null : chosen);
    setPending(false);
    if (answer.ok) {
      onChanged(answer.data.request);
      const to = answer.data.request.assigned_to;
      setMessage({ tone: "success", text: to ? `Assigned to ${to.name}. We have emailed them.` : "Returned to the team inbox." });
    } else if (answer.failure.fields?.user_id) {
      setError("That person cannot take this request. Choose an active agent, manager or principal of the team that received it.");
    } else if (answer.failure.status === 404) {
      setMessage({ tone: "warning", text: "This request is no longer in your inbox. We have refreshed it." });
      onStale();
    } else {
      setMessage({ tone: "danger", text: teamMessage(answer.failure), traceId: answer.failure.traceId });
    }
    result.current?.focus();
  }

  return (
    <section aria-labelledby="request-assignee">
      <h2 id="request-assignee" className="text-xl">
        Assigned to
      </h2>
      <p className="mt-2 text-ink">
        {request.assigned_to ? (
          <span className="font-medium">{request.assigned_to.name}</span>
        ) : (
          <span className="text-muted">Nobody yet: it is in the team inbox, where every agent of the team can see it.</span>
        )}
      </p>
      {canAssign &&
        (assignees === null ? (
          <div aria-busy="true" aria-label="Loading the team" className="mt-4 h-11 rounded-md bg-sunken" />
        ) : assignees.status === "failed" ? (
          <p className="mt-3 text-sm text-muted">
            We could not load your team, so the request cannot be assigned right now. Reload the page to try again.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-4">
            <Field id="request-assign" label="Give it to" hint={ASSIGN_HINT} error={error}>
              {/* key: after a change the picker starts from the new assignee. */}
              <SearchableSelect
                key={current}
                id="request-assign"
                name="assignee"
                options={assignees.options}
                defaultValue={current}
                aria-invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy("request-assign", { error, hint: ASSIGN_HINT })}
              />
            </Field>
            <Button type="submit" variant="secondary" className="mt-3" disabled={pending} aria-busy={pending}>
              {pending ? "Saving…" : "Save the assignment"}
            </Button>
          </form>
        ))}
      <div ref={result} tabIndex={-1} className="mt-3 outline-none" aria-live="polite">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
    </section>
  );
}

/** The words of a history entry: the API's label, with a fallback for the assignment entries. */
function timelineLabel(entry: RequestTimelineEntry): string {
  if (entry.label) return entry.label;
  if (entry.event === "ASSIGNED") return entry.assignee_name ? `Assigned to ${entry.assignee_name}` : "Assigned";
  if (entry.event === "UNASSIGNED") return "Returned to the organisation inbox";
  return entry.event;
}

function Notes({ request, onChanged }: { request: ReceivedPropertyRequest; onChanged: (request: ReceivedPropertyRequest) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<Message | null>(null);
  const [saved, setSaved] = useState(false);
  const [length, setLength] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const hint = `${length} of ${NOTE_MAX} characters`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    setFailure(null);
    setSaved(false);
    if (!body) {
      setError("Write the note first.");
      textarea.current?.focus();
      return;
    }
    if (body.length > NOTE_MAX) {
      setError(`A note can be at most ${NOTE_MAX} characters.`);
      textarea.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const answer = await addAgentPropertyRequestNote(request.request_id, body);
    setPending(false);
    if (answer.ok) {
      form.reset();
      setLength(0);
      setSaved(true);
      onChanged(answer.data.request);
      return;
    }
    if (answer.failure.fields?.body) {
      setError(answer.failure.fields.body);
      textarea.current?.focus();
      return;
    }
    setFailure({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
  }

  return (
    <section aria-labelledby="request-notes">
      <h2 id="request-notes" className="text-xl">
        Notes
      </h2>
      <p className="mt-2 flex items-center gap-2 rounded-md bg-sunken p-3 text-sm text-ink">
        <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Private notes: only your team can see them. The customer never does.
      </p>
      {request.notes.length === 0 ? (
        <p className="mt-3 text-muted">No notes yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {request.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line p-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{note.mine ? "You" : note.author_name}</span>,{" "}
                {formatWhen(note.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-ink">{note.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={handleSubmit} noValidate className="mt-4">
        <Field id="note-body" label="Add a note" error={error} hint={hint}>
          <Textarea
            ref={textarea}
            id="note-body"
            name="body"
            rows={3}
            maxLength={NOTE_MAX}
            onChange={(event) => {
              setLength(event.currentTarget.value.length);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("note-body", { error, hint })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-3" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save the note"}
        </Button>
        <div aria-live="polite" className="mt-3">
          {saved && <Alert tone="success" title="Note saved." />}
          {failure && <Alert title={failure.text} traceId={failure.traceId} />}
        </div>
      </form>
    </section>
  );
}

function Detail({ id, typeLabels, contactMethodLabels }: { id: string; typeLabels: Labels; contactMethodLabels: Labels }) {
  const load = useCallback(() => getAgentPropertyRequest(id), [id]);
  const { state, reload, replace } = useApi(load);

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the request" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that request</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            It may belong to a colleague or another organisation, or the address may be wrong.
          </p>
          <ButtonLink href="/agent/requests" variant="secondary" className="mt-6">
            Back to the request inbox
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const request = state.status === "ready" ? state.data.request : state.previous!.request;
  const setRequest = (next: ReceivedPropertyRequest) => replace({ request: next });

  return (
    <>
      <BackLink href="/agent/requests">Request inbox</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="primary">{typeLabels[request.request_type] ?? request.request_type}</Badge>
        <span className="font-mono text-xs text-subtle">{request.reference}</span>
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">Request from {request.contact.name}</h1>
      <p className="mt-2 text-muted">
        Received {formatWhen(request.created_at)}
        {request.listing ? (
          <>
            {" about "}
            <Link href={`/listings/${request.listing.slug}`} className="font-medium text-primary-ink hover:underline">
              {request.listing.title}
            </Link>{" "}
            <span className="font-mono text-xs">({request.listing.reference})</span>
          </>
        ) : (
          " about a listing that no longer has a public page"
        )}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <Card>
            <h2 className="text-xl">The customer’s message</h2>
            {request.stay && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-ink">
                <CalendarDays className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                <span className="text-muted">Asks to stay</span>
                <span className="font-medium">
                  {formatStay(request.stay.check_in, request.stay.check_out)} · {guestCount(request.stay.guests)}
                </span>
              </p>
            )}
            {request.preferred_slot_utc && (
              <p className="mt-3 text-sm text-ink">
                <span className="text-muted">Preferred time: </span>
                <span className="font-medium">{formatWhen(request.preferred_slot_utc)}</span>
              </p>
            )}
            <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-ink">{request.message}</p>
          </Card>

          <Card>
            <h2 className="text-xl">Contact</h2>
            <p className="mt-2 text-sm text-muted">
              Prefers{" "}
              {(contactMethodLabels[request.preferred_contact_method] ?? request.preferred_contact_method).toLowerCase()}.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <a href={`mailto:${request.contact.email}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                  <Mail className="size-4" aria-hidden="true" />
                  <span className="break-all">{request.contact.email}</span>
                </a>
              </li>
              {request.contact.phone && (
                <li>
                  <a href={`tel:${request.contact.phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    {request.contact.phone}
                  </a>
                </li>
              )}
            </ul>
            <CreateContactButton requestId={request.request_id} className="mt-4 border-t border-line pt-4" />
          </Card>

          {request.messages && (
            <Card>
              <Conversation
                side="professional"
                messages={request.messages}
                canReply={request.can_reply ?? request.stage !== "CLOSED"}
                closed={request.stage === "CLOSED"}
                send={(body) => replyToAgentPropertyRequest(request.request_id, body)}
                onSent={(data) => setRequest(data.request)}
                intro="The customer reads your replies in their account and by email, without your name or contact details. A first reply moves a new request to Contacted."
              />
            </Card>
          )}

          <Card>
            <Notes request={request} onChanged={setRequest} />
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <StageControl request={request} onChanged={setRequest} onConflict={reload} />
          </Card>

          {(request.can_assign || request.assigned_to) && (
            <Card>
              <AssignControl request={request} onChanged={setRequest} onStale={reload} />
            </Card>
          )}

          <Card>
            <section aria-labelledby="request-history">
              <h2 id="request-history" className="text-xl">
                History
              </h2>
              <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
                {request.timeline.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <p className="font-medium text-ink">{timelineLabel(entry)}</p>
                    <p className="text-sm text-muted">
                      {entry.actor === "CUSTOMER" ? "The customer" : entry.actor_name ?? (entry.actor === "SYSTEM" ? "RightProperty365" : "Your team")}
                      {", "}
                      {formatWhen(entry.at)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </Card>
        </div>
      </div>
    </>
  );
}

type Props = {
  id: string;
  /** code -> label of the API's `request_types` reference set. */
  requestTypeLabels: Labels;
  /** code -> label of the API's `contact_methods` reference set. */
  contactMethodLabels: Labels;
};

/** `/agent/requests/<id>`: one received request, its stage, history and the team's notes. */
export function RequestDetail({ id, requestTypeLabels, contactMethodLabels }: Props) {
  return (
    <RequireAuth allow={canUseInbox}>
      {() => <Detail id={id} typeLabels={requestTypeLabels} contactMethodLabels={contactMethodLabels} />}
    </RequireAuth>
  );
}
