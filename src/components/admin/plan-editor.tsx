"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import {
  hasPlatformRole,
  SUBSCRIPTION_MANAGE_ROLES,
  SUBSCRIPTION_READ_ROLES,
  titleFromCode,
  type User,
} from "@/lib/api/auth";
import type { ApiResult } from "@/lib/api/http";
import {
  adminCreatePlan,
  adminGetPlan,
  adminListPlans,
  adminRetirePlan,
  adminUpdatePlan,
  type FeatureCode,
  type PlanPrice,
  type SubscriberKind,
  type SubscriptionPlan,
  type SubscriptionPlanInput,
} from "@/lib/api/subscriptions";
import { actionMessage, AMOUNT_PATTERN, FEATURE_LABELS, fieldText, toCents } from "@/lib/subscriptions";
import { cn } from "@/lib/cn";
import { PACKAGE_CODE } from "@/lib/packages";

const PATH = "/admin/subscription-plans";
const LIMIT_MAX = 1_000_000;
const BENEFITS_MAX = 20;

type Props = {
  /** Absent for a new plan. */
  planId?: string;
  /** code -> label of the `account_roles` reference set. */
  roleLabels: Record<string, string>;
  currencies: SelectOption[];
};

type Loaded = { featureCodes: FeatureCode[]; roles: string[]; plan: SubscriptionPlan | null };

type FeatureDraft = { value: string; unlimited: boolean };
type PriceRow = { key: string; currency: string; quarterly: string; yearly: string };
type BenefitRow = { key: string; text: string };

type Draft = {
  name: string;
  description: string;
  kind: SubscriberKind;
  roles: string[];
  features: Record<string, FeatureDraft>;
  benefits: BenefitRow[];
  prices: PriceRow[];
  sortOrder: string;
  packageCode: string;
};

type Errors = Partial<Record<"name" | "description" | "subscriber_kind" | "eligible_roles" | "features" | "benefits" | "prices" | "sort_order" | "package_code", string>>;

let rowCount = 0;
const rowKey = () => `row-${(rowCount += 1)}`;

const KIND_OPTIONS = [
  { value: "INDIVIDUAL", label: "For a person" },
  { value: "ORGANISATION", label: "For an organisation (its principal takes it)" },
];

/** MAX_ACTIVE_LISTINGS first, then the API's order. */
const orderedCodes = (codes: FeatureCode[]) =>
  ["MAX_ACTIVE_LISTINGS" as FeatureCode, ...codes.filter((code) => code !== "MAX_ACTIVE_LISTINGS")];

function toDraft(plan: SubscriptionPlan | null, codes: FeatureCode[]): Draft {
  const features: Record<string, FeatureDraft> = {};
  for (const code of orderedCodes(codes)) {
    const feature = plan?.features.find((item) => item.code === code);
    features[code] = { value: feature && feature.limit !== null ? String(feature.limit) : "", unlimited: Boolean(feature && feature.limit === null) };
  }
  const byCurrency = new Map<string, PriceRow>();
  for (const price of plan?.prices ?? []) {
    const row = byCurrency.get(price.currency_code) ?? { key: rowKey(), currency: price.currency_code, quarterly: "", yearly: "" };
    if (price.period === "QUARTERLY") row.quarterly = price.amount;
    else row.yearly = price.amount;
    byCurrency.set(price.currency_code, row);
  }
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    kind: plan?.subscriber_kind ?? "INDIVIDUAL",
    roles: plan?.eligible_roles ?? [],
    features,
    benefits: (plan?.benefits ?? []).map((text) => ({ key: rowKey(), text })),
    prices: byCurrency.size > 0 ? [...byCurrency.values()] : [{ key: rowKey(), currency: "USD", quarterly: "", yearly: "" }],
    sortOrder: plan ? String(plan.sort_order) : "",
    packageCode: plan?.package_code ?? "",
  };
}

