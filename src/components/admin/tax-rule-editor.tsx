"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { SampleBadge, TaxNotAppliedNote } from "@/components/admin/tax-rule-list";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { TAX_RULE_ROLES } from "@/lib/api/auth";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import { adminCreateTaxRule, adminGetTaxRule, adminRetireTaxRule, adminUpdateTaxRule, type TaxRule } from "@/lib/api/tax-rules";
import {
  APPLIES_TO,
  appliesToLabel,
  formatRate,
  periodText,
  taxStatusLabel,
  toDateInput,
  validateTaxRule,
  type TaxRuleDraft,
  type TaxRuleErrors,
} from "@/lib/tax-rules";

const PATH = "/admin/tax-rules";

type Props = {
  /** Absent for a new rule. */
  ruleId?: string;
  /** Every country, by name. Empty when it could not be loaded. */
  markets: SelectOption[];
};

const APPLIES_OPTIONS: SelectOption[] = APPLIES_TO.map((code) => ({ value: code, label: appliesToLabel(code) }));
const FIELD_KEYS = new Set<string>([
  "market_code",
  "tax_name",
  "rate",
  "applies_to",
  "inclusive",
  "effective_from",
  "effective_to",
  "registration_number_label",
  "notes",
  "is_sample",
]);

function toDraft(rule: TaxRule | null, market: string): TaxRuleDraft {
  return {
    market: rule?.market_code ?? market,
    taxName: rule?.tax_name ?? "",
    rate: rule?.rate ?? "",
    appliesTo: rule?.applies_to ?? "SUBSCRIPTIONS",
    inclusive: rule?.inclusive ?? false,
    effectiveFrom: toDateInput(rule?.effective_from),
    effectiveTo: toDateInput(rule?.effective_to),
    registrationLabel: rule?.registration_number_label ?? "",
    notes: rule?.notes ?? "",
    // A new rate is a sample until someone confirms it with a tax adviser.
    isSample: rule?.is_sample ?? true,
  };
}

function fromFailure(failure: ApiFailure): { errors: TaxRuleErrors; message: string | null } {
  if (failure.code === "TAX_RULE_OVERLAP") {
    return {
      errors: { effective_from: "Another active rule of this country and use covers part of these dates. Change the dates, or retire or end the other rule first." },
      message: null,
    };
  }
  const errors: TaxRuleErrors = {};
  for (const [key, text] of Object.entries(failure.fields ?? {})) {
    if (FIELD_KEYS.has(key)) errors[key as keyof TaxRuleErrors] = text;
  }
  return { errors, message: Object.keys(errors).length > 0 ? null : failure.message };
}

