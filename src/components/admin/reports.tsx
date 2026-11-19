"use client";

import { Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, LoadError, LoadingBlock, StatTile } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { adminReportExport, adminReportSummary, type ReportExport, type ReportRange, type ReportSection, type ReportSummary } from "@/lib/api/admin-reports";
import {
  hasPlatformRole,
  PAYMENT_EXPORT_ROLES,
  PEOPLE_EXPORT_ROLES,
  REPORT_ROLES,
  SUBSCRIPTION_EXPORT_ROLES,
  titleFromCode,
  type PlatformRole,
  type User,
} from "@/lib/api/auth";
import { formatAmount, formatDay, SUBSCRIPTION_STATUS, todayIso } from "@/lib/subscriptions";

const PATH = "/admin/reports";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Country = { value: string; label: string; keywords?: string[] };

type SectionKey = Exclude<keyof ReportSummary, "from" | "to" | "market_codes" | "revenue">;

const SECTIONS: { key: SectionKey; title: string; groupLabel: string; intro: string }[] = [
  { key: "new_users", title: "New accounts", groupLabel: "Role", intro: "By the role chosen. A person with several roles counts once per role. Administrators are not counted." },
  { key: "onboarding_applications", title: "Applications", groupLabel: "Status now", intro: "Applications for professional roles started in the range." },
  { key: "listings", title: "Listings", groupLabel: "Status now", intro: "Listings created in the range." },
  { key: "property_requests", title: "Property requests", groupLabel: "Stage now", intro: "Requests sent in the range." },
  { key: "business_enquiries", title: "Business enquiries", groupLabel: "Status now", intro: "Enquiries sent to businesses in the directory." },
  { key: "leases", title: "Leases", groupLabel: "Status now", intro: "Leases drafted in the range." },
  { key: "agreements", title: "Agreements", groupLabel: "Status now", intro: "Documents sent for signature. They have no country." },
  { key: "subscriptions", title: "Subscriptions", groupLabel: "Status now", intro: "Subscriptions requested in the range." },
];

const GROUP_WORDS: Record<string, string> = {
  NONE: "No role",
  ROUTING_EXCEPTION: "Could not be sent to anyone",
  PENDING_REVIEW: "Waiting for review",
  CHANGES_REQUESTED: "Changes requested",
};

const EXPORTS: { kind: ReportExport; label: string; roles: readonly PlatformRole[]; note: string }[] = [
  { kind: "users", label: "Accounts (CSV)", roles: PEOPLE_EXPORT_ROLES, note: "Names and email addresses: personal data." },
  { kind: "listings", label: "Listings (CSV)", roles: PEOPLE_EXPORT_ROLES, note: "Every listing created in the range." },
  { kind: "subscriptions", label: "Subscriptions (CSV)", roles: SUBSCRIPTION_EXPORT_ROLES, note: "Invoices, payments recorded and refunds due." },
  { kind: "payments", label: "Online payments (CSV)", roles: PAYMENT_EXPORT_ROLES, note: "Online checkouts, their status and refunds. Not limited by country." },
];

