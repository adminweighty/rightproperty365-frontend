"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isProfessional } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import { listMyReviews, listReceivedReviews, replyToReview } from "@/lib/api/reviews";
import { pageNumber, ratingWords, replyEditWindow, replyProblem, REPLY_MAX, textCounterWords, type Review } from "@/lib/reviews";
import { ReplyCountdown, ReviewCard } from "./review-bits";
import { RatingSummaryLine } from "./stars";
import { PageButtons } from "./profile-reviews";
import { ExistingReview } from "./write-review";

/*
 * `/agent/reviews`: reviews of the organisation's public profiles, each with
 * a reply box. One reply per review, which can be changed for 7 days after it
 * was first posted (a countdown says how long is left). "Written by you"
 * lists the reviews the organisation wrote of service providers.
 */

const PATH = "/agent/reviews";
type Tab = "received" | "written";
const hrefFor = (org: string, page = 1, tab: Tab = "received") => {
  const search = new URLSearchParams({ org });
  if (tab === "written") search.set("tab", "written");
  if (page > 1) search.set("page", String(page));
  return `${PATH}?${search}`;
};

function ReplyBox({ org, review, onSaved }: { org: string; review: Review; onSaved: (review: Review) => void }) {
  const edit = replyEditWindow(review.reply);
  const has = review.reply !== null;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? "");
  const [problem, setProblem] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const id = `reply-${review.id}`;
  // The API decides (OWNER and MANAGER, one reply, 7 days to change it); the clock hides the button when the time is up.
  const canWrite = has ? review.can.editReply && edit.open : review.can.reply;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = replyProblem(text);
    setProblem(found ?? undefined);
    if (found) return document.getElementById(id)?.focus();
    setBusy(true);
    setError(undefined);
    const answer = await replyToReview(org, review.id, text, has);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.fields?.text) setProblem(answer.failure.fields.text);
      else setError(answer.failure.message);
      return;
    }
    setOpen(false);
    setMessage(has ? "Your reply is changed." : "Your reply is published under the review.");
    onSaved(answer.data);
  }

  const hint = `Thank the reviewer or answer what they said. It is public, under the review. ${textCounterWords(text, 1, REPLY_MAX)}.`;

  return (
    <div className="mt-3 grid gap-2 border-t border-line pt-3">
      {has && review.reply && <ReplyCountdown reply={review.reply} />}
      {review.replyRemoved && (
        <p className="text-sm text-muted">
          Our moderators removed your reply{review.replyRemoved.reason ? `: ${review.replyRemoved.reason}` : "."} A new reply cannot be written.
        </p>
      )}
      {!has && !review.replyRemoved && !review.can.reply && !message && (
        <p className="text-sm text-muted">Not replied to yet. A Principal or Manager of your organisation can reply.</p>
      )}
      <div aria-live="polite">{message && <Alert tone="success" title={message} />}</div>
      {open ? (
        <form onSubmit={submit} noValidate className="grid gap-3">
          <Field id={id} label={has ? "Change your reply" : "Your reply"} hint={hint} error={problem}>
            <Textarea
              id={id}
              rows={4}
              value={text}
              maxLength={REPLY_MAX + 100}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={Boolean(problem)}
              aria-describedby={fieldDescribedBy(id, { hint, error: problem })}
            />
          </Field>
          {!has && <p className="text-sm text-muted">You can reply once, and change the reply for 7 days after you post it.</p>}
          {error && <Alert title={error} />}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : has ? "Save the reply" : "Post the reply"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        canWrite && (
          <Button variant="secondary" className="justify-self-start" onClick={() => setOpen(true)}>
            {has ? "Change your reply" : "Reply"}
            <span className="sr-only"> to {review.reviewerName}</span>
          </Button>
        )
      )}
    </div>
  );
}

