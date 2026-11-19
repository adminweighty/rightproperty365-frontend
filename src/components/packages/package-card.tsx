"use client";

import Link from "next/link";
import { useCallback } from "react";
import { UsageMeterView } from "@/components/packages/usage-meter";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ApiResult } from "@/lib/api/http";
import { getAccountPackage, getMyPackage, type AccountUsage } from "@/lib/api/packages";
import { legal } from "@/lib/legal";
import { pricingPath } from "@/lib/packages";

export type PackageAccount = { kind: "ORGANISATION" | "DIRECT_OWNER"; id: string; name: string };

type Answer = { account: PackageAccount; result: ApiResult<AccountUsage> };

/** Every account's usage, read side by side. One failing account does not hide the others. */
async function loadAll(accounts: PackageAccount[]): Promise<ApiResult<Answer[]>> {
  const answers = await Promise.all(
    accounts.map(async (account) => ({
      account,
      result: account.kind === "DIRECT_OWNER" ? await getMyPackage() : await getAccountPackage(account.id),
    })),
  );
  return { ok: true, status: 200, data: answers };
}

/**
 * "Package": for each listing account the person lists for (each
 * organisation, and their own listings as a direct owner), the package in
 * each country with a used/limit meter, what is left and, at or over the
 * limit, what that means. On the dashboard and on "Your listings".
 */
export function PackageUsageCard({ accounts, className }: { accounts: PackageAccount[]; className?: string }) {
  const key = accounts.map((account) => `${account.kind}:${account.id}`).join(",");
  // `key` stands for `accounts`: a new array with the same accounts does not read again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => loadAll(accounts), [key]);
  const { state, reload } = useApi(load);

  if (accounts.length === 0) return null;
  const several = accounts.length > 1;

  return (
    <Card className={className} aria-labelledby="package-card-heading" role="region">
      <h2 id="package-card-heading" className="font-sans text-lg font-semibold tracking-normal">
        Package
      </h2>
      <p className="mt-1 text-sm text-muted">
        How many of your listings can be live at once in each country. Submitting a listing is never blocked; a listing
        goes live only when a slot is free.
      </p>

      {state.status === "loading" && <div aria-busy="true" aria-label="Loading your package" className="mt-4 h-20 rounded-md bg-sunken" />}
      {state.status === "error" && (
        <div className="mt-4">
          <Alert title={state.failure.message} traceId={state.failure.traceId} />
          <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </div>
      )}
      {state.status === "ready" && (
        <div className="mt-4 space-y-6">
          {state.data.map(({ account, result }) => (
            <section key={`${account.kind}:${account.id}`} aria-label={several ? account.name : undefined}>
              {several && (
                <p className="mb-2 text-sm font-semibold text-ink">
                  {account.kind === "DIRECT_OWNER" ? "Your own listings" : account.name}
                </p>
              )}
              {!result.ok ? (
                result.failure.status === 403 || result.failure.status === 404 ? (
                  <p className="text-sm text-muted">There is no package to show for this account.</p>
                ) : (
                  <div>
                    <Alert title={result.failure.message} traceId={result.failure.traceId} />
                    <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
                      Try again
                    </Button>
                  </div>
                )
              ) : result.data.markets.length === 0 ? (
                <p className="text-sm text-muted">No package yet. One applies when you add a listing in a country.</p>
              ) : (
                <ul className="space-y-5">
                  {result.data.markets.map((usage) => (
                    <li key={usage.market.code}>
                      <UsageMeterView usage={usage} headingLevel={3} />
                      {usage.package && (usage.at_limit || usage.over_limit) && (
                        <p className="mt-2 text-sm">
                          <Link href={pricingPath(usage.market.code)} className="font-medium text-primary-ink hover:underline">
                            See the packages in {usage.market.name}
                          </Link>
                          {" or "}
                          <a href={`mailto:${legal.emails.support}`} className="font-medium text-primary-ink hover:underline">
                            ask us about a bigger package
                          </a>
                          .
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

/** The accounts a dashboard answer lists for: organisations that manage listings, and the person as a direct owner. */
export function packageAccounts(data: {
  organisations: { id: string; name: string; can_manage_listings: boolean }[];
  direct_owner: boolean;
}): PackageAccount[] {
  const accounts: PackageAccount[] = data.organisations
    .filter((organisation) => organisation.can_manage_listings)
    .map((organisation) => ({ kind: "ORGANISATION", id: organisation.id, name: organisation.name }));
  if (data.direct_owner) accounts.push({ kind: "DIRECT_OWNER", id: "me", name: "Your own listings" });
  return accounts;
}
