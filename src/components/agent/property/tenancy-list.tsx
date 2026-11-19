"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ContactPicker, td, TableRegion, th } from "@/components/agent/books/shared";
import { ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { listTenancies } from "@/lib/api/properties";
import {
  canWriteTenancies,
  parseTenancyFilters,
  partyNames,
  TENANCY_STATUSES,
  tenanciesPath,
  tenancyApiQuery,
  tenancyHref,
  tenancyListHref,
  tenancyStatusLabel,
} from "@/lib/tenancies";
import { formatDay, Linked, ManagementShell, rentWords, TenancyStatusBadge, useProperties } from "./shared";

/** `/agent/tenancies`: the book's tenancies by status, with filters. */
export function TenancyList() {
  return (
    <ManagementShell
      area="tenancies"
      path=""
      nav
      title="Tenancies"
      intro="Who rents which property or unit, on what terms. Tenants are people from your contact book."
    >
      {(organisation) => <List organisation={organisation} />}
    </ManagementShell>
  );
}

function List({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseTenancyFilters(new URLSearchParams(search)), [search]);
  const load = useCallback(() => listTenancies(org, tenancyApiQuery(filters)), [org, filters]);
  const { state, reload } = useApi(load);
  const properties = useProperties(org);
  const writer = canWriteTenancies(organisation.role);
  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.statusCounts ?? [];
  const countOf = (status?: string) =>
    counts.length === 0 ? undefined : status ? (counts.find((item) => item.status === status)?.count ?? 0) : counts.reduce((sum, item) => sum + item.count, 0);
  const [contact, setContact] = useState<{ id: string; label: string | null }>(() => ({ id: filters.contact ?? "", label: null }));
  const filtered = Boolean(filters.status || filters.property || filters.contact);

  const propertyOptions: SelectOption[] = [{ value: "", label: "All properties" }];
  if (properties.status === "ready") propertyOptions.push(...properties.items.map((item) => ({ value: item.id, label: item.name, secondary: item.address })));
  if (filters.property && !propertyOptions.some((option) => option.value === filters.property)) {
    propertyOptions.push({ value: filters.property, label: "The property chosen" });
  }

  return (
    <>
      {writer && (
        <ButtonLink href={tenanciesPath("/new", org)}>
          <Plus className="size-4" aria-hidden="true" />
          Start a tenancy
        </ButtonLink>
      )}

      <div className="mt-6">
        <ChipNav
          label="Tenancies by status"
          items={[
            { key: "all", href: tenancyListHref({ property: filters.property, contact: filters.contact }, org), label: "All", count: countOf(), current: !filters.status },
            ...TENANCY_STATUSES.map((status) => ({
              key: status,
              href: tenancyListHref({ status, property: filters.property, contact: filters.contact }, org),
              label: tenancyStatusLabel(status, counts.find((item) => item.status === status)?.label),
              count: countOf(status),
              current: filters.status === status,
            })),
          ]}
        />
      </div>

      {/* A GET form: works without JavaScript and keeps the book and status. */}
      <form method="get" action="/agent/tenancies" role="search" className="mt-6 grid gap-4">
        <input type="hidden" name="org" value={org} />
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <Field id="tenancy-property" label="Property" className="max-w-md">
          <SearchableSelect id="tenancy-property" name="property" options={propertyOptions} defaultValue={filters.property ?? ""} />
        </Field>
        <div className="max-w-2xl">
          <ContactPicker
            id="tenancy-contact"
            org={org}
            label="Tenant or landlord"
            name="contact"
            value={contact.id}
            valueLabel={contact.label}
            onChange={(id, label) => setContact({ id, label })}
          />
        </div>
        <div>
          <Button type="submit" variant="secondary">
            Show tenancies
          </Button>
        </div>
      </form>
      {filtered && (
        <p className="mt-3">
          <ButtonLink href={tenanciesPath("", org)} variant="ghost">
            Clear filters
          </ButtonLink>
        </p>
      )}

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          `${state.data.total === 1 ? "1 tenancy" : `${state.data.total} tenancies`}${filtered ? " match" : ""}${
            state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : ""
          }`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the tenancies" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (filters.page > 1 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these tenancies`}
              action={
                <ButtonLink href={tenancyListHref({ ...filters, page: 1 }, org)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : filtered ? (
            <EmptyState
              title="No tenancies match these filters"
              action={
                <ButtonLink href={tenanciesPath("", org)} variant="secondary">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No tenancies yet"
              action={
                writer ? (
                  <ButtonLink href={tenanciesPath("/new", org)} variant="secondary">
                    Start a tenancy
                  </ButtonLink>
                ) : undefined
              }
            >
              Record who rents each property or unit. Add the property and the tenants to your contact book first.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <TableRegion label="Tenancies, scrolls sideways">
              <table className="w-full min-w-[44rem] border-collapse">
                <caption className="sr-only">Tenancies</caption>
                <thead className="border-b border-line bg-sunken">
                  <tr>
                    <th scope="col" className={th}>
                      Tenants
                    </th>
                    <th scope="col" className={th}>
                      Property
                    </th>
                    <th scope="col" className={th}>
                      Rent
                    </th>
                    <th scope="col" className={th}>
                      Dates
                    </th>
                    <th scope="col" className={th}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.data.items.map((item) => (
                    <tr key={item.id}>
                      <th scope="row" className={`${td} text-left font-normal`}>
                        <Linked href={tenancyHref(item.id, org)}>{partyNames(item.tenants) || item.reference || "Tenancy"}</Linked>
                        {item.reference && <span className="block text-xs text-muted">{item.reference}</span>}
                      </th>
                      <td className={td}>
                        {item.property?.name ?? "—"}
                        {item.unit && <span className="block text-xs text-muted">{item.unit.label}</span>}
                      </td>
                      <td className={`${td} tabular-nums`}>{rentWords(item.rent)}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {item.startDate ? formatDay(item.startDate) : "—"}
                        <span className="block text-xs text-muted">{item.endDate ? `to ${formatDay(item.endDate)}` : "No end date"}</span>
                      </td>
                      <td className={td}>
                        <TenancyStatusBadge status={item.status} label={item.statusLabel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            <Pagination
              page={state.data.page}
              totalPages={state.data.totalPages}
              hrefFor={(n) => tenancyListHref({ ...filters, page: n }, org)}
              label="Tenancies"
              className="mt-8"
            />
          </>
        )}
      </div>
    </>
  );
}
