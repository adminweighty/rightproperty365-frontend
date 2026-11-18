"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useSavedListings } from "@/components/listings/saved-listings-provider";
import { ListingMedia } from "@/components/listings/listing-media";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import type { ApiFailure } from "@/lib/api/http";
import { listSavedListings, unsaveListing, type SavedListing } from "@/lib/api/saved-listings";
import { cn } from "@/lib/cn";
import { formatMoney, pricePeriodLabel } from "@/lib/format";
import { pageFrom } from "@/lib/request-filters";
import { saveFailureMessage, savedCountText, savedPageHref } from "@/lib/saved-listings";

type Labels = Record<string, string>;

/** The loading state, also the page's Suspense fallback: rows the size of a saved property. */
export function SavedListingsSkeleton() {
  return <LoadingBlock label="Loading your saved properties" rows={3} />;
}

function placeOf(item: SavedListing): string {
  const { city, country } = item.listing;
  return [city?.label, country?.name].filter(Boolean).join(", ");
}

type ItemProps = {
  item: SavedListing;
  periods: Labels;
  busy: boolean;
  failure: ApiFailure | null;
  onRemove: (item: SavedListing) => void;
  /** 1-based position in the whole saved list, for the impression count. */
  rank: number;
};

/**
 * One saved property. Available: the photo and title link to the listing.
 * No longer available: greyed, with the API's label, and not a link
 * anywhere; it is kept so the person can still see what they saved.
 */
