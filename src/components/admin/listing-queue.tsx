"use client";

import { Camera, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { listListingQueue } from "@/lib/api/manage-listings";
import type { Option } from "@/lib/api/types";
import { listingStatusLabels, listingStatusTone, REVIEW_QUEUE_STATUSES } from "@/lib/listing-manage";

const DEFAULT_STATUS = "PENDING_REVIEW";

export const reviewKindBadge = (kind: string | null) =>
  kind === "EDIT"
    ? { text: "Changes to a public listing", tone: "accent" as const }
    : kind === "NEW"
      ? { text: "New listing", tone: "primary" as const }
      : null;

export function NotAReviewer() {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">Your role does not review listings</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Listings are reviewed by Moderators, Platform Administrators, Super Administrators and, for their own countries,
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
  const status = (REVIEW_QUEUE_STATUSES as readonly string[]).includes(requested) ? requested : DEFAULT_STATUS;
  const kind = ["NEW", "EDIT"].includes(params.get("kind") ?? "") ? (params.get("kind") as string) : "";
  const country = /^[A-Za-z]{2}$/.test(params.get("country") ?? "") ? (params.get("country") as string).toUpperCase() : "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const load = useCallback(() => listListingQueue({ status, kind, country, q, page }), [status, kind, country, q, page]);
  const { state, reload } = useApi(load);

  const hrefFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status !== DEFAULT_STATUS) query.set("status", status);
    if (kind) query.set("kind", kind);
    if (country) query.set("country", country);
    if (q) query.set("q", q);
    if (nextPage > 1) query.set("page", String(nextPage));
    const text = query.toString();
    return text ? `/admin/listings?${text}` : "/admin/listings";
  };
  const filtered = Boolean(kind || country || q);
  if (state.status === "error" && state.failure.status === 403) return <NotAReviewer />;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-2 text-4xl">Listing reviews</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        New listings and changes to public listings, oldest submission first. Nothing is public until you approve it;
        visitors keep seeing the approved version of a public listing while its changes wait.
      </p>

      {/* A plain GET form: the filters live in the address, so a view can be bookmarked. */}
      <form
        action="/admin/listings"
        role="search"
        aria-label="Filter listings"
        className="mt-8 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[12rem_12rem_12rem_1fr_auto]"
      >
        <div>
          <label htmlFor="queue-status" className="sr-only">
            Status
          </label>
          <SearchableSelect
            id="queue-status"
            name="status"
            defaultValue={status}
            options={REVIEW_QUEUE_STATUSES.map((value) => ({ value, label: listingStatusLabels[value] }))}
          />
        </div>
        <div>
          <label htmlFor="queue-kind" className="sr-only">
            Kind of review
          </label>
          <SearchableSelect
            id="queue-kind"
            name="kind"
            defaultValue={kind}
            options={[
              { value: "", label: "New listings and changes" },
              { value: "NEW", label: "New listings" },
              { value: "EDIT", label: "Changes to public listings" },
            ]}
          />
        </div>
        <div>
          <label htmlFor="queue-country" className="sr-only">
            Country
          </label>
          <SearchableSelect
            id="queue-country"
            name="country"
            defaultValue={country}
            options={[{ value: "", label: "Any country" }, ...countries.map(({ value, label }) => ({ value, label, keywords: [value] }))]}
          />
        </div>
        <div>
          <label htmlFor="queue-q" className="sr-only">
            Search by title or reference
          </label>
          <Input
            id="queue-q"
            name="q"
            type="search"
            defaultValue={q}
            key={q}
            maxLength={100}
            placeholder="Title or reference"
            autoComplete="off"
          />
        </div>
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" />
          Filter
        </Button>
      </form>

      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading listings" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <>
            <p className="text-sm text-muted" role="status">
              {state.data.total === 1 ? "1 listing" : `${state.data.total} listings`}
              {state.data.total_pages > 1 && ` · page ${state.data.page} of ${state.data.total_pages}`}
            </p>
            {state.data.items.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title={
                    filtered
                      ? "No listings match those filters"
                      : status === DEFAULT_STATUS
                        ? "No listings are waiting for review"
                        : `No listings are ${listingStatusLabels[status].toLowerCase()}`
                  }
                  action={
                    filtered ? (
                      <ButtonLink href={status === DEFAULT_STATUS ? "/admin/listings" : `/admin/listings?status=${status}`} variant="secondary">
                        Clear filters
                      </ButtonLink>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {state.data.items.map((item) => {
                  const badge = reviewKindBadge(item.review_kind);
                  const shownStatus = item.review_kind === "EDIT" && item.revision_status ? item.revision_status : item.status;
                  return (
                    <li key={item.id}>
                      <article className="group frame-brand relative rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
                          <Badge tone={listingStatusTone(shownStatus)}>{listingStatusLabels[shownStatus] ?? shownStatus}</Badge>
                          <Badge>{item.country.name}</Badge>
                          <span className="ml-auto text-sm text-muted">
                            {item.submitted_at ? `Submitted ${formatWhen(item.submitted_at)}` : `Updated ${formatWhen(item.updated_at)}`}
                          </span>
                        </div>
                        <h2 className="mt-3 font-sans text-lg font-semibold tracking-normal">
                          {/* The stretched link makes the whole row one target. */}
                          <Link
                            href={`/admin/listings/${item.id}`}
                            className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                          >
                            {item.title || "Untitled listing"}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-muted">Reference {item.reference}</p>
                        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink">
                          <span>
                            {item.advertiser.name}{" "}
                            <span className={item.advertiser.verified ? "text-success" : "text-muted"}>
                              ({item.advertiser.verified ? "Verified" : "Not verified"})
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 text-muted">
                            <Camera className="size-4" aria-hidden="true" />
                            {item.photo_count === 1 ? "1 photo" : `${item.photo_count} photos`}
                            {item.pending_photo_count > 0 && `, ${item.pending_photo_count} waiting for review`}
                          </span>
                        </p>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={hrefFor}
              label="Listing reviews"
              className="mt-8"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/listings`: the review queue of new listings and changes to public ones. */
export function ListingQueue({ countries }: { countries: Option[] }) {
  return <AdminGate>{() => <Queue countries={countries} />}</AdminGate>;
}
