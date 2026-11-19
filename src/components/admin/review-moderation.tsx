"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ReviewCard } from "@/components/reviews/review-bits";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { REVIEW_MODERATION_ROLES } from "@/lib/api/auth";
import { getModeratedReview, listModerationQueue, moderateReview } from "@/lib/api/reviews";
import {
  basisWords,
  MODERATION_REASON_MAX,
  moderationActions,
  moderationApiQuery,
  moderationDone,
  moderationHref,
  moderationNeedsReason,
  moderationReasonProblem,
  moderationVerb,
  parseModerationFilters,
  QUEUES,
  queueCount,
  queueLabel,
  REVIEW_STATUSES,
  reviewStatusLabel,
  textCounterWords,
  type ModerationAction,
  type Review,
} from "@/lib/reviews";

/*
 * `/admin/reviews`: the moderation queue. New reviews wait here until they
 * are published or rejected; reported ones come back with every report and
 * its reason, to keep published or hide. A provider's reply can be removed.
 * Every action but publishing needs a reason, which the reviewer (or the
 * provider, for a reply) is told. Every decision asks first; the API audits
 * it and closes the review's open reports.
 */

const ACTION_EXPLAINED: Record<ModerationAction, string> = {
  PUBLISH: "It appears on the provider's profile and counts towards their average. Any open reports are closed.",
  HIDE: "It leaves the provider's profile and the average. The reviewer is told the reason.",
  REJECT: "It is never published. The reviewer is told the reason.",
  REMOVE_REPLY: "The provider's reply leaves the profile, and they cannot write another. The review stays as it is.",
};

