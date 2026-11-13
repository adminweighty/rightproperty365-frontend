"use client";

import { Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAgentPropertyRequests, type AgentPropertyRequest } from "@/lib/api/agent";
import { isProfessional } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { contactMethods, requestTypes } from "@/lib/api/property-requests";
import { listings } from "@/lib/data/listings";

const typeLabel = (value: string) => requestTypes.find((type) => type.value === value)?.label ?? value;
const methodLabel = (value: string) =>
  contactMethods.find((method) => method.value === value)?.label ?? value;

// Sample listings stand in until the API returns a listing summary with each request.
const listingTitle = (id: string) => listings.find((listing) => listing.id === id)?.title;

const statusLabels: Record<string, string> = {
  RECEIVED: "New",
  ROUTED: "New",
  IN_PROGRESS: "In progress",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

type State =
  | { status: "loading" }
  | { status: "ready"; items: AgentPropertyRequest[] }
  | { status: "error"; failure: ApiFailure };

function Inbox() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAgentPropertyRequests().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", items: result.data.items }
          : { status: "error", failure: result.failure },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading requests" className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-lg bg-sunken" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <Alert title={state.failure.message} traceId={state.failure.traceId} />
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

  if (state.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h2 className="text-2xl">No requests yet</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          When a customer enquires about one of your listings, the request appears here.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted" role="status">
        {state.items.length === 1 ? "1 request" : `${state.items.length} requests`}, newest first
      </p>
      <ul className="mt-4 space-y-4">
        {state.items.map((item) => (
          <li key={item.request_id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{typeLabel(item.request_type)}</Badge>
                <Badge>{statusLabels[item.status] ?? item.status}</Badge>
                <span className="ml-auto text-sm text-muted">{formatWhen(item.created_at)}</span>
              </div>
              <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                {item.contact.name}
                <span className="font-normal text-muted">
                  {" "}
                  about {listingTitle(item.listing_id) ?? "a listing"}
                </span>
              </h2>
              <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-ink">
                {item.message}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
                <a href={`mailto:${item.contact.email}`} className="flex items-center gap-1.5 text-primary-ink hover:underline">
                  <Mail className="size-4" aria-hidden="true" />
                  <span className="break-all">{item.contact.email}</span>
                </a>
                {item.contact.phone && (
                  <a href={`tel:${item.contact.phone}`} className="flex items-center gap-1.5 text-primary-ink hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    {item.contact.phone}
                  </a>
                )}
                <span className="text-muted">Prefers {methodLabel(item.preferred_contact_method).toLowerCase()}</span>
                <span className="font-mono text-xs text-subtle sm:ml-auto">{item.reference}</span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function RequestInbox() {
  return (
    <RequireAuth allow={isProfessional}>
      {() => (
        <>
          <h1 className="text-4xl">Request inbox</h1>
          <p className="mt-2 text-muted">Customer requests sent to your organisation.</p>
          <div className="mt-8">
            <Inbox />
          </div>
        </>
      )}
    </RequireAuth>
  );
}