function Reviews({ organisation }: { organisation: DashboardOrganisation }) {
  const params = useSearchParams();
  const router = useRouter();
  const page = pageNumber(params.get("page"));
  const org = organisation.id;
  const load = useCallback(() => listReceivedReviews(org, page), [org, page]);
  const { state, reload, replace } = useApi(load);

  if (state.status === "loading") return <LoadingBlock label="Loading reviews" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState title="No public profile to review">
          Reviews are written about a public profile under Professionals. {organisation.name} has none yet.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  const data = state.data;
  const words = data.summary ? ratingWords(data.summary.average, data.summary.count) : null;

  return (
    <>
      {data.summary && words && <RatingSummaryLine average={data.summary.average} count={data.summary.count} size="lg" />}
      <p role="status" className="mt-2 text-sm text-muted">
        {data.total === 0 ? "" : `${data.total === 1 ? "1 review" : `${data.total} reviews`}${data.totalPages > 1 ? `, page ${data.page} of ${data.totalPages}` : ""}`}
      </p>
      {data.items.length === 0 ? (
        <EmptyState title={data.total > 0 ? `There is no page ${page}` : "No reviews yet"}>
          {data.total > 0
            ? null
            : "Customers and organisations can review you after a finished maintenance job or a replied enquiry. Reviews appear here once our moderators publish them."}
        </EmptyState>
      ) : (
        <ul className="mt-4 grid gap-4">
          {data.items.map((review) => (
            <li key={review.id}>
              <ReviewCard
                review={review}
                headingLevel="h2"
                extra={review.profile && <p className="mt-1 text-xs text-muted">About {review.profile.name}</p>}
                footer={
                  <ReplyBox
                    key={review.id}
                    org={org}
                    review={review}
                    onSaved={(saved) => replace({ ...data, items: data.items.map((item) => (item.id === saved.id ? saved : item)) })}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
      <PageButtons
        page={data.page}
        totalPages={data.totalPages}
        label="Reviews"
        onPage={(value) => router.push(hrefFor(org, value), { scroll: true })}
      />
    </>
  );
}

/** The reviews the book wrote of service providers (from finished maintenance jobs), each with its status. */
function Written({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const who = useMemo(() => ({ as: "org" as const, orgId: org }), [org]);
  const load = useCallback(() => listMyReviews(who), [who]);
  const { state, reload } = useApi(load);
  if (state.status === "loading") return <LoadingBlock label="Loading the reviews you wrote" rows={2} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.items.length === 0) {
    return (
      <EmptyState title="No reviews written yet">
        When a maintenance job done by a service provider from Professionals is resolved or closed, you can review them from the request&rsquo;s page.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-6">
      {state.data.items.map((review) => {
        const name = review.profile?.name ?? "the provider";
        return (
          <li key={review.id} className="grid gap-2">
            {review.profile?.kind && review.profile.slug && (
              <Link href={`/directory/${review.profile.kind}/${review.profile.slug}`} className="text-sm font-medium text-primary-ink hover:underline">
                See {name}&rsquo;s profile
              </Link>
            )}
            <ExistingReview who={who} review={review} providerName={name} onChanged={reload} />
          </li>
        );
      })}
    </ul>
  );
}

function Shell() {
  const { state, reload } = useApi(getDashboard);
  const params = useSearchParams();
  const router = useRouter();
  const organisations = useMemo(() => (state.status === "ready" ? state.data.organisations : []), [state]);
  const organisation = organisations.find((item) => item.id === params.get("org")) ?? organisations[0];
  const tab: Tab = params.get("tab") === "written" ? "written" : "received";

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-3xl md:text-4xl">Reviews</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Reviews of your public profiles, published by our moderators: reply once to each, and change a reply for 7 days. And the reviews your
        organisation wrote of service providers.
      </p>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your organisations" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState title="Reviews belong to a business with a public profile">
            Service providers and other businesses listed under Professionals are reviewed by their customers. Ask your Principal to add you to the
            team.
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id="reviews-organisation" label="Organisation" className="mb-4 max-w-md">
                <SearchableSelect
                  id="reviews-organisation"
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(hrefFor(value), { scroll: false })}
                />
              </Field>
            )}
            <ChipNav
              label="Reviews"
              items={[
                { key: "received", href: hrefFor(organisation.id), label: "About your business", current: tab === "received" },
                { key: "written", href: hrefFor(organisation.id, 1, "written"), label: "Written by you", current: tab === "written" },
              ]}
            />
            <div key={`${organisation.id}-${tab}`} className="mt-6">
              {tab === "written" ? <Written organisation={organisation} /> : <Reviews organisation={organisation} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function ProviderReviews() {
  return <RequireAuth allow={isProfessional}>{() => <Shell />}</RequireAuth>;
}
