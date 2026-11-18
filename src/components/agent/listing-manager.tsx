"use client";

import { BarChart3, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ListingPhotoImage } from "@/components/agent/listing-photo-image";
import { NoAccess, RequireAuth } from "@/components/auth/require-auth";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { listMyListings, type MyListing } from "@/lib/api/availability";
import { getDashboard } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import {
  archiveListing,
  deleteListing,
  getManagedListing,
  relistListing,
  submitListing,
  type ManagedListing,
} from "@/lib/api/manage-listings";
import { SHORT_STAY } from "@/lib/api/types";
import { formatMoney, pricePeriodLabel } from "@/lib/format";
import {
  confirmText,
  countByStatus,
  editLinkLabel,
  isListingStatus,
  listingActionButtons,
  listingManagerHref,
  listingStatusLabel,
  listingStatusLabels,
  listingStatusTone,
  pendingChangesBadge,
  statusTabs,
  type ActionButton,
} from "@/lib/listing-manage";
import { photoCounter } from "@/lib/listing-photos";
import { listingAnalyticsPath } from "@/components/analytics/agent-analytics";
import { profilePlace } from "@/lib/places";

/** The most pages read: 48 listings each. */
const MAX_PAGES = 5;
/** Rows per page of a tab. Each row reads its listing in full, for its actions and photo. */
const PAGE_SIZE = 12;
/** Full listings read at the same time. */
const PARALLEL = 4;

type Summaries = { items: MyListing[]; total: number };

/** Every listing the caller manages (up to MAX_PAGES pages), newest first. */
async function loadSummaries(): Promise<ApiResult<Summaries>> {
  const first = await listMyListings(1);
  if (!first.ok) return first;
  const items = [...first.data.items];
  for (let page = 2; page <= Math.min(first.data.total_pages, MAX_PAGES); page += 1) {
    const next = await listMyListings(page);
    if (!next.ok) return next;
    items.push(...next.data.items);
  }
  return { ok: true, status: 200, data: { items, total: first.data.total } };
}

type Detail = { status: "ready"; listing: ManagedListing } | { status: "error" };

/** Reads the given listings in full, a few at a time, reporting each as it arrives. */
function useDetails(ids: string[]) {
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    const queue = key ? key.split(",") : [];
    async function worker() {
      while (!cancelled && queue.length > 0) {
        const id = queue.shift()!;
        const result = await getManagedListing(id);
        if (cancelled) return;
        setDetails((current) => ({
          ...current,
          [id]: result.ok ? { status: "ready", listing: result.data.listing } : { status: "error" },
        }));
      }
    }
    for (let i = 0; i < PARALLEL; i += 1) void worker();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const replace = useCallback(
    (listing: ManagedListing) => setDetails((current) => ({ ...current, [listing.id]: { status: "ready", listing } })),
    [],
  );
  return { details, replace };
}

type Pending = { listing: ManagedListing; button: ActionButton } | null;

