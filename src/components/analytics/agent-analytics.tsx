"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DEFINITIONS_PATH, localToday, PeriodPicker, ReportBody, TopListingsTable } from "@/components/analytics/report-ui";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCount, parsePeriod, periodQuery, type PeriodChoice } from "@/lib/analytics/report";
import { getListingAnalytics, getOrganisationAnalytics, type TopListing } from "@/lib/api/analytics";
import { canUseInbox } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";

/*
 * The professionals' analytics (API 0.30.0): an organisation's listings at
 * /agent/analytics and one listing at /agent/analytics/listings/<id>. The API
 * scopes every figure: an OWNER or MANAGER sees all of the organisation's
 * listings, an AGENT only the ones assigned to them; anyone else gets 404.
 */

const PATH = "/agent/analytics";
export const listingAnalyticsPath = (listingId: string) => `${PATH}/listings/${listingId}`;

/** The period in the address, the same object while the address does not change. */
export function usePeriod() {
  const params = useSearchParams();
  const period = params.get("period");
  const from = params.get("from");
  const to = params.get("to");
  return useMemo(() => parsePeriod({ period, from, to }, localToday()), [period, from, to]);
}

function Intro() {
  return (
    <p className="mt-2 max-w-2xl text-muted">
      How often your listings were seen in lists, opened and enquired about. These are our own first-party counts, not
      Google Analytics figures, so they will differ from other tools.{" "}
      <Link href={DEFINITIONS_PATH} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
        How we count
      </Link>
    </p>
  );
}

/** The organisation in `?org=`, or the only one. */
function OrganisationReport({ organisations }: { organisations: DashboardOrganisation[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { choice, errors } = usePeriod();
  const wanted = params.get("org") ?? "";
  const chosen = organisations.find((item) => item.id === wanted) ?? (organisations.length === 1 ? organisations[0] : null);
  const valid = !errors.from && !errors.to;

  const go = (next: PeriodChoice, org = chosen?.id) => router.push(`${PATH}${periodQuery(next, { org })}`, { scroll: false });

  const chosenId = chosen?.id ?? "";
  const load = useCallback(() => getOrganisationAnalytics(chosenId, choice), [chosenId, choice]);

  return (
    <>
      <div className="mt-8">
        <PeriodPicker
          choice={choice}
          errors={errors}
          onChoose={(next) => go(next)}
          extra={
            organisations.length > 1 ? (
              <Field id="analytics-organisation" label="Organisation">
                <SearchableSelect
                  id="analytics-organisation"
                  options={[{ value: "", label: "Choose an organisation…" }, ...organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))]}
                  value={chosen?.id ?? ""}
                  onValueChange={(id) => go(choice, id || undefined)}
                />
              </Field>
            ) : undefined
          }
        />
      </div>
      {!chosen && <p className="mt-6 text-muted">Choose the organisation whose listings you want to see.</p>}
      {chosen && valid && <OrganisationFigures key={`${chosen.id}${periodQuery(choice)}`} organisation={chosen} load={load} />}
    </>
  );
}

function OrganisationFigures({ organisation, load }: { organisation: DashboardOrganisation; load: () => ReturnType<typeof getOrganisationAnalytics> }) {
  const { state, reload } = useApi(load);
  const agentOnly = organisation.role === "AGENT";
  return (
    <div className="mt-8">
      <p role="status" className="sr-only">
        {state.status === "ready" ? `Figures for ${organisation.name} have loaded.` : ""}
      </p>
      {state.status === "loading" && <LoadingBlock label="Loading the figures" rows={3} />}
      {state.status === "error" &&
        (state.failure.status === 404 ? (
          <EmptyState title="These figures are not available to you">
            Analytics for {organisation.name} are for its owner and managers, and for each agent&rsquo;s own listings.
          </EmptyState>
        ) : (
          <LoadError failure={state.failure} onRetry={reload} />
        ))}
      {state.status === "ready" && (
        <>
          <h2 className="mb-4 text-2xl">
            {organisation.name}
            {agentOnly && <span className="block text-base font-normal text-muted">The listings assigned to you</span>}
          </h2>
          <ReportBody report={state.data}>
            <TopListingsTable rows={state.data.top_listings} hrefFor={(row: TopListing) => (row.listing_id ? listingAnalyticsPath(row.listing_id) : null)} />
          </ReportBody>
        </>
      )}
    </div>
  );
}

