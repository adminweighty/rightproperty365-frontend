"use client";

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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PACKAGE_ROLES } from "@/lib/api/auth";
import type { ApiResult } from "@/lib/api/http";
import {
  adminCreatePackage,
  adminDeletePackage,
  adminGetPackage,
  adminListPackages,
  adminUpdatePackage,
  type ListingPackage,
  type PackageInput,
} from "@/lib/api/packages";
import {
  BILLING_TERMS,
  currencyDecimals,
  normalisePrice,
  PACKAGE_CODE,
  packageMessage,
  priceProblem,
} from "@/lib/packages";
import { fieldText } from "@/lib/subscriptions";

const PATH = "/admin/packages";

export type PackageMarketOption = { value: string; label: string; secondary?: string; currency: string };

type Props = {
  /** Absent for a new package. */
  packageId?: string;
  /** Every country, with its currency. */
  markets: PackageMarketOption[];
};

type Loaded = { scope: string[] | null; pkg: ListingPackage | null };

type Draft = {
  name: string;
  code: string;
  market: string;
  limit: string;
  description: string;
  active: boolean;
  isDefault: boolean;
  sort: string;
  prices: Record<string, string>;
};

type ErrorKey = "name" | "code" | "market_code" | "listing_limit" | "description" | "is_default" | "sort" | "prices" | `price-${string}`;
type Errors = Partial<Record<ErrorKey, string>>;

const FIELD_IDS: Record<string, string> = {
  name: "package-name",
  code: "package-code",
  market_code: "package-market",
  listing_limit: "package-limit",
  description: "package-description",
  is_default: "package-default",
  sort: "package-sort",
  prices: "package-prices",
};
const idFor = (key: string) => FIELD_IDS[key] ?? (key.startsWith("price-") ? `package-${key}` : "package-name");

function draftFrom(pkg: ListingPackage | null, market: string): Draft {
  const prices: Record<string, string> = {};
  for (const term of BILLING_TERMS) prices[term.code] = pkg?.prices.find((price) => price.billing_term === term.code)?.amount ?? "";
  return {
    name: pkg?.name ?? "",
    code: pkg?.code ?? "",
    market: pkg?.market.code ?? market,
    limit: pkg ? String(pkg.listing_limit) : "",
    description: pkg?.description ?? "",
    active: pkg?.active ?? true,
    isDefault: pkg?.is_default ?? false,
    sort: pkg ? String(pkg.sort) : "100",
    prices,
  };
}

const wholeNumber = (text: string, min: number, max: number) => /^\d+$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;

function validate(draft: Draft, currency: string, minorUnit: number | undefined, isNew: boolean) {
  const errors: Errors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Enter the package name.";
  else if (name.length > 80) errors.name = "Keep the name to 80 characters or fewer.";
  const code = draft.code.trim().toUpperCase();
  if (isNew) {
    if (!code) errors.code = "Enter a code, such as STARTER.";
    else if (!PACKAGE_CODE.test(code)) errors.code = "Use 2 to 32 capital letters, digits or underscores, starting with a letter.";
    if (!draft.market) errors.market_code = "Choose the country.";
  }
  if (!wholeNumber(draft.limit, 0, 100000)) errors.listing_limit = "Enter a whole number from 0 to 100000.";
  if (draft.description.trim().length > 1000) errors.description = "Keep the description to 1000 characters or fewer.";
  if (!wholeNumber(draft.sort, 0, 10000)) errors.sort = "Enter a whole number from 0 to 10000.";
  if (draft.isDefault && !draft.active) errors.is_default = "Only an active package can be the default.";
  const prices: { billing_term: string; amount: string }[] = [];
  for (const term of BILLING_TERMS) {
    const typed = draft.prices[term.code].trim();
    if (!typed) continue;
    const problem = priceProblem(typed, currency, minorUnit);
    if (problem) errors[`price-${term.code}`] = problem;
    else prices.push({ billing_term: term.code, amount: normalisePrice(typed) });
  }
  const input: PackageInput = {
    name,
    listing_limit: Number(draft.limit),
    description: draft.description.trim(),
    active: draft.active,
    is_default: draft.isDefault,
    sort: Number(draft.sort),
    prices,
    ...(isNew ? { code, market_code: draft.market } : {}),
  };
  return { errors, input };
}

function focusFirst(errors: Errors) {
  const first = Object.keys(errors).find((key) => errors[key as ErrorKey]);
  if (first) document.getElementById(idFor(first))?.focus();
}

