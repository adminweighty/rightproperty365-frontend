"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { td, TableRegion, th } from "@/components/agent/books/shared";
import { ManagementShell, useProperties } from "@/components/agent/property/shared";
import { ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { listInspections } from "@/lib/api/inspections";
import {
  canWriteInspections,
  hasInspectionFilters,
  inspectionApiQuery,
  inspectionHref,
  inspectionListHref,
  inspectionsPath,
  inspectionStatusLabel,
  INSPECTION_STATUSES,
  isOverdue,
  parseInspectionFilters,
  progressWords,
  type InspectionFilters,
  type InspectionPage,
} from "@/lib/inspections";
import { InspectionStatusBadge, InspectionTypeBadge, scheduledWords, useInspectionOptions } from "./shared";

/** `/agent/inspections`: the book's inspections, upcoming or past, filtered by status, type and property. */
export function InspectionList() {
  return (
    <ManagementShell
      area="inspections"
      path=""
      nav
      title="Inspections"
      intro="Move-in, routine and move-out inspections: a checklist of each room, what was found, photos, and a report once completed."
    >
      {(organisation) => <List organisation={organisation} />}
    </ManagementShell>
  );
}

function List({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseInspectionFilters(new URLSearchParams(search)), [search]);
  const load = useCallback(() => listInspections(org, inspectionApiQuery(filters)), [org, filters]);
  const { state, reload } = useApi(load);
  const properties = useProperties(org);
  const options = useInspectionOptions(org);
  const writer = canWriteInspections(organisation.role);
  const filtered = hasInspectionFilters(filters);
  const keep = { status: filters.status, type: filters.type, property: filters.property, tenancy: filters.tenancy };

  const propertyOptions: SelectOption[] = [{ value: "", label: "All properties" }];
  if (properties.status === "ready") propertyOptions.push(...properties.items.map((item) => ({ value: item.id, label: item.name, secondary: item.address })));
  if (filters.property && !propertyOptions.some((option) => option.value === filters.property)) propertyOptions.push({ value: filters.property, label: "The property chosen" });
  const statusOptions: SelectOption[] = [{ value: "", label: "Any status" }, ...INSPECTION_STATUSES.map((status) => ({ value: status, label: inspectionStatusLabel(status) }))];
  const typeOptions: SelectOption[] = [{ value: "", label: "Any type" }, ...options.types.map((item) => ({ value: item.code, label: item.label }))];

  return (
    <>
      {writer && (
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={inspectionsPath("/new", org)}>
            <Plus className="size-4" aria-hidden="true" />
            Schedule inspection
          </ButtonLink>
        </div>
      )}

      <div className="mt-6">
        <ChipNav
          label="When"
          items={[
            { key: "all", href: inspectionListHref({ ...keep }, org), label: "All", current: !filters.when },
            { key: "upcoming", href: inspectionListHref({ ...keep, when: "upcoming" }, org), label: "Upcoming", current: filters.when === "upcoming" },
            { key: "past", href: inspectionListHref({ ...keep, when: "past" }, org), label: "Past", current: filters.when === "past" },
          ]}
        />
      </div>

      {/* A GET form: works without JavaScript and keeps the book and "when". */}
      <form method="get" action="/agent/inspections" role="search" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="org" value={org} />
        {filters.when && <input type="hidden" name="when" value={filters.when} />}
        {filters.tenancy && <input type="hidden" name="tenancy" value={filters.tenancy} />}
        <Field id="inspection-status" label="Status">
          <SearchableSelect id="inspection-status" name="status" options={statusOptions} defaultValue={filters.status ?? ""} />
        </Field>
        <Field id="inspection-type" label="Type">
          <SearchableSelect id="inspection-type" name="type" options={typeOptions} defaultValue={filters.type ?? ""} />
        </Field>
        <Field id="inspection-property" label="Property">
          <SearchableSelect id="inspection-property" name="property" options={propertyOptions} defaultValue={filters.property ?? ""} />
        </Field>
        <div className="self-end">
          <Button type="submit" variant="secondary">
            Show inspections
          </Button>
        </div>
      </form>
      {filtered && (
        <p className="mt-3">
          <ButtonLink href={inspectionListHref({}, org)} variant="ghost">
            Clear filters
          </ButtonLink>
        </p>
      )}
      {filters.tenancy && <p className="mt-2 text-sm text-muted">Showing the inspections of one tenancy.</p>}

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          `${state.data.total === 1 ? "1 inspection" : `${state.data.total} inspections`}${filtered ? " match" : ""}${state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : ""}`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the inspections" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (filters.page > 1 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these inspections`}
              action={
                <ButtonLink href={inspectionListHref({ ...filters, page: 1 }, org)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : filtered ? (
            <EmptyState
              title={filters.when === "upcoming" ? "No upcoming inspections match" : filters.when === "past" ? "No past inspections match" : "No inspections match these filters"}
              action={
                <ButtonLink href={inspectionListHref({}, org)} variant="secondary">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No inspections yet"
              action={
                writer ? (
                  <ButtonLink href={inspectionsPath("/new", org)} variant="secondary">
                    Schedule inspection
                  </ButtonLink>
                ) : undefined
              }
            >
              Schedule a move-in inspection when a tenant moves in, routine ones during the tenancy, and a move-out inspection when they leave.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && <Table org={org} page={state.data} filters={filters} />}
      </div>
    </>
  );
}

function Table({ org, page, filters }: { org: string; page: InspectionPage; filters: InspectionFilters }) {
  return (
    <>
      <TableRegion label="Inspections, scrolls sideways">
        <table className="w-full min-w-[44rem] border-collapse">
          <caption className="sr-only">Inspections</caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              <th scope="col" className={th}>
                Scheduled
              </th>
              <th scope="col" className={th}>
                Property
              </th>
              <th scope="col" className={th}>
                Type
              </th>
              <th scope="col" className={th}>
                Status
              </th>
              <th scope="col" className={th}>
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {page.items.map((item) => (
              <tr key={item.id}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Link href={inspectionHref(item.id, org)} className="font-medium break-words text-primary-ink hover:underline">
                    {scheduledWords(item.scheduledFor, item.timeZone)}
                  </Link>
                  {item.reference && <span className="block text-xs text-muted">{item.reference}</span>}
                </th>
                <td className={td}>
                  {item.property?.name ?? "—"}
                  {item.unit && <span className="block text-xs text-muted">{item.unit.label}</span>}
                  {item.tenancy && item.tenancy.tenants.length > 0 && <span className="block text-xs text-muted">{item.tenancy.tenants.join(", ")}</span>}
                </td>
                <td className={td}>
                  <InspectionTypeBadge type={item.type} label={item.typeLabel} />
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    <InspectionStatusBadge status={item.status} label={item.statusLabel} />
                    {isOverdue(item) && <Badge tone="danger">Overdue</Badge>}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{item.progress ? progressWords(item.progress.done, item.progress.total) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
      <Pagination page={page.page} totalPages={page.totalPages} hrefFor={(n) => inspectionListHref({ ...filters, page: n }, org)} label="Inspections" className="mt-8" />
    </>
  );
}
