"use client";

import { PenLine, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createReview, deleteReview, getEligibility, getMyReview, updateReview, type Reviewer } from "@/lib/api/reviews";
import {
  basisWords,
  eligibilityFor,
  hasProblems,
  notYetWords,
  reviewApiProblems,
  reviewBody,
  reviewEditBody,
  reviewFormProblems,
  STATUS_FOR_REVIEWER,
  textCounterWords,
  TEXT_MAX,
  type Eligibility,
  type Review,
  type ReviewForm,
  type ReviewProblems,
} from "@/lib/reviews";
import { formatDate, ReviewCard } from "./review-bits";
import { StarRatingInput } from "./stars";

/*
 * Writing a review where the API says the caller may: on a provider's
 * profile, on a finished maintenance request, and from the customer's
 * reviews page. Shows the review already written instead (waiting to be
 * checked: change or delete it).
 */


const CHECKED_NOTE = "We check every review before it is published, usually within two working days. Until then only you can see it, and you can change or delete it.";

/** The rating and the text, for a new review or a change to one waiting to be checked. */
export function ReviewFormFields({
  id,
  form,
  setForm,
  problems,
  disabled,
}: {
  id: string;
  form: ReviewForm;
  setForm: (form: ReviewForm) => void;
  problems: ReviewProblems;
  disabled?: boolean;
}) {
  const textId = `${id}-text`;
  const hint = `Say what was done and how it went. No phone numbers, emails or other personal details. ${textCounterWords(form.text)}.`;
  return (
    <>
      <StarRatingInput id={`${id}-rating`} value={form.rating} onChange={(rating) => setForm({ ...form, rating })} error={problems.rating} disabled={disabled} />
      <Field id={textId} label="Your review" hint={hint} error={problems.text ? `${problems.text} ${textCounterWords(form.text)}.` : undefined}>
        <Textarea
          id={textId}
          rows={5}
          value={form.text}
          maxLength={TEXT_MAX + 200}
          disabled={disabled}
          onChange={(event) => setForm({ ...form, text: event.target.value })}
          aria-invalid={Boolean(problems.text)}
          aria-describedby={fieldDescribedBy(textId, { hint, error: problems.text })}
        />
      </Field>
    </>
  );
}

function focusFirstProblem(id: string, problems: ReviewProblems) {
  window.setTimeout(() => {
    const target = problems.rating ? document.getElementById(`${id}-rating`) : problems.text ? document.getElementById(`${id}-text`) : null;
    target?.focus();
  }, 0);
}