function Form({ rule, initial, markets, onSaved }: { rule: TaxRule | null; initial: TaxRuleDraft; markets: SelectOption[]; onSaved: (rule: TaxRule) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<TaxRuleErrors>({});
  const [message, setMessage] = useState<{ text: string; traceId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [retireError, setRetireError] = useState<string | undefined>();
  const set = <K extends keyof TaxRuleDraft>(key: K, value: TaxRuleDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const fixed = Boolean(rule);
  const described = (id: string, error?: string, hint?: string) => fieldDescribedBy(id, { error, hint });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setNotice(null);
    const { input, errors: found } = validateTaxRule(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const { market_code, applies_to, ...change } = input;
    const result: ApiResult<{ tax_rule: TaxRule }> = rule
      ? await adminUpdateTaxRule(rule.id, change)
      : await adminCreateTaxRule({ ...change, market_code, applies_to });
    setBusy(false);
    if (!result.ok) {
      const { errors: apiErrors, message: text } = fromFailure(result.failure);
      setErrors(apiErrors);
      if (text) setMessage({ text, traceId: result.failure.traceId });
      return;
    }
    if (!rule) {
      router.replace(`${PATH}/${result.data.tax_rule.id}`);
      return;
    }
    setNotice("Rule saved.");
    onSaved(result.data.tax_rule);
  }

  async function retire() {
    if (!rule) return;
    setBusy(true);
    setRetireError(undefined);
    const result = await adminRetireTaxRule(rule.id);
    setBusy(false);
    if (!result.ok) {
      setRetireError(result.failure.message);
      return;
    }
    setRetiring(false);
    onSaved(result.data.tax_rule);
  }

  const rateHint = "A percent, digits exactly as they should be kept: 15 or 12.5. From 0 to 100, at most 4 decimals, no % sign.";
  const fromHint = "The first day it applies (UTC).";
  const toHint = "The day it stops applying (not included). Leave empty for no end.";

  return (
    <form noValidate onSubmit={submit} className="mt-8 space-y-6">
      {message && <Alert title={message.text} traceId={message.traceId} />}
      {notice && <Alert tone="success" title={notice} />}
      <Card className="grid gap-5 sm:grid-cols-2">
        <Field id="tax-market" label="Country" error={errors.market_code} hint={fixed ? "Fixed once the rule exists." : undefined}>
          {markets.length > 0 ? (
            <SearchableSelect
              id="tax-market"
              options={markets}
              value={draft.market}
              disabled={fixed}
              onValueChange={(value) => set("market", value)}
              aria-invalid={Boolean(errors.market_code)}
              aria-describedby={described("tax-market", errors.market_code, fixed ? "x" : undefined)}
            />
          ) : (
            <Input
              id="tax-market"
              value={draft.market}
              disabled={fixed}
              onChange={(event) => set("market", event.target.value.toUpperCase())}
              maxLength={2}
              placeholder="ZW"
              autoComplete="off"
              aria-invalid={Boolean(errors.market_code)}
              aria-describedby={described("tax-market", errors.market_code, fixed ? "x" : undefined)}
            />
          )}
        </Field>
        <Field id="tax-applies" label="Applies to" error={errors.applies_to} hint={fixed ? "Fixed once the rule exists." : undefined}>
          <SearchableSelect
            id="tax-applies"
            options={APPLIES_OPTIONS}
            value={draft.appliesTo}
            disabled={fixed}
            onValueChange={(value) => set("appliesTo", value)}
            aria-invalid={Boolean(errors.applies_to)}
            aria-describedby={described("tax-applies", errors.applies_to, fixed ? "x" : undefined)}
          />
        </Field>
        <Field id="tax-name" label="Tax name" error={errors.tax_name} hint="As it is printed: VAT, GST.">
          <Input
            id="tax-name"
            value={draft.taxName}
            onChange={(event) => set("taxName", event.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errors.tax_name)}
            aria-describedby={described("tax-name", errors.tax_name, "x")}
          />
        </Field>
        <Field id="tax-rate" label="Rate (%)" error={errors.rate} hint={rateHint}>
          <Input
            id="tax-rate"
            value={draft.rate}
            onChange={(event) => set("rate", event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="font-mono tabular-nums"
            aria-invalid={Boolean(errors.rate)}
            aria-describedby={described("tax-rate", errors.rate, "x")}
          />
        </Field>
        <Field id="tax-from" label="From" error={errors.effective_from} hint={fromHint}>
          <Input
            id="tax-from"
            type="date"
            value={draft.effectiveFrom}
            onChange={(event) => set("effectiveFrom", event.target.value)}
            aria-invalid={Boolean(errors.effective_from)}
            aria-describedby={described("tax-from", errors.effective_from, "x")}
          />
        </Field>
        <Field id="tax-to" label="Until" optional error={errors.effective_to} hint={toHint}>
          <Input
            id="tax-to"
            type="date"
            value={draft.effectiveTo}
            onChange={(event) => set("effectiveTo", event.target.value)}
            aria-invalid={Boolean(errors.effective_to)}
            aria-describedby={described("tax-to", errors.effective_to, "x")}
          />
        </Field>
        <Field id="tax-reg-label" label="Registration number label" optional error={errors.registration_number_label} hint="What the tax number is called on an invoice: VAT registration number." className="sm:col-span-2">
          <Input
            id="tax-reg-label"
            value={draft.registrationLabel}
            onChange={(event) => set("registrationLabel", event.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errors.registration_number_label)}
            aria-describedby={described("tax-reg-label", errors.registration_number_label, "x")}
          />
        </Field>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={draft.inclusive} onChange={(event) => set("inclusive", event.target.checked)} aria-describedby="tax-inclusive-hint" />
          <span>
            <span className="font-medium text-ink">Prices already include this tax</span>
            <span id="tax-inclusive-hint" className="block text-sm text-muted">
              Leave unticked when the tax is added on top of the price.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={draft.isSample} onChange={(event) => set("isSample", event.target.checked)} aria-describedby="tax-sample-hint" />
          <span>
            <span className="font-medium text-ink">This is a sample value, not yet confirmed</span>
            <span id="tax-sample-hint" className="block text-sm text-muted">
              Untick it only once a tax adviser has confirmed the rate and dates.
            </span>
          </span>
        </label>
        <Field id="tax-notes" label="Notes" optional error={errors.notes} className="sm:col-span-2">
          <Textarea
            id="tax-notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={described("tax-notes", errors.notes)}
          />
        </Field>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : rule ? "Save the rule" : "Create the rule"}
        </Button>
        {rule && (
          <Button variant="danger" disabled={busy} onClick={() => setRetiring(true)}>
            Retire this rule
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={retiring}
        title="Retire this tax rule?"
        confirmLabel="Retire"
        busyLabel="Retiring…"
        busy={busy}
        error={retireError}
        onConfirm={retire}
        onCancel={() => setRetiring(false)}
      >
        <p>It stops being looked up and cannot be made active again. Add a new rule for the same dates if you need one.</p>
      </ConfirmDialog>
    </form>
  );
}

function RetiredRule({ rule, names }: { rule: TaxRule; names: Record<string, string> }) {
  return (
    <Card className="mt-8">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Country</dt>
        <dd className="text-ink">{names[rule.market_code] ?? rule.market_code} ({rule.market_code})</dd>
        <dt className="text-muted">Applies to</dt>
        <dd className="text-ink">{appliesToLabel(rule.applies_to)}</dd>
        <dt className="text-muted">Rate</dt>
        <dd className="font-mono text-ink">{formatRate(rule.rate)} ({rule.inclusive ? "included in prices" : "added to prices"})</dd>
        <dt className="text-muted">Dates</dt>
        <dd className="text-ink">{periodText(rule.effective_from, rule.effective_to)}</dd>
        {rule.registration_number_label && (
          <>
            <dt className="text-muted">Registration number label</dt>
            <dd className="text-ink">{rule.registration_number_label}</dd>
          </>
        )}
        {rule.notes && (
          <>
            <dt className="text-muted">Notes</dt>
            <dd className="whitespace-pre-wrap text-ink">{rule.notes}</dd>
          </>
        )}
      </dl>
      <p className="mt-4 text-sm text-muted">A retired rule cannot be changed.</p>
    </Card>
  );
}

function Editor({ ruleId, markets }: Props) {
  const params = useSearchParams();
  const market = (params.get("market") ?? "").toUpperCase();
  const load = useCallback(
    async (): Promise<ApiResult<TaxRule | null>> => {
      if (!ruleId) return { ok: true, status: 200, data: null };
      const result = await adminGetTaxRule(ruleId);
      return result.ok ? { ...result, data: result.data.tax_rule } : result;
    },
    [ruleId],
  );
  const { state, reload, replace } = useApi(load);
  const rule = state.status === "ready" ? state.data : null;
  const names = Object.fromEntries(markets.map((option) => [option.value, option.label]));

  return (
    <>
      <BackLink href={PATH}>Tax rules</BackLink>
      <h1 className="mt-1 break-words text-4xl">{rule ? `${rule.tax_name} ${formatRate(rule.rate)}, ${rule.market_code}` : "New tax rule"}</h1>
      <TaxNotAppliedNote />
      {state.status === "loading" && <div className="mt-8"><LoadingBlock label="Loading the rule" rows={2} /></div>}
      {state.status === "error" && <div className="mt-8"><LoadError failure={state.failure} onRetry={reload} /></div>}
      {state.status === "ready" && (
        <>
          {rule && (
            <div className="mt-3 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone={taxStatusLabel(rule.status).tone}>{taxStatusLabel(rule.status).label}</Badge>
                {rule.is_sample && <SampleBadge />}
              </p>
              <p className="text-xs text-subtle">
                Created {formatWhen(rule.created_at)} · last changed {formatWhen(rule.updated_at)}
              </p>
            </div>
          )}
          {rule?.is_sample && (
            <Alert tone="warning" title="This is a sample value." className="mt-4">
              Confirm the rate and the dates with a tax adviser, then untick &ldquo;This is a sample value&rdquo;.
            </Alert>
          )}
          {rule && rule.status === "RETIRED" ? (
            <RetiredRule rule={rule} names={names} />
          ) : (
            <Form key={rule?.id ?? "new"} rule={rule} markets={markets} initial={toDraft(rule, market)} onSaved={replace} />
          )}
        </>
      )}
    </>
  );
}

/** `/admin/tax-rules/new` and `/admin/tax-rules/[id]` (SUPER_ADMIN, FINANCE_ADMIN). */
export function TaxRuleEditor(props: Props) {
  return (
    <RoleGate roles={TAX_RULE_ROLES} what="the tax rules">
      {() => <Editor {...props} />}
    </RoleGate>
  );
}
