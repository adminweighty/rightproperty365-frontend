"use client";

import { Building2, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import type { SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { listProperties } from "@/lib/api/properties";
import { canWriteTenancies, occupancyWords, pageNumber, propertiesPath, propertyApiQuery, propertyHref, QUERY_MAX, type Property } from "@/lib/tenancies";
import { Linked, ManagementShell } from "./shared";

/** "3 units", or "Let as a whole" for a property with no units (it counts as one). */
function unitWords(item: Property): string {
  const count = item.unitCount || item.units.length;
  if (count === 0) return "Let as a whole";
  return count === 1 ? "1 unit" : `${count} units`;
}

/** `/agent/properties`: the book's properties, each with its units and tenancies. */
export function PropertyList({ markets }: { markets: SelectOption[] }) {
  return (
    <ManagementShell
      area="properties"
      path=""
      nav
      title="Properties"
      intro="The buildings and homes you manage, and the units in each. A property with no units is let as a whole."
    >
      {(organisation) => <List organisation={organisation} markets={markets} />}
    </ManagementShell>
  );
}

function List({ organisation, markets }: { organisation: DashboardOrganisation; markets: SelectOption[] }) {
  const org = organisation.id;
  const params = useSearchParams();
  const page = pageNumber(params.get("page"));
  const q = (params.get("q") ?? "").trim().slice(0, QUERY_MAX);
  const load = useCallback(() => listProperties(org, propertyApiQuery(page, q)), [org, page, q]);
  const { state, reload } = useApi(load);
  const writer = canWriteTenancies(organisation.role);
  const marketNames = useMemo(() => Object.fromEntries(markets.map((item) => [item.value, item.label])), [markets]);
  const hrefFor = (n: number) => propertiesPath("", org, { q: q || undefined, page: n > 1 ? String(n) : undefined });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        {writer && (
          <ButtonLink href={propertiesPath("/new", org)}>
            <Plus className="size-4" aria-hidden="true" />
            Add a property
          </ButtonLink>
        )}
      </div>

      {/* A GET form: works without JavaScript and keeps the book. */}
      <form method="get" action="/agent/properties" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
        <input type="hidden" name="org" value={org} />
        <Field id="property-q" label="Search" className="flex-1 sm:max-w-md">
          <Input id="property-q" name="q" type="search" defaultValue={q} maxLength={QUERY_MAX} placeholder="Name or address" />
        </Field>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {q && (
          <ButtonLink href={propertiesPath("", org)} variant="ghost">
            Clear search
          </ButtonLink>
        )}
      </form>

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          `${state.data.total === 1 ? "1 property" : `${state.data.total} properties`}${q ? " match" : ""}${
            state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : ""
          }`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the properties" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (page > 1 ? (
            <EmptyState
              title={`There is no page ${page} of these properties`}
              action={
                <ButtonLink href={hrefFor(1)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : q ? (
            <EmptyState
              title="No properties match that search"
              action={
                <ButtonLink href={propertiesPath("", org)} variant="secondary">
                  Clear search
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No properties yet"
              action={
                writer ? (
                  <ButtonLink href={propertiesPath("/new", org)} variant="secondary">
                    Add a property
                  </ButtonLink>
                ) : undefined
              }
            >
              Add each building or home you manage, with its units, before you record a tenancy.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="grid gap-4 md:grid-cols-2">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <Card className="h-full">
                    <div className="flex items-start gap-3">
                      <Building2 className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <h2 className="font-sans text-lg font-semibold tracking-normal break-words">
                          <Linked href={propertyHref(item.id, org)}>{item.name}</Linked>
                        </h2>
                        <p className="mt-1 text-sm break-words text-muted">
                          {item.address}
                          {item.marketCode && ` · ${marketNames[item.marketCode] ?? item.marketCode}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{unitWords(item)}</Badge>
                      {item.occupiedUnits !== null && (
                        <Badge tone={item.occupiedUnits > 0 ? "success" : "neutral"}>{occupancyWords(item.occupiedUnits, item.lettableUnits)}</Badge>
                      )}
                      {item.listing && <Badge tone="info">Linked to a listing</Badge>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination page={state.data.page} totalPages={state.data.totalPages} hrefFor={hrefFor} label="Properties" className="mt-8" />
          </>
        )}
      </div>
    </>
  );
}
