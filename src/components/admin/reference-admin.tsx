"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  adminReferenceCreate,
  adminReferenceDeactivate,
  adminReferenceReactivate,
  adminReferenceRows,
  adminReferenceSets,
  adminReferenceUpdate,
  referenceSetLabel,
  type AdminReferenceInput,
  type AdminReferenceItem,
  type AdminReferenceSet,
} from "@/lib/api/admin-reference";
import { hasPlatformRole, REFERENCE_ROLES, type User } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { actionMessage, fieldText } from "@/lib/subscriptions";

const PATH = "/admin/reference";

type Country = { value: string; label: string };
type Notice = { tone: "success" | "warning" | "danger"; text: string; traceId?: string };
type Errors = Partial<Record<"code" | "label" | "singular_label" | "description" | "sort_order" | "market_code" | "parent_code", string>>;

const FIELD_LABELS: Record<keyof Errors, string> = {
  code: "Code",
  label: "Label",
  singular_label: "Singular label",
  description: "Description",
  sort_order: "Position",
  market_code: "Country",
  parent_code: "Belongs to",
};

/** The sets whose rows have a singular label and a description (directory sections). */
const DESCRIBED_SETS = new Set(["directory_kinds"]);

const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Garden flat" becomes "garden-flat": a suggested code. */
const codeFrom = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Every administrator role but a market administrator changes every row. */
const changesEverything = (user: User) => hasPlatformRole(user, ["SUPER_ADMIN", "PLATFORM_ADMIN", "CONTENT_ADMIN"]);
const ownMarkets = (user: User) =>
  user.platform_roles.filter(({ role, market_code }) => role === "MARKET_ADMIN" && market_code).map(({ market_code }) => market_code!);

function mayChange(user: User, marketCode: string | null) {
  if (changesEverything(user)) return true;
  return marketCode !== null && ownMarkets(user).includes(marketCode);
}

function errorsFrom(failure: ApiFailure): Errors | null {
  const fields = failure.fields ?? {};
  const keys = Object.keys(FIELD_LABELS) as (keyof Errors)[];
  const found: Errors = {};
  for (const key of keys) if (fields[key]) found[key] = fieldText(FIELD_LABELS[key], fields[key]);
  return Object.keys(found).length > 0 ? found : null;
}

function firstError(prefix: string, errors: Errors) {
  const key = (Object.keys(FIELD_LABELS) as (keyof Errors)[]).find((name) => errors[name]);
  if (key) document.getElementById(`${prefix}-${key}`)?.focus();
}

/** Position: optional whole number. */
function positionProblem(text: string) {
  if (text.trim() === "") return undefined;
  return /^-?\d{1,6}$/.test(text.trim()) ? undefined : "Use a whole number, for example 10.";
}

function NoticeAlert({ notice }: { notice: Notice | null }) {
  return notice ? <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-4" /> : null;
}

