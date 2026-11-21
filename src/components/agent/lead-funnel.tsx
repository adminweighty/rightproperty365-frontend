"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Download, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { saveBlob, useListingOptions, type ListingOptions } from "@/components/agent/books/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { campaignLabel } from "@/lib/analytics/campaign";
import { dayLong } from "@/lib/analytics/report";
import { canUseInbox, type User } from "@/lib/api/auth";
import { getDashboard, type Dashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import {
  downloadLeadFunnelCsv,
  getLeadFunnel,
  type LeadFunnelBreakdownFigures,
  type LeadFunnelReport,
  type LeadFunnelScope,
} from "@/lib/api/lead-funnel";
import { listTeamMembers } from "@/lib/api/team";
import { cn } from "@/lib/cn";
import {
  checkFunnelDates,
  formatDays,
  formatDuration,
  formatFunnelCount,
  formatShare,
  FUNNEL_PERIOD_LABELS,
  FUNNEL_PERIODS,
  FUNNEL_REQUEST_TYPE_LABELS,
  FUNNEL_REQUEST_TYPES,
  funnelApiQuery,
  funnelCsvName,
  funnelRows,
  funnelSearch,
  funnelSentence,
  hasNarrowingFunnelFilters,
  hasValidWindow,
  isUuid,
  parseFunnelFilters,
  SELLER_TARGET,
  shareValue,
  sortRows,
  utcToday,
  type FunnelFilterErrors,
  type FunnelFilters,
  type FunnelPeriod,
  type SortDirection,
} from "@/lib/lead-funnel";
import { fileNameFrom } from "@/lib/ledger";

/*
 * `/agent/requests/funnel` (API 0.38.0): how the requests received in a
 * period moved through the inbox's stages, and how fast they were first
 * answered. Every figure comes from the API, which counts only what the
 * caller's inbox shows; the page adds words, bar widths and sorting.
 */

const PATH = "/agent/requests/funnel";
const INBOX = "/agent/requests";

type Labels = Record<string, string>;
type Country = { value: string; label: string; keywords?: string[] };

/** Whose report: an organisation the caller belongs to, or their own requests as a direct seller. */
type Target = { id: string; name: string; organisation: DashboardOrganisation | null };

function targetsOf(data: Dashboard): Target[] {
  const targets: Target[] = data.organisations.map((organisation) => ({ id: organisation.id, name: organisation.name, organisation }));
  if (data.direct_owner || targets.length === 0) targets.push({ id: SELLER_TARGET, name: "Your own listings (as the seller)", organisation: null });
  return targets;
}

const isMemberRole = (organisation: DashboardOrganisation | null) => organisation?.role === "AGENT" || organisation?.role === "STAFF";

// ---- Filters ----------------------------------------------------------------------

const AGENT_HINT = "Who holds the request now";

function AgentSelect({ options, defaultValue }: { options: SelectOption[]; defaultValue: string }) {
  return (
    <Field id="funnel-agent" label="Agent" hint={AGENT_HINT}>
      <SearchableSelect
        id="funnel-agent"
        name="agent"
        options={options}
        defaultValue={defaultValue}
        aria-describedby={fieldDescribedBy("funnel-agent", { hint: AGENT_HINT })}
      />
    </Field>
  );
}

/** An AGENT or STAFF member: everything they can see, or only what is assigned to them. */
function MemberAgentField({ user, defaultValue }: { user: User; defaultValue: string }) {
  const options = [
    { value: "", label: "Yours and the organisation inbox" },
    { value: user.id, label: "Only the requests assigned to you" },
  ];
  return <AgentSelect options={options} defaultValue={defaultValue === user.id ? user.id : ""} />;
}

/** An OWNER or MANAGER: anyone in the team, and anyone the report names. */
function TeamAgentField({ organisation, user, defaultValue, report }: { organisation: DashboardOrganisation; user: User; defaultValue: string; report: LeadFunnelReport | null }) {
  const orgId = organisation.id;
  const seesTeam = organisation.can_see_members;
  const load = useCallback(() => listTeamMembers(orgId), [orgId]);
  const team = useApi(load).state;

  const options = useMemo<SelectOption[]>(() => {
    const byId = new Map<string, SelectOption>();
    if (seesTeam && team.status === "ready") {
      for (const person of team.data.items) byId.set(person.user_id, { value: person.user_id, label: person.name, secondary: person.role_label });
    }
    for (const row of report?.by_agent ?? []) if (row.user_id && !byId.has(row.user_id)) byId.set(row.user_id, { value: row.user_id, label: row.name });
    if (!byId.has(user.id)) byId.set(user.id, { value: user.id, label: user.name, secondary: "You" });
    const people = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
    if (defaultValue && !byId.has(defaultValue)) people.push({ value: defaultValue, label: "The chosen person" });
    return [{ value: "", label: "Everyone" }, ...people];
  }, [seesTeam, team, report, user, defaultValue]);

  return <AgentSelect options={options} defaultValue={defaultValue} />;
}

function ListingField({ defaultValue, report, listings }: { defaultValue: string; report: LeadFunnelReport | null; listings: ListingOptions }) {
  const options = useMemo<SelectOption[]>(() => {
    const byId = new Map<string, SelectOption>();
    if (listings.status === "ready") for (const option of listings.options) byId.set(option.value, option);
    for (const row of report?.by_listing ?? []) {
      if (!byId.has(row.listing_id) && row.listing) byId.set(row.listing_id, { value: row.listing_id, label: row.listing.title || row.listing.reference, secondary: row.listing.reference });
    }
    const items = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
    if (defaultValue && !byId.has(defaultValue)) items.push({ value: defaultValue, label: "The chosen listing" });
    return [{ value: "", label: "Every listing" }, ...items];
  }, [listings, report, defaultValue]);
  return (
    <Field id="funnel-listing" label="Listing">
      <SearchableSelect id="funnel-listing" name="listing" options={options} defaultValue={defaultValue} />
    </Field>
  );
}

function FunnelFiltersForm({
  filters,
  urlErrors,
  targets,
  target,
  user,
  typeLabels,
  countries,
  report,
  listings,
  today,
}: {
  filters: FunnelFilters;
  urlErrors: FunnelFilterErrors;
  targets: Target[];
  target: Target;
  user: User;
  typeLabels: Labels;
  countries: Country[];
  report: LeadFunnelReport | null;
  listings: ListingOptions;
  today: string;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<FunnelPeriod>(filters.period);
  const [errors, setErrors] = useState<FunnelFilterErrors>({});
  const shown = period === "custom" ? { ...urlErrors, ...errors } : {};
  const seller = target.id === SELLER_TARGET;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "") || undefined;
    const next: FunnelFilters = {
      period,
      org: text("org") ?? filters.org,
      agent: isUuid(text("agent")) ? text("agent") : undefined,
      listing: isUuid(text("listing")) ? text("listing") : undefined,
      type: text("type"),
      market: text("market"),
    };
    // Another organisation's people and listings mean nothing here.
    if (next.org !== target.id) {
      next.agent = undefined;
      next.listing = undefined;
    }
    if (next.org === SELLER_TARGET) next.agent = undefined;
    if (period === "custom") {
      next.from = text("from");
      next.to = text("to");
      const found = checkFunnelDates(next.from, next.to, today);
      setErrors(found);
      if (!hasValidWindow(found)) {
        document.getElementById(found.from ? "funnel-from" : "funnel-to")?.focus();
        return;
      }
    } else {
      setErrors({});
    }
    router.push(`${PATH}${funnelSearch(next)}`, { scroll: false });
  }

  const typeOptions: SelectOption[] = [
    { value: "", label: "Any type" },
    ...FUNNEL_REQUEST_TYPES.map((code) => ({ value: code, label: typeLabels[code] ?? FUNNEL_REQUEST_TYPE_LABELS[code] ?? code })),
  ];
  const countryOptions: SelectOption[] = [
    { value: "", label: "Every country" },
    ...(countries.length > 0 ? countries : filters.market ? [{ value: filters.market, label: filters.market }] : []),
  ];
  const cleared: FunnelFilters = { period: filters.period, from: filters.from, to: filters.to, org: filters.org };

  return (
    <form onSubmit={submit} noValidate role="search" aria-label="Filter the figures" className="rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {targets.length > 1 && (
          <Field id="funnel-org" label="Whose requests">
            <SearchableSelect
              id="funnel-org"
              name="org"
              options={targets.map((item) => ({ value: item.id, label: item.name, secondary: item.organisation?.market_code }))}
              defaultValue={target.id}
            />
          </Field>
        )}
        <Field id="funnel-period" label="Received in">
          <SearchableSelect
            id="funnel-period"
            name="period"
            options={FUNNEL_PERIODS.map((value) => ({ value, label: FUNNEL_PERIOD_LABELS[value] }))}
            value={period}
            onValueChange={(value) => setPeriod((FUNNEL_PERIODS as readonly string[]).includes(value) ? (value as FunnelPeriod) : "30d")}
          />
        </Field>
        {period === "custom" && (
          <>
            <Field id="funnel-from" label="First day" error={shown.from}>
              <Input
                id="funnel-from"
                name="from"
                type="date"
                defaultValue={filters.from}
                max={today}
                aria-invalid={Boolean(shown.from)}
                aria-describedby={fieldDescribedBy("funnel-from", { error: shown.from })}
              />
            </Field>
            <Field id="funnel-to" label="Last day" error={shown.to}>
              <Input
                id="funnel-to"
                name="to"
                type="date"
                defaultValue={filters.to}
                max={today}
                aria-invalid={Boolean(shown.to)}
                aria-describedby={fieldDescribedBy("funnel-to", { error: shown.to })}
              />
            </Field>
          </>
        )}
        {!seller &&
          target.organisation &&
          (isMemberRole(target.organisation) ? (
            <MemberAgentField user={user} defaultValue={filters.agent ?? ""} />
          ) : (
            <TeamAgentField organisation={target.organisation} user={user} defaultValue={filters.agent ?? ""} report={report} />
          ))}
        <ListingField defaultValue={filters.listing ?? ""} report={report} listings={listings} />
        <Field id="funnel-type" label="Type of request">
          <SearchableSelect id="funnel-type" name="type" options={typeOptions} defaultValue={filters.type ?? ""} />
        </Field>
        <Field id="funnel-market" label="Country">
          <SearchableSelect id="funnel-market" name="market" options={countryOptions} defaultValue={filters.market ?? ""} />
        </Field>
      </div>
      <p className="mt-3 text-sm text-muted">Days are UTC days. Up to 366 days at a time.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Show</Button>
        {hasNarrowingFunnelFilters(filters) && (
          <ButtonLink href={`${PATH}${funnelSearch(cleared)}`} variant="ghost" scroll={false}>
            Clear filters
          </ButtonLink>
        )}
      </div>
    </form>
  );
}