/** The reports of a reported review, read from its detail (the list gives only the count). */
function Reports({ review }: { review: Review }) {
  const load = useCallback(() => getModeratedReview(review.id), [review.id]);
  const { state, reload } = useApi(load);
  const reports = state.status === "ready" ? state.data.reports.filter((item) => !item.status || item.status === "OPEN") : [];
  return (
    <div className="rounded-md border border-warning bg-warning-soft p-3">
      <p className="flex items-center gap-1.5 font-medium text-ink">
        <Flag className="size-4 text-warning" aria-hidden="true" />
        {review.reportCount === 1 ? "1 open report" : `${review.reportCount} open reports`}
      </p>
      {state.status === "loading" && <p className="mt-2 text-muted">Loading the reasons…</p>}
      {state.status === "error" && (
        <p className="mt-2 text-danger">
          {state.failure.message}{" "}
          <button type="button" onClick={reload} className="min-h-11 font-medium underline">
            Try again
          </button>
        </p>
      )}
      {state.status === "ready" && (
        <ul className="mt-2 grid gap-2">
          {reports.map((report, index) => (
            <li key={report.id ?? index} className="break-words text-ink">
              &ldquo;{report.reason}&rdquo;
              {report.createdAt && <span className="text-muted">, {formatWhen(report.createdAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Details({ review }: { review: Review }) {
  return (
    <div className="mt-3 grid gap-2 text-sm">
      <p className="text-muted">
        {review.profile ? (
          <>
            About{" "}
            {review.profile.kind && review.profile.slug ? (
              <Link href={`/directory/${review.profile.kind}/${review.profile.slug}`} className="font-medium text-primary-ink hover:underline">
                {review.profile.name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{review.profile.name}</span>
            )}
          </>
        ) : (
          "About a profile that no longer exists"
        )}
        {review.basis && ` · ${basisWords(review.basis)}`}
        {review.createdAt && ` · written ${formatWhen(review.createdAt)}`}
      </p>
      <p className="text-muted">
        {review.reviewerKind === "ORGANISATION" ? "An organisation" : review.reviewerKind === "DIRECT_OWNER" ? "A landlord" : "A customer"}
        {review.authorName && (
          <>
            {", written by "}
            <span className="text-ink">{review.authorName}</span>
          </>
        )}
        {review.reviewerUserId && <span className="break-all"> (account {review.reviewerUserId})</span>}
      </p>
      {review.moderation?.reason && (
        <p className="text-muted">
          Last decision{review.moderation.by ? ` by ${review.moderation.by}` : ""}
          {review.moderation.at ? `, ${formatWhen(review.moderation.at)}` : ""}: <span className="text-ink">{review.moderation.reason}</span>
        </p>
      )}
      {review.replyRemoved && (
        <p className="text-muted">
          The provider&rsquo;s reply was removed{review.replyRemoved.at ? ` ${formatWhen(review.replyRemoved.at)}` : ""}
          {review.replyRemoved.reason ? `: ${review.replyRemoved.reason}` : "."}
        </p>
      )}
      {review.reportCount > 0 && <Reports review={review} />}
    </div>
  );
}

function Decide({ review, onDone }: { review: Review; onDone: (message: string) => void }) {
  const actions = moderationActions({ status: review.status, reportCount: review.reportCount, hasReply: review.reply !== null }, review.can.actions);
  const [action, setAction] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const field = useRef<HTMLTextAreaElement>(null);
  const id = `moderate-${review.id}`;

  function ask(next: ModerationAction) {
    setError(undefined);
    const found = moderationReasonProblem(next, reason);
    if (found) {
      setProblem(found);
      field.current?.focus();
      return;
    }
    setProblem(undefined);
    setAction(next);
  }

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setError(undefined);
    const answer = await moderateReview(review.id, action, reason);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.status === 409) {
        setAction(null);
        onDone("Another moderator already changed this review. The queue has been refreshed.");
        return;
      }
      if (answer.failure.fields?.reason) {
        setProblem(answer.failure.fields.reason);
        setAction(null);
        window.setTimeout(() => field.current?.focus(), 0);
        return;
      }
      setError(answer.failure.message);
      return;
    }
    setAction(null);
    onDone(`The review by ${review.reviewerName} is ${moderationDone(action, review.status)}.`);
  }

  if (actions.length === 0) return <p className="mt-4 border-t border-line pt-4 text-sm text-muted">Nothing to decide on this review.</p>;
  const hint = `Needed for everything but publishing; the reviewer (or, for a reply, the provider) is told it. ${textCounterWords(reason, 0, MODERATION_REASON_MAX)}.`;

  return (
    <div className="mt-4 grid gap-3 border-t border-line pt-4">
      <Field id={id} label="Reason" optional hint={hint} error={problem}>
        <Textarea
          ref={field}
          id={id}
          rows={2}
          value={reason}
          maxLength={MODERATION_REASON_MAX + 50}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={fieldDescribedBy(id, { hint, error: problem })}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        {actions.map((item) => (
          <Button key={item} variant={item === "PUBLISH" ? "primary" : item === "REJECT" ? "danger" : "secondary"} onClick={() => ask(item)}>
            {moderationVerb(item, review.status)}
            <span className="sr-only">: the review by {review.reviewerName}</span>
          </Button>
        ))}
      </div>
      <ConfirmDialog
        open={action !== null}
        tone={action === "PUBLISH" ? "primary" : "danger"}
        title={action ? `${moderationVerb(action, review.status)}?` : ""}
        confirmLabel={action ? `Yes, ${moderationVerb(action, review.status).toLowerCase()}` : "Confirm"}
        busyLabel="Saving…"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => setAction(null)}
      >
        {action && ACTION_EXPLAINED[action]}
        {action && moderationNeedsReason(action) && reason.trim() && <span className="mt-2 block text-ink">Reason: {reason.trim()}</span>}
      </ConfirmDialog>
    </div>
  );
}

function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const search = params.toString();
  const filters = useMemo(() => parseModerationFilters(new URLSearchParams(search)), [search]);
  const load = useCallback(() => listModerationQueue(moderationApiQuery(filters)), [filters]);
  const { state, reload } = useApi(load);
  const [message, setMessage] = useState<string | null>(null);
  const announce = useRef<HTMLDivElement>(null);
  const counts = state.status === "ready" ? state.data.counts : state.status === "loading" ? state.previous?.counts : undefined;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-3xl md:text-4xl">Reviews</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Reviews of service providers wait here until they are checked: publish those that keep to the rules, reject the rest with a reason.
        Reported reviews come back with every report: keep them published or hide them. The oldest are first.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_16rem] md:items-end">
        <ChipNav
          label="Review queues"
          items={QUEUES.map((queue) => ({
            key: queue,
            href: moderationHref({ queue, status: filters.status }),
            label: queueLabel(queue),
            count: queueCount(queue, counts),
            current: queue === filters.queue,
          }))}
        />
        {filters.queue !== "NEW" && (
          <Field id="review-status" label="Status">
            <SearchableSelect
              id="review-status"
              options={[{ value: "", label: "Any status" }, ...REVIEW_STATUSES.map((status) => ({ value: status, label: reviewStatusLabel(status) }))]}
              value={filters.status}
              onValueChange={(status) => router.push(moderationHref({ queue: filters.queue, status }), { scroll: false })}
            />
          </Field>
        )}
      </div>

      <div ref={announce} tabIndex={-1} aria-live="polite" className="mt-4 outline-none">
        {message && <Alert tone="success" title={message} />}
      </div>

      <p role="status" className="mt-2 text-sm text-muted">
        {state.status === "ready" &&
          `${state.data.total === 1 ? "1 review" : `${state.data.total} reviews`}${state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : ""}`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading reviews" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these reviews`}
              action={
                <ButtonLink href={moderationHref({ ...filters, page: 1 })} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title={filters.queue === "REPORTED" ? "No reported reviews" : filters.queue === "NEW" ? "No new reviews to check" : "No reviews here"}>
              {filters.queue === "ALL" ? "Try another status." : "Nothing is waiting for you right now."}
            </EmptyState>
          )
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4">
              {state.data.items.map((review) => (
                <li key={review.id}>
                  <ReviewCard
                    review={review}
                    headingLevel="h2"
                    showStatus
                    extra={<Details review={review} />}
                    footer={
                      <Decide
                        key={`${review.id}-${review.status}`}
                        review={review}
                        onDone={(text) => {
                          setMessage(text);
                          reload();
                          window.setTimeout(() => announce.current?.focus(), 0);
                        }}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.totalPages}
              hrefFor={(page) => moderationHref({ ...filters, page })}
              label="Reviews"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/reviews`, for the roles the API lets moderate reviews. */
export function ReviewModeration() {
  return (
    <RoleGate roles={REVIEW_MODERATION_ROLES} what="review moderation">
      {() => <Queue />}
    </RoleGate>
  );
}