/** Relabel, reorder (position) and, where the set has one, change what the row belongs to. */
function EditRow({
  set,
  item,
  parents,
  onDone,
  onCancel,
}: {
  set: AdminReferenceSet;
  item: AdminReferenceItem;
  parents: { value: string; label: string }[];
  onDone: (item: AdminReferenceItem) => void;
  onCancel: () => void;
}) {
  const prefix = `edit-${item.code}`;
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const described = DESCRIBED_SETS.has(set.set) || item.singular_label !== null || item.description !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    const position = String(data.get("sort_order") ?? "");
    const next: Errors = {};
    if (!label) next.label = "Write the label people see.";
    next.sort_order = positionProblem(position);
    if (next.label || next.sort_order) {
      setErrors(next);
      firstError(prefix, next);
      return;
    }
    const change: AdminReferenceInput = {};
    if (label !== item.label) change.label = label;
    if (position.trim() !== "" && Number(position) !== item.sort_order) change.sort_order = Number(position);
    if (described) {
      const singular = String(data.get("singular_label") ?? "").trim();
      const description = String(data.get("description") ?? "").trim();
      if (singular !== (item.singular_label ?? "")) change.singular_label = singular;
      if (description !== (item.description ?? "")) change.description = description;
    }
    if (set.parent_set) {
      const parent = String(data.get("parent_code") ?? "");
      if (parent && parent !== item.parent_code) change.parent_code = parent;
    }
    setErrors({});
    setFailure(null);
    if (Object.keys(change).length === 0) {
      onCancel();
      return;
    }
    setBusy(true);
    const answer = await adminReferenceUpdate(set.set, item.code, change);
    setBusy(false);
    if (answer.ok) {
      onDone(answer.data.item);
      return;
    }
    const fieldErrors = errorsFrom(answer.failure);
    if (fieldErrors) {
      setErrors(fieldErrors);
      firstError(prefix, fieldErrors);
      return;
    }
    setFailure({ tone: "danger", text: actionMessage(answer.failure), traceId: answer.failure.traceId });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-md border border-line bg-sunken p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field id={`${prefix}-label`} label="Label" error={errors.label}>
          <Input
            id={`${prefix}-label`}
            name="label"
            defaultValue={item.label}
            maxLength={120}
            required
            aria-invalid={Boolean(errors.label)}
            aria-describedby={fieldDescribedBy(`${prefix}-label`, { error: errors.label })}
          />
        </Field>
        <Field id={`${prefix}-sort_order`} label="Position" hint="Lower comes first." error={errors.sort_order}>
          <Input
            id={`${prefix}-sort_order`}
            name="sort_order"
            inputMode="numeric"
            defaultValue={String(item.sort_order)}
            aria-invalid={Boolean(errors.sort_order)}
            aria-describedby={fieldDescribedBy(`${prefix}-sort_order`, { hint: "x", error: errors.sort_order })}
          />
        </Field>
        {described && (
          <>
            <Field id={`${prefix}-singular_label`} label="Singular label" optional error={errors.singular_label} className="sm:col-span-2">
              <Input
                id={`${prefix}-singular_label`}
                name="singular_label"
                defaultValue={item.singular_label ?? ""}
                maxLength={120}
                aria-invalid={Boolean(errors.singular_label)}
                aria-describedby={fieldDescribedBy(`${prefix}-singular_label`, { error: errors.singular_label })}
              />
            </Field>
            <Field id={`${prefix}-description`} label="Description" optional error={errors.description} className="sm:col-span-2">
              <Textarea
                id={`${prefix}-description`}
                name="description"
                rows={3}
                defaultValue={item.description ?? ""}
                maxLength={500}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={fieldDescribedBy(`${prefix}-description`, { error: errors.description })}
              />
            </Field>
          </>
        )}
        {set.parent_set && parents.length > 0 && (
          <Field id={`${prefix}-parent_code`} label={`Belongs to (${referenceSetLabel(set.parent_set).toLowerCase()})`} error={errors.parent_code} className="sm:col-span-2">
            <SearchableSelect
              id={`${prefix}-parent_code`}
              name="parent_code"
              options={parents}
              defaultValue={item.parent_code ?? ""}
              aria-invalid={Boolean(errors.parent_code)}
              aria-describedby={fieldDescribedBy(`${prefix}-parent_code`, { error: errors.parent_code })}
            />
          </Field>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">The code ({item.code}) never changes: listings and profiles keep using it.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <NoticeAlert notice={failure} />
    </form>
  );
}

/** A new row of a set that takes new rows. */
function AddRow({
  set,
  market,
  marketName,
  parents,
  onDone,
}: {
  set: AdminReferenceSet;
  market: string;
  marketName: string;
  parents: { value: string; label: string }[];
  onDone: (item: AdminReferenceItem) => void;
}) {
  const prefix = "add";
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const shownCode = codeTouched ? code : codeFrom(label);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const position = String(data.get("sort_order") ?? "");
    const parent = String(data.get("parent_code") ?? "");
    const next: Errors = {};
    if (!label.trim()) next.label = "Write the label people see.";
    if (!shownCode) next.code = "Write a code, for example garden-flat.";
    else if (!CODE_PATTERN.test(shownCode)) next.code = "Use lower-case letters and digits separated by single hyphens, for example garden-flat.";
    next.sort_order = positionProblem(position);
    if (set.parent_set && !parent) next.parent_code = "Choose what this row belongs to.";
    if (Object.values(next).some(Boolean)) {
      setErrors(next);
      firstError(prefix, next);
      return;
    }
    const input: AdminReferenceInput = { code: shownCode, label: label.trim() };
    if (position.trim() !== "") input.sort_order = Number(position);
    if (set.market_bound) input.market_code = market;
    if (set.parent_set) input.parent_code = parent;
    setErrors({});
    setFailure(null);
    setBusy(true);
    const answer = await adminReferenceCreate(set.set, input);
    setBusy(false);
    if (answer.ok) {
      setLabel("");
      setCode("");
      setCodeTouched(false);
      form.reset();
      onDone(answer.data.item);
      return;
    }
    const fieldErrors = errorsFrom(answer.failure);
    if (fieldErrors) {
      setErrors(fieldErrors);
      firstError(prefix, fieldErrors);
      return;
    }
    if (answer.failure.code === "REFERENCE_ITEM_EXISTS") {
      setErrors({ code: actionMessage(answer.failure) });
      document.getElementById(`${prefix}-code`)?.focus();
      return;
    }
    setFailure({ tone: "danger", text: actionMessage(answer.failure), traceId: answer.failure.traceId });
  }

  return (
    <Card>
      <h2 className="text-xl">Add a row</h2>
      <p className="mt-1 text-sm text-muted">
        It is offered on the site at once{set.market_bound ? ` for ${marketName}` : ""}. Rows are never deleted; you can deactivate one later.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-label`} label="Label" error={errors.label}>
          <Input
            id={`${prefix}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            required
            aria-invalid={Boolean(errors.label)}
            aria-describedby={fieldDescribedBy(`${prefix}-label`, { error: errors.label })}
          />
        </Field>
        <Field
          id={`${prefix}-code`}
          label="Code"
          hint="Lower-case letters, digits and hyphens. It can never change."
          error={errors.code}
        >
          <Input
            id={`${prefix}-code`}
            value={shownCode}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value.trim());
            }}
            maxLength={80}
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.code)}
            aria-describedby={fieldDescribedBy(`${prefix}-code`, { hint: "x", error: errors.code })}
          />
        </Field>
        {set.parent_set && (
          <Field id={`${prefix}-parent_code`} label={`Belongs to (${referenceSetLabel(set.parent_set).toLowerCase()})`} error={errors.parent_code}>
            <SearchableSelect
              id={`${prefix}-parent_code`}
              name="parent_code"
              options={[{ value: "", label: "Choose…" }, ...parents]}
              defaultValue=""
              aria-required
              aria-invalid={Boolean(errors.parent_code)}
              aria-describedby={fieldDescribedBy(`${prefix}-parent_code`, { error: errors.parent_code })}
            />
          </Field>
        )}
        <Field id={`${prefix}-sort_order`} label="Position" optional hint="Lower comes first." error={errors.sort_order}>
          <Input
            id={`${prefix}-sort_order`}
            name="sort_order"
            inputMode="numeric"
            aria-invalid={Boolean(errors.sort_order)}
            aria-describedby={fieldDescribedBy(`${prefix}-sort_order`, { hint: "x", error: errors.sort_order })}
          />
        </Field>
        {errors.market_code && <Alert title={errors.market_code} className="sm:col-span-2" />}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} aria-busy={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {busy ? "Adding…" : "Add the row"}
          </Button>
        </div>
      </form>
      <NoticeAlert notice={failure} />
    </Card>
  );
}