// ---- Who is counted --------------------------------------------------------------

function ScopeNote({ scope, target, user }: { scope: LeadFunnelScope; target: Target; user: User }) {
  const text =
    scope === "MEMBER" ? (
      <>
        <strong className="font-semibold text-ink">You see only your own numbers.</strong> As {target.organisation?.role === "STAFF" ? "a staff member" : "an agent"} of{" "}
        {target.name}, these figures count only the requests assigned to you and those waiting unassigned in the organisation inbox: the same requests
        your inbox lists. Requests held by other members are never counted. To leave out the organisation inbox, choose &ldquo;Only the requests assigned
        to you&rdquo; under Agent.
      </>
    ) : scope === "DIRECT_SELLER" ? (
      <>
        <strong className="font-semibold text-ink">Only your own requests.</strong> These figures count the requests sent to you, {user.name}, as the seller
        of your own listings. Requests to an organisation you belong to are not included.
      </>
    ) : (
      <>
        <strong className="font-semibold text-ink">The whole organisation.</strong> As {target.organisation?.role === "OWNER" ? "its owner" : "a manager"}, you
        see every request {target.name} received. Its agents see only their own numbers.
      </>
    );
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-soft p-4 text-sm text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

const expectedScope = (target: Target): LeadFunnelScope =>
  target.organisation === null ? "DIRECT_SELLER" : isMemberRole(target.organisation) ? "MEMBER" : "ORGANISATION";

// ---- KPI tiles -------------------------------------------------------------------

function KpiTile({ label, value, empty, detail, help }: { label: string; value: string | null; empty: string; detail?: string; help: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-xs">
      <dt className="text-sm font-medium leading-snug text-ink">{label}</dt>
      <dd>
        {value === null ? (
          <span className="block text-base font-medium text-muted">{empty}</span>
        ) : (
          <span className="block text-3xl font-bold tabular-nums text-ink">{value}</span>
        )}
        {detail && <span className="mt-1 block text-sm text-muted">{detail}</span>}
      </dd>
      <dd className="mt-auto border-t border-line pt-2 text-xs leading-relaxed text-muted">{help}</dd>
    </div>
  );
}

const RESPONSE_RULE =
  "A response is the first time your side moved the request to Contacted or a later step. Assigning, follow-up, closing, notes and the appointment a customer books with the request do not count.";

function KpiTiles({ report }: { report: LeadFunnelReport }) {
  const { response_time: response, time_to_conversion: conversion, received } = report;
  const of = (count: number) => `${formatFunnelCount(count)} of ${formatFunnelCount(received)} ${received === 1 ? "request" : "requests"}`;
  const neverShare = received > 0 ? formatShare(response.never_responded / received) : null;
  return (
    <section aria-labelledby="funnel-kpis">
      <h2 id="funnel-kpis" className="text-2xl">
        Response times
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile
          label="Median time to first response"
          value={formatDuration(response.median_minutes)}
          empty="No responses yet"
          detail={`Over ${formatFunnelCount(response.responded)} answered ${response.responded === 1 ? "request" : "requests"}`}
          help={<>Half of the answered requests had their first response sooner than this, half later. Unanswered requests are left out. {RESPONSE_RULE}</>}
        />
        <KpiTile
          label="Slowest 1 in 10 (90th percentile)"
          value={formatDuration(response.p90_minutes)}
          empty="No responses yet"
          detail="Time to first response"
          help={<>9 in 10 answered requests had their first response within this time. Unanswered requests are left out.</>}
        />
        <KpiTile
          label="Answered within 1 hour"
          value={formatShare(response.within_1h_rate)}
          empty="No requests"
          detail={of(response.within_1h)}
          help={<>First response within 60 minutes of the request arriving. Counted against every request received, so unanswered requests lower it.</>}
        />
        <KpiTile
          label="Answered within 24 hours"
          value={formatShare(response.within_24h_rate)}
          empty="No requests"
          detail={of(response.within_24h)}
          help={<>First response within 24 hours of the request arriving. Counted against every request received, so unanswered requests lower it.</>}
        />
        <KpiTile
          label="Never responded"
          value={formatFunnelCount(response.never_responded)}
          empty="No requests"
          detail={neverShare ? `${neverShare} of requests received` : undefined}
          help={<>Requests not yet moved to Contacted or a later step, including ones that were closed or marked for follow-up without that.</>}
        />
        <KpiTile
          label="Median time to conversion"
          value={formatDays(conversion.median_days)}
          empty="None converted yet"
          detail={`Over ${formatFunnelCount(conversion.converted)} converted ${conversion.converted === 1 ? "request" : "requests"}`}
          help={<>From the request arriving to its first move to Converted. Only requests that converted are counted.</>}
        />
      </dl>
    </section>
  );
}

// ---- The funnel ------------------------------------------------------------------

function FunnelChart({ report }: { report: LeadFunnelReport }) {
  const id = useId();
  const rows = funnelRows(report.steps, report.received);
  const sentence = funnelSentence(rows, report.received);
  const side = report.side_states;
  return (
    <section aria-labelledby={id}>
      <Card>
        <h2 id={id} className="text-2xl">
          From received to converted
        </h2>
        <p className="mt-1 text-ink">{sentence}</p>
        <p className="mt-1 text-sm text-muted">
          A request counts at a step once it reached that step or any later one, even when a stage was skipped; moving it back does not undo that.
          Follow-up required and Closed are not steps. Requests received in the period are followed to today.
        </p>
        <ol className="mt-5 space-y-5">
          {rows.map((row, index) => (
            <li key={row.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium text-ink">{row.label}</span>
                <span className="text-sm text-muted">
                  <span className="text-base font-semibold tabular-nums text-ink">{formatFunnelCount(row.reached)}</span>
                  {index > 0 && (
                    <>
                      {" "}
                      reached
                      {row.fromPrevious && <> · {row.fromPrevious} of {rows[index - 1].label.toLowerCase()}</>}
                      {index > 1 && row.fromReceived && <> · {row.fromReceived} of received</>}
                    </>
                  )}
                  {index === 0 && " received"}
                </span>
              </div>
              <div className="mt-1.5 h-3 rounded-full bg-sunken" aria-hidden="true">
                <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(row.reached > 0 ? 1 : 0, Math.round(row.width * 100))}%` }} />
              </div>
              <p className="mt-1 text-xs text-subtle">In this stage now: {formatFunnelCount(row.current)}</p>
            </li>
          ))}
        </ol>
        <details className="mt-5">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-primary-ink">Show the funnel as a table</summary>
          <div className="mt-2 overflow-x-auto" role="region" aria-label="The funnel as a table" tabIndex={0}>
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Requests that reached each step, with the conversion from the step before and from received</caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Step</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Reached</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">From the step before</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">From received</th>
                  <th scope="col" className="py-2 text-right font-medium">In this stage now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="py-2 pr-4 font-normal text-ink">{row.label}</th>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink">{formatFunnelCount(row.reached)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted">{row.fromPrevious ?? "Not applicable"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted">{row.fromReceived ?? "Not applicable"}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{formatFunnelCount(row.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <h3 className="mt-6 font-sans text-lg font-semibold tracking-normal">Where the requests are now</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Open", value: side.open, note: "Not converted or closed" },
            { label: "Converted or closed", value: side.closed },
            { label: "Closed without converting", value: side.closed_without_converting },
            { label: "Converted, then closed", value: side.converted_then_closed },
            { label: "Follow-up required now", value: side.follow_up_required.current, note: `${formatFunnelCount(side.follow_up_required.ever)} ever` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-line p-3">
              <dt className="text-xs leading-snug text-muted">{item.label}</dt>
              <dd className="text-xl font-bold tabular-nums text-ink">{formatFunnelCount(item.value)}</dd>
              {item.note && <dd className="text-xs text-subtle">{item.note}</dd>}
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

// ---- Breakdown tables --------------------------------------------------------------

type ColumnKey = "name" | "received" | "contacted" | "converted" | "conversion_rate" | "median_first_response_minutes";
type Row = LeadFunnelBreakdownFigures & { key: string; name: string; sub?: string };

const COLUMNS: { key: Exclude<ColumnKey, "name">; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Converted" },
  { key: "conversion_rate", label: "Conversion" },
  { key: "median_first_response_minutes", label: "Median first response" },
];

function sortValue(row: Row, key: ColumnKey): string | number | null {
  if (key === "name") return row.name;
  if (key === "conversion_rate") return shareValue(row.conversion_rate);
  return row[key];
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  numeric,
}: {
  label: string;
  column: ColumnKey;
  sort: { key: ColumnKey; direction: SortDirection } | null;
  onSort: (key: ColumnKey) => void;
  numeric?: boolean;
}) {
  const active = sort?.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase", numeric ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn("inline-flex min-h-11 items-center gap-1 rounded-md uppercase hover:text-ink", numeric && "flex-row-reverse")}
      >
        {label}
        <Icon className={cn("size-3.5", active ? "text-primary-ink" : "text-subtle")} aria-hidden="true" />
      </button>
    </th>
  );
}

function BreakdownTable({ title, intro, firstColumn, rows }: { title: string; intro: string; firstColumn: string; rows: Row[] }) {
  const id = useId();
  const [sort, setSort] = useState<{ key: ColumnKey; direction: SortDirection } | null>(null);
  const sorted = sort ? sortRows(rows, (row) => sortValue(row, sort.key), sort.direction) : rows;
  const onSort = (key: ColumnKey) =>
    setSort((current) =>
      current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "name" ? "asc" : "desc" },
    );
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="font-sans text-xl font-semibold tracking-normal">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted">{intro}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-muted">No requests in this period.</p>
      ) : (
        <div role="region" aria-labelledby={id} tabIndex={0} className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              {title}. {sort ? `Sorted by ${sort.key === "name" ? firstColumn : COLUMNS.find((column) => column.key === sort.key)?.label}, ${sort.direction === "asc" ? "ascending" : "descending"}.` : "Choose a column heading to sort."}
            </caption>
            <thead className="border-b border-line">
              <tr>
                <SortHeader label={firstColumn} column="name" sort={sort} onSort={onSort} />
                {COLUMNS.map((column) => (
                  <SortHeader key={column.key} label={column.label} column={column.key} sort={sort} onSort={onSort} numeric />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-ink">
                    <span className="font-medium">{row.name}</span>
                    {row.sub && <span className="block text-xs text-subtle">{row.sub}</span>}
                  </th>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{formatFunnelCount(row.received)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{formatFunnelCount(row.contacted)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{formatFunnelCount(row.converted)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{formatShare(row.conversion_rate) ?? "None received"}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-muted">{formatDuration(row.median_first_response_minutes) ?? "No responses"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CsvButton({ target, query, window }: { target: string; query: string; window: { from: string; to: string } }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);
  async function download() {
    setBusy(true);
    setNotice(null);
    const answer = await downloadLeadFunnelCsv(target, query);
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), funnelCsvName(window.from, window.to));
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}.` });
  }
  return (
    <div>
      <Button variant="secondary" onClick={download} disabled={busy} aria-busy={busy}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing the file…" : "Download the tables (CSV)"}
      </Button>
      <div aria-live="polite" className="mt-2">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
    </div>
  );
}

function Breakdowns({ report, typeLabels, listingNames, csv }: { report: LeadFunnelReport; typeLabels: Labels; listingNames: Labels; csv: ReactNode }) {
  const agents: Row[] = report.by_agent.map((row) => ({ ...row, key: row.user_id ?? "inbox", name: row.name, sub: row.user_id ? undefined : "Not assigned to anyone yet" }));
  const types: Row[] = report.by_request_type.map((row) => ({ ...row, key: row.request_type, name: typeLabels[row.request_type] ?? row.label }));
  const listings: Row[] = report.by_listing.map((row) => ({
    ...row,
    key: row.listing_id,
    name: row.listing?.title || listingNames[row.listing_id] || "Listing without a public page",
    sub: row.listing?.reference ? `Reference ${row.listing.reference}` : undefined,
  }));
  const campaigns: Row[] = (report.by_campaign ?? []).map((row) => ({
    ...row,
    key: row.campaign ? `${row.campaign.source}/${row.campaign.medium}/${row.campaign.campaign}` : "none",
    name: campaignLabel(row.campaign),
    sub: row.campaign ? undefined : "No campaign, or the browser asked not to be tracked",
  }));
  return (
    <section aria-labelledby="funnel-breakdowns" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="funnel-breakdowns" className="text-2xl">
            Breakdowns
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Conversion is converted ÷ received. Median first response is over the answered requests only.</p>
        </div>
        {csv}
      </div>
      <BreakdownTable
        title={report.scope === "DIRECT_SELLER" ? "By person" : "By agent"}
        intro="Grouped by who holds each request now, not who held it at each step."
        firstColumn="Agent"
        rows={agents}
      />
      <BreakdownTable title="By type of request" intro="Every type, including those with no requests." firstColumn="Type" rows={types} />
      <BreakdownTable title="By listing" intro="The 20 listings with the most requests." firstColumn="Listing" rows={listings} />
      {campaigns.length > 0 && (
        <BreakdownTable
          title="By campaign"
          intro="Where the customer's visit came from (utm_source · utm_medium · utm_campaign of the page they landed on). The 20 campaigns with the most requests, then the requests without one."
          firstColumn="Campaign"
          rows={campaigns}
        />
      )}
    </section>
  );
}

// ---- The report --------------------------------------------------------------------

/** What the filters form needs besides the report. */
type FormContext = Omit<Parameters<typeof FunnelFiltersForm>[0], "report">;

/** The form, then the figures for a valid window. The form offers the people and listings the report names. */
function Report({ form, query, csvQuery }: { form: FormContext; query: string; csvQuery: string | null }) {
  const { target, user, filters, typeLabels, listings } = form;
  const load = useCallback(() => getLeadFunnel(target.id, query), [target.id, query]);
  const { state, reload } = useApi(load);
  const listingNames = listings.status === "ready" ? listings.names : {};
  const report = state.status === "ready" ? state.data : null;

  const cleared = `${PATH}${funnelSearch({ period: filters.period, from: filters.from, to: filters.to, org: filters.org })}`;

  return (
    <>
      <div className="mt-8">
        <FunnelFiltersForm {...form} report={report} />
      </div>
      <div className="mt-8 space-y-8">
        <p role="status" className="sr-only">
          {state.status === "ready" ? "The figures have loaded." : ""}
        </p>
        <ScopeNote scope={report?.scope ?? expectedScope(target)} target={target} user={user} />
        {state.status === "loading" && <LoadingBlock label="Loading the figures" rows={3} />}
        {state.status === "error" &&
          (state.failure.status === 404 ? (
            <EmptyState title="These figures are not available to you" action={<ButtonLink href={INBOX} variant="secondary">Request inbox</ButtonLink>}>
              Lead figures for {target.name} are for its members.
            </EmptyState>
          ) : (
            <LoadError failure={state.failure} onRetry={reload} />
          ))}
        {report && (
          <>
            <div>
              <p className="text-lg text-ink">
                {report.window.from === report.window.to ? dayLong(report.window.from) : `${dayLong(report.window.from)} to ${dayLong(report.window.to)}`}
              </p>
              <p className="text-sm text-muted">
                {formatFunnelCount(report.received)} {report.received === 1 ? "request" : "requests"} received in {formatFunnelCount(report.window.days)}{" "}
                {report.window.days === 1 ? "day" : "days"} ({report.window.timezone} days). Figures worked out at {formatWhen(report.generated_at)}.
              </p>
            </div>
            {report.received === 0 ? (
              <EmptyState
                title="No requests in this period"
                action={
                  hasNarrowingFunnelFilters(filters) ? (
                    <ButtonLink href={cleared} variant="secondary" scroll={false}>
                      Clear filters
                    </ButtonLink>
                  ) : filters.period !== "90d" ? (
                    <ButtonLink href={`${PATH}${funnelSearch({ period: "90d", org: filters.org })}`} variant="secondary" scroll={false}>
                      Show the last 90 days
                    </ButtonLink>
                  ) : undefined
                }
              >
                {hasNarrowingFunnelFilters(filters)
                  ? "No request received in these days matches the filters."
                  : "No customer request was received in these days. The figures appear once requests arrive."}
              </EmptyState>
            ) : (
              <>
                <FunnelChart report={report} />
                <KpiTiles report={report} />
                <Breakdowns
                  report={report}
                  typeLabels={typeLabels}
                  listingNames={listingNames}
                  csv={csvQuery ? <CsvButton target={target.id} query={csvQuery} window={report.window} /> : null}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FunnelPage({ user, typeLabels, countries }: { user: User; typeLabels: Labels; countries: Country[] }) {
  const params = useSearchParams();
  const search = params.toString();
  const today = utcToday();
  const { filters, errors } = useMemo(() => parseFunnelFilters(new URLSearchParams(search), today), [search, today]);
  const loadDashboard = useCallback(() => getDashboard(), []);
  const { state, reload } = useApi(loadDashboard);
  const listings = useListingOptions();

  const targets = state.status === "ready" ? targetsOf(state.data) : [];
  const target = targets.find((item) => item.id === filters.org) ?? targets[0];
  const query = target && hasValidWindow(errors) ? funnelApiQuery({ ...filters, org: target.id }, today) : null;
  const csvQuery = target && hasValidWindow(errors) ? funnelApiQuery({ ...filters, org: target.id }, today, "csv") : null;

  return (
    <>
      <BackLink href={INBOX}>Request inbox</BackLink>
      <h1 className="mt-1 text-4xl">Lead conversion</h1>
      <p className="mt-2 max-w-2xl text-muted">
        How the requests received in a period moved from received to converted, and how quickly they were first answered. Every request is counted once,
        from the day it arrived.{" "}
        <Link href={INBOX} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
          Open the inbox
        </Link>
      </p>
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
      {target &&
        (() => {
          const form: FormContext = { filters, urlErrors: errors, targets, target, user, typeLabels, countries, listings, today };
          return query ? (
            <Report key={`${search}|${target.id}`} form={form} query={query} csvQuery={csvQuery} />
          ) : (
            <>
              <div className="mt-8">
                <FunnelFiltersForm key={search} {...form} report={null} />
              </div>
              <p className="mt-8 text-muted">Choose the first and last day, then press Show.</p>
            </>
          );
        })()}
    </>
  );
}

type Props = {
  /** code -> label of the API's `request_types` reference set. */
  requestTypeLabels: Labels;
  /** Every country, by name, for the Country filter. */
  countries: Country[];
};

/** `/agent/requests/funnel`: for whoever has the request inbox. */
export function LeadFunnel({ requestTypeLabels, countries }: Props) {
  return (
    <RequireAuth allow={canUseInbox}>{(user) => <FunnelPage user={user} typeLabels={requestTypeLabels} countries={countries} />}</RequireAuth>
  );
}
