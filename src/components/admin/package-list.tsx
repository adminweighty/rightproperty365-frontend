"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { adminListUsers, type AdminUserSummary } from "@/lib/api/admin-users";
import { hasPlatformRole, PACKAGE_ROLES, USER_READ_ROLES, type User } from "@/lib/api/auth";
import { adminListPackages, type ListingPackage } from "@/lib/api/packages";
import { priceWithTerm } from "@/lib/packages";

const PATH = "/admin/packages";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
] as const;

type Group = { code: string; name: string; currency: string; items: ListingPackage[] };

/** Packages under their market, in the API's order (market code, sort, name). */
function byMarket(items: ListingPackage[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    let group = groups.find((entry) => entry.code === item.market.code);
    if (!group) {
      group = { code: item.market.code, name: item.market.name, currency: item.market.currency, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function hrefFor(market: string, status: string) {
  const query = new URLSearchParams();
  if (market) query.set("market", market);
  if (status && status !== "all") query.set("status", status);
  const text = query.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** Find an account by name or email; its page has the package links of the person and their organisations. */
function AccountSearch() {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const load = useCallback(() => adminListUsers({ q: asked }), [asked]);
  const { state } = useApi(load);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsked(q.trim());
  }

  return (
    <section aria-labelledby="assign-heading" className="mt-12">
      <h2 id="assign-heading" className="text-2xl">
        Assign a package to an account
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Find the person who lists (a direct owner) or a member of the organisation. Their account page links to the package
        of their own listings and of each organisation they belong to.
      </p>
      <form role="search" onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="package-account-q" label="Name or email" className="flex-1">
          <Input id="package-account-q" value={q} onChange={(event) => setQ(event.target.value)} autoComplete="off" />
        </Field>
        <Button type="submit" variant="secondary">
          <Search className="size-4" aria-hidden="true" />
          Find
        </Button>
      </form>
      {asked && (
        <div className="mt-4" aria-live="polite">
          {state.status === "loading" && <LoadingBlock label="Finding accounts" rows={1} />}
          {state.status === "error" && <Alert title={state.failure.message} traceId={state.failure.traceId} />}
          {state.status === "ready" && state.data.items.length === 0 && <p className="text-muted">No account matches &ldquo;{asked}&rdquo;.</p>}
          {state.status === "ready" && state.data.items.length > 0 && (
            <Card padded={false}>
              <ul className="divide-y divide-line">
                {state.data.items.map((account: AdminUserSummary) => (
                  <li key={account.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{account.name}</span>
                      <span className="block break-all text-sm text-muted">{account.email}</span>
                    </span>
                    <ButtonLink href={`/admin/users/${account.id}#user-packages`} size="sm" variant="secondary">
                      Packages<span className="sr-only"> of {account.name}</span>
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function Packages({ user }: { user: User }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const market = (params.get("market") ?? "").toUpperCase();
  const status = STATUS_FILTERS.find((item) => item.key === params.get("status"))?.key ?? "all";
  const { state, reload } = useApi(adminListPackages);

  const all = state.status === "ready" ? state.data.items : [];
  // The countries that have packages, by name.
  const names = new Map(all.map((item) => [item.market.code, item.market.name]));
  if (market && !names.has(market)) names.set(market, market);
  const marketOptions = [
    { value: "", label: "Every country" },
    ...[...names.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => ({ value: code, label: name, secondary: code })),
  ];
  const countFor = (key: string) =>
    all.filter((pkg) => (!market || pkg.market.code === market) && (key === "all" || (key === "active" ? pkg.active : !pkg.active))).length;
  const shown = all.filter(
    (item) =>
      (!market || item.market.code === market) && (status === "all" || (status === "active" ? item.active : !item.active)),
  );
  const groups = byMarket(shown);
  const scope = state.status === "ready" ? state.data.markets : null;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Listing packages</h1>
          <p className="mt-2 max-w-2xl text-muted">
            How many listings an organisation or a direct owner may have live at once, per country, with the prices per
            billing term. The default package applies to every account without one of its own.
          </p>
          {scope && <p className="mt-1 text-sm text-muted">You manage the packages of: {scope.join(", ") || "no countries"}.</p>}
        </div>
        <ButtonLink href={`${PATH}/new${market ? `?market=${market}` : ""}`}>
          <Plus className="size-4" aria-hidden="true" />
          New package
        </ButtonLink>
      </div>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Field id="package-market" label="Country" className="md:w-72">
          <SearchableSelect
            id="package-market"
            options={marketOptions}
            value={market}
            disabled={state.status !== "ready"}
            onValueChange={(value) => router.replace(hrefFor(value, status), { scroll: false })}
          />
        </Field>
        <ChipNav
          label="Package status"
          items={STATUS_FILTERS.map((item) => ({
            key: item.key,
            href: hrefFor(market, item.key),
            label: item.label,
            count: state.status === "ready" ? countFor(item.key) : undefined,
            current: item.key === status,
          }))}
        />
      </div>

      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading the packages" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && groups.length === 0 && (
          <EmptyState
            title={all.length === 0 ? "No packages yet" : "No packages match"}
            action={
              all.length === 0 ? (
                <ButtonLink href={`${PATH}/new`} variant="secondary">
                  Create a package
                </ButtonLink>
              ) : (
                <ButtonLink href={pathname} variant="secondary">
                  Show every package
                </ButtonLink>
              )
            }
          >
            {all.length === 0 && "A country with no packages has no listing limit."}
          </EmptyState>
        )}
        {groups.map((group) => (
          <section key={group.code} aria-labelledby={`market-${group.code}`} className="mt-6 first:mt-0">
            <h2 id={`market-${group.code}`} className="text-xl">
              {group.name} <span className="text-base font-normal text-muted">({group.code}, prices in {group.currency})</span>
            </h2>
            {!group.items.some((item) => item.is_default) && (
              <p className="mt-1 text-sm text-warning">No default package: accounts without a package are not limited here.</p>
            )}
            <Card padded={false} className="mt-3">
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`${PATH}/${item.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                          {item.name}
                        </Link>
                        <span className="text-xs text-subtle">{item.code}</span>
                        {item.is_default && <Badge tone="primary">Default</Badge>}
                        <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                      </p>
                      <p className="text-sm text-ink">
                        {item.listing_limit === 1 ? "1 active listing" : `${item.listing_limit} active listings`}
                        {" · "}
                        {item.current_assignments === 1 ? "1 account assigned" : `${item.current_assignments} accounts assigned`}
                      </p>
                      <p className="text-sm text-muted">
                        {item.prices.length === 0
                          ? "No prices yet"
                          : item.prices.map((price) => `${priceWithTerm(price)}${price.sample ? " (sample)" : ""}`).join(" · ")}
                      </p>
                    </div>
                    <ButtonLink href={`${PATH}/${item.id}`} size="sm" variant="secondary">
                      {item.can.edit ? "Edit" : "View"}
                      <span className="sr-only"> {item.name}</span>
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>

      {hasPlatformRole(user, USER_READ_ROLES) ? (
        <AccountSearch />
      ) : (
        <p className="mt-12 max-w-2xl text-sm text-muted">
          To assign a package, open the listing under review and follow &ldquo;Their package and history&rdquo;, or ask a Platform
          Administrator to find the account.
        </p>
      )}
    </>
  );
}

/** `/admin/packages` (SUPER_ADMIN, PLATFORM_ADMIN, and MARKET_ADMIN for its countries). */
export function PackageList() {
  return (
    <RoleGate roles={PACKAGE_ROLES} what="the listing packages">
      {(user) => <Packages user={user} />}
    </RoleGate>
  );
}