function Rows({
  user,
  set,
  market,
  countries,
}: {
  user: User;
  set: AdminReferenceSet;
  market: string;
  countries: Country[];
}) {
  const load = useCallback(() => adminReferenceRows(set.set, market || undefined), [set.set, market]);
  const { state, reload, replace } = useApi(load);
  const parentLoad = useCallback(
    () =>
      set.parent_set
        ? adminReferenceRows(set.parent_set, market || undefined)
        : Promise.resolve({ ok: true as const, status: 200, data: { set: "", items: [] as AdminReferenceItem[] } }),
    [set.parent_set, market],
  );
  const parentState = useApi(parentLoad).state;
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminReferenceItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const countryName = (code: string | null) => (code ? (countries.find((country) => country.value === code)?.label ?? code) : "Every country");
  const parents =
    set.parent_set && parentState.status === "ready"
      ? parentState.data.items
          .filter((item) => item.active)
          .map((item) => ({ value: item.code, label: item.label, secondary: item.market_code ?? undefined }))
      : [];
  const parentLabel = (code: string | null) =>
    code && parentState.status === "ready" ? (parentState.data.items.find((item) => item.code === code)?.label ?? code) : code;

  function show(next: Notice) {
    setNotice(next);
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  function swap(item: AdminReferenceItem) {
    if (state.status !== "ready") return;
    replace({ ...state.data, items: state.data.items.map((row) => (row.code === item.code ? item : row)) });
  }

  async function setActive(item: AdminReferenceItem, active: boolean) {
    setBusy(item.code);
    setDialogError(undefined);
    const answer = active ? await adminReferenceReactivate(set.set, item.code) : await adminReferenceDeactivate(set.set, item.code);
    setBusy(null);
    if (answer.ok) {
      setPending(null);
      swap(answer.data.item);
      show({
        tone: "success",
        text: active
          ? `“${item.label}” is offered again.`
          : `“${item.label}” is no longer offered. Listings and profiles that use it keep it.`,
      });
      return;
    }
    if (answer.failure.code === "REFERENCE_ITEM_NOT_FOUND") {
      setPending(null);
      show({ tone: "warning", text: actionMessage(answer.failure) });
      reload();
      return;
    }
    if (active) show({ tone: "danger", text: actionMessage(answer.failure), traceId: answer.failure.traceId });
    else setDialogError(actionMessage(answer.failure));
  }

  const canAdd = set.creatable && (!set.market_bound || (market !== "" && mayChange(user, market)));
  const items = state.status === "ready" ? [...state.data.items].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)) : [];

  return (
    <div className="mt-6 space-y-6">
      <div ref={noticeRef} tabIndex={-1} aria-live="polite" className="outline-none">
        <NoticeAlert notice={notice} />
      </div>

      {set.creatable && set.market_bound && !market && (
        <p className="text-muted">Choose a country above to add a row to {referenceSetLabel(set.set).toLowerCase()}.</p>
      )}
      {!set.creatable && (
        <p className="text-muted">
          The codes of this set decide how the site works, so rows cannot be added. You can relabel, reorder, deactivate and
          reactivate them.
        </p>
      )}
      {canAdd && (
        <AddRow
          set={set}
          market={market}
          marketName={countryName(market)}
          parents={parents}
          onDone={(item) => {
            show({ tone: "success", text: `“${item.label}” was added.` });
            reload();
          }}
        />
      )}

      {state.status === "loading" && <LoadingBlock label="Loading the rows" rows={3} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" && items.length === 0 && <EmptyState title="No rows here">{market ? "Choose another country, or add the first row." : undefined}</EmptyState>}
      {state.status === "ready" && items.length > 0 && (
        <section aria-labelledby="reference-rows">
          <h2 id="reference-rows" className="sr-only">
            Rows
          </h2>
          <p className="mb-2 text-sm text-muted" role="status">
            {items.length === 1 ? "1 row" : `${items.length} rows`} · {items.filter((item) => !item.active).length} inactive
          </p>
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const changeable = mayChange(user, item.market_code);
                return (
                  <li key={item.code} className="px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{item.label}</span>
                          {!item.active && <Badge tone="warning">Inactive</Badge>}
                          {item.market_code && <Badge tone="accent">{item.market_code}</Badge>}
                        </p>
                        <p className="text-sm break-all text-muted">
                          Code {item.code} · position {item.sort_order}
                          {item.parent_code && <> · belongs to {parentLabel(item.parent_code)}</>}
                        </p>
                        {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
                      </div>
                      {changeable ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-expanded={editing === item.code}
                            onClick={() => setEditing(editing === item.code ? null : item.code)}
                          >
                            Edit<span className="sr-only"> {item.label}</span>
                          </Button>
                          {item.active ? (
                            <Button size="sm" variant="ghost" onClick={() => setPending(item)} disabled={busy === item.code}>
                              Deactivate<span className="sr-only"> {item.label}</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void setActive(item, true)}
                              disabled={busy === item.code}
                              aria-busy={busy === item.code}
                            >
                              {busy === item.code ? "Reactivating…" : "Reactivate"}
                              <span className="sr-only"> {item.label}</span>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-subtle">Another market: you cannot change it.</p>
                      )}
                    </div>
                    {editing === item.code && (
                      <EditRow
                        set={set}
                        item={item}
                        parents={parents}
                        onCancel={() => setEditing(null)}
                        onDone={(updated) => {
                          setEditing(null);
                          swap(updated);
                          show({ tone: "success", text: `“${updated.label}” was saved.` });
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={`Deactivate “${pending?.label ?? ""}”?`}
        confirmLabel="Deactivate"
        busyLabel="Deactivating…"
        busy={busy !== null}
        error={dialogError}
        onCancel={() => {
          setPending(null);
          setDialogError(undefined);
        }}
        onConfirm={() => pending && void setActive(pending, false)}
      >
        <p>
          It is no longer offered, and new listings, profiles and requests cannot choose it, from now on. Nothing is deleted:
          what already uses it keeps it, and you can reactivate it at any time.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Reference({ user, countries }: { user: User; countries: Country[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const { state, reload } = useApi(adminReferenceSets);
  const sets = state.status === "ready" ? state.data.sets : [];
  const set = sets.find((item) => item.set === params.get("set")) ?? null;
  const requestedMarket = (params.get("market") ?? "").toUpperCase();
  const market = /^[A-Z]{2}$/.test(requestedMarket) ? requestedMarket : "";
  // A market administrator works on its own markets: offer those first.
  const marketOptions = changesEverything(user)
    ? countries
    : [...countries].sort((a, b) => Number(ownMarkets(user).includes(b.value)) - Number(ownMarkets(user).includes(a.value)));

  const hrefFor = (nextSet: string, nextMarket: string) => {
    const query = new URLSearchParams();
    if (nextSet) query.set("set", nextSet);
    if (nextMarket) query.set("market", nextMarket);
    const text = query.toString();
    return text ? `${PATH}?${text}` : PATH;
  };

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Reference data</h1>
      <p className="mt-2 max-w-2xl text-muted">
        The lists behind the site’s drop-downs and filters: property types, features, places and more. Nothing is ever deleted.
        A row you deactivate stops being offered, and what already uses it keeps it.
      </p>
      {!changesEverything(user) && ownMarkets(user).length > 0 && (
        <p className="mt-2 text-sm text-muted">You can change the rows of {ownMarkets(user).join(", ")} only.</p>
      )}

      {state.status === "loading" && <div className="mt-8"><LoadingBlock label="Loading the sets" rows={1} /></div>}
      {state.status === "error" && (
        <div className="mt-8">
          <LoadError failure={state.failure} onRetry={reload} />
        </div>
      )}
      {state.status === "ready" && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Field id="reference-set" label="Set">
              <SearchableSelect
                id="reference-set"
                options={[
                  { value: "", label: "Choose a set…" },
                  {
                    label: "Rows can be added",
                    options: sets.filter((item) => item.creatable).map((item) => ({ value: item.set, label: referenceSetLabel(item.set) })),
                  },
                  {
                    label: "Relabel and reorder only",
                    options: sets.filter((item) => !item.creatable).map((item) => ({ value: item.set, label: referenceSetLabel(item.set) })),
                  },
                ]}
                value={set?.set ?? ""}
                onValueChange={(value) => router.push(hrefFor(value, sets.find((item) => item.set === value)?.market_bound ? market : ""), { scroll: false })}
              />
            </Field>
            {set?.market_bound && (
              <Field id="reference-market" label="Country">
                <SearchableSelect
                  id="reference-market"
                  options={[{ value: "", label: "Every country" }, ...marketOptions.map((country) => ({ ...country, keywords: [country.value] }))]}
                  value={market}
                  onValueChange={(value) => router.push(hrefFor(set.set, value), { scroll: false })}
                />
              </Field>
            )}
          </div>
          {set ? (
            <Rows key={`${set.set}-${market}`} user={user} set={set} market={set.market_bound ? market : ""} countries={countries} />
          ) : (
            <div className="mt-6">
              <EmptyState title="Choose a set to see its rows" />
            </div>
          )}
        </>
      )}
    </>
  );
}

/** `/admin/reference` (SUPER_ADMIN, PLATFORM_ADMIN, CONTENT_ADMIN, MARKET_ADMIN for its own market). */
export function ReferenceAdmin({ countries }: { countries: Country[] }) {
  return (
    <RoleGate roles={REFERENCE_ROLES} what="the reference data">
      {(user) => <Reference user={user} countries={countries} />}
    </RoleGate>
  );
}