/** The review the caller already wrote: its status, and change or delete while it waits to be checked. */
export function ExistingReview({ who, review, providerName, onChanged }: { who: Reviewer; review: Review; providerName: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReviewForm>({ rating: review.rating, text: review.text });
  const [problems, setProblems] = useState<ReviewProblems>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const id = `edit-review-${review.id}`;
  // The API decides: change while it waits to be checked; delete at any time.
  const canEdit = review.can.edit;
  const canDelete = review.can.delete;

  async function save(event: FormEvent) {
    event.preventDefault();
    const found = reviewFormProblems(form);
    setProblems(found);
    if (hasProblems(found)) return focusFirstProblem(id, found);
    setBusy(true);
    setError(undefined);
    const answer = await updateReview(who, review.id, reviewEditBody(form));
    setBusy(false);
    if (!answer.ok) {
      const fromApi = reviewApiProblems(answer.failure.fields);
      setProblems(fromApi);
      setError(fromApi.other?.join(" ") || (fromApi.rating || fromApi.text ? undefined : answer.failure.message));
      return;
    }
    setEditing(false);
    setMessage("Your review is changed. It still waits to be checked.");
    onChanged();
  }

  async function remove() {
    setBusy(true);
    setError(undefined);
    const answer = await deleteReview(who, review.id);
    setBusy(false);
    if (!answer.ok && answer.failure.status !== 404) {
      setError(answer.failure.message);
      return;
    }
    setConfirm(false);
    onChanged();
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-ink">Your review of {providerName}</p>
      {editing ? (
        <form onSubmit={save} noValidate className="grid gap-4 rounded-lg border border-line bg-surface p-4">
          <ReviewFormFields id={id} form={form} setForm={setForm} problems={problems} disabled={busy} />
          <p className="text-sm text-muted">{CHECKED_NOTE}</p>
          {error && <Alert title={error} />}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <ReviewCard
          review={review}
          providerName={providerName}
          headingLevel="h4"
          showStatus
          extra={
            <>
              <p className="mt-2 text-sm text-muted">{STATUS_FOR_REVIEWER[review.status] ?? ""}</p>
              {review.moderation?.reason && review.status !== "PUBLISHED" && (
                <p className="mt-1 text-sm text-ink">Reason: {review.moderation.reason}</p>
              )}
              {review.authorName && <p className="mt-1 text-xs text-muted">Written by {review.authorName}</p>}
            </>
          }
          actions={
            canEdit || canDelete ? (
              <>
                {canEdit && (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    Change your review
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
                    Delete it
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      )}
      <div aria-live="polite">{message && <Alert tone="success" title={message} />}</div>
      {!editing && error && <Alert title={error} />}
      <ConfirmDialog
        open={confirm}
        title="Delete your review?"
        confirmLabel="Delete review"
        busyLabel="Deleting…"
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      >
        It is removed for good. You can write a new one on the same job or enquiry while you are still allowed to.
      </ConfirmDialog>
    </div>
  );
}

/** A new review on one of the bases the API offers. */
function NewReview({
  who,
  eligibility,
  providerName,
  startOpen,
  onCreated,
}: {
  who: Reviewer;
  eligibility: Eligibility;
  providerName: string;
  startOpen?: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));
  const [basisId, setBasisId] = useState(eligibility.bases[0]?.id ?? "");
  const [form, setForm] = useState<ReviewForm>({ rating: null, text: "" });
  const [problems, setProblems] = useState<ReviewProblems & { basis?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const opener = useRef<HTMLButtonElement>(null);
  const id = `review-${eligibility.bases[0]?.id ?? "new"}`;
  const basis = eligibility.bases.find((item) => item.id === basisId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: ReviewProblems & { basis?: string } = reviewFormProblems(form);
    if (!basis) found.basis = "Choose the job or enquiry you are reviewing.";
    setProblems(found);
    if (hasProblems(found) || !basis) return focusFirstProblem(id, found);
    const profileId = eligibility.profile?.id;
    if (!profileId) {
      setError("We could not tell which provider this review is for. Please reload the page.");
      return;
    }
    setBusy(true);
    setError(undefined);
    const answer = await createReview(who, reviewBody(profileId, { kind: basis.kind, id: basis.id }, form));
    setBusy(false);
    if (!answer.ok) {
      const fromApi = reviewApiProblems(answer.failure.fields);
      setProblems(fromApi);
      if (fromApi.rating || fromApi.text) focusFirstProblem(id, fromApi);
      setError(fromApi.other?.join(" ") || (fromApi.rating || fromApi.text ? undefined : answer.failure.message));
      // Already reviewed, or no longer allowed: show the box as the API now sees it.
      if (answer.failure.status === 409) onCreated();
      return;
    }
    onCreated();
  }

  if (!open) {
    return (
      <Button ref={opener} onClick={() => setOpen(true)} className="justify-self-start">
        <PenLine className="size-4" aria-hidden="true" />
        Review {providerName}
      </Button>
    );
  }

  const shownAs = who.as === "org" ? "The review shows your organisation’s name." : "The review shows your first name and the initial of your last name.";

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-heading`} className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <h3 id={`${id}-heading`} className="font-sans text-lg font-semibold tracking-normal">
        Review {providerName}
      </h3>
      {eligibility.bases.length > 1 ? (
        <Field id={`${id}-basis`} label="What are you reviewing?" error={problems.basis}>
          <SearchableSelect
            id={`${id}-basis`}
            options={eligibility.bases.map((item) => ({
              value: item.id,
              label: item.label ?? basisWords(item),
              secondary: item.date ? formatDate(item.date) : undefined,
            }))}
            value={basisId}
            onValueChange={setBasisId}
            aria-invalid={Boolean(problems.basis)}
          />
        </Field>
      ) : (
        basis && (
          <p className="text-sm text-muted">
            For {basis.label ?? basisWords(basis)}
            {basis.date ? `, ${formatDate(basis.date)}` : ""}.
          </p>
        )
      )}
      <ReviewFormFields id={id} form={form} setForm={setForm} problems={problems} disabled={busy} />
      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
        <span>
          {CHECKED_NOTE} {shownAs} We keep who wrote it.
        </span>
      </p>
      {error && <Alert title={error} />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send your review"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => opener.current?.focus(), 0);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The caller's own review of a basis, read by its id. */
function ExistingById({ who, id, providerName, onChanged }: { who: Reviewer; id: string; providerName: string; onChanged: () => void }) {
  const load = useCallback(() => getMyReview(who, id), [who, id]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <div aria-busy="true" aria-label="Loading your review" className="h-28 rounded-lg bg-sunken" />;
  if (state.status === "error") {
    if (state.failure.status === 404) return null;
    return (
      <div className="grid gap-2">
        <Alert title={state.failure.message} traceId={state.failure.traceId} />
        <Button variant="secondary" onClick={reload} className="justify-self-start">
          Try again
        </Button>
      </div>
    );
  }
  return <ExistingReview key={state.data.updatedAt ?? state.data.id} who={who} review={state.data} providerName={providerName} onChanged={onChanged} />;
}

/**
 * The review box for one profile: the reviews the caller already wrote on
 * it, then the "Review …" button and form when the API says they may,
 * otherwise nothing (or, with `explain`, why not yet).
 */
export function ReviewComposer({
  who,
  profile,
  basisId,
  providerName,
  explain,
  startOpen,
  onChanged,
}: {
  who: Reviewer;
  /** The profile, by id or by kind and slug. */
  profile: { id?: string | null; kind?: string; slug?: string };
  /** Only this job or enquiry (a page about one maintenance request). */
  basisId?: string;
  providerName: string;
  /** Say why when the caller may not review yet (a page about one job, not the public profile). */
  explain?: boolean;
  startOpen?: boolean;
  onChanged?: () => void;
}) {
  const orgId = who.as === "org" ? who.orgId : "";
  const { id: profileId, kind, slug } = profile;
  const reviewer: Reviewer = useMemo(() => (orgId ? { as: "org", orgId } : { as: "me" }), [orgId]);
  const load = useCallback(() => getEligibility(reviewer, { id: profileId, kind, slug }), [reviewer, profileId, kind, slug]);
  const { state, reload } = useApi(load);
  const [sent, setSent] = useState(false);

  if (state.status === "loading") return <div aria-busy="true" aria-label="Checking whether you can review" className="h-11 max-w-xs rounded-md bg-sunken" />;
  if (state.status === "error") {
    if ([401, 403, 404].includes(state.failure.status)) return null;
    return (
      <div className="grid gap-2">
        <Alert title={state.failure.message} traceId={state.failure.traceId} />
        <Button variant="secondary" onClick={reload} className="justify-self-start">
          Try again
        </Button>
      </div>
    );
  }
  const eligibility = eligibilityFor(state.data, basisId);
  if (!eligibility.reviewable) return null;
  const changed = () => {
    onChanged?.();
    reload();
  };
  const own = eligibility.reviewed.filter((item) => item.reviewId);
  const others = eligibility.reviewed.filter((item) => !item.reviewId);

  return (
    <div className="grid gap-3">
      <div aria-live="polite">
        {sent && (
          <Alert tone="success" title="Thank you. Your review is received.">
            We check every review before it is published. You can change or delete it until then.
          </Alert>
        )}
      </div>
      {own.map((item) => (
        <ExistingById key={item.reviewId} who={reviewer} id={item.reviewId as string} providerName={providerName} onChanged={changed} />
      ))}
      {eligibility.eligible && (
        <NewReview
          key={eligibility.bases.map((item) => item.id).join()}
          who={reviewer}
          eligibility={eligibility}
          providerName={providerName}
          startOpen={startOpen}
          onCreated={() => {
            setSent(true);
            changed();
          }}
        />
      )}
      {explain && !eligibility.eligible && own.length === 0 && (
        <>
          {others.length > 0 && <p className="text-sm text-muted">This has already been reviewed by someone in your organisation.</p>}
          {eligibility.upcoming.map((item) => (
            <p key={item.basis.id} className="text-sm text-muted">
              {notYetWords(item, formatDate)}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
