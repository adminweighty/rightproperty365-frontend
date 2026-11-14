"use client";

import { Mail, Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAgentPropertyRequests, listBusinessEnquiries } from "@/lib/api/agent";
import { canUseInbox, isProfessional } from "@/lib/api/auth";
import type { ApiFailure, ApiResult } from "@/lib/api/http";

/** code -> label maps of the API's reference sets, loaded by the page. */
type Labels = Record<string, string>;

const statusLabels: Record<string, string> = {
  RECEIVED: "New",
  ROUTED: "New",
  IN_PROGRESS: "In progress",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** One row of either inbox, reduced to what the card shows. */
type InboxItem = {
  id: string;
  label: string;
  status: string;
  createdAt: string;
  customer: string;
  subject: string;
  message: string;
  email: string;
  phone?: string | null;
  contactMethod: string;
  reference: string;
};

async function loadPropertyRequests(typeLabels: Labels): Promise<ApiResult<InboxItem[]>> {
  const result = await listAgentPropertyRequests();
  if (!result.ok) return result;
  return {
    ...result,
    data: result.data.items.map((item) => ({
      id: item.request_id,
      label: typeLabels[item.request_type] ?? item.request_type,
      status: item.status,
      createdAt: item.created_at,
      customer: item.contact.name,
      // The API sends a listing summary with each request; older builds do not.
      subject: `about ${item.listing?.title ?? "a listing"}`,
      message: item.message,
      email: item.contact.email,
      phone: item.contact.phone,
      contactMethod: item.preferred_contact_method,
      reference: item.reference,
    })),
  };
}

async function loadBusinessEnquiries(): Promise<ApiResult<InboxItem[]>> {
  const result = await listBusinessEnquiries();
  if (!result.ok) return result;
  return {
    ...result,
    data: result.data.items.map((item) => ({
      id: item.enquiry_id,
      label: item.service ?? "Business enquiry",
      status: item.status,
      createdAt: item.created_at,
      customer: item.contact.name,
      subject: `to ${item.recipient.name}`,
      message: item.message,
      email: item.contact.email,
      phone: item.contact.phone,
      contactMethod: item.preferred_contact_method,
      reference: item.reference,
    })),
  };
}

type State =
  | { status: "loading" }
  | { status: "ready"; items: InboxItem[] }
  | { status: "error"; failure: ApiFailure };

type SectionProps = {
  id: string;
  title: string;
  /** Singular and plural nouns for the count line. */
  noun: [string, string];
  emptyText: string;
  load: () => Promise<ApiResult<InboxItem[]>>;
  contactMethodLabels: Labels;
};

function InboxSection({ id, title, noun, emptyText, load, contactMethodLabels }: SectionProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (cancelled) return;
      setState(
        result.ok ? { status: "ready", items: result.data } : { status: "error", failure: result.failure },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, load]);

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl">
        {title}
      </h2>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label={`Loading ${noun[1]}`} className="mt-4 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 rounded-lg bg-sunken" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4">
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
        </div>
      )}

      {state.status === "ready" && state.items.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
          {emptyText}
        </p>
      )}

      {state.status === "ready" && state.items.length > 0 && (
        <>
          <p className="mt-2 text-sm text-muted" role="status">
            {state.items.length === 1 ? `1 ${noun[0]}` : `${state.items.length} ${noun[1]}`}, newest first
          </p>
          <ul className="mt-4 space-y-4">
            {state.items.map((item) => (
              <li key={item.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">{item.label}</Badge>
                    <Badge>{statusLabels[item.status] ?? item.status}</Badge>
                    <span className="ml-auto text-sm text-muted">{formatWhen(item.createdAt)}</span>
                  </div>
                  <h3 className="mt-3 font-sans text-lg font-medium tracking-normal">
                    {item.customer}
                    <span className="font-normal text-muted"> {item.subject}</span>
                  </h3>
                  <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-ink">
                    {item.message}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
                    <a
                      href={`mailto:${item.email}`}
                      className="flex items-center gap-1.5 text-primary-ink hover:underline"
                    >
                      <Mail className="size-4" aria-hidden="true" />
                      <span className="break-all">{item.email}</span>
                    </a>
                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        className="flex items-center gap-1.5 text-primary-ink hover:underline"
                      >
                        <Phone className="size-4" aria-hidden="true" />
                        {item.phone}
                      </a>
                    )}
                    <span className="text-muted">
                      Prefers {(contactMethodLabels[item.contactMethod] ?? item.contactMethod).toLowerCase()}
                    </span>
                    <span className="font-mono text-xs text-subtle sm:ml-auto">{item.reference}</span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type Props = {
  /** code -> label of the API's `request_types` reference set. */
  requestTypeLabels: Labels;
  /** code -> label of the API's `contact_methods` reference set. */
  contactMethodLabels: Labels;
};

export function RequestInbox({ requestTypeLabels, contactMethodLabels }: Props) {
  // A stable function, so the section does not reload on every render.
  const loadRequests = useCallback(() => loadPropertyRequests(requestTypeLabels), [requestTypeLabels]);

  return (
    <RequireAuth allow={canUseInbox}>
      {(user) => (
        <>
          <h1 className="text-4xl">Request inbox</h1>
          <p className="mt-2 text-muted">Customer requests sent to you or your organisation.</p>
          <div className="mt-8 space-y-12">
            <InboxSection
              id="inbox-property"
              title="Property requests"
              noun={["request", "requests"]}
              emptyText="When a customer enquires about one of your listings, the request appears here."
              load={loadRequests}
              contactMethodLabels={contactMethodLabels}
            />
            {/* Business enquiries go to organisations, so Landlords and Property Sellers (Vendors) have none. */}
            {isProfessional(user) && (
              <InboxSection
                id="inbox-business"
                title="Business enquiries"
                noun={["enquiry", "enquiries"]}
                emptyText="When a customer contacts you from your directory profile, the enquiry appears here."
                load={loadBusinessEnquiries}
                contactMethodLabels={contactMethodLabels}
              />
            )}
          </div>
        </>
      )}
    </RequireAuth>
  );
}
