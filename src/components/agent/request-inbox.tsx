"use client";

import { CalendarDays, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CreateContactButton } from "@/components/agent/contacts/create-contact-button";
import { RequireAuth } from "@/components/auth/require-auth";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { listAgentPropertyRequests, listBusinessEnquiries, markBusinessEnquiryReplied, type AgentPropertyRequest, type InboxBusinessEnquiry } from "@/lib/api/agent";
import { getInboxSummary } from "@/lib/api/appointments";
import { canManageTeam, canUseInbox, isProfessional } from "@/lib/api/auth";
import { formatStay, guestCount } from "@/lib/nights";
import {
  hasNarrowingFilters,
  parseRequestFilters,
  QUERY_MAX,
  requestFiltersApiQuery,
  requestFiltersSearch,
  type RequestFilters,
} from "@/lib/request-filters";

/** code -> label maps of the API's reference sets, loaded by the page. */
type Labels = Record<string, string>;

const PATH = "/agent/requests";

/** How many appointments wait for an answer, from GET /v1/inbox/summary. Nothing when there are none. */
function AppointmentsWaiting() {
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getInboxSummary().then((result) => {
      if (!cancelled && result.ok) {
        setWaiting(result.data.appointments.requested + result.data.appointments.reschedule_requested);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (waiting === 0) return null;
  return (
    <Badge tone="primary" className="ml-2">
      {waiting} <span className="sr-only">waiting for your answer</span>
    </Badge>
  );
}

/** Stage badge tones: the new ones stand out, the finished ones are quiet. The word is always shown. */
export const stageTones: Record<string, "primary" | "info" | "warning" | "success" | "neutral" | "accent"> = {
  NEW_ENQUIRY: "primary",
  ASSIGNED: "info",
  CONTACTED: "info",
  VIEWING_REQUESTED: "accent",
  VIEWING_SCHEDULED: "accent",
  FOLLOW_UP_REQUIRED: "warning",
  CONVERTED: "success",
  CLOSED: "neutral",
};

/**
 * Who holds a request. Organisation requests are either with a member or in
 * the team inbox; a direct seller's own requests are never assigned, so they
 * say nothing (`inTeam` false).
 */
function Assignee({ item, inTeam }: { item: AgentPropertyRequest; inTeam: boolean }) {
  if (item.assigned_to === undefined) return null; // an API build without assignment
  if (item.assigned_to) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-ink">
        <UserRound className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
        <span className="text-muted">Assigned to</span> <span className="font-medium">{item.assigned_to.name}</span>
      </span>
    );
  }
  if (!inTeam) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted">
      <UserRound className="size-4 shrink-0" aria-hidden="true" />
      Not assigned: in the team inbox
    </span>
  );
}

function RequestCard({ item, typeLabels, inTeam }: { item: AgentPropertyRequest; typeLabels: Labels; inTeam: boolean }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{typeLabels[item.request_type] ?? item.request_type}</Badge>
        {item.stage_label && <Badge tone={stageTones[item.stage ?? ""] ?? "neutral"}>{item.stage_label}</Badge>}
        <span className="ml-auto text-sm text-muted">{formatWhen(item.created_at)}</span>
      </div>
      <h3 className="mt-3 font-sans text-lg font-medium tracking-normal">
        <Link href={`${PATH}/${item.request_id}`} className="text-primary-ink hover:underline">
          {item.contact.name}
        </Link>
        <span className="font-normal text-muted"> about {item.listing?.title ?? "a listing"}</span>
      </h3>
      {item.stay && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink">
          <CalendarDays className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
          <span className="text-muted">Asks to stay</span>
          <span className="font-medium">
            {formatStay(item.stay.check_in, item.stay.check_out)} · {guestCount(item.stay.guests)}
          </span>
        </p>
      )}
      <p className="mt-2 line-clamp-3 max-w-prose whitespace-pre-line leading-relaxed text-ink">{item.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
        <Link href={`${PATH}/${item.request_id}`} className="font-semibold text-primary-ink hover:underline">
          Open the request<span className="sr-only"> from {item.contact.name}</span>
        </Link>
        <Assignee item={item} inTeam={inTeam} />
        <span className="font-mono text-xs text-subtle sm:ml-auto">{item.reference}</span>
      </div>
    </Card>
  );
}

