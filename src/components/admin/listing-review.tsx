"use client";

import { BedDouble, Bath, CheckCircle2, Ruler, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { NotAReviewer, reviewKindBadge } from "@/components/admin/listing-queue";
import { ListingPhotoImage } from "@/components/agent/listing-photo-image";
import { UsageMeterView } from "@/components/packages/usage-meter";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import {
  approveListing,
  getAdminListing,
  rejectListing,
  requestListingChanges,
  type AdminListing,
  type ListingContent,
  type ListingDecision,
} from "@/lib/api/manage-listings";
import type { EditorOption, ListingEditorLists } from "@/lib/api/server/listing-editor";
import { SHORT_STAY } from "@/lib/api/types";
import { formatArea, formatMoney, pricePeriodLabel } from "@/lib/format";
import {
  isLocationField,
  isVideoField,
  listingFieldLabels,
  locationPrecisionText,
  listingStatusLabel,
  listingStatusLabels,
  listingStatusTone,
  reviewReasonProblem,
  timelineText,
} from "@/lib/listing-manage";
import { formatCoordinates, openStreetMapHref } from "@/lib/map";
import { QUOTA_REACHED, quotaDetails, quotaReachedReviewerMessage } from "@/lib/packages";
import { joinPlaces } from "@/lib/places";
import { formatStart, isPlaceholderThumbnail, isYouTubeId, startText, thumbnailFor, watchHref, watchUrlFor } from "@/lib/youtube";

type Props = { listingId: string; lists: ListingEditorLists };

const labelIn = (options: EditorOption[], code: unknown) =>
  typeof code === "string" ? (options.find((option) => option.value === code)?.label ?? code) : "";

/** A field's value in words, for the preview and the before and after table. */
function describeValue(field: string, value: unknown, lists: ListingEditorLists, period?: string | null): string {
  if (value === null || value === undefined || value === "") return "Not set";
  switch (field) {
    case "price": {
      const price = value as { amount?: string | null; currency?: string | null };
      if (!price.amount) return "Not set";
      const money = formatMoney({ amount: price.amount, currency: price.currency ?? "" });
      return period ? `${money} ${pricePeriodLabel(period, Object.fromEntries(lists.periods.map((item) => [item.value, item.label])))}` : money;
    }
    case "features":
      return Array.isArray(value) && value.length > 0 ? value.map((code) => labelIn(lists.features, code)).join(", ") : "None";
    case "deal":
      return labelIn(lists.deals, value);
    case "category":
      return labelIn(lists.categories, value);
    case "property_type":
      return labelIn(lists.propertyTypes, value);
    case "price_period":
      return labelIn(lists.periods, value);
    case "country":
      return labelIn(lists.countries, value);
    case "city":
      return labelIn(lists.cities, value);
    case "suburb":
      return labelIn(lists.suburbs, value);
    case "floor_area":
    case "land_area":
      return typeof value === "number" ? formatArea(value) : String(value);
    case "youtube_start_seconds":
      return typeof value === "number" ? (formatStart(value) ?? "From the start") : String(value);
    case "min_nights":
      return typeof value === "number" ? `${value} ${value === 1 ? "night" : "nights"}` : String(value);
    case "latitude":
    case "longitude":
      return typeof value === "number" ? value.toFixed(6) : String(value);
    case "location_precision":
      return locationPrecisionText(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}

/**
 * A video tour for the reviewer: its poster, id, start time and a link to
 * watch it on YouTube, or "No video" when there is none. Nothing plays here.
 */
function ReviewVideo({ label, id, startSeconds }: { label: string; id: string | null | undefined; startSeconds: number | null | undefined }) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (!isYouTubeId(id)) {
    return (
      <div>
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-1 text-ink">No video</p>
      </div>
    );
  }
  const watch = watchHref(watchUrlFor(id), startSeconds);
  const starts = startText(startSeconds);
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-muted">{label}</p>
      {failedFor === id ? (
        <p className="mt-1 flex aspect-video items-center justify-center rounded-md border border-line bg-sunken p-4 text-center text-sm text-muted">
          The poster could not be shown. The video may be private, removed or not embeddable.
        </p>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, as on the listing page */}
          <img
            key={id}
            src={thumbnailFor(id)}
            alt={`Poster of the video ${id}`}
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              if (isPlaceholderThumbnail(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)) setFailedFor(id);
            }}
            onError={() => setFailedFor(id)}
            className="mt-1 aspect-video w-full rounded-md border border-line object-cover"
          />
        </>
      )}
      <p className="mt-1 text-sm text-ink">
        Video <span className="font-mono">{id}</span>
        {starts ? ` · ${starts}` : ""}
      </p>
      {watch && (
        <a
          href={watch}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
        >
          Watch on YouTube
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

/**
 * A pin for the reviewer: its coordinates, how visitors see it, and a link to
 * check the spot on OpenStreetMap in a new tab, or "Not on the map".
 */
function ReviewLocation({ label, content }: { label: string; content: ListingContent | null | undefined }) {
  const latitude = content?.latitude;
  const longitude = content?.longitude;
  const placed = typeof latitude === "number" && typeof longitude === "number";
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-muted">{label}</p>
      {placed ? (
        <>
          <p className="mt-1 font-mono text-sm text-ink">{formatCoordinates(latitude, longitude)}</p>
          <p className="text-sm text-ink">{locationPrecisionText(content?.location_precision)}</p>
          <a
            href={openStreetMapHref(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
          >
            Check it on OpenStreetMap
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      ) : (
        <p className="mt-1 text-ink">Not on the map</p>
      )}
    </div>
  );
}

/** The listing as visitors would see it once approved: the working copy and every photo. */
function Preview({ listing, content, lists }: { listing: AdminListing; content: ListingContent; lists: ListingEditorLists }) {
  const [cover, ...more] = listing.photos;
  const place = joinPlaces([
    labelIn(lists.suburbs, content.suburb),
    labelIn(lists.cities, content.city) || content.city_name,
    content.region_name,
    labelIn(lists.countries, content.country),
  ]);
  const isStay = content.category === SHORT_STAY;
  return (
    <div>
      {cover ? (
        <ListingPhotoImage photo={cover} size="large" listingPublic={listing.public} alt={cover.alt} className="aspect-[16/9] w-full rounded-lg" />
      ) : (
        <p className="flex aspect-[16/9] items-center justify-center rounded-lg bg-sunken text-sm text-subtle">No photo yet</p>
      )}
      {more.length > 0 && (
        <ul aria-label="More photos" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {more.map((photo) => (
            <li key={photo.id}>
              <ListingPhotoImage photo={photo} size="small" listingPublic={listing.public} alt={photo.alt} className="aspect-[4/3] rounded-md" />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {content.deal && <Badge tone="primary">{labelIn(lists.deals, content.deal)}</Badge>}
        {content.category && <Badge>{labelIn(lists.categories, content.category)}</Badge>}
        {content.property_type && <Badge>{labelIn(lists.propertyTypes, content.property_type)}</Badge>}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-ink">{describeValue("price", content.price, lists, content.price_period)}</p>
      <h3 className="mt-1 text-2xl">{content.title || "Untitled listing"}</h3>
      {place && <p className="mt-1 text-muted">{place}</p>}
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-ink">
        {isStay && content.max_guests !== null && <Fact icon={<Users className="size-4" />}>Sleeps {content.max_guests}</Fact>}
        {content.bedrooms !== null && <Fact icon={<BedDouble className="size-4" />}>{content.bedrooms} bedrooms</Fact>}
        {content.bathrooms !== null && <Fact icon={<Bath className="size-4" />}>{content.bathrooms} bathrooms</Fact>}
        {content.floor_area !== null && <Fact icon={<Ruler className="size-4" />}>{formatArea(content.floor_area)} floor</Fact>}
        {content.land_area !== null && <Fact icon={<Ruler className="size-4" />}>{formatArea(content.land_area)} land</Fact>}
        {isStay && content.min_nights !== null && <span>{describeValue("min_nights", content.min_nights, lists)} minimum</span>}
      </p>
      <p className="mt-2 text-sm text-muted">
        {typeof content.latitude === "number" && typeof content.longitude === "number"
          ? `On the map at ${formatCoordinates(content.latitude, content.longitude)}, shown as: ${locationPrecisionText(content.location_precision).toLowerCase()}.`
          : "Not on the map."}
      </p>
      {content.summary && <p className="mt-4 font-medium text-ink">{content.summary}</p>}
      <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-ink">{content.description || "No description yet."}</p>
      {content.features.length > 0 && (
        <>
          <h4 className="mt-5 font-sans text-base font-semibold tracking-normal">Features</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {content.features.map((code) => (
              <li key={code}>
                <Badge>{labelIn(lists.features, code)}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
      {isYouTubeId(content.youtube_video_id) && (
        <>
          <h4 className="mt-5 font-sans text-base font-semibold tracking-normal">Video tour</h4>
          <div className="mt-2 max-w-sm">
            <ReviewVideo label="Shown as a poster; visitors press play" id={content.youtube_video_id} startSeconds={content.youtube_start_seconds} />
          </div>
        </>
      )}
      {listing.photos.length > 0 && (
        <>
          <h4 className="mt-5 font-sans text-base font-semibold tracking-normal">Photo descriptions</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
            {listing.photos.map((photo) => (
              <li key={photo.id}>
                {photo.alt || <span className="text-danger">Not described</span>}
                {photo.status === "PENDING_REVIEW" && <Badge tone="info" className="ml-2">Waiting for review</Badge>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

type Decision = { kind: ListingDecision } | null;

const decisionWords: Record<ListingDecision, { button: string; title: string; body: string; confirm: string; busy: string; done: string }> = {
  approve: {
    button: "Approve",
    title: "Approve this listing?",
    body: "",
    confirm: "Yes, approve it",
    busy: "Approving…",
    done: "Approved.",
  },
  request_changes: {
    button: "Request changes",
    title: "Ask the advertiser for changes",
    body: "Say what needs to change. The advertiser sees this on the listing and it is emailed to them.",
    confirm: "Send the request",
    busy: "Sending…",
    done: "Changes were requested. The advertiser has been emailed the reason.",
  },
  reject: {
    button: "Reject",
    title: "Reject this listing?",
    body: "",
    confirm: "Yes, reject it",
    busy: "Rejecting…",
    done: "Rejected. The advertiser has been emailed the reason.",
  },
};

function Review({ listingId, lists }: Props) {
  const load = useCallback(() => getAdminListing(listingId), [listingId]);
  const { state, reload, replace } = useApi(load);
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  if (state.status === "loading") return <LoadingBlock label="Loading the listing" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 403) return <NotAReviewer />;
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that listing</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">It may have been deleted, or it is in a country you do not review.</p>
          <ButtonLink href="/admin/listings" variant="secondary" className="mt-6">
            Back to listing reviews
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const listing = state.data.listing;
  const isEdit = listing.review_kind === "EDIT";
  const kindBadge = reviewKindBadge(listing.review_kind);
  const shownStatus = isEdit && listing.pending_changes ? listing.pending_changes.status : listing.status;
  const newPhotos = listing.photos.filter((photo) => photo.status === "PENDING_REVIEW");
  const words = decision ? decisionWords[decision.kind] : null;
  const needsReason = decision?.kind === "request_changes" || decision?.kind === "reject";

  const approveBody = isEdit
    ? "The changes and new photos become public at once. The listing keeps its publication dates. The advertiser is emailed."
    : "The listing is published for 90 days from now and every photo becomes public. The advertiser is emailed.";
  const rejectBody = isEdit
    ? "The changes and their new photos are dropped. The approved version stays public. The advertiser sees your reason and it is emailed to them."
    : "A rejected listing cannot be changed or published again; the advertiser can only delete it. They see your reason and it is emailed to them.";

  async function decide() {
    if (!decision) return;
    if (needsReason) {
      const problem = reviewReasonProblem(reason);
      setReasonError(problem ?? undefined);
      if (problem) {
        document.getElementById("decision-reason")?.focus();
        return;
      }
    }
    setBusy(true);
    setFailure(undefined);
    const text = reason.trim();
    const result =
      decision.kind === "approve"
        ? await approveListing(listingId)
        : decision.kind === "request_changes"
          ? await requestListingChanges(listingId, text)
          : await rejectListing(listingId, text);
    setBusy(false);
    if (!result.ok) {
      if (result.failure.code === QUOTA_REACHED) {
        // API 0.37.0: the advertiser's package is full. Nothing changed; the listing still waits for review.
        setDecision(null);
        const details = quotaDetails(result.failure.body);
        setOutcome({
          tone: "danger",
          text: quotaReachedReviewerMessage({
            ...details,
            accountName: details.accountName ?? listing.advertiser.display?.name ?? listing.advertiser.name,
          }),
        });
        reload();
        return;
      }
      if (result.failure.status === 409) {
        setDecision(null);
        setOutcome({ tone: "warning", text: `${result.failure.message} The listing has been loaded again.` });
        reload();
        return;
      }
      if (result.failure.code === "SELF_REVIEW_FORBIDDEN") {
        // API 0.23.0: a reviewer never decides a listing of their own organisation, or one they sell or submitted.
        setFailure("You can't review a listing from your own organisation. Another reviewer must decide it.");
        return;
      }
      if (result.failure.fields?.reason) {
        setReasonError(result.failure.fields.reason);
        return;
      }
      setFailure(result.failure.message);
      return;
    }
    setOutcome({ tone: "success", text: decisionWords[decision.kind].done });
    setDecision(null);
    setReason("");
    replace({ listing: result.data.listing });
  }

  return (
    <>
      <BackLink href="/admin/listings">Listing reviews</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {kindBadge && <Badge tone={kindBadge.tone}>{kindBadge.text}</Badge>}
        <Badge tone={listingStatusTone(shownStatus)}>
          {isEdit && listing.pending_changes ? listing.pending_changes.status_label : listingStatusLabel(listing.status, listing.status_label)}
        </Badge>
        <span className="text-sm text-muted">Reference {listing.reference}</span>
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">{listing.content.title || "Untitled listing"}</h1>
      <p className="mt-2 text-muted">
        {listing.advertiser.display?.name ?? listing.advertiser.name}{" "}
        <span className={(listing.advertiser.display?.verified ?? listing.advertiser.verified) ? "text-success" : ""}>
          ({(listing.advertiser.display?.verified ?? listing.advertiser.verified) ? "Verified" : "Not verified"})
        </span>
        {listing.review.submitted_at && <> · Submitted {formatWhen(listing.review.submitted_at)}</>}
      </p>

      {outcome && <Alert tone={outcome.tone} title={outcome.text} className="mt-6" />}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <aside aria-label="Decision" className="lg:order-2">
          <Card className="lg:sticky lg:top-24">
            <h2 className="font-sans text-lg font-semibold tracking-normal">Decision</h2>
            {!listing.completeness.ready && (
              <div className="mt-2">
                <p className="text-sm font-medium text-warning">Not complete:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                  {listing.completeness.missing.map((item) => (
                    <li key={`${item.field}-${item.message}`}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {listing.package_usage && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-semibold text-ink">The advertiser&apos;s package</p>
                <UsageMeterView usage={listing.package_usage} audience="admin" headingLevel={3} className="mt-2" />
                {listing.owner.type === "organisation" && listing.owner.organisation_id && (
                  <p className="mt-2 text-sm">
                    <Link
                      href={`/admin/packages/organisations/${listing.owner.organisation_id}`}
                      className="font-medium text-primary-ink hover:underline"
                    >
                      Their package and history
                    </Link>
                  </p>
                )}
              </div>
            )}
            {listing.quota_warning && listing.decisions.includes("approve") && (
              <p className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-ink">
                <span className="block font-medium text-warning">Package full</span>
                {listing.quota_warning}
              </p>
            )}
            {listing.decisions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing is waiting for a decision on this listing.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {(["approve", "request_changes", "reject"] as const)
                  .filter((kind) => listing.decisions.includes(kind))
                  .map((kind) => (
                    <Button
                      key={kind}
                      variant={kind === "approve" ? "primary" : kind === "reject" ? "danger" : "secondary"}
                      size={kind === "approve" ? "lg" : "md"}
                      onClick={() => {
                        setOutcome(null);
                        setFailure(undefined);
                        setReasonError(undefined);
                        setDecision({ kind });
                      }}
                    >
                      {kind === "approve" && <CheckCircle2 className="size-4" aria-hidden="true" />}
                      {decisionWords[kind].button}
                    </Button>
                  ))}
              </div>
            )}
          </Card>
        </aside>

        <div className="min-w-0 space-y-8 lg:order-1">
          {isEdit && (
            <section aria-labelledby="review-changes">
              <Card>
                <h2 id="review-changes" className="text-2xl">
                  What changes
                </h2>
                <p className="mt-1 text-sm text-muted">Visitors see the column &ldquo;Public now&rdquo; until you approve.</p>
                {listing.changes.length === 0 ? (
                  <p className="mt-4 text-ink">No field changes. Only the photos changed.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <caption className="sr-only">Each changed field, public now and proposed</caption>
                      <thead>
                        <tr className="border-b border-line text-muted">
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Field
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            Public now
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Proposed
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {listing.changes.map((change) => (
                          <tr key={change.field} className="border-b border-line align-top">
                            <th scope="row" className="py-3 pr-4 font-medium text-ink">
                              {listingFieldLabels[change.field] ?? change.field}
                            </th>
                            <td className="whitespace-pre-line py-3 pr-4 text-muted">
                              <del className="no-underline">
                                <span className="sr-only">Public now: </span>
                                {describeValue(change.field, change.before, lists, listing.live?.price_period)}
                              </del>
                            </td>
                            <td className="whitespace-pre-line py-3 font-medium text-ink">
                              <ins className="no-underline">
                                <span className="sr-only">Proposed: </span>
                                {describeValue(change.field, change.after, lists, listing.content.price_period)}
                              </ins>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {listing.changes.some((change) => isVideoField(change.field)) && (
                  <div className="mt-6">
                    <h3 className="font-sans text-base font-semibold tracking-normal">Video tour</h3>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <ReviewVideo label="Public now" id={listing.live?.youtube_video_id} startSeconds={listing.live?.youtube_start_seconds} />
                      <ReviewVideo label="Proposed" id={listing.content.youtube_video_id} startSeconds={listing.content.youtube_start_seconds} />
                    </div>
                  </div>
                )}
                {listing.changes.some((change) => isLocationField(change.field)) && (
                  <div className="mt-6">
                    <h3 className="font-sans text-base font-semibold tracking-normal">Location on the map</h3>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <ReviewLocation label="Public now" content={listing.live} />
                      <ReviewLocation label="Proposed" content={listing.content} />
                    </div>
                  </div>
                )}
                <p className="mt-4 text-sm text-ink">
                  {listing.photo_changes.added === 1 ? "1 new photo" : `${listing.photo_changes.added} new photos`} ·{" "}
                  {listing.photo_changes.alt_changed === 1
                    ? "1 photo description changed"
                    : `${listing.photo_changes.alt_changed} photo descriptions changed`}
                </p>
                {newPhotos.length > 0 && (
                  <ul aria-label="New photos" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {newPhotos.map((photo) => (
                      <li key={photo.id}>
                        <ListingPhotoImage photo={photo} size="small" listingPublic={listing.public} alt={photo.alt} className="aspect-[4/3] rounded-md" />
                        <p className="mt-1 text-xs text-muted">{photo.alt || "Not described"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          )}

          <section aria-labelledby="review-preview">
            <Card>
              <h2 id="review-preview" className="text-2xl">
                {isEdit ? "How it will look after approval" : "How it will look"}
              </h2>
              <div className="mt-4">
                <Preview listing={listing} content={listing.content} lists={lists} />
              </div>
            </Card>
          </section>

          {listing.timeline.length > 0 && (
            <section aria-labelledby="review-history">
              <Card>
                <h2 id="review-history" className="text-2xl">
                  History
                </h2>
                <ol className="mt-4 space-y-3">
                  {[...listing.timeline].reverse().map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="border-l-2 border-line pl-4">
                      <p className="font-medium text-ink">
                        {timelineText(entry)}
                        {entry.to_status && (
                          <span className="font-normal text-muted"> · {listingStatusLabels[entry.to_status] ?? entry.to_status}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {entry.actor === "REVIEWER" ? "Reviewer" : entry.actor === "SYSTEM" ? "System" : "Advertiser"} · <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
                      </p>
                      {entry.reason && <p className="mt-1 whitespace-pre-line text-sm text-ink">{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={decision !== null}
        title={words?.title ?? ""}
        confirmLabel={words?.confirm ?? ""}
        busyLabel={words?.busy}
        tone={decision?.kind === "approve" ? "primary" : "danger"}
        busy={busy}
        error={failure}
        onCancel={() => setDecision(null)}
        onConfirm={() => void decide()}
      >
        {decision?.kind === "approve" && <p>{approveBody}</p>}
        {decision?.kind === "approve" && listing.quota_warning && <p className="mt-2 font-medium text-warning">{listing.quota_warning}</p>}
        {decision?.kind === "reject" && <p>{rejectBody}</p>}
        {decision?.kind === "request_changes" && <p>{words?.body}</p>}
        {needsReason && (
          <Field
            id="decision-reason"
            label="Reason"
            hint="Plain text, up to 1000 characters."
            error={reasonError}
            className="mt-4 text-left"
          >
            <Textarea
              id="decision-reason"
              rows={5}
              maxLength={1000}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (reasonError) setReasonError(undefined);
              }}
              aria-invalid={Boolean(reasonError)}
              aria-required="true"
              aria-describedby={fieldDescribedBy("decision-reason", { hint: "x", error: reasonError })}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/admin/listings/<id>`: one listing (or its changes) for a decision. */
export function ListingReview(props: Props) {
  return <AdminGate>{() => <Review {...props} />}</AdminGate>;
}
