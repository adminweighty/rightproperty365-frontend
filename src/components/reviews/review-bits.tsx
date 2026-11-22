"use client";

import { Flag, MessageSquareReply } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { reportReview } from "@/lib/api/reviews";
import {
  countdownTick,
  countdownWords,
  REASON_MAX,
  replyEditWindow,
  reportReasonProblem,
  reviewStatusLabel,
  reviewStatusTone,
  textCounterWords,
  type Review,
} from "@/lib/reviews";
import { currentViewerZone } from "@/lib/display-zone";
import { formatInstant } from "@/lib/time-zone";
import { ReviewStars } from "./stars";

/*
 * Pieces shared by the review pages: a review as a card, the status badge,
 * the reply's countdown, a form in a modal dialog and the "Report" button.
 */

/** Class A (API 0.62.0): "15 Nov 2026 (Harare time)", the day in the viewer's display zone, named. */
export const formatDate = (iso: string | null) => (iso ? formatInstant(iso, currentViewerZone(), { style: "date" }) : "");

export function ReviewStatusBadge({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={reviewStatusTone(status)}>{reviewStatusLabel(status, label)}</Badge>;
}

/**
 * One review: stars, the public name, the date, the text and the provider's
 * reply. `actions` go under it (report, edit, moderate); `extra` above the
 * reply (moderation details).
 */
export function ReviewCard({
  review,
  providerName,
  headingLevel = "h3",
  showStatus,
  actions,
  extra,
  footer,
}: {
  review: Review;
  providerName?: string;
  headingLevel?: "h2" | "h3" | "h4";
  showStatus?: boolean;
  actions?: ReactNode;
  extra?: ReactNode;
  /** Full width under everything (a reply box, moderation controls). */
  footer?: ReactNode;
}) {
  const Heading = headingLevel;
  const when = review.publishedAt ?? review.createdAt;
  return (
    <article className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ReviewStars rating={review.rating} />
        <Heading className="font-sans text-base font-semibold tracking-normal break-words text-ink">{review.reviewerName}</Heading>
        {when && (
          <time dateTime={when} className="text-sm text-muted">
            {formatDate(when)}
          </time>
        )}
        {showStatus && <ReviewStatusBadge status={review.status} label={review.statusLabel} />}
      </div>
      <p className="mt-2 max-w-prose whitespace-pre-line break-words leading-relaxed text-ink">{review.text}</p>
      {extra}
      {review.reply && (
        <div className="mt-3 rounded-md border-l-4 border-primary bg-tint p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <MessageSquareReply className="size-4 text-primary-ink" aria-hidden="true" />
            Reply from {providerName ?? review.profile?.name ?? "the provider"}
          </p>
          <p className="mt-1 max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-ink">{review.reply.text}</p>
        </div>
      )}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      {footer}
    </article>
  );
}

/** The time left to change a reply, redrawn every minute (every second in its last minute). */
export function ReplyCountdown({ reply, className }: { reply: { createdAt: string | null; editableUntil: string | null }; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const edit = replyEditWindow(reply, now);
  useEffect(() => {
    if (!edit.open) return;
    const timer = setTimeout(() => setNow(Date.now()), countdownTick(edit.remainingMs));
    return () => clearTimeout(timer);
  }, [now, edit.open, edit.remainingMs]);
  if (!edit.until) return null;
  return (
    <p className={className ?? "text-sm text-muted"}>
      {edit.open ? (
        <>
          You can change your reply until <time dateTime={edit.until}>{formatWhen(edit.until)}</time>:{" "}
          <span className="font-medium text-ink">{countdownWords(edit.remainingMs)}</span>.
        </>
      ) : (
        <>Replies can be changed for 7 days. The time to change this one ended on {formatWhen(edit.until)}.</>
      )}
    </p>
  );
}

/**
 * A small form in a native modal `<dialog>`: the browser keeps focus inside,
 * makes the page inert and closes it on Escape; focus returns to the opener.
 */
export function FormDialog({
  open,
  title,
  intro,
  submitLabel,
  busyLabel,
  busy,
  error,
  onSubmit,
  onCancel,
  children,
  initialFocus,
}: {
  open: boolean;
  title: string;
  intro?: ReactNode;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  children: ReactNode;
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocus?.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-line bg-surface p-5 text-ink shadow-lg backdrop:bg-overlay sm:p-6"
    >
      <form onSubmit={onSubmit} noValidate>
        <h2 id={titleId} className="font-sans text-xl font-semibold tracking-normal">
          {title}
        </h2>
        {intro && <div className="mt-2 text-sm leading-relaxed text-muted">{intro}</div>}
        <div className="mt-4 grid gap-4">{children}</div>
        {error && <Alert title={error} className="mt-4" />}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * "Report" on a review, for anyone signed in. Signed out, it is a link to
 * sign in and come back. Nothing is drawn until the session is known, so the
 * public page's HTML is the same for everyone.
 */
export function ReportButton({ review }: { review: Review }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = `report-${review.id}`;

  if (status === "loading") return null;
  if (status === "anonymous") {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(pathname)}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink hover:underline"
      >
        <Flag className="size-4" aria-hidden="true" />
        Sign in to report<span className="sr-only"> the review by {review.reviewerName}</span>
      </Link>
    );
  }
  if (done) {
    return (
      <p role="status" className="text-sm text-muted">
        Thank you. Our moderators will look at this review.
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = reportReasonProblem(reason);
    setProblem(found ?? undefined);
    if (found) {
      field.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    const answer = await reportReview(review.id, reason.trim());
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.fields?.reason) {
        setProblem(answer.failure.fields.reason);
        field.current?.focus();
      } else if (answer.failure.status === 409) {
        setOpen(false);
        setDone(true);
      } else setError(answer.failure.message);
      return;
    }
    setOpen(false);
    setDone(true);
  }

  const hint = `What is wrong: abuse, personal details, not a real customer, spam. ${textCounterWords(reason, 1, REASON_MAX)}.`;
  return (
    <>
      <Button variant="ghost" size="md" className="text-muted" onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden="true" />
        Report<span className="sr-only"> the review by {review.reviewerName}</span>
      </Button>
      <FormDialog
        open={open}
        title="Report this review"
        intro="Our moderators read every report and may hide the review. The reviewer is not told who reported it."
        submitLabel="Send the report"
        busyLabel="Sending…"
        busy={busy}
        error={error}
        onSubmit={submit}
        onCancel={() => setOpen(false)}
        initialFocus={field}
      >
        <Field id={id} label="Reason" hint={hint} error={problem}>
          <Textarea
            ref={field}
            id={id}
            rows={4}
            value={reason}
            maxLength={REASON_MAX + 50}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy(id, { hint, error: problem })}
          />
        </Field>
      </FormDialog>
    </>
  );
}
