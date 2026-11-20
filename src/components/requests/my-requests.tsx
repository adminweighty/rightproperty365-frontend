"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Conversation } from "@/components/requests/conversation";
import { customerStatusTones, getMyPropertyRequest, listMyPropertyRequests, replyOnMyPropertyRequest } from "@/lib/api/my-requests";
import { formatStay, guestCount } from "@/lib/nights";
import { parseStatusFilter, statusFilterSearch } from "@/lib/request-filters";

type Labels = Record<string, string>;

const PATH = "/account/requests";

/** What each status means for the customer, in one line. */
const statusExplained: Record<string, string> = {
  RECEIVED: "The advertiser has your request and has not answered yet.",
  IN_PROGRESS: "The advertiser is working on your request.",
  RESPONDED: "The advertiser has been in touch. Check the conversation below, your email and your phone.",
  VIEWING_SCHEDULED: "A viewing has been arranged.",
  CLOSED: "This request is finished.",
};

function List({ typeLabels }: { typeLabels: Labels }) {
  const params = useSearchParams();
  const search = params.toString();
  const filter = useMemo(() => parseStatusFilter(new URLSearchParams(search)), [search]);
  const load = useCallback(() => listMyPropertyRequests(filter), [filter]);
  const { state, reload } = useApi(load);
  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.status_counts ?? [];
  const all = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-4xl">Your requests</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Enquiries and requests you sent about a property while signed in, and where each one stands. Requests sent
        without signing in are not shown here.
      </p>

      {counts.length > 0 && all > 0 && (
        <div className="mt-6">
          <ChipNav
            label="Requests by status"
            items={[
              { key: "all", href: PATH, label: "All", count: all, current: !filter.status },
              ...counts.map((item) => ({
                key: item.status,
                href: `${PATH}${statusFilterSearch({ status: item.status, page: 1 })}`,
                label: item.label,
                count: item.count,
                current: filter.status === item.status,
              })),
            ]}
          />
        </div>
      )}

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.total > 0 &&
          `${state.data.total === 1 ? "1 request" : `${state.data.total} requests`}${
            state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : ""
          }, newest first`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading your requests" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${filter.page} of your requests`}
              action={
                <ButtonLink href={`${PATH}${statusFilterSearch({ ...filter, page: 1 })}`} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : filter.status ? (
            <EmptyState
              title="No requests with this status"
              action={
                <ButtonLink href={PATH} variant="secondary">
                  Show all your requests
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="You have not sent a request yet"
              action={
                <ButtonLink href="/listings" variant="secondary">
                  Find a property
                </ButtonLink>
              }
            >
              Ask an advertiser about any listing while signed in and you can follow it here.
            </EmptyState>
          )
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item) => (
                <li key={item.request_id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={customerStatusTones[item.status] ?? "neutral"}>{item.status_label}</Badge>
                      <Badge>{typeLabels[item.request_type] ?? item.request_type}</Badge>
                      {item.unread_reply && <Badge tone="accent">New reply</Badge>}
                      <span className="ml-auto text-sm text-muted">Sent {formatWhen(item.created_at)}</span>
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                      <Link href={`${PATH}/${item.request_id}`} className="text-primary-ink hover:underline">
                        {item.listing?.title ?? "A listing that is no longer shown"}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">{statusExplained[item.status]}</p>
                    <p className="mt-2 line-clamp-2 max-w-prose text-ink">{item.message}</p>
                    <p className="mt-3 font-mono text-xs text-subtle">{item.reference}</p>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={(value) => `${PATH}${statusFilterSearch({ ...filter, page: value })}`}
              label="Your requests"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/account/requests`: the requests the signed-in person sent, by status. */
export function MyRequests({ requestTypeLabels }: { requestTypeLabels: Labels }) {
  return <RequireAuth>{() => <List typeLabels={requestTypeLabels} />}</RequireAuth>;
}

function Detail({ id, typeLabels, contactMethodLabels }: { id: string; typeLabels: Labels; contactMethodLabels: Labels }) {
  const load = useCallback(() => getMyPropertyRequest(id), [id]);
  const { state, reload, replace } = useApi(load);

  if (state.status === "loading") return <LoadingBlock label="Loading your request" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState
          title="We could not find that request"
          action={
            <ButtonLink href={PATH} variant="secondary">
              Back to your requests
            </ButtonLink>
          }
        >
          Only requests you sent while signed in to this account can be opened here.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const request = state.data.request;
  const method = (contactMethodLabels[request.preferred_contact_method] ?? request.preferred_contact_method).toLowerCase();

  return (
    <>
      <BackLink href={PATH}>Your requests</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={customerStatusTones[request.status] ?? "neutral"}>{request.status_label}</Badge>
        <Badge>{typeLabels[request.request_type] ?? request.request_type}</Badge>
        <span className="font-mono text-xs text-subtle">{request.reference}</span>
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">
        {request.listing ? (
          <Link href={`/listings/${request.listing.slug}`} className="hover:underline">
            {request.listing.title}
          </Link>
        ) : (
          "A listing that is no longer shown"
        )}
      </h1>
      <p className="mt-2 text-muted">
        {statusExplained[request.status]} The advertiser replies here or contacts you directly, by {method} if they can.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {request.messages && (
          <Card className="lg:col-span-2">
            <Conversation
              side="customer"
              messages={request.messages}
              canReply={Boolean(request.can_reply)}
              closed={request.status === "CLOSED"}
              send={(body) => replyOnMyPropertyRequest(request.request_id, body)}
              onSent={(data) => replace(data)}
              intro="Messages between you and the advertiser about this request. They are private to the two of you."
            />
          </Card>
        )}
        <Card>
          <h2 className="text-xl">What you sent</h2>
          <p className="mt-1 text-sm text-muted">Sent {formatWhen(request.created_at)}</p>
          {request.stay && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-ink">
              <CalendarDays className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
              <span className="text-muted">You asked to stay</span>
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
          <h2 className="text-xl">History</h2>
          {request.timeline && request.timeline.length > 0 ? (
            <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
              {request.timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>
                  <p className="font-medium text-ink">{entry.event === "RECEIVED" ? "Request received" : entry.status_label}</p>
                  <p className="text-sm text-muted">{formatWhen(entry.at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-muted">Nothing has changed since you sent it.</p>
          )}
          <p className="mt-6 text-sm">
            <Link href="/account/appointments" className="font-medium text-primary-ink hover:underline">
              Your appointments
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}

/** `/account/requests/<id>`: one request the person sent, with its status history. */
export function MyRequestDetail({
  id,
  requestTypeLabels,
  contactMethodLabels,
}: {
  id: string;
  requestTypeLabels: Labels;
  contactMethodLabels: Labels;
}) {
  return (
    <RequireAuth>
      {() => <Detail id={id} typeLabels={requestTypeLabels} contactMethodLabels={contactMethodLabels} />}
    </RequireAuth>
  );
}