/** The input for the API, or the problems to fix first. */
function validate(draft: Draft, hadPackageCode = false): { input: SubscriptionPlanInput; errors: Errors } {
  const errors: Errors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Enter the plan's name.";
  else if (name.length > 120) errors.name = "Use 120 characters or fewer.";
  const description = draft.description.trim();
  if (description.length > 2000) errors.description = "Use 2000 characters or fewer.";
  if (draft.roles.length === 0) errors.eligible_roles = "Choose at least one role the plan is offered to.";

  const features: { code: string; limit: number | null }[] = [];
  for (const [code, feature] of Object.entries(draft.features)) {
    if (feature.unlimited) {
      features.push({ code, limit: null });
      continue;
    }
    const text = feature.value.trim();
    if (!text) {
      if (code === "MAX_ACTIVE_LISTINGS") errors.features ??= "Enter the most active listings, or tick Unlimited.";
      continue;
    }
    const limit = Number(text);
    if (!/^\d+$/.test(text) || limit > LIMIT_MAX) {
      errors.features ??= `${FEATURE_LABELS[code] ?? code}: enter a whole number from 0 to ${LIMIT_MAX.toLocaleString("en-GB")}, or tick Unlimited.`;
      continue;
    }
    features.push({ code, limit });
  }

  const benefits = draft.benefits.map((row) => row.text.trim()).filter(Boolean);
  if (benefits.length > BENEFITS_MAX) errors.benefits = `Use ${BENEFITS_MAX} benefits or fewer.`;
  else if (benefits.some((text) => text.length > 200)) errors.benefits = "Keep each benefit to 200 characters or fewer.";

  const prices: PlanPrice[] = [];
  const seen = new Set<string>();
  for (const row of draft.prices) {
    const quarterly = row.quarterly.trim();
    const yearly = row.yearly.trim();
    if (!quarterly && !yearly) continue;
    if (!/^[A-Z]{3}$/.test(row.currency)) {
      errors.prices ??= "Choose the currency of each price.";
      continue;
    }
    if (seen.has(row.currency)) {
      errors.prices ??= `${row.currency} is listed twice. Use one row per currency.`;
      continue;
    }
    seen.add(row.currency);
    for (const [period, amount] of [
      ["QUARTERLY", quarterly],
      ["YEARLY", yearly],
    ] as const) {
      if (!amount) continue;
      const cents = toCents(amount);
      if (!AMOUNT_PATTERN.test(amount) || cents === null || cents <= 0) {
        errors.prices ??= `${row.currency} ${period === "QUARTERLY" ? "quarterly" : "yearly"}: enter an amount above 0 with at most two decimals, for example 30.00.`;
        continue;
      }
      prices.push({ currency_code: row.currency, period, amount });
    }
  }
  if (prices.length === 0) errors.prices ??= "Enter at least one price: a quarterly or a yearly amount in one currency.";

  const sortText = draft.sortOrder.trim();
  if (sortText && !/^-?\d+$/.test(sortText)) errors.sort_order = "Enter a whole number, or leave it empty.";

  // API 0.42.0: "" clears it. Sent only when it is set or was set, so an older API is not sent an unknown field.
  const packageCode = draft.packageCode.trim().toUpperCase();
  if (packageCode && !PACKAGE_CODE.test(packageCode)) {
    errors.package_code = "Use 2 to 32 capital letters, digits or underscores, starting with a letter, for example BUSINESS.";
  }

  return {
    errors,
    input: {
      name,
      description,
      subscriber_kind: draft.kind,
      eligible_roles: draft.roles,
      features,
      benefits,
      prices,
      ...(sortText && /^-?\d+$/.test(sortText) ? { sort_order: Number(sortText) } : {}),
      ...(packageCode || hadPackageCode ? { package_code: packageCode } : {}),
    },
  };
}

/** Where each problem is shown, in page order, to focus the first. */
const ERROR_TARGETS: [keyof Errors, string][] = [
  ["name", "plan-name"],
  ["description", "plan-description"],
  ["subscriber_kind", "plan-kind"],
  ["eligible_roles", "plan-roles"],
  ["features", "plan-features"],
  ["benefits", "plan-benefits"],
  ["prices", "plan-prices"],
  ["sort_order", "plan-sort"],
  ["package_code", "plan-package"],
];