/** The days before `to`, as YYYY-MM-DD. */
function daysBefore(to: string, days: number) {
  const at = new Date(`${to}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
}

function SectionTable({
  id,
  title,
  groupLabel,
  intro,
  section,
  label,
  countryName,
}: {
  id: string;
  title: string;
  groupLabel: string;
  intro: string;
  section: ReportSection;
  label: (group: string) => string;
  countryName: (code: string | null) => string;
}) {
  const markets = [...new Set(section.rows.map((row) => row.market_code))].sort((a, b) => (a ?? "~").localeCompare(b ?? "~"));
  const groups = [...new Set(section.rows.map((row) => row.group))];
  const count = (group: string, market?: string | null) =>
    section.rows
      .filter((row) => row.group === group && (market === undefined || row.market_code === market))
      .reduce((sum, row) => sum + row.count, 0);
  groups.sort((a, b) => count(b) - count(a));
  const perMarket = markets.length > 1;

  return (
    <section aria-labelledby={id}>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={id} className="text-2xl">
            {title}
          </h2>
          <p className="text-2xl font-bold tabular-nums">{section.total}</p>
        </div>
        <p className="mt-1 text-sm text-muted">{intro}</p>
        {groups.length === 0 ? (
          <p className="mt-4 text-muted">None in this range.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-80 text-left text-sm">
              <caption className="sr-only">
                {title} by {groupLabel.toLowerCase()}
                {perMarket ? " and country" : ""}
              </caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {groupLabel}
                  </th>
                  {perMarket &&
                    markets.map((market) => (
                      <th key={market ?? "none"} scope="col" className="py-2 pr-4 text-right font-medium">
                        <abbr title={countryName(market)} className="no-underline">
                          {market ?? "None"}
                        </abbr>
                      </th>
                    ))}
                  <th scope="col" className="py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {groups.map((group) => (
                  <tr key={group}>
                    <th scope="row" className="py-2 pr-4 font-normal text-ink">
                      {label(group)}
                    </th>
                    {perMarket &&
                      markets.map((market) => (
                        <td key={market ?? "none"} className="py-2 pr-4 text-right tabular-nums text-muted">
                          {count(group, market)}
                        </td>
                      ))}
                    <td className="py-2 text-right font-medium tabular-nums text-ink">{count(group)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function Downloads({ user, range }: { user: User; range: ReportRange }) {
  const [busy, setBusy] = useState<ReportExport | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string; traceId?: string } | null>(null);
  const allowed = EXPORTS.filter((item) => hasPlatformRole(user, item.roles));
  if (allowed.length === 0) return null;

  async function download(kind: ReportExport) {
    setBusy(kind);
    setNotice(null);
    const answer = await adminReportExport(kind, range);
    setBusy(null);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const { blob, headers } = answer.data;
    // The file name the API gives, when its header can be read from this site; otherwise one made the same way.
    const disposition = headers.get("Content-Disposition") ?? "";
    const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const name = named ?? `${kind}-${range.from ?? "start"}-to-${range.to ?? todayIso()}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    const truncated = headers.get("X-Export-Truncated") === "true";
    const total = headers.get("X-Total-Count");
    setNotice(
      truncated
        ? {
            tone: "warning",
            text: `Downloaded ${name}, but some rows were left out${total ? ` (${total} match)` : ""}. Choose a shorter date range to get them all.`,
          }
        : { tone: "success", text: `Downloaded ${name}.` },
    );
  }

  return (
    <section aria-labelledby="report-downloads">
      <Card>
        <h2 id="report-downloads" className="text-2xl">
          Download as a spreadsheet
        </h2>
        <p className="mt-1 text-sm text-muted">
          For the same dates and country. At most 10,000 rows per file, newest first. Store these files safely: they hold
          personal data.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {allowed.map((item) => (
            <li key={item.kind} className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => void download(item.kind)} disabled={busy !== null} aria-busy={busy === item.kind}>
                <Download className="size-4" aria-hidden="true" />
                {busy === item.kind ? "Preparing…" : item.label}
              </Button>
              <span className="text-sm text-muted">{item.note}</span>
            </li>
          ))}
        </ul>
        <div aria-live="polite">{notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-4" />}</div>
      </Card>
    </section>
  );
}

