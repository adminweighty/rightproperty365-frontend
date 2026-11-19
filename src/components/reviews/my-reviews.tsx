"use client";

import Link from "next/link";
import { useCallback } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listMyReviews } from "@/lib/api/reviews";
import { ExistingReview } from "./write-review";

/*
 * `/account/reviews`: the reviews the customer wrote, each with its status
 * (a review waiting to be checked can be changed; any can be deleted), and
 * how to write one: from the provider's profile, once they replied to the
 * customer's enquiry and 14 days have passed.
 */

const ME = { as: "me" } as const;

function HowTo() {
  return (
    <Card>
      <h2 className="font-sans text-lg font-semibold tracking-normal">Reviewing a service provider</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        You can review a service provider you sent an enquiry to from their profile, once they have replied and 14 days have passed. Open their
        profile under Professionals and choose &ldquo;Review&rdquo; in the Reviews section. Our moderators check every review before it is
        published.
      </p>
      <ButtonLink href="/directory" variant="secondary" className="mt-4">
        Find a professional
      </ButtonLink>
    </Card>
  );
}

function Written() {
  const load = useCallback(() => listMyReviews(ME), []);
  const { state, reload } = useApi(load);
  return (
    <section aria-labelledby="written-heading" className="mt-12">
      <h2 id="written-heading" className="text-2xl">
        Reviews you wrote
      </h2>
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading your reviews" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          <EmptyState title="You have not written a review yet">Reviews you write appear here, with whether they are published.</EmptyState>
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
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
                  <ExistingReview who={ME} review={review} providerName={name} onChanged={reload} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Page() {
  return (
        <>
          <h1 className="text-3xl md:text-4xl">Your reviews</h1>
          <div className="mt-8">
            <HowTo />
            <Written />
          </div>
        </>
  );
}

export function MyReviews() {
  return <RequireAuth>{() => <Page />}</RequireAuth>;
}
