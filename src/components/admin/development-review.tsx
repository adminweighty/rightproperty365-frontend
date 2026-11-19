"use client";

import { Check, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { NotADevelopmentReviewer } from "@/components/admin/development-queue";
import { toManagedPhoto } from "@/components/agent/developments/development-photos";
import { ListingPhotoImage } from "@/components/agent/listing-photo-image";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { approveDevelopment, getAdminDevelopment, rejectDevelopment } from "@/lib/api/developments";
import {
  availabilityText,
  bedroomsText,
  completionText,
  developmentPath,
  developmentStatusLabel,
  developmentStatusTone,
  moderationStatusLabel,
  moderationStatusTone,
  priceRangeText,
  sizeRangeText,
  type ManagedDevelopment,
} from "@/lib/developments";
import { formatCoordinates, openStreetMapHref } from "@/lib/map";
import { fullPlace } from "@/lib/places";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="font-sans text-lg font-semibold tracking-normal">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const none = <p className="text-sm text-muted">None given.</p>;

function Details({ development }: { development: ManagedDevelopment }) {
  const { location } = development;
  const coordinates = location.coordinates;
  const photos = [...development.photos].sort((a, b) => a.position - b.position);
  const isPublic = development.moderation_status === "PUBLISHED";
  return (
    <div className="space-y-5">
      <Block title="Summary and description">
        <p className="font-medium text-ink">{development.summary || "No summary."}</p>
        <p className="mt-2 max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-muted">
          {development.description || "No description."}
        </p>
      </Block>
      <Block title="Location">
        <p className="text-ink">{fullPlace(location) || development.city_name || development.market.name}</p>
        {coordinates ? (
          <p className="mt-1 text-sm text-muted">
            {formatCoordinates(coordinates.latitude, coordinates.longitude)} ·{" "}
            {coordinates.precision === "APPROXIMATE" ? "Shown publicly as an area of about 1 km" : "Shown publicly as an exact pin"} ·{" "}
            <a href={openStreetMapHref(coordinates.latitude, coordinates.longitude)} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-ink hover:underline">
              Open in OpenStreetMap<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">No position on the map.</p>
        )}
      </Block>
      <Block title="Status and completion">
        <p className="text-ink">
          {developmentStatusLabel(development.status)}
          {completionText(development.completion, development.status.code) && ` · ${completionText(development.completion, development.status.code)}`}
        </p>
      </Block>
      <Block title={`Photos (${photos.length})`}>
        {photos.length === 0 ? (
          none
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((photo, index) => {
              const managed = toManagedPhoto(photo);
              return (
                <li key={photo.id}>
                  <ListingPhotoImage photo={managed} size="small" listingPublic={isPublic} alt={photo.alt || `Photo ${index + 1}, not described`} className="aspect-[4/3] w-full rounded-md" />
                  <p className={`mt-1 break-words text-xs ${photo.alt ? "text-muted" : "text-danger"}`}>{photo.alt || "No description"}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Block>
      <Block title="Amenities">
        {development.amenities.length === 0 ? (
          none
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {development.amenities.map((amenity) => (
              <li key={amenity.code} className="flex items-center gap-2 text-sm text-ink">
                <Check className="size-4 text-primary-ink" aria-hidden="true" />
                {amenity.label}
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Investment highlights">
        {development.investment_highlights.items.length === 0 ? (
          none
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Shown with: {development.investment_highlights.disclaimer}
            </p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {development.investment_highlights.items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-md border border-line p-3">
                  <dt className="text-sm text-muted">{item.label}</dt>
                  <dd className="break-words font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Block>
      <Block title="Video">
        {development.video ? (
          <a href={development.video.watch_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
            Watch on YouTube
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          none
        )}
      </Block>
      <Block title="Phases and unit types">
        {development.phases.length === 0 ? (
          none
        ) : (
          <ol className="space-y-4">
            {development.phases.map((phase) => (
              <li key={phase.id}>
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {phase.name}
                  <Badge tone={developmentStatusTone(phase.status.code)}>{developmentStatusLabel(phase.status)}</Badge>
                  <span className="text-sm font-normal text-muted">{completionText(phase.completion, phase.status.code)}</span>
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {phase.unit_types.map((unit) => (
                    <li key={unit.id} className="break-words text-ink">
                      {unit.name}: <span className="font-medium">{priceRangeText(unit.price)}</span>
                      <span className="text-muted">
                        {[bedroomsText(unit.bedrooms), sizeRangeText(unit.size_m2), availabilityText(unit)].filter(Boolean).map((part) => ` · ${part}`)}
                      </span>
                    </li>
                  ))}
                  {phase.unit_types.length === 0 && <li className="text-muted">No unit types.</li>}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Block>
      <Block title="Linked listings">
        {development.linked_listings.length === 0 ? (
          none
        ) : (
          <ul className="space-y-1 text-sm">
            {development.linked_listings.map((item) => (
              <li key={item.listing_id} className="break-words text-ink">
                {item.title} <span className="text-muted">({item.reference}, {item.public ? "public" : "not public"})</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function Review({ developmentId }: { developmentId: string }) {
  const load = useCallback(() => getAdminDevelopment(developmentId), [developmentId]);
  const { state, reload, replace } = useApi(load);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);

  if (state.status === "loading") return <LoadingBlock label="Loading the project" rows={4} />;
  if (state.status === "error") {
    if (state.failure.status === 403) return <NotADevelopmentReviewer />;
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const development = state.data.development;
  const waiting = development.moderation_status === "PENDING_REVIEW";

  function askReject() {
    const text = reason.trim();
    const problem = text === "" ? "Write the reason. The developer sees it on their project." : text.length > 1000 ? `Keep the reason to 1000 characters or fewer (it has ${text.length}).` : null;
    setReasonError(problem ?? undefined);
    if (problem) {
      document.getElementById("development-reason")?.focus();
      return;
    }
    setError(undefined);
    setConfirm("reject");
  }

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setError(undefined);
    const result = kind === "approve" ? await approveDevelopment(development.id) : await rejectDevelopment(development.id, reason.trim());
    setBusy(null);
    if (result.ok) {
      replace({ development: result.data.development });
      setConfirm(null);
      setReason("");
      setDone(kind === "approve" ? "Approved. The project and its photos are public now." : "Rejected. The developer sees your reason and can change the project and submit it again.");
      return;
    }
    const failure = result.failure;
    if (failure.fields?.reason) {
      setConfirm(null);
      setReasonError(failure.fields.reason);
      return;
    }
    setError(
      failure.code === "SELF_REVIEW_FORBIDDEN"
        ? "You cannot review this project: you belong to its organisation, or you created or submitted it. Another reviewer must decide."
        : failure.code === "DEVELOPMENT_STATE_CONFLICT"
          ? "This project is no longer waiting for review. It has been read again."
          : failure.message,
    );
    if (failure.code === "DEVELOPMENT_STATE_CONFLICT") {
      setConfirm(null);
      reload();
    }
  }

  return (
    <>
      <BackLink href="/admin/developments">Development reviews</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={moderationStatusTone(development.moderation_status)}>{moderationStatusLabel(development.moderation_status)}</Badge>
        <Badge>{development.market.name}</Badge>
      </div>
      <h1 className="mt-3 break-words text-3xl md:text-4xl">{development.name || "Untitled project"}</h1>
      <p className="mt-2 text-sm text-muted">
        By {development.developer.name} ({development.developer.verified ? "Verified" : "Not verified"})
        {development.submitted_at && ` · Submitted ${formatWhen(development.submitted_at)}`}
        {development.reviewed_at && ` · Last reviewed ${formatWhen(development.reviewed_at)}`}
      </p>
      {development.moderation_status === "PUBLISHED" && (
        <p className="mt-2">
          <Link href={developmentPath(development)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
            View the public page
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
      )}
      {done && <Alert tone="success" title={done} className="mt-6" />}
      {development.moderation_status === "REJECTED" && development.review_reason && (
        <Alert tone="danger" title="The reason given when it was rejected" className="mt-6">
          <p className="whitespace-pre-line">{development.review_reason}</p>
        </Alert>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <Details development={development} />
        </Card>
        <aside aria-labelledby="decision-heading">
          <Card className="lg:sticky lg:top-24">
            <h2 id="decision-heading" className="text-2xl">
              Decision
            </h2>
            {waiting ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Check that the text has no contact details, the photos are of the project and described, and the figures are
                  presented as the developer&rsquo;s own.
                </p>
                {error && <Alert title={error} className="mt-4" />}
                <Button className="mt-4 w-full" onClick={() => { setError(undefined); setConfirm("approve"); }} disabled={busy !== null}>
                  Approve and publish
                </Button>
                <div className="mt-6 border-t border-line pt-5">
                  <Field id="development-reason" label="Reason for rejecting" hint="Say what to change. The developer sees it." error={reasonError}>
                    <Textarea
                      id="development-reason"
                      rows={5}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        if (reasonError) setReasonError(undefined);
                      }}
                      aria-invalid={Boolean(reasonError)}
                      aria-describedby={fieldDescribedBy("development-reason", { hint: "x", error: reasonError })}
                    />
                  </Field>
                  <Button variant="danger" className="mt-3 w-full" onClick={askReject} disabled={busy !== null}>
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                This project is not waiting for review, so there is nothing to decide. It comes back to the queue when the
                developer submits it.
              </p>
            )}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "approve"}
        title="Approve and publish this project?"
        tone="primary"
        confirmLabel="Yes, publish it"
        busyLabel="Publishing…"
        busy={busy === "approve"}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void decide("approve")}
      >
        It becomes public at once, with its photos, on its own page and on the developer&rsquo;s profile.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "reject"}
        title="Reject this project?"
        confirmLabel="Yes, reject it"
        busyLabel="Rejecting…"
        busy={busy === "reject"}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void decide("reject")}
      >
        The developer sees your reason. They can change the project and submit it again.
      </ConfirmDialog>
    </>
  );
}

/** `/admin/developments/[id]`: one project, with approve and reject (a reason is required). */
export function DevelopmentReview({ developmentId }: { developmentId: string }) {
  return <AdminGate>{() => <Review developmentId={developmentId} />}</AdminGate>;
}
