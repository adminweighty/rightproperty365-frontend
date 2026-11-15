"use client";

import { useCallback } from "react";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listTeamAudit } from "@/lib/api/team";

/** Work handed back to the team inbox, from the record's `after` values. */
function released(after: Record<string, unknown> | null): string | null {
  const requests = Number(after?.released_requests ?? 0);
  const appointments = Number(after?.released_appointments ?? 0);
  const parts = [
    requests > 0 && `${requests} ${requests === 1 ? "request" : "requests"}`,
    appointments > 0 && `${appointments} ${appointments === 1 ? "appointment" : "appointments"}`,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" and ")} back to the team inbox` : null;
}

/** The team's audit trail, newest first, one page at a time. */
export function Activity({
  organisationId,
  page,
  hrefFor,
}: {
  organisationId: string;
  page: number;
  hrefFor: (page: number) => string;
}) {
  const load = useCallback(() => listTeamAudit(organisationId, page), [organisationId, page]);
  const { state, reload } = useApi(load);

  return (
    <section aria-labelledby="team-activity">
      <h2 id="team-activity" className="text-2xl">
        Activity
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        Every invitation, decision, change to a member and assignment of a request, with who made it and when. It cannot
        be changed.
      </p>
      <p role="status" className="mt-2 text-sm text-muted">
        {state.status === "ready" &&
          `${state.data.total} ${state.data.total === 1 ? "entry" : "entries"}` +
            (state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : "") +
            ", newest first"}
        {state.status === "loading" && "Loading activity…"}
      </p>
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading activity" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${page} of the activity`}
              action={
                <ButtonLink href={hrefFor(1)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title="No activity yet">
              Invitations, decisions on requests to join, changes to members and assignments will be listed here.
            </EmptyState>
          )
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <Card padded={false}>
              <ol className="divide-y divide-line">
                {state.data.items.map((event) => {
                  const handedBack = released(event.after);
                  return (
                    <li key={event.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-ink">
                          <span className="font-medium">{event.action_label}</span>
                          {event.target.label && <span className="break-all text-muted"> · {event.target.label}</span>}
                        </p>
                        <p className="text-sm text-muted">
                          By {event.actor.name}
                          {event.after?.decided_by === "PLATFORM" && " (our verification team)"}
                          {handedBack && <> · {handedBack}</>}
                        </p>
                      </div>
                      <time dateTime={event.at} className="text-sm text-muted">
                        {formatWhen(event.at)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </Card>
            <Pagination
              className="mt-6"
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={hrefFor}
              label="Team activity"
            />
          </>
        )}
      </div>
    </section>
  );
}
