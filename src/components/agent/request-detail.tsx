"use client";

import { CalendarDays, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { stageTones } from "@/components/agent/request-inbox";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import {
  addAgentPropertyRequestNote,
  getAgentPropertyRequest,
  moveAgentPropertyRequest,
  type LeadStage,
  type ReceivedPropertyRequest,
} from "@/lib/api/agent";
import { canUseInbox } from "@/lib/api/auth";
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
        Only your team can see notes. The customer never does.
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
          </Card>

          <Card>
            <Notes request={request} onChanged={setRequest} />
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <StageControl request={request} onChanged={setRequest} onConflict={reload} />
          </Card>

          <Card>
            <section aria-labelledby="request-history">
              <h2 id="request-history" className="text-xl">
                History
              </h2>
              <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
                {request.timeline.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <p className="font-medium text-ink">{entry.label}</p>
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
