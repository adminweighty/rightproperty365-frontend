"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { listProfileReviews } from "@/lib/api/reviews";
import { reviewCountWords, type ReviewPage } from "@/lib/reviews";
import { ReportButton, ReviewCard } from "./review-bits";
import { RatingSummaryLine } from "./stars";
import { ReviewComposer } from "./write-review";

/*
 * The Reviews section of a public profile. The first page of published
 * reviews comes with the cached page (the same HTML for everyone, readable
 * without JavaScript); later pages are read in the browser, so the profile
 * keeps one address and its cache rules. "Report" and the review form need a
 * session and appear only once the browser knows it.
 */

/** Previous / page n of m / next, as buttons (the list changes in place). */
export function PageButtons({
  page,
  totalPages,
  label,
  busy,
  onPage,
}: {
  page: number;
  totalPages: number;
  label: string;
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={`${label} pages`} className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <Button variant="secondary" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous<span className="sr-only"> page</span>
      </Button>
      <span className="text-sm text-muted tabular-nums">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)}>
        Next<span className="sr-only"> page</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

const PAGE_SIZE = 10;

export function ProfileReviews({
  kind,
  slug,
  profileName,
  profileId,
  initial,
}: {
  kind: string;
  slug: string;
  profileName: string;
  profileId?: string | null;
  /** The first page, read with the cached page; null when it could not be read. */
  initial: ReviewPage | null;
}) {
  const { status } = useAuth();
  const [data, setData] = useState<ReviewPage | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initial ? null : "We could not load the reviews.");
  const list = useRef<HTMLHeadingElement>(null);

  async function go(page: number) {
    setBusy(true);
    setError(null);
    const answer = await listProfileReviews(kind, slug, page, PAGE_SIZE);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.message);
      return;
    }
    setData(answer.data);
    list.current?.focus();
  }

  const summary = data?.summary;
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-24 border-t border-line pt-12">
      <h2 id="reviews-heading" ref={list} tabIndex={-1} className="text-2xl outline-none md:text-3xl">
        Reviews
      </h2>
      {summary && summary.count > 0 && <RatingSummaryLine average={summary.average} count={summary.count} size="lg" className="mt-2" />}
      <p className="mt-2 max-w-prose text-sm text-muted">
        Reviews come from customers and organisations who used {profileName} through RightProperty365: a finished maintenance job or an
        enquiry they replied to. Our moderators check every review before it is published.
      </p>

      {status === "authenticated" && (
        <div className="mt-6">
          <ReviewComposer
            who={{ as: "me" }}
            profile={profileId ? { id: profileId } : { kind, slug }}
            providerName={profileName}
            explain
          />
        </div>
      )}

      <div className="mt-6" aria-busy={busy || undefined}>
        {error && (
          <div className="grid gap-3">
            <Alert title={error} />
            <Button variant="secondary" className="justify-self-start" onClick={() => go(data?.page ?? 1)} disabled={busy}>
              Try again
            </Button>
          </div>
        )}
        {data && data.items.length === 0 && !error && (
          <EmptyState title="No reviews yet">Reviews appear here once a customer has written one and it has been checked.</EmptyState>
        )}
        {data && data.items.length > 0 && (
          <>
            <p role="status" className="sr-only">
              {`${reviewCountWords(data.total)}${data.totalPages > 1 ? `, page ${data.page} of ${data.totalPages}` : ""}`}
            </p>
            <ul className="grid gap-4">
              {data.items.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} providerName={profileName} actions={<ReportButton review={review} />} />
                </li>
              ))}
            </ul>
            <PageButtons page={data.page} totalPages={data.totalPages} label="Reviews" busy={busy} onPage={go} />
          </>
        )}
      </div>
    </section>
  );
}