function focusFirst(errors: Errors) {
  const target = ERROR_TARGETS.find(([key]) => errors[key]);
  if (target) document.getElementById(target[1])?.focus();
}

function GroupError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="mt-2 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

const legendClass = "font-sans text-lg font-semibold tracking-normal text-ink";
const groupClass = "rounded-lg border border-line p-4 outline-none focus-visible:outline-2 focus-visible:outline-focus";

function Form({
  loaded,
  roleLabels,
  currencies,
  manages,
  onSaved,
}: {
  loaded: Loaded;
  roleLabels: Record<string, string>;
  currencies: SelectOption[];
  manages: boolean;
  onSaved: (plan: SubscriptionPlan) => void;
}) {
  const router = useRouter();
  const created = useSearchParams().get("created") === "1" && Boolean(loaded.plan);
  const plan = loaded.plan;
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan, loaded.featureCodes));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [retireBusy, setRetireBusy] = useState(false);
  const [retireError, setRetireError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);
  const readOnly = !manages || plan?.status === "RETIRED";
  const roleName = (role: string) => roleLabels[role] ?? titleFromCode(role);
  // A role the plan already has is kept in the list even if the API no longer offers it.
  const roleChoices = [...new Set([...loaded.roles, ...draft.roles])];

  const set = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setSaved(false);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const { input, errors: problems } = validate(draft, Boolean(plan?.package_code));
    setErrors(problems);
    setFailure(null);
    if (Object.values(problems).some(Boolean)) {
      focusFirst(problems);
      return;
    }
    setBusy(true);
    const result: ApiResult<{ plan: SubscriptionPlan }> = plan ? await adminUpdatePlan(plan.id, input) : await adminCreatePlan(input);
    setBusy(false);
    if (result.ok) {
      if (!plan) {
        router.replace(`${PATH}/${result.data.plan.id}?created=1`);
        return;
      }
      onSaved(result.data.plan);
      setSaved(true);
      requestAnimationFrame(() => savedRef.current?.focus());
      return;
    }
    const fields = result.failure.fields ?? {};
    const fromApi: Errors = {
      name: fieldText("Name", fields.name),
      description: fieldText("Description", fields.description),
      subscriber_kind: fieldText("Who takes it", fields.subscriber_kind),
      eligible_roles: fieldText("Roles", fields.eligible_roles),
      features: fieldText("Limits", fields.features),
      benefits: fieldText("Benefits", fields.benefits),
      prices: fieldText("Prices", fields.prices),
      sort_order: fieldText("Sort order", fields.sort_order),
      package_code: fieldText("Listing package code", fields.package_code),
    };
    if (Object.values(fromApi).some(Boolean)) {
      setErrors(fromApi);
      focusFirst(fromApi);
      return;
    }
    setFailure({ text: actionMessage(result.failure), traceId: result.failure.traceId });
  }

  async function retire() {
    if (!plan) return;
    setRetireBusy(true);
    setRetireError(undefined);
    const result = await adminRetirePlan(plan.id);
    setRetireBusy(false);
    if (result.ok || result.failure.code === "PLAN_RETIRED") {
      setRetiring(false);
      if (result.ok) onSaved(result.data.plan);
      return;
    }
    setRetireError(actionMessage(result.failure));
  }


  return (
    <>
      <BackLink href={PATH}>Subscription plans</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {plan && <Badge tone={plan.status === "ACTIVE" ? "success" : "warning"}>{plan.status === "ACTIVE" ? "Offered" : "Retired"}</Badge>}
        {plan && <span className="text-sm text-muted">Updated {formatWhen(plan.updated_at)}</span>}
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">{plan ? plan.name : "New plan"}</h1>
      {plan?.status === "RETIRED" && (
        <Alert tone="info" title="This plan is retired." className="mt-4">
          It is no longer offered, requested or renewed, and it cannot be changed. Subscriptions already taken run to their end.
        </Alert>
      )}
      {!manages && plan?.status !== "RETIRED" && (
        <p className="mt-2 text-muted">Read-only. Finance Administrators and Super Administrators change plans.</p>
      )}
      {plan && (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Changes apply to new requests and renewals. Subscriptions already requested keep the name, period and amount they
          were invoiced with.
        </p>
      )}

      <div ref={savedRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {(saved || created) && <Alert tone="success" title={saved ? "The plan was saved." : "The plan was created. It is offered at once."} className="mt-4" />}
      </div>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        <Card className="space-y-4">
          <Field id="plan-name" label="Name" error={errors.name}>
            <Input
              id="plan-name"
              value={draft.name}
              maxLength={120}
              disabled={readOnly}
              onChange={(event) => set({ name: event.target.value })}
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy("plan-name", { error: errors.name })}
            />
          </Field>
          <Field id="plan-description" label="Description" optional hint="Shown to professionals choosing a plan." error={errors.description}>
            <Textarea
              id="plan-description"
              rows={3}
              maxLength={2000}
              value={draft.description}
              disabled={readOnly}
              onChange={(event) => set({ description: event.target.value })}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={fieldDescribedBy("plan-description", { hint: "x", error: errors.description })}
            />
          </Field>
          <Field id="plan-kind" label="Who takes it" error={errors.subscriber_kind} className="sm:max-w-md">
            <SearchableSelect
              id="plan-kind"
              options={KIND_OPTIONS}
              value={draft.kind}
              disabled={readOnly}
              onValueChange={(value) => set({ kind: (value || "INDIVIDUAL") as SubscriberKind })}
              aria-invalid={Boolean(errors.subscriber_kind)}
              aria-describedby={fieldDescribedBy("plan-kind", { error: errors.subscriber_kind })}
            />
          </Field>
          <Field id="plan-sort" label="Sort order" optional hint="Lower numbers are listed first." error={errors.sort_order} className="sm:max-w-48">
            <Input
              id="plan-sort"
              inputMode="numeric"
              value={draft.sortOrder}
              disabled={readOnly}
              onChange={(event) => set({ sortOrder: event.target.value })}
              aria-invalid={Boolean(errors.sort_order)}
              aria-describedby={fieldDescribedBy("plan-sort", { hint: "x", error: errors.sort_order })}
            />
          </Field>
          <Field
            id="plan-package"
            label="Listing package code"
            optional
            hint="The code of a listing package, for example BUSINESS. When a subscription to this plan is paid, the subscriber gets that package of their country for the paid period, if it is active there. Leave it empty to grant none."
            error={errors.package_code}
            className="sm:max-w-md"
          >
            <Input
              id="plan-package"
              value={draft.packageCode}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              disabled={readOnly}
              onChange={(event) => set({ packageCode: event.target.value.toUpperCase() })}
              aria-invalid={Boolean(errors.package_code)}
              aria-describedby={fieldDescribedBy("plan-package", { hint: "x", error: errors.package_code })}
            />
          </Field>
        </Card>

        <fieldset
          id="plan-roles"
          tabIndex={-1}
          className={groupClass}
          aria-invalid={Boolean(errors.eligible_roles) || undefined}
          aria-describedby={errors.eligible_roles ? "plan-roles-error" : undefined}
        >
          <legend className={cn(legendClass, "px-1")}>Offered to</legend>
          <p className="text-sm text-muted">Only people whose role is approved can take the plan.</p>
          {roleChoices.length === 0 ? (
            <p className="mt-2 text-muted">No professional roles were sent by the API.</p>
          ) : (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {roleChoices.map((role) => (
                <li key={role}>
                  <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={draft.roles.includes(role)}
                      disabled={readOnly}
                      onChange={(event) =>
                        set({ roles: event.currentTarget.checked ? [...draft.roles, role] : draft.roles.filter((item) => item !== role) })
                      }
                    />
                    {roleName(role)}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <GroupError id="plan-roles" error={errors.eligible_roles} />
        </fieldset>

        <fieldset
          id="plan-features"
          tabIndex={-1}
          className={groupClass}
          aria-describedby={errors.features ? "plan-features-error" : undefined}
        >
          <legend className={cn(legendClass, "px-1")}>Limits</legend>
          <p className="text-sm text-muted">Leave a limit empty to leave it out of the plan. Limits are shown to subscribers but not enforced yet.</p>
          <ul className="mt-3 space-y-3">
            {Object.entries(draft.features).map(([code, feature]) => {
              const id = `feature-${code}`;
              const label = `Most ${(FEATURE_LABELS[code] ?? titleFromCode(code)).toLowerCase()}`;
              return (
                <li key={code} className="flex flex-wrap items-end gap-4">
                  <Field id={id} label={label} optional={code !== "MAX_ACTIVE_LISTINGS"} className="w-48">
                    <Input
                      id={id}
                      inputMode="numeric"
                      value={feature.unlimited ? "" : feature.value}
                      disabled={readOnly || feature.unlimited}
                      placeholder={feature.unlimited ? "Unlimited" : undefined}
                      onChange={(event) => set({ features: { ...draft.features, [code]: { ...feature, value: event.target.value } } })}
                    />
                  </Field>
                  <label className="flex min-h-11 items-center gap-3 text-ink">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={feature.unlimited}
                      disabled={readOnly}
                      onChange={(event) =>
                        set({ features: { ...draft.features, [code]: { ...feature, unlimited: event.currentTarget.checked } } })
                      }
                    />
                    Unlimited<span className="sr-only"> {label.toLowerCase()}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <GroupError id="plan-features" error={errors.features} />
        </fieldset>

        <fieldset
          id="plan-benefits"
          tabIndex={-1}
          className={groupClass}
          aria-describedby={errors.benefits ? "plan-benefits-error" : undefined}
        >
          <legend className={cn(legendClass, "px-1")}>Benefits</legend>
          <p className="text-sm text-muted">Short lines shown with the plan, up to {BENEFITS_MAX}. Empty lines are left out.</p>
          <ol className="mt-3 space-y-3">
            {draft.benefits.map((row, index) => (
              <li key={row.key} className="flex items-end gap-2">
                <Field id={`benefit-${row.key}`} label={`Benefit ${index + 1}`} className="flex-1">
                  <Input
                    id={`benefit-${row.key}`}
                    value={row.text}
                    maxLength={200}
                    disabled={readOnly}
                    onChange={(event) =>
                      set({ benefits: draft.benefits.map((item) => (item.key === row.key ? { ...item, text: event.target.value } : item)) })
                    }
                  />
                </Field>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    className="w-11 px-0"
                    onClick={() => set({ benefits: draft.benefits.filter((item) => item.key !== row.key) })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Remove benefit {index + 1}</span>
                  </Button>
                )}
              </li>
            ))}
          </ol>
          {draft.benefits.length === 0 && <p className="mt-2 text-muted">No benefits listed.</p>}
          {!readOnly && draft.benefits.length < BENEFITS_MAX && (
            <Button variant="secondary" className="mt-3" onClick={() => set({ benefits: [...draft.benefits, { key: rowKey(), text: "" }] })}>
              <Plus className="size-4" aria-hidden="true" />
              Add a benefit
            </Button>
          )}
          <GroupError id="plan-benefits" error={errors.benefits} />
        </fieldset>

        <fieldset
          id="plan-prices"
          tabIndex={-1}
          className={groupClass}
          aria-describedby={errors.prices ? "plan-prices-error" : undefined}
        >
          <legend className={cn(legendClass, "px-1")}>Prices</legend>
          <p className="text-sm text-muted">
            One row per currency. Quarterly is for 3 months, yearly for a year. Either may be left empty, but the plan needs at
            least one price. Professionals see the price in their country&apos;s currency.
          </p>
          <ul className="mt-3 space-y-4">
            {draft.prices.map((row, index) => (
              <li key={row.key} className="grid gap-3 rounded-md bg-sunken p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Field id={`price-${row.key}-currency`} label="Currency">
                  <SearchableSelect
                    id={`price-${row.key}-currency`}
                    options={currencies}
                    value={row.currency}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      set({ prices: draft.prices.map((item) => (item.key === row.key ? { ...item, currency: value } : item)) })
                    }
                  />
                </Field>
                <Field id={`price-${row.key}-q`} label="Quarterly" optional>
                  <Input
                    id={`price-${row.key}-q`}
                    inputMode="decimal"
                    placeholder="30.00"
                    value={row.quarterly}
                    disabled={readOnly}
                    onChange={(event) =>
                      set({ prices: draft.prices.map((item) => (item.key === row.key ? { ...item, quarterly: event.target.value } : item)) })
                    }
                  />
                </Field>
                <Field id={`price-${row.key}-y`} label="Yearly" optional>
                  <Input
                    id={`price-${row.key}-y`}
                    inputMode="decimal"
                    placeholder="100.00"
                    value={row.yearly}
                    disabled={readOnly}
                    onChange={(event) =>
                      set({ prices: draft.prices.map((item) => (item.key === row.key ? { ...item, yearly: event.target.value } : item)) })
                    }
                  />
                </Field>
                {!readOnly && draft.prices.length > 1 && (
                  <Button variant="ghost" onClick={() => set({ prices: draft.prices.filter((item) => item.key !== row.key) })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove<span className="sr-only"> price row {index + 1} ({row.currency || "no currency"})</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => set({ prices: [...draft.prices, { key: rowKey(), currency: "", quarterly: "", yearly: "" }] })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a currency
            </Button>
          )}
          <GroupError id="plan-prices" error={errors.prices} />
        </fieldset>

        {failure && <Alert title={failure.text} traceId={failure.traceId} />}

        {!readOnly && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : plan ? "Save changes" : "Create the plan"}
            </Button>
            <ButtonLink href={PATH} variant="ghost">
              Cancel
            </ButtonLink>
            {plan && (
              <Button variant="danger" className="sm:ml-auto" onClick={() => setRetiring(true)}>
                Retire the plan
              </Button>
            )}
          </div>
        )}
      </form>

      <ConfirmDialog
        open={retiring}
        title="Retire this plan?"
        confirmLabel="Yes, retire it"
        busyLabel="Retiring…"
        cancelLabel="Keep it"
        busy={retireBusy}
        error={retireError}
        onCancel={() => setRetiring(false)}
        onConfirm={() => void retire()}
      >
        <p>
          It will no longer be offered, requested or renewed. Subscriptions already taken run to their end. Plans are never
          deleted, and a retired plan cannot be offered again.
        </p>
      </ConfirmDialog>
    </>
  );
}

function Editor({ planId, roleLabels, currencies, user }: Props & { user: User }) {
  const load = useCallback(async (): Promise<ApiResult<Loaded>> => {
    const [list, one] = await Promise.all([adminListPlans(), planId ? adminGetPlan(planId) : Promise.resolve(null)]);
    if (!list.ok) return list;
    if (one && !one.ok) return one;
    return {
      ok: true,
      status: 200,
      data: { featureCodes: list.data.feature_codes, roles: list.data.professional_roles, plan: one ? one.data.plan : null },
    };
  }, [planId]);
  const { state, reload, replace } = useApi(load);
  const manages = hasPlatformRole(user, SUBSCRIPTION_MANAGE_ROLES);

  if (state.status === "loading") return <LoadingBlock label="Loading the plan" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that plan</h1>
          <ButtonLink href={PATH} variant="secondary" className="mt-6">
            Back to the plans
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  const loaded = state.data;
  return (
    <Form
      key={loaded.plan?.id ?? "new"}
      loaded={loaded}
      roleLabels={roleLabels}
      currencies={currencies}
      manages={manages}
      onSaved={(plan) => replace({ ...loaded, plan })}
    />
  );
}

/** `/admin/subscription-plans/new` and `/admin/subscription-plans/<id>`. SUPER_ADMIN and FINANCE_ADMIN change plans. */
export function PlanEditor(props: Props) {
  return (
    <RoleGate roles={props.planId ? SUBSCRIPTION_READ_ROLES : SUBSCRIPTION_MANAGE_ROLES} what={props.planId ? "the subscription plans" : "new plans"}>
      {(user) => <Editor {...props} user={user} />}
    </RoleGate>
  );
}
