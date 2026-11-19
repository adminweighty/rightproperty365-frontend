"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { TAX_RULE_ROLES } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { adminListTaxRules, adminLookupTaxRule, type TaxRule } from "@/lib/api/tax-rules";
import {
  APPLIES_TO,
  appliesToLabel,
  formatDay,
  formatRate,
  lookupQuery,
  periodText,
  taxStatusLabel,
} from "@/lib/tax-rules";

const PATH = "/admin/tax-rules";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "RETIRED", label: "Retired" },
] as const;

const APPLIES_OPTIONS: SelectOption[] = APPLIES_TO.map((code) => ({ value: code, label: appliesToLabel(code) }));

function hrefFor(filters: { market: string; appliesTo: string; status: string }) {
  const query = new URLSearchParams();
  if (filters.market) query.set("market", filters.market);
  if (filters.appliesTo) query.set("applies_to", filters.appliesTo);
  if (filters.status) query.set("status", filters.status);
  const text = query.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** Said on every tax page of the console (contract 0.43.0, "Where they are used"). */
export function TaxNotAppliedNote() {
  return (
    <div role="note" className="mt-3 max-w-2xl rounded-md bg-info-soft p-3 text-sm text-ink">
      <p>
        <strong className="font-semibold">These rules are not applied anywhere yet.</strong> They are stored and can be
        looked up, but nothing charges or shows tax from them: subscription invoices carry no tax, and customers never see
        these rates. A venue&rsquo;s quote still uses the tax its owner set in the venue&rsquo;s own settings.
      </p>
    </div>
  );
}

export function SampleBadge() {
  return <Badge tone="warning">Sample — confirm with a tax adviser</Badge>;
}

function RuleSummary({ rule, names }: { rule: TaxRule; names: Record<string, string> }) {
  const status = taxStatusLabel(rule.status);
  return (
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-2">
        <Link href={`${PATH}/${rule.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
          {rule.tax_name} {formatRate(rule.rate)}
        </Link>
        <Badge tone={status.tone}>{status.label}</Badge>
        {rule.is_sample && <SampleBadge />}
      </p>
      <p className="text-sm text-ink">
        {names[rule.market_code] ?? rule.market_code} ({rule.market_code}) · {appliesToLabel(rule.applies_to)} ·{" "}
        {rule.inclusive ? "included in prices" : "added to prices"}
      </p>
      <p className="text-xs text-subtle">{periodText(rule.effective_from, rule.effective_to)}</p>
    </div>
  );
}

/** Which rule is in force for a market, a use and a day. */
function Lookup({ markets, names }: { markets: SelectOption[]; names: Record<string, string> }) {
  const [market, setMarket] = useState("");
  const [appliesTo, setAppliesTo] = useState<string>("SUBSCRIPTIONS");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"market" | "applies_to" | "at", string>>>({});
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ rule: TaxRule | null; asked: string } | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = lookupQuery({ market, appliesTo, date });
    if (!question.ok) {
      setErrors(question.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    setFailure(null);
    const result = await adminLookupTaxRule(question.query);
    setBusy(false);
    if (!result.ok) {
      setAnswer(null);
      setFailure(result.failure);
      return;
    }
    const where = names[market] ?? market;
    setAnswer({ rule: result.data.tax_rule, asked: `${appliesToLabel(appliesTo)} in ${where}, ${date ? formatDay(`${date}T00:00:00Z`) : "today"}` });
  }

  return (
    <section aria-labelledby="tax-lookup-heading" className="mt-12">
      <h2 id="tax-lookup-heading" className="text-2xl">
        Look up the rule in force
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">The active rule for a country and a use on a day (UTC). For checking only: it is not charged.</p>
      <form noValidate onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_12rem_auto] lg:items-start">
        <Field id="tax-lookup-market" label="Country" error={errors.market}>
          {markets.length > 0 ? (
            <SearchableSelect
              id="tax-lookup-market"
              options={markets}
              value={market}
              onValueChange={setMarket}
              aria-invalid={Boolean(errors.market)}
              aria-describedby={fieldDescribedBy("tax-lookup-market", { error: errors.market })}
            />
          ) : (
            <Input
              id="tax-lookup-market"
              value={market}
              onChange={(event) => setMarket(event.target.value.toUpperCase())}
              maxLength={2}
              placeholder="ZW"
              autoComplete="off"
              aria-invalid={Boolean(errors.market)}
              aria-describedby={fieldDescribedBy("tax-lookup-market", { error: errors.market })}
            />
          )}
        </Field>
        <Field id="tax-lookup-applies" label="Applies to" error={errors.applies_to}>
          <SearchableSelect id="tax-lookup-applies" options={APPLIES_OPTIONS} value={appliesTo} onValueChange={setAppliesTo} />
        </Field>
        <Field id="tax-lookup-date" label="On" optional error={errors.at}>
          <Input
            id="tax-lookup-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={Boolean(errors.at)}
            aria-describedby={fieldDescribedBy("tax-lookup-date", { error: errors.at })}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy || undefined} className="lg:mt-7">
          <Search className="size-4" aria-hidden="true" />
          {busy ? "Looking up…" : "Look up"}
        </Button>
      </form>
      <div className="mt-4" aria-live="polite">
        {failure && <Alert title={failure.message} traceId={failure.traceId} />}
        {answer && answer.rule && (
          <Card padded={false}>
            <p className="px-5 pt-4 text-sm text-muted">{answer.asked}:</p>
            <div className="flex flex-col gap-2 px-5 pb-4 sm:flex-row sm:items-center">
              <RuleSummary rule={answer.rule} names={names} />
            </div>
          </Card>
        )}
        {answer && !answer.rule && <p className="text-muted">No active rule covers {answer.asked}.</p>}
      </div>
    </section>
  );
}

function Rules({ markets }: { markets: SelectOption[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const market = (params.get("market") ?? "").toUpperCase();
  const appliesTo = APPLIES_TO.find((code) => code === params.get("applies_to")?.toUpperCase()) ?? "";
  const status = STATUS_FILTERS.find((item) => item.key === params.get("status")?.toUpperCase())?.key ?? "";
  const load = useCallback(() => adminListTaxRules({ market, applies_to: appliesTo, status }), [market, appliesTo, status]);
  const { state, reload } = useApi(load);
  const names = Object.fromEntries(markets.map((option) => [option.value, option.label]));

  const marketOptions: SelectOption[] = [{ value: "", label: "Every country" }, ...markets];
  if (market && !marketOptions.some((option) => option.value === market)) marketOptions.push({ value: market, label: market });

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Tax rules</h1>
          <p className="mt-2 max-w-2xl text-muted">
            The tax rate per country for subscriptions, venue bookings and listing fees, with the dates each applies. Two
            active rules of one country and use may not overlap.
          </p>
          <TaxNotAppliedNote />
        </div>
        <ButtonLink href={market ? `${PATH}/new?market=${market}` : `${PATH}/new`}>
          <Plus className="size-4" aria-hidden="true" />
          New rule
        </ButtonLink>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <Field id="tax-market" label="Country">
          <SearchableSelect
            id="tax-market"
            options={marketOptions}
            value={market}
            onValueChange={(value) => router.replace(hrefFor({ market: value, appliesTo, status }), { scroll: false })}
          />
        </Field>
        <Field id="tax-applies" label="Applies to">
          <SearchableSelect
            id="tax-applies"
            options={[{ value: "", label: "Everything" }, ...APPLIES_OPTIONS]}
            value={appliesTo}
            onValueChange={(value) => router.replace(hrefFor({ market, appliesTo: value, status }), { scroll: false })}
          />
        </Field>
      </div>
      <div className="mt-4">
        <ChipNav
          label="Rule status"
          items={STATUS_FILTERS.map((item) => ({
            key: item.key || "all",
            href: hrefFor({ market, appliesTo, status: item.key }),
            label: item.label,
            current: item.key === status,
          }))}
        />
      </div>

      <p role="status" className="sr-only">
        {state.status === "ready" ? `${state.data.tax_rules.length} rules.` : ""}
      </p>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading the tax rules" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.tax_rules.length === 0 && (
          <EmptyState
            title={market || appliesTo || status ? "No rules match these filters" : "No tax rules yet"}
            action={
              <ButtonLink href={`${PATH}/new`} variant="secondary">
                Add a rule
              </ButtonLink>
            }
          />
        )}
        {state.status === "ready" && state.data.tax_rules.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {state.data.tax_rules.map((rule) => (
                <li key={rule.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <RuleSummary rule={rule} names={names} />
                  <ButtonLink href={`${PATH}/${rule.id}`} size="sm" variant="secondary">
                    {rule.status === "ACTIVE" ? "Edit" : "View"}
                    <span className="sr-only">
                      {" "}
                      {rule.tax_name} {rule.market_code}
                    </span>
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Lookup markets={markets} names={names} />
    </>
  );
}

/** `/admin/tax-rules` (SUPER_ADMIN, FINANCE_ADMIN). */
export function TaxRuleList({ markets }: { markets: SelectOption[] }) {
  return (
    <RoleGate roles={TAX_RULE_ROLES} what="the tax rules">
      {() => <Rules markets={markets} />}
    </RoleGate>
  );
}