function SavedItem({ item, periods, busy, failure, onRemove, rank }: ItemProps) {
  const { listing } = item;
  const href = item.available && listing.slug ? `/listings/${listing.slug}` : null;
  const place = placeOf(item);
  const titleId = `saved-${item.listing_id}`;

  return (
    <article
      aria-labelledby={titleId}
      // Counted as a "saved" impression while it is public (src/lib/analytics); an unavailable listing is not.
      data-rp-impression={href ? "saved" : undefined}
      data-rp-listing={href ? item.listing_id : undefined}
      data-rp-rank={href ? rank : undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border sm:flex-row",
        href ? "border-line bg-surface shadow-xs" : "border-dashed border-line-strong bg-sunken",
      )}
    >
      <div className="sm:w-56 sm:shrink-0">
        {href ? (
          // The photo repeats the title link, so it is out of the tab order and hidden from screen readers.
          <Link href={href} tabIndex={-1} aria-hidden="true">
            <ListingMedia photo={listing.photo ?? undefined} alt="" sizes="(min-width: 640px) 224px, 100vw" className="aspect-[4/3] h-full" />
          </Link>
        ) : (
          <ListingMedia
            photo={listing.photo ?? undefined}
            alt=""
            sizes="(min-width: 640px) 224px, 100vw"
            className="aspect-[4/3] h-full opacity-70 grayscale"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {!item.available && <Badge tone="warning">{item.unavailable_label ?? "No longer listed"}</Badge>}
          <Badge>{listing.category.label}</Badge>
        </div>
        <h2 id={titleId} className="font-sans text-lg font-medium tracking-normal">
          {href ? (
            <Link href={href} className="text-primary-ink hover:underline">
              {listing.title}
            </Link>
          ) : (
            <span className="text-ink">{listing.title}</span>
          )}
        </h2>
        <p className="text-ink">
          <span className="font-semibold tabular-nums">{formatMoney(listing.price)}</span>
          {listing.price_period && (
            <>
              {" "}
              <span className="text-sm text-muted">{pricePeriodLabel(listing.price_period, periods)}</span>
            </>
          )}
        </p>
        {place && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {place}
          </p>
        )}
        {!item.available && (
          <p className="text-sm text-muted">
            This listing is no longer available. It is kept here for your reference, as it was when you last saw it.
          </p>
        )}

        {failure && <Alert title={saveFailureMessage(failure, { saving: false, title: listing.title })} traceId={failure.traceId} />}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
          <p className="text-sm text-subtle">
            Saved {formatWhen(item.saved_at)} · <span className="font-mono text-xs">{listing.reference}</span>
          </p>
          <Button variant="secondary" disabled={busy} aria-busy={busy} onClick={() => onRemove(item)}>
            {busy ? "Removing…" : "Remove"}
            <span className="sr-only"> {listing.title}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}

function List({ periods }: { periods: Labels }) {
  const router = useRouter();
  const page = pageFrom(useSearchParams().get("page"));
  const load = useCallback(() => listSavedListings({ page }), [page]);
  const { state, reload } = useApi(load);
  const { forget } = useSavedListings();
  const heading = useRef<HTMLHeadingElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; failure: ApiFailure } | null>(null);
  const [confirming, setConfirming] = useState<SavedListing | null>(null);
  const [announcement, setAnnouncement] = useState("");

  async function remove(item: SavedListing) {
    setRemoving(item.listing_id);
    setFailed(null);
    setAnnouncement("");
    const result = await unsaveListing(item.listing_id);
    setRemoving(null);
    if (!result.ok) {
      // In the dialog when it asked first, otherwise under the item.
      setFailed({ id: item.listing_id, failure: result.failure });
      return;
    }
    setConfirming(null);
    forget(item.listing_id);
    setAnnouncement(`Removed ${item.listing.title} from your saved properties.`);
    // The button that had focus is gone: start again from the page's heading, once a dialog has closed.
    requestAnimationFrame(() => heading.current?.focus());
    const lastOnPage = state.status === "ready" && state.data.items.length === 1;
    if (lastOnPage && page > 1) router.push(savedPageHref(page - 1));
    else reload();
  }

  // An unavailable listing cannot be saved again, so removing it asks first.
  const askOrRemove = (item: SavedListing) => (item.available ? remove(item) : setConfirming(item));

  return (
    <>
      <h1 ref={heading} tabIndex={-1} className="text-4xl outline-none">
        Saved properties
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Properties you saved while signed in. When a listing is sold, let or ends, it stays here for your reference
        but can no longer be opened.
      </p>

      <p role="status" className="mt-4 text-sm text-muted">
        {announcement || (state.status === "ready" && state.data.total > 0 ? savedCountText(state.data) : "")}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <SavedListingsSkeleton />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${page} of your saved properties`}
              action={
                <ButtonLink href={savedPageHref(1)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="You have not saved any properties yet"
              action={
                <ButtonLink href="/listings" variant="secondary">
                  Find a property
                </ButtonLink>
              }
            >
              Press the heart on any listing to keep it here.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item, index) => (
                <li key={item.listing_id}>
                  <SavedItem
                    item={item}
                    periods={periods}
                    busy={removing === item.listing_id}
                    failure={failed?.id === item.listing_id && confirming?.listing_id !== item.listing_id ? failed.failure : null}
                    onRemove={askOrRemove}
                    rank={(state.data.page - 1) * state.data.page_size + index + 1}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={savedPageHref}
              label="Saved properties"
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Remove this saved property?"
        confirmLabel="Yes, remove it"
        busyLabel="Removing…"
        cancelLabel="Keep it"
        busy={confirming !== null && removing === confirming.listing_id}
        error={
          confirming && failed?.id === confirming.listing_id
            ? saveFailureMessage(failed.failure, { saving: false, title: confirming.listing.title })
            : undefined
        }
        onConfirm={() => confirming && remove(confirming)}
        onCancel={() => {
          setConfirming(null);
          setFailed(null);
        }}
      >
        {confirming && (
          <p>
            {confirming.listing.title} is no longer listed, so you cannot save it again once it is removed.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}


/** `/account/saved`: the signed-in person's saved properties, read in the browser with the session cookie. */
export function SavedListings({ periods }: { periods: Labels }) {
  return <RequireAuth>{() => <List periods={periods} />}</RequireAuth>;
}
