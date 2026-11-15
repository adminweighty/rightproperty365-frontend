"use client";

import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import {
  listRoutingExceptions,
  resolveRoutingException,
  type RoutingException,
  type RoutingExceptionState,
} from "@/lib/api/admin";
import { titleFromCode } from "@/lib/api/auth";
import { formatStay, guestCount } from "@/lib/nights";
import { pageFrom } from "@/lib/request-filters";

const PATH = "/admin/routing-exceptions";
const STATES: { value: RoutingExceptionState; label: string }[] = [
  { value: "OPEN", label: "Still open" },
  { value: "RESOLVED", label: "Dealt with" },
  { value: "ALL", label: "All" },
];

const hrefFor = (state: RoutingExceptionState, page = 1) => {
  const search = new URLSearchParams();
  if (state !== "OPEN") search.set("state", state);
  if (page > 1) search.set("page", String(page));
  const text = search.toString();
  return text ? `${PATH}?${text}` : PATH;
};

/** Marking one as dealt with, in place: a note for other administrators, then confirm. */
function Resolve({ item, onDone }: { item: RoutingException; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = `resolve-${item.request_id}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    setFailure(null);
    setPending(true);
    const result = await resolveRoutingException(item.request_id, note);
    setPending(false);
    if (result.ok) {
      onDone(`${item.reference} is marked as dealt with.`);
      return;
    }
    if (result.failure.status === 409) {
      onDone(`Another administrator already dealt with ${item.reference}. The list has been refreshed.`);
      return;
    }
    if (result.failure.fields?.note) {
      setError(result.failure.fields.note);
      field.current?.focus();
      return;
    }
    setFailure({ message: result.failure.message, traceId: result.failure.traceId });
  }

  if (!open) {
    return (
      <Button
        ref={opener}
        variant="secondary"
        onClick={() => {
          setOpen(true);
          // Focus moves into the step once it is drawn.
          window.setTimeout(() => field.current?.focus(), 0);
        }}
      >
        Mark as dealt with<span className="sr-only">: {item.reference}</span>
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full rounded-md border border-line bg-sunken p-4">
      <p className="font-medium text-ink">Mark {item.reference} as dealt with</p>
      <p className="mt-1 text-sm text-muted">
        The request stays without a recipient; this only records that someone has passed it on or closed it.
      </p>
      <Field id={id} label="What was done" optional error={error} className="mt-3">
        <Textarea
          ref={field}
          id={id}
          name="note"
          rows={2}
          maxLength={2000}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy(id, { error })}
        />
      </Field>
      {failure && <Alert title={failure.message} traceId={failure.traceId} className="mt-3" />}
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Mark as dealt with"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(undefined);
            setFailure(null);
            window.setTimeout(() => opener.current?.focus(), 0);
          }}
        >
          Keep it open
        </Button>
      </div>
    </form>
  );
}

function List() {
  const params = useSearchParams();
  const requested = params.get("state") ?? "OPEN";
  const state = STATES.find((item) => item.value === requested)?.value ?? "OPEN";
  const page = pageFrom(params.get("page"));
  const load = useCallback(() => listRoutingExceptions(state, page), [state, page]);
  const { state: loaded, reload } = useApi(load);
  const [message, setMessage] = useState<string | null>(null);
  const announce = useRef<HTMLDivElement>(null);

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Requests nobody could receive</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Customer requests about a listing that had no one to send them to. Pass each one on by hand using the
        customer’s details, then mark it as dealt with. The longest waiting are first.
      </p>

      <div className="mt-6">
        <ChipNav
          label="Requests by state"
          items={STATES.map((item) => ({
            key: item.value,
            href: hrefFor(item.value),
            label: item.label,
            current: item.value === state,
          }))}
        />
      </div>

      <div ref={announce} tabIndex={-1} aria-live="polite" className="mt-4 outline-none">
        {message && <Alert tone="success" title={message} />}
      </div>

      <p role="status" className="mt-2 text-sm text-muted">
        {loaded.status === "ready" &&
          `${loaded.data.total === 1 ? "1 request" : `${loaded.data.total} requests`}${
            loaded.data.total_pages > 1 ? `, page ${loaded.data.page} of ${loaded.data.total_pages}` : ""
          }`}
      </p>

      <div className="mt-4">
        {loaded.status === "loading" && <LoadingBlock label="Loading requests" />}
        {loaded.status === "error" && <LoadError failure={loaded.failure} onRetry={reload} />}
        {loaded.status === "ready" && loaded.data.items.length === 0 && (
          loaded.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${page} of these requests`}
              action={
                <ButtonLink href={hrefFor(state)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title={state === "OPEN" ? "Every request has a recipient" : "No requests here"}>
              {state === "OPEN" ? "Nothing is waiting to be passed on." : null}
            </EmptyState>
          )
        )}
        {loaded.status === "ready" && loaded.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {loaded.data.items.map((item) => (
                <li key={item.request_id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.state === "OPEN" ? "warning" : "success"}>
                        {item.state === "OPEN" ? "Still open" : "Dealt with"}
                      </Badge>
                      <Badge>{titleFromCode(item.request_type)}</Badge>
                      <span className="font-mono text-xs text-subtle">{item.reference}</span>
                      <span className="ml-auto text-sm text-muted">{formatWhen(item.created_at)}</span>
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                      {item.contact.name}
                      <span className="font-normal text-muted">
                        {" about "}
                        {item.listing ? (
                          <Link href={`/listings/${item.listing.slug}`} className="text-primary-ink hover:underline">
                            {item.listing.title}
                          </Link>
                        ) : (
                          "a listing with no public page"
                        )}
                      </span>
                    </h2>
                    {item.stay && (
                      <p className="mt-2 text-sm text-ink">
                        Asks to stay {formatStay(item.stay.check_in, item.stay.check_out)} · {guestCount(item.stay.guests)}
                      </p>
                    )}
                    <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-ink">{item.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                      <a href={`mailto:${item.contact.email}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                        <Mail className="size-4" aria-hidden="true" />
                        <span className="break-all">{item.contact.email}</span>
                      </a>
                      {item.contact.phone && (
                        <a href={`tel:${item.contact.phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                          <Phone className="size-4" aria-hidden="true" />
                          {item.contact.phone}
                        </a>
                      )}
                      <span className="text-muted">Prefers {titleFromCode(item.preferred_contact_method).toLowerCase()}</span>
                    </div>
                    <div className="mt-4 border-t border-line pt-4">
                      {item.state === "OPEN" ? (
                        <Resolve
                          item={item}
                          onDone={(text) => {
                            setMessage(text);
                            reload();
                            window.setTimeout(() => announce.current?.focus(), 0);
                          }}
                        />
                      ) : (
                        <p className="text-sm text-muted">
                          Dealt with{item.resolved_at ? ` ${formatWhen(item.resolved_at)}` : ""}.
                          {item.resolution_note && <span className="mt-1 block text-ink">{item.resolution_note}</span>}
                        </p>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={loaded.data.page}
              totalPages={loaded.data.total_pages}
              hrefFor={(value) => hrefFor(state, value)}
              label="Requests nobody could receive"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/routing-exceptions`: the requests that found no recipient, and marking them dealt with. */
export function RoutingExceptions() {
  return <AdminGate>{() => <List />}</AdminGate>;
}