function Filters({ filters, typeLabels }: { filters: RequestFilters; typeLabels: Labels }) {
  const router = useRouter();
  const typeOptions = [
    { value: "", label: "Any type" },
    ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = parseRequestFilters({
      get: (name) => (name === "stage" ? (filters.stage ?? null) : name === "page" ? null : String(data.get(name) ?? "")),
    });
    router.push(`${PATH}${requestFiltersSearch(next)}`, { scroll: false });
  }

  return (
    <form method="get" action={PATH} onSubmit={handleSubmit} role="search" aria-label="Filter requests" className="rounded-lg border border-line bg-surface p-4">
      {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="requests-q" label="Search">
          <Input
            id="requests-q"
            name="q"
            type="search"
            maxLength={QUERY_MAX}
            defaultValue={filters.q ?? ""}
            placeholder="Name, email, reference or words"
          />
        </Field>
        <Field id="requests-type" label="Type of request">
          <SearchableSelect id="requests-type" name="type" options={typeOptions} defaultValue={filters.type ?? ""} />
        </Field>
        <Field id="requests-from" label="Received from">
          <Input id="requests-from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </Field>
        <Field id="requests-to" label="Received until">
          <Input id="requests-to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        {hasNarrowingFilters(filters) && (
          <ButtonLink href={`${PATH}${requestFiltersSearch({ stage: filters.stage, page: 1 })}`} variant="ghost" scroll={false}>
            Clear filters
          </ButtonLink>
        )}
      </div>
    </form>
  );
}