function OrganisationPage() {
  const load = useCallback(() => getDashboard(), []);
  const { state, reload } = useApi(load);
  return (
    <>
      <BackLink href="/agent/listings">Your listings</BackLink>
      <h1 className="mt-1 text-4xl">Analytics</h1>
      <Intro />
      {state.status === "loading" && (
        <div className="mt-8">
          <LoadingBlock label="Loading your organisations" rows={2} />
        </div>
      )}
      {state.status === "error" && (
        <div className="mt-8">
          <LoadError failure={state.failure} onRetry={reload} />
        </div>
      )}
      {state.status === "ready" &&
        (state.data.organisations.length === 0 ? (
          <div className="mt-8">
            <EmptyState title="No organisation to report on" action={<ButtonLink href="/agent/listings" variant="secondary">Your listings</ButtonLink>}>
              Figures for an organisation are for its members. The figures for each of your own listings are on the listing, under
              &ldquo;Your listings&rdquo;.
            </EmptyState>
          </div>
        ) : (
          <OrganisationReport organisations={state.data.organisations} />
        ))}
    </>
  );
}

/** `/agent/analytics`: an organisation's listings, for members of organisations, Landlords and Property Sellers (Vendors). */
export function AgentAnalytics() {
  return <RequireAuth allow={canUseInbox}>{() => <OrganisationPage />}</RequireAuth>;
}

// ---- One listing ------------------------------------------------------------------

function ListingReport({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { choice, errors } = usePeriod();
  const valid = !errors.from && !errors.to;
  const load = useCallback(() => getListingAnalytics(listingId, choice), [listingId, choice]);
  const { state, reload } = useApi(load);
  const listing = state.status === "ready" ? state.data.listing : undefined;

  return (
    <>
      <BackLink href={`/agent/listings/${listingId}`}>The listing</BackLink>
      <h1 className="mt-1 text-4xl">{listing?.title ? `Analytics: ${listing.title}` : "Listing analytics"}</h1>
      {listing?.reference && <p className="mt-1 text-sm text-muted">Reference {listing.reference}</p>}
      <Intro />
      <p className="mt-2">
        <Link href={PATH} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
          All your listings
        </Link>
      </p>
      <div className="mt-6">
        <PeriodPicker choice={choice} errors={errors} onChoose={(next) => router.push(`${listingAnalyticsPath(listingId)}${periodQuery(next)}`, { scroll: false })} />
      </div>
      <p role="status" className="sr-only">
        {state.status === "ready" ? "The figures have loaded." : ""}
      </p>
      <div className="mt-8">
        {!valid && <p className="text-muted">Choose the first and last day, then press Show.</p>}
        {valid && state.status === "loading" && <LoadingBlock label="Loading the figures" rows={3} />}
        {valid && state.status === "error" &&
          (state.failure.status === 404 ? (
            <EmptyState title="These figures are not available to you" action={<ButtonLink href="/agent/listings" variant="secondary">Your listings</ButtonLink>}>
              A listing&rsquo;s figures are for whoever lists it, their organisation&rsquo;s owner and managers, and its assigned agent.
            </EmptyState>
          ) : (
            <LoadError failure={state.failure} onRetry={reload} />
          ))}
        {valid && state.status === "ready" && <ReportBody report={state.data} />}
      </div>
    </>
  );
}

/** `/agent/analytics/listings/<id>`. */
export function ListingAnalytics({ listingId }: { listingId: string }) {
  return <RequireAuth allow={canUseInbox}>{() => <ListingReport listingId={listingId} />}</RequireAuth>;
}

// ---- The card on a listing in the editor ---------------------------------------------

const THIRTY_DAYS: PeriodChoice = { period: "30d" };

/**
 * Views, unique views, saves and enquiries over the last 30 days, with a link
 * to the listing's analytics page. In the listing editor's side panel.
 */
export function ListingAnalyticsCard({ listingId, title }: { listingId: string; title: string }) {
  const load = useCallback(() => getListingAnalytics(listingId, THIRTY_DAYS), [listingId]);
  const { state } = useApi(load);
  const totals = state.status === "ready" ? state.data.totals : null;
  const figures = totals
    ? [
        { label: "Views", value: totals.views },
        { label: "Unique views", value: totals.unique_views },
        { label: "Saves", value: totals.saves },
        { label: "Enquiries", value: totals.enquiries },
      ]
    : [];
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal">
        <BarChart3 className="size-5 text-primary-ink" aria-hidden="true" />
        Last 30 days
      </h2>
      {state.status === "loading" && <div className="mt-3 h-16 rounded-md bg-sunken" aria-busy="true" aria-label="Loading the figures" />}
      {state.status === "error" && <p className="mt-2 text-sm text-muted">The figures could not be loaded.</p>}
      {totals && (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-xs text-muted">{figure.label}</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">{formatCount(figure.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link
        href={listingAnalyticsPath(listingId)}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
      >
        See the analytics
        <span className="sr-only"> of {title}</span>
      </Link>
    </Card>
  );
}
