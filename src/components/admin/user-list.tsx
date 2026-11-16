"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectItem, type SelectOption } from "@/components/ui/searchable-select";
import { ACCOUNT_STATUS, adminListUsers, type AccountStatus } from "@/lib/api/admin-users";
import { platformRoleLabels, titleFromCode, USER_READ_ROLES, type PlatformRole } from "@/lib/api/auth";
import { pageFrom } from "@/lib/request-filters";

const PATH = "/admin/users";
const STATUSES: AccountStatus[] = ["ACTIVE", "SUSPENDED", "DELETED"];

type Props = {
  /** The account roles (code and label) from the API's reference data. */
  roles: SelectOption[];
  /** Every country, by name. */
  countries: SelectOption[];
};

type Filters = { q: string; role: string; status: AccountStatus | ""; market: string };

function hrefFor(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.market) params.set("market", filters.market);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

function Users({ roles, countries }: Props) {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").slice(0, 200);
  const role = /^[A-Z_]{1,60}$/.test(params.get("role") ?? "") ? params.get("role")! : "";
  const status = STATUSES.find((value) => value === params.get("status")) ?? "";
  const market = /^[A-Z]{2}$/.test(params.get("market") ?? "") ? params.get("market")! : "";
  const page = pageFrom(params.get("page"));
  const filters: Filters = { q, role, status, market };

  const load = useCallback(
    () => adminListUsers({ q: q || undefined, role: role || undefined, status: status || undefined, market: market || undefined, page }),
    [q, role, status, market, page],
  );
  const { state, reload } = useApi(load);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.page_size))) : 1;

  const roleLabels: Record<string, string> = Object.fromEntries(roles.map(({ value, label }) => [value, label]));
  const roleName = (code: string) => platformRoleLabels[code as PlatformRole] ?? roleLabels[code] ?? titleFromCode(code);
  const countryName = (code: string) => countries.find((country) => country.value === code)?.label ?? code;
  const filtered = Boolean(q || role || status || market);

  const roleOptions: SelectItem[] = [
    { value: "", label: "Any role" },
    ...(roles.length > 0 ? [{ label: "Account roles", options: roles }] : []),
    {
      label: "Administrator roles",
      options: (Object.keys(platformRoleLabels) as PlatformRole[]).map((code) => ({ value: code, label: platformRoleLabels[code] })),
    },
  ];

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Accounts</h1>
      <p className="mt-2 max-w-2xl text-muted">Everyone who has an account, newest first. Administrators are listed too.</p>

      {/* A plain GET form: the filters live in the address, so a view can be bookmarked. */}
      <form
        action={PATH}
        role="search"
        aria-label="Find accounts"
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_13rem_10rem_13rem_auto] lg:items-end"
      >
        <Field id="users-q" label="Name or email">
          <Input id="users-q" name="q" type="search" defaultValue={q} key={q} maxLength={200} autoComplete="off" />
        </Field>
        <Field id="users-role" label="Role">
          <SearchableSelect id="users-role" name="role" defaultValue={role} options={roleOptions} />
        </Field>
        <Field id="users-status" label="Status">
          <SearchableSelect
            id="users-status"
            name="status"
            defaultValue={status}
            options={[{ value: "", label: "Any status" }, ...STATUSES.map((value) => ({ value, label: ACCOUNT_STATUS[value].label }))]}
          />
        </Field>
        <Field id="users-market" label="Country">
          <SearchableSelect id="users-market" name="market" defaultValue={market} options={[{ value: "", label: "Every country" }, ...countries]} />
        </Field>
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
      </form>

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the accounts" rows={3} />}
        {data && (
          <p className="text-sm text-muted" role="status">
            {data.total === 1 ? "1 account" : `${data.total} accounts`}
            {totalPages > 1 && ` · page ${data.page} of ${totalPages}`}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-4">
            <EmptyState
              title={filtered ? "No accounts match those filters" : "No accounts yet"}
              action={filtered ? <ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink> : undefined}
            />
          </div>
        )}
        {data && data.items.length > 0 && (
          <ul className="mt-4 space-y-3" aria-busy={state.status === "loading" || undefined}>
            {data.items.map((item) => {
              const shown = ACCOUNT_STATUS[item.status] ?? { label: titleFromCode(item.status), tone: "neutral" as const };
              return (
                <li key={item.id}>
                  <article className="group relative rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={shown.tone}>{shown.label}</Badge>
                      {!item.email_verified && item.status !== "DELETED" && <Badge tone="warning">Email not confirmed</Badge>}
                      {item.platform_roles.map((code) => (
                        <Badge key={code} tone="accent">
                          {roleName(code)}
                        </Badge>
                      ))}
                      {item.account_roles.map((code) => (
                        <Badge key={code} tone="primary">
                          {roleName(code)}
                        </Badge>
                      ))}
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-semibold tracking-normal">
                      {/* The stretched link makes the whole card one target. */}
                      <Link
                        href={`${PATH}/${item.id}`}
                        className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                      >
                        {item.name}
                      </Link>
                    </h2>
                    <p className="mt-1 break-all text-sm text-muted">{item.email}</p>
                    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                      <span>{item.market_codes.length > 0 ? item.market_codes.map(countryName).join(", ") : "No organisation"}</span>
                      <span>Joined {formatWhen(item.created_at)}</span>
                      <span>{item.last_sign_in_at ? `Last signed in ${formatWhen(item.last_sign_in_at)}` : "Never signed in"}</span>
                    </p>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        {data && (
          <Pagination page={data.page} totalPages={totalPages} hrefFor={(value) => hrefFor(filters, value)} label="Accounts" className="mt-8" />
        )}
      </div>
    </>
  );
}

/** `/admin/users` (SUPER_ADMIN, PLATFORM_ADMIN, SUPPORT). */
export function UserList(props: Props) {
  return (
    <RoleGate roles={USER_READ_ROLES} what="the accounts">
      {() => <Users {...props} />}
    </RoleGate>
  );
}