function PropertyRequests({ typeLabels, inTeam }: { typeLabels: Labels; inTeam: boolean }) {
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseRequestFilters(new URLSearchParams(search)), [search]);
  const apiQuery = requestFiltersApiQuery(filters);
  const load = useCallback(() => listAgentPropertyRequests(apiQuery), [apiQuery]);
  const { state, reload } = useApi(load);

  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.stage_counts ?? [];
  const all = counts.reduce((sum, item) => sum + item.count, 0);
  const narrowed = hasNarrowingFilters(filters) || Boolean(filters.stage);

  return (
    <section aria-labelledby="inbox-property">
      <h2 id="inbox-property" className="text-2xl">
        Property requests
      </h2>

      <div className="mt-4 space-y-4">
        {counts.length > 0 && (
          <ChipNav
            label="Requests by stage"
            items={[
              {
                key: "all",
                href: `${PATH}${requestFiltersSearch({ ...filters, stage: undefined, page: 1 })}`,
                label: "All",
                count: all,
                current: !filters.stage,
              },
              ...counts.map((item) => ({
                key: item.stage,
                href: `${PATH}${requestFiltersSearch({ ...filters, stage: item.stage, page: 1 })}`,
                label: item.label,
                count: item.count,
                current: filters.stage === item.stage,
              })),
            ]}
          />
        )}
        <Filters key={search} filters={filters} typeLabels={typeLabels} />
      </div>

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          (state.data.total === 1 ? "1 request" : `${state.data.total} requests`) +
            (narrowed ? " match" : "") +
            (state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : "") +
            ", newest first"}
        {state.status === "loading" && "Loading requests…"}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading requests" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these requests`}
              action={
                <ButtonLink href={`${PATH}${requestFiltersSearch({ ...filters, page: 1 })}`} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : narrowed ? (
            <EmptyState
              title="No requests match these filters"
              action={
                <ButtonLink href={PATH} variant="secondary">
                  Show every request
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title="No requests yet">
              When a customer enquires about one of your listings, the request appears here.
            </EmptyState>
          )
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item) => (
                <li key={item.request_id}>
                  <RequestCard item={item} typeLabels={typeLabels} inTeam={inTeam} />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={(value) => `${PATH}${requestFiltersSearch({ ...filters, page: value })}`}
              label="Property requests"
            />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * "Mark as replied" on a business enquiry (API 0.36.4). The reply goes by
 * email, phone or WhatsApp; marking it lets the customer review the provider
 * 14 days after the enquiry. Once marked, it says when.
 */
function RepliedMark({ item }: { item: InboxBusinessEnquiry }) {
  const [repliedAt, setRepliedAt] = useState<string | null>(item.replied_at ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (repliedAt) {
    return (
      <p className="text-sm text-muted">
        <Badge tone="success">Replied</Badge> <span className="ml-1">Marked {formatWhen(repliedAt)}</span>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const answer = await markBusinessEnquiryReplied(item.enquiry_id);
          setBusy(false);
          if (answer.ok) setRepliedAt(answer.data.item?.replied_at ?? new Date().toISOString());
          else setError(answer.failure.message);
        }}
      >
        {busy ? "Saving…" : "Mark as replied"}
        <span className="sr-only">: {item.reference}</span>
      </Button>
      <span className="text-sm text-muted">Once you have answered {item.contact.name}. They can then review you after 14 days.</span>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Enquiries sent from a public profile. Not paged by the API. */
function BusinessEnquiries({ contactMethodLabels }: { contactMethodLabels: Labels }) {
  const { state: loaded, reload } = useApi(listBusinessEnquiries);
  const state =
    loaded.status === "ready" ? { status: "ready" as const, items: loaded.data.items } : loaded;

  return (
    <section aria-labelledby="business-enquiries-heading" id="business-enquiries" className="scroll-mt-24">
      <h2 id="business-enquiries-heading" className="text-2xl">
        Business enquiries
      </h2>
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading enquiries" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.items.length === 0 && (
          <EmptyState title="No enquiries yet">
            When a customer contacts you from your public profile, the enquiry appears here.
          </EmptyState>
        )}
        {state.status === "ready" && state.items.length > 0 && (
          <>
            <p className="text-sm text-muted" role="status">
              {state.items.length === 1 ? "1 enquiry" : `${state.items.length} enquiries`}, newest first
            </p>
            <ul className="mt-4 space-y-4">
              {state.items.map((item) => (
                <li key={item.enquiry_id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{item.service ?? "Business enquiry"}</Badge>
                      <span className="ml-auto text-sm text-muted">{formatWhen(item.created_at)}</span>
                    </div>
                    <h3 className="mt-3 font-sans text-lg font-medium tracking-normal">
                      {item.contact.name}
                      <span className="font-normal text-muted"> to {item.recipient.name}</span>
                    </h3>
                    <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed text-ink">{item.message}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
                      <a href={`mailto:${item.contact.email}`} className="flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                        <Mail className="size-4" aria-hidden="true" />
                        <span className="break-all">{item.contact.email}</span>
                      </a>
                      {item.contact.phone && (
                        <a href={`tel:${item.contact.phone}`} className="flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                          <Phone className="size-4" aria-hidden="true" />
                          {item.contact.phone}
                        </a>
                      )}
                      <span className="text-muted">
                        Prefers {(contactMethodLabels[item.preferred_contact_method] ?? item.preferred_contact_method).toLowerCase()}
                      </span>
                      <span className="font-mono text-xs text-subtle sm:ml-auto">{item.reference}</span>
                    </div>
                    <div className="mt-4 border-t border-line pt-4">
                      <RepliedMark item={item} />
                    </div>
                    <CreateContactButton requestId={item.enquiry_id} name={item.contact.name} className="mt-4 border-t border-line pt-4" />
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
  return (
    <RequireAuth allow={canUseInbox}>
      {(user) => (
        <>
          <p className="text-sm">
            <Link href="/dashboard" className="font-medium text-primary-ink hover:underline">
              Dashboard
            </Link>
          </p>
          <h1 className="mt-1 text-4xl">Request inbox</h1>
          <p className="mt-2 text-muted">
            Customer requests sent to you or your organisation. Open one to move it along, see its history and keep
            notes for your team.{" "}
            <Link href="/agent/appointments" className="font-medium text-primary-ink hover:underline">
              Appointments
              <AppointmentsWaiting />
            </Link>
            {" · "}
            <Link href="/agent/listings" className="font-medium text-primary-ink hover:underline">
              Your listings
            </Link>
            {isProfessional(user) && (
              <>
                {" · "}
                <Link href="/agent/contacts" className="font-medium text-primary-ink hover:underline">
                  Contacts
                </Link>
              </>
            )}
            {canManageTeam(user) && (
              <>
                {" · "}
                <Link href="/agent/team" className="font-medium text-primary-ink hover:underline">
                  Your team
                </Link>
              </>
            )}
          </p>
          <div className="mt-8 space-y-12">
            <PropertyRequests typeLabels={requestTypeLabels} inTeam={isProfessional(user)} />
            {/* Business enquiries go to organisations, so Landlords and Property Sellers (Vendors) have none. */}
            {isProfessional(user) && <BusinessEnquiries contactMethodLabels={contactMethodLabels} />}
          </div>
        </>
      )}
    </RequireAuth>
  );
}
