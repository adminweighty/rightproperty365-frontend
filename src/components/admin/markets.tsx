"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import {
  BackLink,
  ChipNav,
  LoadError,
  LoadingBlock,
} from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MARKET_ROLES } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";

/** Market administration (API 0.56.0). */
type MarketStatus = "PLANNED" | "ACTIVE" | "SUSPENDED";
type Market = {
  code: string;
  name: string;
  currency_code: string;
  extra_currencies: string[];
  timezone: string;
  status: MarketStatus;
  default_package_code: string | null;
  notice: string | null;
  updated_at: string;
};
type Readiness = { ready: boolean; problems: string[]; warnings: string[] };
type Outcome = {
  tone: "success" | "danger";
  text: string;
  list?: string[];
  traceId?: string;
} | null;

const STATUS_LABELS: Record<MarketStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Live",
  SUSPENDED: "Suspended",
};
const statusTone = {
  PLANNED: "info",
  ACTIVE: "success",
  SUSPENDED: "neutral",
} as const;

function Editor({ code, onSaved }: { code: string; onSaved: () => void }) {
  const load = useCallback(
    () =>
      apiFetch<{ market: Market; readiness: Readiness }>(
        `/v1/admin/markets/${code}`,
        { cache: "no-store" },
      ),
    [code],
  );
  const { state, reload } = useApi(load);
  const [form, setForm] = useState<{
    name: string;
    currency: string;
    extra: string;
    timezone: string;
    pkg: string;
    notice: string;
  } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "loading")
    return <LoadingBlock label="Loading the country" rows={3} />;
  if (state.status === "error")
    return <LoadError failure={state.failure} onRetry={reload} />;
  const { market: m, readiness } = state.data;
  const f = form ?? {
    name: m.name,
    currency: m.currency_code,
    extra: m.extra_currencies.join(", "),
    timezone: m.timezone,
    pkg: m.default_package_code ?? "",
    notice: m.notice ?? "",
  };
  const set = (patch: Partial<typeof f>) => setForm({ ...f, ...patch });

  async function save(body: Record<string, unknown>, done: string) {
    setBusy(true);
    const answer = await apiFetch<{ market: Market; readiness: Readiness }>(
      `/v1/admin/markets/${code}`,
      { method: "PATCH", body },
    );
    setBusy(false);
    if (answer.ok) {
      setFields({});
      setForm(null);
      setOutcome({ tone: "success", text: done });
      reload();
      onSaved();
      return;
    }
    if (answer.failure.code === "MARKET_NOT_READY") {
      setOutcome({
        tone: "danger",
        text: "This country is not ready to go live.",
        list: Object.values(answer.failure.fields ?? {}),
      });
      return;
    }
    setFields(answer.failure.fields ?? {});
    setOutcome(
      answer.failure.fields
        ? null
        : {
            tone: "danger",
            text: answer.failure.message,
            traceId: answer.failure.traceId,
          },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(
      {
        name: f.name,
        currency_code: f.currency,
        extra_currencies: f.extra.split(/[\s,]+/).filter(Boolean),
        timezone: f.timezone,
        default_package_code: f.pkg,
        notice: f.notice,
      },
      "Saved.",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl">
          {m.name} <span className="text-muted">({m.code})</span>
        </h2>
        <Badge tone={statusTone[m.status]}>{STATUS_LABELS[m.status]}</Badge>
      </div>
      <div aria-live="polite">
        {outcome && (
          <Alert
            tone={outcome.tone}
            title={outcome.text}
            traceId={outcome.traceId}
          >
            {outcome.list && (
              <ul className="mt-1 list-disc pl-5">
                {outcome.list.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
      </div>

      <section
        aria-labelledby="readiness-heading"
        className="rounded-lg border border-line p-4"
      >
        <h3
          id="readiness-heading"
          className="font-sans text-base font-semibold tracking-normal"
        >
          {readiness.ready ? "Ready to go live" : "Before it can go live"}
        </h3>
        {readiness.problems.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-danger">
            {readiness.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {readiness.warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-muted">
            {readiness.warnings.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">
          Set up its{" "}
          <Link href="/admin/packages" className="text-primary-ink underline">
            listing packages
          </Link>{" "}
          and{" "}
          <Link href="/admin/legal" className="text-primary-ink underline">
            legal documents
          </Link>{" "}
          while it is planned: they accept planned countries.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.status !== "ACTIVE" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void save({ status: "ACTIVE" }, `${m.name} is live.`)
              }
            >
              Go live
            </Button>
          )}
          {m.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() =>
                void save(
                  { status: "SUSPENDED" },
                  `${m.name} is suspended and hidden from the public.`,
                )
              }
            >
              Suspend
            </Button>
          )}
        </div>
      </section>

      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="mk-name" label="Name" error={fields.name}>
          <Input
            id="mk-name"
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field
          id="mk-zone"
          label="Time zone"
          hint="IANA name, such as Africa/Gaborone."
          error={fields.timezone}
        >
          <Input
            id="mk-zone"
            value={f.timezone}
            onChange={(e) => set({ timezone: e.target.value })}
          />
        </Field>
        <Field
          id="mk-currency"
          label="Main currency"
          hint="ISO 4217, such as BWP."
          error={fields.currency_code}
        >
          <Input
            id="mk-currency"
            maxLength={3}
            value={f.currency}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field
          id="mk-extra"
          label="Other permitted currencies"
          optional
          hint="Up to 5, separated by commas, such as USD, ZAR."
          error={fields.extra_currencies}
        >
          <Input
            id="mk-extra"
            value={f.extra}
            onChange={(e) => set({ extra: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field
          id="mk-pkg"
          label="Default listing package"
          hint="The code of one of this country's packages."
          error={fields.default_package_code}
        >
          <Input
            id="mk-pkg"
            value={f.pkg}
            onChange={(e) => set({ pkg: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field
          id="mk-notice"
          label="Notice"
          optional
          hint="Shown on the country's pages, such as “Launching soon”. Up to 280 characters."
          error={fields.notice}
          className="sm:col-span-2"
        >
          <Textarea
            id="mk-notice"
            rows={2}
            maxLength={280}
            value={f.notice}
            onChange={(e) => set({ notice: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await apiFetch<{ market: Market }>("/v1/admin/markets", {
      method: "POST",
      body: { code, name, currency_code: currency, timezone },
    });
    setBusy(false);
    if (answer.ok) {
      onCreated(answer.data.market.code);
      return;
    }
    setFields(answer.failure.fields ?? {});
    setError(answer.failure.fields ? null : answer.failure.message);
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-4">
      <h2 className="text-xl sm:col-span-4">Add a country</h2>
      <Field
        id="nc-code"
        label="Code"
        hint="ISO, such as BW."
        error={fields.code}
      >
        <Input
          id="nc-code"
          maxLength={2}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field id="nc-name" label="Name" error={fields.name}>
        <Input
          id="nc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field id="nc-currency" label="Currency" error={fields.currency_code}>
        <Input
          id="nc-currency"
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </Field>
      <Field id="nc-zone" label="Time zone" error={fields.timezone}>
        <Input
          id="nc-zone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
      </Field>
      <div className="sm:col-span-4">
        <Button
          type="submit"
          variant="secondary"
          disabled={busy}
          aria-busy={busy}
        >
          Add as planned (not public)
        </Button>
      </div>
      {error && <Alert tone="danger" title={error} className="sm:col-span-4" />}
    </form>
  );
}

function Page() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status") ?? "";
  const selected = params.get("code");
  const [q, setQ] = useState("");
  const load = useCallback(
    () =>
      apiFetch<{ items: Market[] }>(
        `/v1/admin/markets${status ? `?status=${status}` : ""}`,
        { cache: "no-store" },
      ),
    [status],
  );
  const { state, reload } = useApi(load);
  const href = (s: string, code?: string | null) =>
    `/admin/markets?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(code ? { code } : {}) })}`;
  const items =
    state.status === "ready"
      ? state.data.items.filter(
          (m) =>
            !q ||
            m.name.toLowerCase().includes(q.toLowerCase()) ||
            m.code === q.toUpperCase(),
        )
      : [];
  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Countries</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Prepare a country before it goes live, change its currencies and notice,
        or suspend it. Every change is in the audit log.
      </p>
      {selected && (
        <Card className="mt-6">
          <Editor key={selected} code={selected} onSaved={reload} />
        </Card>
      )}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <ChipNav
          label="Country status"
          items={[
            {
              key: "all",
              href: href("", selected),
              label: "All",
              current: status === "",
            },
            {
              key: "PLANNED",
              href: href("PLANNED", selected),
              label: "Planned",
              current: status === "PLANNED",
            },
            {
              key: "ACTIVE",
              href: href("ACTIVE", selected),
              label: "Live",
              current: status === "ACTIVE",
            },
            {
              key: "SUSPENDED",
              href: href("SUSPENDED", selected),
              label: "Suspended",
              current: status === "SUSPENDED",
            },
          ]}
        />
        <Field id="mk-q" label="Find a country" className="min-w-0 basis-56">
          <Input id="mk-q" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </div>
      {state.status === "loading" && (
        <LoadingBlock label="Loading countries" rows={4} />
      )}
      {state.status === "error" && (
        <LoadError failure={state.failure} onRetry={reload} />
      )}
      {state.status === "ready" && (
        <ul className="mt-4 max-h-[28rem] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {items.slice(0, 300).map((m) => (
            <li
              key={m.code}
              className="flex flex-wrap items-center gap-3 px-4 py-2"
            >
              <Link
                href={href(status, m.code)}
                className="min-w-0 flex-1 font-medium text-primary-ink hover:underline"
              >
                {m.name}{" "}
                <span className="font-normal text-muted">({m.code})</span>
              </Link>
              <span className="text-sm text-muted">
                {[m.currency_code, ...m.extra_currencies].join(", ")} ·{" "}
                {m.timezone}
              </span>
              <Badge tone={statusTone[m.status]}>
                {STATUS_LABELS[m.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-6">
        <CreateForm
          onCreated={(code) => {
            reload();
            router.push(href("", code));
          }}
        />
      </Card>
    </>
  );
}

/** `/admin/markets` (API 0.56.0). */
export function Markets() {
  return (
    <RoleGate roles={MARKET_ROLES} what="the countries">
      {() => <Page />}
    </RoleGate>
  );
}