function Row({
  summary,
  detail,
  periods,
  onAction,
}: {
  summary: MyListing;
  detail: Detail | undefined;
  periods: Record<string, string>;
  onAction: (listing: ManagedListing, button: ActionButton) => void;
}) {
  const listing = detail?.status === "ready" ? detail.listing : null;
  const status = listing?.status ?? summary.status;
  const pending = pendingChangesBadge(listing?.pending_changes);
  const isStay = summary.category.code === SHORT_STAY;
  const place = profilePlace(summary);
  const title = (listing?.content.title || summary.title || "").trim() || "Untitled listing";
  const hasPrice = Number(summary.price.amount) > 0;
  // In the list, "Submit" is offered only once the listing is complete; the editor says what is missing.
  const buttons = listing
    ? listingActionButtons({
        actions: listing.actions,
        ready: listing.completeness.ready,
        publishedWithChanges: listing.status === "PUBLISHED" && listing.pending_changes !== null,
      }).filter((button) => !button.disabledReason)
    : [];
  const cover = listing?.photos[0];

  return (
    <Card className="flex flex-col gap-4 sm:flex-row">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md sm:w-44">
        {cover ? (
          <ListingPhotoImage
            photo={cover}
            size="small"
            listingPublic={listing.public}
            alt={cover.alt}
            className="size-full"
          />
        ) : (
          <span
            className="flex size-full items-center justify-center bg-sunken text-sm text-subtle"
            aria-busy={detail === undefined || undefined}
          >
            {detail === undefined ? "" : "No photo yet"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={listingStatusTone(status)}>{listingStatusLabel(status, listing?.status_label)}</Badge>
          {pending && <Badge tone={pending.tone}>{pending.text}</Badge>}
          <Badge>{summary.category.label}</Badge>
          {summary.property_type.label && <Badge>{summary.property_type.label}</Badge>}
        </div>
        <h2 className="mt-2 font-sans text-lg font-medium tracking-normal">
          <Link href={`/agent/listings/${summary.id}`} className="text-ink hover:underline">
            {title}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-muted">
          {[place, `Reference ${summary.reference}`, listing && photoCounter(listing.photos.length, listing.photo_limit).text]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-2 text-ink">
          {hasPrice ? (
            <>
              <span className="font-semibold tabular-nums">{formatMoney(summary.price)}</span>
              {summary.price_period && (
                <span className="text-sm text-muted"> {pricePeriodLabel(summary.price_period, periods)}</span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">No price yet</span>
          )}
        </p>
        {isStay && (
          <p className="mt-2 text-sm text-muted">
            {summary.availability_updated_at
              ? `Calendar updated ${formatWhen(summary.availability_updated_at)}`
              : "Calendar not updated yet: every night shows as available"}
          </p>
        )}
        {listing && !listing.completeness.ready && listing.actions.includes("submit") && (
          <p className="mt-2 text-sm text-warning">
            {listing.completeness.missing.length === 1
              ? "1 thing is still needed before it can be submitted."
              : `${listing.completeness.missing.length} things are still needed before it can be submitted.`}
          </p>
        )}
        {detail?.status === "error" && (
          <p className="mt-2 text-sm text-muted">The actions for this listing could not be loaded. Open it to see them.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/agent/listings/${summary.id}`} variant={buttons.length ? "secondary" : "primary"} size="md">
            {editLinkLabel(listing?.actions)}
            <span className="sr-only"> {title}</span>
          </ButtonLink>
          {listing &&
            buttons.map((button) => (
              <Button
                key={button.action}
                variant={button.variant === "primary" ? "primary" : button.variant === "danger" ? "danger" : "secondary"}
                onClick={() => onAction(listing, button)}
              >
                {button.label}
                <span className="sr-only"> {title}</span>
              </Button>
            ))}
          {status === "PUBLISHED" && (
            <ButtonLink href={`/listings/${summary.slug}`} variant="ghost">
              See it as visitors do
              <span className="sr-only"> {title}</span>
            </ButtonLink>
          )}
          {status !== "DRAFT" && (
            <ButtonLink href={listingAnalyticsPath(summary.id)} variant="ghost">
              <BarChart3 className="size-4" aria-hidden="true" />
              Analytics
              <span className="sr-only"> of {title}</span>
            </ButtonLink>
          )}
          {isStay && (
            <ButtonLink href={`/agent/listings/${summary.id}/availability`} variant="ghost">
              <CalendarDays className="size-4" aria-hidden="true" />
              Manage availability
              <span className="sr-only"> of {title}</span>
            </ButtonLink>
          )}
        </div>
      </div>
    </Card>
  );
}

const emptyText: Record<string, string> = {
  "": "You have no listings yet.",
  DRAFT: "No drafts. A new listing starts here until it is submitted for review.",
  CHANGES_REQUESTED: "No listings are waiting for your changes.",
  PENDING_REVIEW: "No listings are waiting for review.",
  PUBLISHED: "No listings are public at the moment.",
  ARCHIVED: "No archived listings.",
};

function Manager({ periods }: { periods: Record<string, string> }) {
  const params = useSearchParams();
  const requested = params.get("status");
  const status = isListingStatus(requested) ? requested : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const { state, reload } = useApi(loadSummaries);
  const dashboard = useApi(getDashboard);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");

  const items = state.status === "ready" ? state.data.items : (state.status === "loading" ? state.previous?.items : undefined) ?? [];
  const shown = status ? items.filter((item) => item.status === status) : items;
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const { details, replace } = useDetails(
    state.status === "ready" ? pageItems.map((item) => item.id) : [],
  );

  const canCreate = dashboard.state.status === "ready" && dashboard.state.data.capabilities.manages_listings;

  if (state.status === "error" && state.failure.status === 403) return <NoAccess />;

  async function run(listing: ManagedListing, button: ActionButton) {
    setBusy(true);
    setActionError(undefined);
    const title = listing.content.title || listing.reference;
    const calls = { submit: submitListing, archive: archiveListing, relist: relistListing, delete: deleteListing };
    const result = await calls[button.action](listing.id);
    setBusy(false);
    if (!result.ok) {
      const message =
        result.failure.code === "LISTING_INCOMPLETE"
          ? "This listing is not complete yet. Open it to see what is still needed."
          : result.failure.message;
      if (button.confirm) setActionError(message);
      else setAnnouncement(`${title}: ${message}`);
      return;
    }
    setPending(null);
    const done = { submit: "was sent for review", archive: "was archived", relist: "was relisted", delete: "was deleted" };
    setAnnouncement(`${title} ${done[button.action]}.`);
    if (result.data) replace(result.data.listing);
    // Read again: the list (and so every row of this page) reflects the new status.
    reload();
  }

  const tabs = statusTabs(countByStatus(items), state.status === "ready" ? state.data.items.length : items.length);
  const dialog = pending ? confirmText(pending.button.action, pending.listing.published_at !== null) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Your listings</h1>
          <p className="mt-2 text-muted">
            The listings you or your organisation manage, newest first.{" "}
            <Link href="/agent/requests" className="font-medium text-primary-ink hover:underline">
              Request inbox
            </Link>
            {" · "}
            <Link href="/agent/analytics" className="font-medium text-primary-ink hover:underline">
              Analytics
            </Link>
          </p>
        </div>
        {canCreate && (
          <ButtonLink href="/agent/listings/new" size="lg">
            <Plus className="size-4" aria-hidden="true" />
            Add a listing
          </ButtonLink>
        )}
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
        A new listing is a draft that only you and your team see. When you submit it, our review team checks it before
        it is public. Changes to a public listing are checked the same way; visitors see the approved version until then.
      </p>

      <div className="mt-8">
        <ChipNav
          label="Listings by status"
          items={tabs.map((tab) => ({
            key: tab.status || "all",
            href: listingManagerHref(tab.status),
            label: tab.label,
            count: state.status === "ready" ? tab.count : undefined,
            current: tab.status === status,
          }))}
        />
      </div>
      {status === "CHANGES_REQUESTED" && (
        <p className="mt-3 text-sm text-muted">
          Changes asked for on a listing that is already public are shown on that listing under Published.
        </p>
      )}

      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm font-medium text-ink">
        {announcement}
      </p>

      <div className="mt-2">
        {state.status === "loading" && items.length === 0 && <LoadingBlock label="Loading your listings" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status !== "error" && (state.status === "ready" || items.length > 0) && (
          <>
            {shown.length === 0 ? (
              <EmptyState
                title={emptyText[status] ?? `No listings are ${listingStatusLabels[status]?.toLowerCase() ?? "here"}.`}
                action={
                  canCreate && !status ? (
                    <ButtonLink href="/agent/listings/new" variant="secondary">
                      Add a listing
                    </ButtonLink>
                  ) : status ? (
                    <ButtonLink href="/agent/listings" variant="secondary">
                      See all listings
                    </ButtonLink>
                  ) : undefined
                }
              >
                {!status && !canCreate && "When a listing is created for you or your organisation, it appears here."}
              </EmptyState>
            ) : page > totalPages ? (
              <EmptyState
                title={`There is no page ${page} of these listings`}
                action={
                  <ButtonLink href={listingManagerHref(status)} variant="secondary">
                    Go to page 1
                  </ButtonLink>
                }
              />
            ) : (
              <>
                <p className="text-sm text-muted">
                  {shown.length === 1 ? "1 listing" : `${shown.length} listings`}
                  {totalPages > 1 && ` · page ${page} of ${totalPages}`}
                  {state.status === "ready" && state.data.items.length < state.data.total &&
                    ` · showing the newest ${state.data.items.length} of ${state.data.total}`}
                </p>
                <ul className="mt-4 space-y-4">
                  {pageItems.map((item) => (
                    <li key={item.id}>
                      <Row
                        summary={item}
                        detail={details[item.id]}
                        periods={periods}
                        onAction={(listing, button) => {
                          if (button.confirm) {
                            setActionError(undefined);
                            setPending({ listing, button });
                          } else {
                            void run(listing, button);
                          }
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  hrefFor={(value) => listingManagerHref(status, value)}
                  label="Your listings"
                  className="mt-8"
                />
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={dialog?.title ?? ""}
        confirmLabel={dialog?.confirm ?? ""}
        busyLabel="Working…"
        tone={pending?.button.action === "relist" ? "primary" : "danger"}
        busy={busy}
        error={actionError}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void run(pending.listing, pending.button)}
      >
        {pending && (
          <>
            <p className="font-medium text-ink">{pending.listing.content.title || pending.listing.reference}</p>
            <p className="mt-1">{dialog?.body}</p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

/**
 * "Your listings": the advertiser's listing manager. Tabs by status with
 * counts, each listing with its photo, status, pending changes and the
 * actions the API allows, and "Add a listing" for those who may create one.
 */
export function ListingManager(props: { periods: Record<string, string> }) {
  return <RequireAuth>{() => <Manager {...props} />}</RequireAuth>;
}
