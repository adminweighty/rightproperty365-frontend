"use client";

import { CalendarDays, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NoAccess, RequireAuth } from "@/components/auth/require-auth";
import { ListingMedia } from "@/components/listings/listing-media";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMyListings, type MyListing } from "@/lib/api/availability";
import type { ApiFailure } from "@/lib/api/http";
import { SHORT_STAY } from "@/lib/api/types";
import { formatMoney, pricePeriodLabel } from "@/lib/format";
import { legal } from "@/lib/legal";
import { guestCount, nightCount } from "@/lib/nights";
import { profilePlace } from "@/lib/places";

/** A listing's status is an enum of the API, not reference data, so its words are written here. */
export const listingStatusLabels: Record<string, string> = {
  PUBLISHED: "Published",
  EXPIRED: "Expired",
  DRAFT: "Draft",
  PAUSED: "Paused",
  SOLD: "Sold",
  LET: "Let",
  CLOSED: "Closed",
};

/** The most pages read: 48 listings each. */
const MAX_PAGES = 5;

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

type State =
  | { status: "loading" }
  | { status: "ready"; items: MyListing[]; total: number }
  | { status: "forbidden" }
  | { status: "error"; failure: ApiFailure };

async function loadListings(): Promise<State> {
  const first = await listMyListings(1);
  if (!first.ok) return first.failure.status === 403 ? { status: "forbidden" } : { status: "error", failure: first.failure };
  const items = [...first.data.items];
  for (let page = 2; page <= Math.min(first.data.total_pages, MAX_PAGES); page += 1) {
    const next = await listMyListings(page);
    if (!next.ok) return { status: "error", failure: next.failure };
    items.push(...next.data.items);
  }
  return { status: "ready", items, total: first.data.total };
}

type Props = {
  /** code -> label of the API's `price_periods` set ("per night"). */
  periods: Record<string, string>;
};

function Listings({ periods }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadListings().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The API decides who manages listings; it says 403 for everyone else.
  if (state.status === "forbidden") return <NoAccess />;

  return (
    <>
      <h1 className="text-4xl">Your listings</h1>
      <p className="mt-2 text-muted">
        The listings you or your organisation manage, newest first.{" "}
        <Link href="/agent/requests" className="font-medium text-primary-ink hover:underline">
          Request inbox
        </Link>
      </p>
      <div className="mt-6 flex items-start gap-3 rounded-md bg-info-soft p-4 text-sm leading-relaxed text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
        <p>
          Creating and editing listings is not available here yet. To add a listing or change one, email{" "}
          <a href={`mailto:${legal.emails.support}`} className="font-medium text-primary-ink underline underline-offset-2">
            {legal.emails.support}
          </a>
          . For a short stay you can manage the availability calendar, the shortest stay and the number of guests
          yourself.
        </p>
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading your listings" className="mt-8 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-sunken" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-8">
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
        <p className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center text-muted">
          You have no listings yet. When a listing is created for you or your organisation, it appears here.
        </p>
      )}

      {state.status === "ready" && state.items.length > 0 && (
        <>
          <p className="mt-8 text-sm text-muted" role="status">
            {state.total === 1 ? "1 listing" : `${state.total} listings`}
            {state.items.length < state.total && `, showing the newest ${state.items.length}`}
          </p>
          <ul className="mt-4 space-y-4">
            {state.items.map((listing) => {
              const isStay = listing.category.code === SHORT_STAY;
              const place = profilePlace(listing);
              const published = listing.status === "PUBLISHED";
              return (
                <li key={listing.id}>
                  <Card className="flex flex-col gap-4 sm:flex-row">
                    <ListingMedia
                      photo={listing.photo ?? undefined}
                      sizes="(min-width: 640px) 176px, 100vw"
                      className="aspect-[4/3] w-full shrink-0 rounded-md sm:w-44"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={published ? "success" : "neutral"}>
                          {listingStatusLabels[listing.status] ?? listing.status}
                        </Badge>
                        <Badge>{listing.category.label}</Badge>
                        <Badge>{listing.property_type.label}</Badge>
                      </div>
                      <h2 className="mt-2 font-sans text-lg font-medium tracking-normal">
                        {published ? (
                          <Link href={`/listings/${listing.slug}`} className="text-ink hover:underline">
                            {listing.title}
                          </Link>
                        ) : (
                          listing.title
                        )}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {[place, `Reference ${listing.reference}`].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2 text-ink">
                        <span className="font-semibold tabular-nums">{formatMoney(listing.price)}</span>
                        {listing.price_period && (
                          <span className="text-sm text-muted"> {pricePeriodLabel(listing.price_period, periods)}</span>
                        )}
                      </p>
                      {isStay && (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="text-sm text-muted">
                            Shortest stay <span className="font-medium text-ink">{nightCount(listing.min_nights ?? 1)}</span>
                            {listing.max_guests !== null && (
                              <>
                                {" · "}Sleeps up to <span className="font-medium text-ink">{guestCount(listing.max_guests)}</span>
                              </>
                            )}
                            {" · "}
                            {listing.availability_updated_at
                              ? `Calendar updated ${formatDay(listing.availability_updated_at)}`
                              : "Calendar not updated yet: every night shows as available"}
                          </p>
                          <ButtonLink
                            href={`/agent/listings/${listing.id}/availability`}
                            variant="secondary"
                            size="sm"
                            className="mt-3"
                          >
                            <CalendarDays className="size-4" aria-hidden="true" />
                            Manage availability
                            <span className="sr-only"> of {listing.title}</span>
                          </ButtonLink>
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * "Your listings": what the signed-in person or their organisation manages,
 * read from `GET /v1/me/listings`. Read-only, except that a short stay links
 * to its availability calendar.
 */
export function MyListings(props: Props) {
  return <RequireAuth>{() => <Listings {...props} />}</RequireAuth>;
}