function Reports({ user, countries, roleLabels }: { user: User; countries: Country[]; roleLabels: Record<string, string> }) {
  const params = useSearchParams();
  const router = useRouter();
  const from = DAY.test(params.get("from") ?? "") ? params.get("from")! : "";
  const to = DAY.test(params.get("to") ?? "") ? params.get("to")! : "";
  const requested = (params.get("market") ?? "").toUpperCase();
  const market = /^[A-Z]{2}$/.test(requested) ? requested : "";
  const range: ReportRange = { from: from || undefined, to: to || undefined, markets: market ? [market] : undefined };
  const load = useCallback(
    () => adminReportSummary({ from: from || undefined, to: to || undefined, markets: market ? [market] : undefined }),
    [from, to, market],
  );
  const { state, reload } = useApi(load);
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const failureFields = state.status === "error" ? state.failure.fields : undefined;

  const countryName = (code: string | null) => (code ? (countries.find((country) => country.value === code)?.label ?? code) : "No country");

  function hrefFor(next: { from?: string; to?: string; market?: string }) {
    const query = new URLSearchParams();
    if (next.from) query.set("from", next.from);
    if (next.to) query.set("to", next.to);
    if (next.market) query.set("market", next.market);
    const text = query.toString();
    return text ? `${PATH}?${text}` : PATH;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextFrom = String(form.get("from") ?? "");
    const nextTo = String(form.get("to") ?? "");
    const nextMarket = String(form.get("market") ?? "");
    const next: { from?: string; to?: string } = {};
    if (nextFrom && nextTo && nextFrom > nextTo) next.from = "The first day must be on or before the last day.";
    if (nextTo && nextTo > todayIso()) next.to = "The last day cannot be in the future.";
    setErrors(next);
    if (next.from || next.to) {
      document.getElementById(next.from ? "report-from" : "report-to")?.focus();
      return;
    }
    router.push(hrefFor({ from: nextFrom, to: nextTo, market: nextMarket }), { scroll: false });
  }

  const today = todayIso();
  const quick = [
    { label: "Last 7 days", from: daysBefore(today, 6) },
    { label: "Last 30 days", from: daysBefore(today, 29) },
    { label: "Last 12 months", from: daysBefore(today, 364) },
  ];

  const groupLabel = (key: SectionKey) => (group: string) => {
    if (key === "new_users" && roleLabels[group]) return roleLabels[group];
    if (key === "subscriptions" && SUBSCRIPTION_STATUS[group]) return SUBSCRIPTION_STATUS[group].label;
    return GROUP_WORDS[group] ?? titleFromCode(group);
  };

  const fromError = errors.from ?? (failureFields?.from ? `First day ${failureFields.from}.` : undefined);
  const toError = errors.to ?? (failureFields?.to ? `Last day ${failureFields.to}.` : undefined);

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Reports</h1>
      <p className="mt-2 max-w-2xl text-muted">
        What was created over a range of days, grouped by its status now. Days are counted in UTC and both ends are included.
      </p>

      <form onSubmit={submit} noValidate aria-label="Report dates and country" className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end">
        <Field id="report-from" label="First day" error={fromError}>
          <Input
            id="report-from"
            name="from"
            type="date"
            defaultValue={from}
            key={`from-${from}`}
            max={today}
            aria-invalid={Boolean(fromError)}
            aria-describedby={fieldDescribedBy("report-from", { error: fromError })}
          />
        </Field>
        <Field id="report-to" label="Last day" error={toError}>
          <Input
            id="report-to"
            name="to"
            type="date"
            defaultValue={to}
            key={`to-${to}`}
            max={today}
            aria-invalid={Boolean(toError)}
            aria-describedby={fieldDescribedBy("report-to", { error: toError })}
          />
        </Field>
        <Field id="report-market" label="Country">
          <SearchableSelect id="report-market" name="market" options={[{ value: "", label: "Every country" }, ...countries]} defaultValue={market} />
        </Field>
        <Button type="submit">Show</Button>
      </form>
      <nav aria-label="Quick date ranges" className="mt-3">
        <ul className="flex flex-wrap gap-2">
          {quick.map((item) => (
            <li key={item.label}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setErrors({});
                  router.push(hrefFor({ from: item.from, to: today, market }), { scroll: false });
                }}
              >
                {item.label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      <p role="status" className="sr-only">
        {state.status === "ready" ? "The report has loaded." : ""}
      </p>

      <div className="mt-8 space-y-8">
        {state.status === "error" && !failureFields && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the report" rows={3} />}
        {data && (
          <>
            <p className="text-lg text-ink">
              {formatDay(data.from)} to {formatDay(data.to)} · {data.market_codes ? data.market_codes.map((code) => countryName(code)).join(", ") : "every country"}
            </p>

            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
              {SECTIONS.map((section) => (
                <li key={section.key}>
                  <StatTile label={section.title} value={data[section.key].total} />
                </li>
              ))}
            </ul>

            <section aria-labelledby="report-revenue">
              <Card>
                <h2 id="report-revenue" className="text-2xl">
                  Payments recorded
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Payments administrators recorded for subscriptions, by the day the money arrived. There is no online payment,
                  so this is money received outside the site. Each currency is added up on its own.
                </p>
                {data.revenue.length === 0 ? (
                  <p className="mt-4 text-muted">No payments were recorded in this range.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-80 text-left text-sm">
                      <caption className="sr-only">Payments recorded by currency and country</caption>
                      <thead className="border-b border-line text-muted">
                        <tr>
                          <th scope="col" className="py-2 pr-4 font-medium">Currency</th>
                          <th scope="col" className="py-2 pr-4 font-medium">Country</th>
                          <th scope="col" className="py-2 pr-4 text-right font-medium">Payments</th>
                          <th scope="col" className="py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {[...data.revenue]
                          .sort((a, b) => a.currency_code.localeCompare(b.currency_code) || (a.market_code ?? "").localeCompare(b.market_code ?? ""))
                          .map((row) => (
                            <tr key={`${row.currency_code}-${row.market_code ?? "none"}`}>
                              <th scope="row" className="py-2 pr-4 font-medium text-ink">{row.currency_code}</th>
                              <td className="py-2 pr-4 text-muted">{countryName(row.market_code)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-muted">{row.payments}</td>
                              <td className="py-2 text-right font-semibold tabular-nums text-ink">{formatAmount(row.total, row.currency_code)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>

            <Downloads user={user} range={range} />

            <div className="grid gap-6 lg:grid-cols-2">
              {SECTIONS.map((section) => (
                <SectionTable
                  key={section.key}
                  id={`report-${section.key}`}
                  title={section.title}
                  groupLabel={section.groupLabel}
                  intro={section.intro}
                  section={data[section.key]}
                  label={groupLabel(section.key)}
                  countryName={countryName}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** `/admin/reports` (SUPER_ADMIN, PLATFORM_ADMIN, FINANCE_ADMIN; the exports by what they contain). */
export function AdminReports({ countries, roleLabels }: { countries: Country[]; roleLabels: Record<string, string> }) {
  return (
    <RoleGate roles={REPORT_ROLES} what="the reports">
      {(user) => <Reports user={user} countries={countries} roleLabels={roleLabels} />}
    </RoleGate>
  );
}