function Form({ loaded, markets, onSaved }: { loaded: Loaded; markets: PackageMarketOption[]; onSaved: (pkg: ListingPackage) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const pkg = loaded.pkg;
  const created = params.get("created") === "1";
  const startMarket = (params.get("market") ?? "").toUpperCase();
  const choosable = markets.filter((market) => loaded.scope === null || loaded.scope.includes(market.value));
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(pkg, choosable.some((market) => market.value === startMarket) ? startMarket : choosable.length === 1 ? choosable[0].value : ""),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const savedRef = useRef<HTMLDivElement>(null);

  const readOnly = pkg ? !pkg.can.edit : false;
  const marketOption = markets.find((market) => market.value === draft.market);
  const currency = pkg?.market.currency ?? marketOption?.currency ?? "";
  const minorUnit = pkg?.market.minor_unit ?? (currency ? currencyDecimals(currency) : undefined);

  const set = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setSaved(false);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const { errors: problems, input } = validate(draft, currency || "USD", minorUnit, !pkg);
    setErrors(problems);
    setFailure(null);
    if (Object.values(problems).some(Boolean)) {
      focusFirst(problems);
      return;
    }
    setBusy(true);
    const result: ApiResult<{ package: ListingPackage }> = pkg
      ? await adminUpdatePackage(pkg.id, input)
      : await adminCreatePackage(input);
    setBusy(false);
    if (result.ok) {
      if (!pkg) {
        router.replace(`${PATH}/${result.data.package.id}?created=1`);
        return;
      }
      onSaved(result.data.package);
      setDraft(draftFrom(result.data.package, result.data.package.market.code));
      setSaved(true);
      requestAnimationFrame(() => savedRef.current?.focus());
      return;
    }
    const fields = result.failure.fields ?? {};
    const fromApi: Errors = {};
    const labels: Record<string, string> = {
      name: "Name",
      code: "Code",
      market_code: "Country",
      listing_limit: "Listing limit",
      description: "Description",
      is_default: "Default",
      sort: "Sort order",
      prices: "Prices",
      active: "Active",
    };
    for (const [key, message] of Object.entries(fields)) {
      const price = /^prices\[(\d+)\]/.exec(key);
      if (price) {
        const term = input.prices?.[Number(price[1])]?.billing_term;
        if (term) fromApi[`price-${term}`] = fieldText("The price", message);
        else fromApi.prices = fieldText("Prices", message);
      } else if (key in labels) {
        fromApi[(key === "active" ? "is_default" : key) as ErrorKey] = fieldText(labels[key], message);
      }
    }
    if (result.failure.code === "PACKAGE_CODE_TAKEN") fromApi.code = packageMessage(result.failure);
    if (Object.values(fromApi).some(Boolean)) {
      setErrors(fromApi);
      focusFirst(fromApi);
      return;
    }
    setFailure({ text: packageMessage(result.failure), traceId: result.failure.traceId });
  }

  async function remove() {
    if (!pkg) return;
    setDeleteBusy(true);
    setDeleteError(undefined);
    const result = await adminDeletePackage(pkg.id);
    setDeleteBusy(false);
    if (result.ok) {
      router.replace(`${PATH}?market=${pkg.market.code}`);
      return;
    }
    const assignments = (result.failure.body as { error?: { details?: { assignments?: number } } } | undefined)?.error?.details?.assignments;
    setDeleteError(
      result.failure.code === "PACKAGE_IN_USE" && typeof assignments === "number"
        ? `This package has been assigned ${assignments === 1 ? "once" : `${assignments} times`}, so it cannot be deleted. Deactivate it instead.`
        : packageMessage(result.failure),
    );
  }

  const priceIds = BILLING_TERMS.map((term) => `package-price-${term.code}`);

  return (
    <>
      <BackLink href={pkg ? `${PATH}?market=${pkg.market.code}` : PATH}>Listing packages</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pkg?.is_default && <Badge tone="primary">Default</Badge>}
        {pkg && <Badge tone={pkg.active ? "success" : "neutral"}>{pkg.active ? "Active" : "Inactive"}</Badge>}
        {pkg && (
          <span className="text-sm text-muted">
            {pkg.market.name} · {pkg.code} · updated {formatWhen(pkg.updated_at)}
          </span>
        )}
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">{pkg ? pkg.name : "New package"}</h1>
      {pkg && (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {pkg.current_assignments === 1 ? "1 account holds" : `${pkg.current_assignments} accounts hold`} this package today
          {pkg.is_default ? ", and every account without a package of its own in this country uses it" : ""}. A new listing limit
          applies to them at once; listings already live stay live if the limit is lowered.
        </p>
      )}
      {readOnly && <p className="mt-2 text-muted">Read-only: this package is in a country you do not manage.</p>}

      <div ref={savedRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {(saved || created) && <Alert tone="success" title={saved ? "The package was saved." : "The package was created."} className="mt-4" />}
      </div>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        <Card className="space-y-4">
          <Field id="package-name" label="Name" hint="Shown to advertisers and on the pricing page." error={errors.name}>
            <Input
              id="package-name"
              value={draft.name}
              maxLength={80}
              disabled={readOnly}
              onChange={(event) => set({ name: event.target.value })}
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy("package-name", { hint: "x", error: errors.name })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="package-code"
              label="Code"
              hint={pkg ? "The code cannot be changed." : "Capital letters, digits and underscores, such as STARTER. It cannot be changed later."}
              error={errors.code}
            >
              <Input
                id="package-code"
                value={draft.code}
                maxLength={32}
                disabled={readOnly || Boolean(pkg)}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(event) => set({ code: event.target.value.toUpperCase() })}
                aria-required="true"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={fieldDescribedBy("package-code", { hint: "x", error: errors.code })}
              />
            </Field>
            <Field
              id="package-market"
              label="Country"
              hint={pkg ? "The country cannot be changed." : currency ? `Prices are in ${currency}.` : "Prices are in the country's currency."}
              error={errors.market_code}
            >
              <SearchableSelect
                id="package-market"
                options={pkg ? [{ value: pkg.market.code, label: pkg.market.name, secondary: pkg.market.code }] : choosable}
                value={draft.market}
                disabled={readOnly || Boolean(pkg)}
                onValueChange={(value) => set({ market: value })}
                aria-required
                aria-invalid={Boolean(errors.market_code)}
                aria-describedby={fieldDescribedBy("package-market", { hint: "x", error: errors.market_code })}
              />
            </Field>
            <Field id="package-limit" label="Listing limit" hint="Listings live at once. 0 means none can be published." error={errors.listing_limit}>
              <Input
                id="package-limit"
                inputMode="numeric"
                value={draft.limit}
                disabled={readOnly}
                onChange={(event) => set({ limit: event.target.value })}
                aria-required="true"
                aria-invalid={Boolean(errors.listing_limit)}
                aria-describedby={fieldDescribedBy("package-limit", { hint: "x", error: errors.listing_limit })}
              />
            </Field>
            <Field id="package-sort" label="Sort order" hint="Lower numbers are listed first." error={errors.sort}>
              <Input
                id="package-sort"
                inputMode="numeric"
                value={draft.sort}
                disabled={readOnly}
                onChange={(event) => set({ sort: event.target.value })}
                aria-invalid={Boolean(errors.sort)}
                aria-describedby={fieldDescribedBy("package-sort", { hint: "x", error: errors.sort })}
              />
            </Field>
          </div>
          <Field id="package-description" label="Description" optional hint="Who it suits. Shown on the pricing page." error={errors.description}>
            <Textarea
              id="package-description"
              rows={3}
              maxLength={1000}
              value={draft.description}
              disabled={readOnly}
              onChange={(event) => set({ description: event.target.value })}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={fieldDescribedBy("package-description", { hint: "x", error: errors.description })}
            />
          </Field>
          <div className="space-y-1">
            <label className="flex min-h-11 items-center gap-3 text-ink">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={draft.active}
                disabled={readOnly}
                onChange={(event) => set({ active: event.currentTarget.checked })}
              />
              Active (offered, and can be assigned)
            </label>
            <label className="flex min-h-11 items-center gap-3 text-ink">
              <input
                id="package-default"
                type="checkbox"
                className="size-5 accent-primary"
                checked={draft.isDefault}
                disabled={readOnly}
                onChange={(event) => set({ isDefault: event.currentTarget.checked })}
                aria-invalid={Boolean(errors.is_default)}
                aria-describedby={errors.is_default ? "package-default-error" : "package-default-hint"}
              />
              Default package for this country
            </label>
            <p id="package-default-hint" className="text-sm text-muted">
              {pkg?.is_default && !draft.isDefault
                ? "Without a default, accounts with no package of their own are not limited in this country."
                : "Every account without a package of its own uses the default. The previous default loses the flag."}
            </p>
            {errors.is_default && (
              <p id="package-default-error" className="text-sm text-danger">
                {errors.is_default}
              </p>
            )}
          </div>
        </Card>

        <fieldset id="package-prices" tabIndex={-1} className="rounded-lg border border-line p-4 outline-none focus-visible:outline-2 focus-visible:outline-focus">
          <legend className="px-1 font-sans text-lg font-semibold tracking-normal text-ink">Prices{currency ? ` in ${currency}` : ""}</legend>
          <p className="text-sm text-muted">
            Exact amounts with at most {minorUnit ?? 2} decimal place{minorUnit === 1 ? "" : "s"}. Leave a term empty when the
            package is not offered for it. Advertisers and the pricing page see exactly what is entered here.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {BILLING_TERMS.map((term, index) => {
              const key = `price-${term.code}` as const;
              const sample = pkg?.prices.find((price) => price.billing_term === term.code)?.sample;
              return (
                <Field
                  key={term.code}
                  id={priceIds[index]}
                  label={term.label}
                  optional
                  hint={sample ? "Sample price from the development data. Saving replaces it." : undefined}
                  error={errors[key]}
                >
                  <Input
                    id={priceIds[index]}
                    inputMode="decimal"
                    value={draft.prices[term.code]}
                    disabled={readOnly}
                    placeholder={minorUnit === 0 ? "2500" : "25.00"}
                    onChange={(event) => set({ prices: { ...draft.prices, [term.code]: event.target.value } })}
                    aria-invalid={Boolean(errors[key])}
                    aria-describedby={fieldDescribedBy(priceIds[index], { hint: sample ? "x" : undefined, error: errors[key] })}
                  />
                </Field>
              );
            })}
          </div>
          {errors.prices && <p className="mt-2 text-sm text-danger">{errors.prices}</p>}
        </fieldset>

        {failure && <Alert title={failure.text} traceId={failure.traceId} />}

        {!readOnly && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : pkg ? "Save the package" : "Create the package"}
            </Button>
            <ButtonLink href={PATH} variant="ghost" size="lg">
              Cancel
            </ButtonLink>
          </div>
        )}
      </form>

      {pkg && pkg.can.edit && (
        <Card className="mt-10">
          <h2 className="font-sans text-lg font-semibold tracking-normal">Delete the package</h2>
          {pkg.can.delete ? (
            <>
              <p className="mt-1 text-sm text-muted">It has never been assigned, so it can be deleted.</p>
              <Button variant="danger" className="mt-3" onClick={() => setDeleting(true)}>
                Delete the package
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {pkg.is_default
                ? "The default package cannot be deleted. Make another package the default first."
                : "A package that has been assigned cannot be deleted. Untick Active to stop offering it."}
            </p>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={deleting}
        title="Delete this package?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => setDeleting(false)}
        onConfirm={() => void remove()}
      >
        <p className="font-medium text-ink">{pkg?.name}</p>
        <p className="mt-1">The package and its prices are removed for good. This cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}

function Editor({ packageId, markets }: Props) {
  const load = useCallback(async (): Promise<ApiResult<Loaded>> => {
    const [list, one] = await Promise.all([adminListPackages(), packageId ? adminGetPackage(packageId) : Promise.resolve(null)]);
    if (one && !one.ok) return one;
    if (!list.ok) return list;
    return { ok: true, status: 200, data: { scope: list.data.markets, pkg: one?.ok ? one.data.package : null } };
  }, [packageId]);
  const { state, reload, replace } = useApi(load);

  if (state.status === "loading") return <LoadingBlock label="Loading the package" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that package</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">It may have been deleted, or it is in a country you do not manage.</p>
          <ButtonLink href={PATH} variant="secondary" className="mt-6">
            Back to listing packages
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  return (
    <Form
      key={state.data.pkg?.id ?? "new"}
      loaded={state.data}
      markets={markets}
      onSaved={(pkg) => replace({ ...state.data, pkg })}
    />
  );
}

/** `/admin/packages/new` and `/admin/packages/<id>`. */
export function PackageEditor(props: Props) {
  return (
    <RoleGate roles={PACKAGE_ROLES} what="the listing packages">
      {() => <Editor {...props} />}
    </RoleGate>
  );
}
