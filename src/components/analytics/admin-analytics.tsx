"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { usePeriod } from "@/components/analytics/agent-analytics";
import { DEFINITIONS_PATH, PeriodPicker, ReportBody, TopListingsTable } from "@/components/analytics/report-ui";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCount, formatRate, periodQuery, rate, type PeriodChoice } from "@/lib/analytics/report";
import { getAdminAnalytics, type MarketAnalytics } from "@/lib/api/analytics";
import { ANALYTICS_ROLES, type User } from "@/lib/api/auth";

const PATH = "/admin/analytics";

type Country = { value: string; label: string; keywords?: string[] };

/** The markets a MARKET_ADMIN is limited to; null when the person also holds a site-wide role. */
function marketScope(user: User): string[] | null {
  const siteWide = user.platform_roles.some(({ role }) => role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN");
  if (siteWide) return null;
  const markets = user.platform_roles.filter(({ role }) => role === "MARKET_ADMIN").map(({ market_code }) => market_code);
  return markets.some((code) => code === null) ? null : [...new Set(markets as string[])];
}

function MarketsTable({ rows, countryName }: { rows: MarketAnalytics[]; countryName: (code: string) => string }) {
  if (rows.length < 2) return null;
  return (
    <section aria-labelledby="analytics-markets">
      <Card>
        <h2 id="analytics-markets" className="text-2xl">
          By country
        </h2>
        <p className="mt-1 text-sm text-muted">Each country&rsquo;s days are its own local days.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Listing analytics by country</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Country</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Views</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Unique</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Contact clicks</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Enquiries</th>
                <th scope="col" className="py-2 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...rows]
                .sort((a, b) => b.totals.views - a.totals.views || a.market_code.localeCompare(b.market_code))
                .map((row) => (
                  <tr key={row.market_code}>
                    <th scope="row" className="py-2 pr-4 font-normal text-ink">
                      {countryName(row.market_code)}
                    </th>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink">{formatCount(row.totals.views)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted">{formatCount(row.totals.unique_views)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted">{formatCount(row.totals.contact_clicks)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted">{formatCount(row.totals.enquiries)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{formatRate(rate(row.totals.enquiries, row.totals.views)) ?? "No views"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function Summary({ user, countries }: { user: User; countries: Country[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { choice, errors } = usePeriod();
  const scope = useMemo(() => marketScope(user), [user]);
  const requested = (params.get("market") ?? "").toUpperCase();
  // A Market Administrator with one market always sees that one; with several, one of theirs or all of theirs.
  const market = scope?.length === 1 ? scope[0] : /^[A-Z]{2}$/.test(requested) && (!scope || scope.includes(requested)) ? requested : "";
  const options = scope ? countries.filter((country) => scope.includes(country.value)) : countries;
  const countryName = (code: string) => countries.find((country) => country.value === code)?.label ?? code;
  const valid = !errors.from && !errors.to;

  const load = useCallback(() => getAdminAnalytics(choice, market || undefined), [choice, market]);
  const { state, reload } = useApi(load);

  const go = (next: PeriodChoice, nextMarket: string) => router.push(`${PATH}${periodQuery(next, { market: nextMarket || undefined })}`, { scroll: false });

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Analytics</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Listing views, enquiries and top listings across the site, from our own first-party counts. Raw events are never shown here,
        only totals.{" "}
        <Link href={DEFINITIONS_PATH} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
          How we count
        </Link>
      </p>

      <div className="mt-8">
        <PeriodPicker
          choice={choice}
          errors={errors}
          idPrefix="admin-analytics"
          // A new country is shown as soon as it is chosen, so the address already holds it.
          onChoose={(next) => go(next, market)}
          extra={
            scope?.length === 1 ? undefined : (
              <Field id="admin-analytics-market" label="Country">
                <SearchableSelect
                  id="admin-analytics-market"
                  name="market"
                  options={[{ value: "", label: scope ? "All your countries" : "Every country" }, ...options]}
                  value={market}
                  onValueChange={(next) => go(choice, next)}
                />
              </Field>
            )
          }
        />
      </div>
      {scope?.length === 1 && <p className="mt-3 text-sm text-muted">You see {countryName(scope[0])}, the country you administer.</p>}

      <p role="status" className="sr-only">
        {state.status === "ready" ? "The figures have loaded." : ""}
      </p>
      <div className="mt-8">
        {!valid && <p className="text-muted">Choose the first and last day, then press Show.</p>}
        {valid && state.status === "loading" && <LoadingBlock label="Loading the figures" rows={3} />}
        {valid && state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {valid && state.status === "ready" && (
          <ReportBody report={state.data}>
            <MarketsTable rows={state.data.markets} countryName={countryName} />
            <TopListingsTable
              rows={state.data.top_listings}
              showMarket={!market}
              hrefFor={(row) => (row.slug ? `/listings/${row.slug}` : null)}
            />
          </ReportBody>
        )}
      </div>
    </>
  );
}

/** `/admin/analytics` (SUPER_ADMIN, PLATFORM_ADMIN, MARKET_ADMIN for their market). */
export function AdminAnalytics({ countries }: { countries: Country[] }) {
  return (
    <RoleGate roles={ANALYTICS_ROLES} what="analytics">
      {(user) => <Summary user={user} countries={countries} />}
    </RoleGate>
  );
}
