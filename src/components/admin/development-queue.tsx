"use client";

import { Camera, Filter, Layers } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEVELOPMENT_QUEUE_STATUSES, listDevelopmentQueue } from "@/lib/api/developments";
import type { Option } from "@/lib/api/types";
import { developmentPlace, moderationStatusLabel, moderationStatusTone } from "@/lib/developments";

const DEFAULT_STATUS = "PENDING_REVIEW";

export function NotADevelopmentReviewer() {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">Your role does not review development projects</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Projects are reviewed by Moderators, Platform Administrators, Super Administrators and, for their own countries,
        Market Administrators.
      </p>
      <ButtonLink href="/admin" variant="secondary" className="mt-6">
        Back to the overview
      </ButtonLink>
    </div>
  );
}

function Queue({ countries }: { countries: Option[] }) {
  const params = useSearchParams();
  const requested = params.get("status") ?? "";
  const status = (DEVELOPMENT_QUEUE_STATUSES as readonly string[]).includes(requested) ? requested : DEFAULT_STATUS;
  const market = /^[A-Za-z]{2}$/.test(params.get("market") ?? "") ? (params.get("market") as string).toUpperCase() : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const load = useCallback(() => listDevelopmentQueue({ status, market, page }), [status, market, page]);
  const { state, reload } = useApi(load);

  const hrefFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status !== DEFAULT_STATUS) query.set("status", status);
    if (market) query.set("market", market);
    if (nextPage > 1) query.set("page", String(nextPage));
    const text = query.toString();
    return text ? `/admin/developments?${text}` : "/admin/developments";
  };
  if (state.status === "error" && state.failure.status === 403) return <NotADevelopmentReviewer />;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-2 text-4xl">Development reviews</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Projects developers have submitted, oldest submission first. Nothing is public until you approve it; a rejected
        project can be changed and submitted again.
      </p>

      <form
        action="/admin/developments"
        role="search"
        aria-label="Filter projects"
        className="mt-8 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <div className="min-w-0">
          <label htmlFor="development-queue-status" className="sr-only">
            Status
          </label>
          <SearchableSelect
            id="development-queue-status"
            name="status"
            defaultValue={status}
            options={DEVELOPMENT_QUEUE_STATUSES.map((value) => ({ value, label: moderationStatusLabel(value) }))}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="development-queue-market" className="sr-only">
            Country
          </label>
          <SearchableSelect
            id="development-queue-market"
            name="market"
            defaultValue={market}
            options={[{ value: "", label: "Any country" }, ...countries.map(({ value, label }) => ({ value, label, keywords: [value] }))]}
          />
        </div>
        <Button type="submit">
          <Filter className="size-4" aria-hidden="true" />
          Filter
        </Button>
      </form>

      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading projects" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <>
            <p className="text-sm text-muted" role="status">
              {state.data.total === 1 ? "1 project" : `${state.data.total} projects`}
              {state.data.total_pages > 1 && ` · page ${state.data.page} of ${state.data.total_pages}`}
            </p>
            {state.data.items.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title={
                    market
                      ? "No projects match those filters"
                      : status === DEFAULT_STATUS
                        ? "No projects are waiting for review"
                        : `No projects are ${moderationStatusLabel(status).toLowerCase()}`
                  }
                  action={
                    market ? (
                      <ButtonLink href={status === DEFAULT_STATUS ? "/admin/developments" : `/admin/developments?status=${status}`} variant="secondary">
                        Clear filters
                      </ButtonLink>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {state.data.items.map((item) => {
                  const unitTypes = item.phases.reduce((count, phase) => count + phase.unit_types.length, 0);
                  return (
                    <li key={item.id}>
                      <article className="group frame-brand relative rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={moderationStatusTone(item.moderation_status)}>{moderationStatusLabel(item.moderation_status)}</Badge>
                          <Badge>{item.market.name}</Badge>
                          <span className="ml-auto text-sm text-muted">
                            {item.submitted_at ? `Submitted ${formatWhen(item.submitted_at)}` : `Updated ${formatWhen(item.updated_at)}`}
                          </span>
                        </div>
                        <h2 className="mt-3 break-words font-sans text-lg font-semibold tracking-normal">
                          <Link
                            href={`/admin/developments/${item.id}`}
                            className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                          >
                            {item.name || "Untitled project"}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-muted">{developmentPlace(item.location) || item.city_name || item.market.name}</p>
                        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink">
                          <span>
                            {item.developer.name}{" "}
                            <span className={item.developer.verified ? "text-success" : "text-muted"}>
                              ({item.developer.verified ? "Verified" : "Not verified"})
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 text-muted">
                            <Layers className="size-4" aria-hidden="true" />
                            {item.phases.length === 1 ? "1 phase" : `${item.phases.length} phases`}, {unitTypes === 1 ? "1 unit type" : `${unitTypes} unit types`}
                          </span>
                          <span className="flex items-center gap-1.5 text-muted">
                            <Camera className="size-4" aria-hidden="true" />
                            {item.photos.length === 1 ? "1 photo" : `${item.photos.length} photos`}
                          </span>
                        </p>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination page={state.data.page} totalPages={state.data.total_pages} hrefFor={hrefFor} label="Development reviews" className="mt-8" />
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/developments`: the review queue of development projects. */
export function DevelopmentQueue({ countries }: { countries: Option[] }) {
  return <AdminGate>{() => <Queue countries={countries} />}</AdminGate>;
}
