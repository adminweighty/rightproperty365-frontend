"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { UsageMeterView } from "@/components/packages/usage-meter";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
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
  adminAssignPackage,
  adminEndPackage,
  adminGetAccountPackage,
  adminListPackages,
  type AccountKind,
  type AdminAccountPackage,
  type ListingPackage,
  type MarketUsage,
} from "@/lib/api/packages";
import { ASSIGNMENT_STATUS, assignmentDates, assignmentDatesProblem, packageMessage, todayUtc } from "@/lib/packages";

type Props = { kind: AccountKind; accountId: string };

type Loaded = { account: AdminAccountPackage; packages: ListingPackage[] };

type Errors = Partial<Record<"package_id" | "starts_on" | "ends_on" | "note", string>>;

function AssignForm({
  kind,
  accountId,
  packages,
  onDone,
}: Props & { packages: ListingPackage[]; onDone: (usage: MarketUsage, text: string) => void }) {
  const today = todayUtc();
  const [packageId, setPackageId] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = packages.filter((item) => item.active);
  // Grouped by country, so a package name that exists in several countries is never ambiguous.
  const options = [...new Set(active.map((item) => item.market.code))].map((code) => {
    const items = active.filter((item) => item.market.code === code);
    return {
      label: items[0].market.name,
      options: items.map((item) => ({
        value: item.id,
        label: item.name,
        secondary: `${item.listing_limit} listings${item.is_default ? ", default" : ""}`,
        keywords: [item.code, code],
      })),
    };
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems: Errors = {};
    if (!packageId) problems.package_id = "Choose the package.";
    const dates = assignmentDatesProblem(startsOn, endsOn, today);
    if (dates) problems[dates.field] = dates.message;
    if (note.trim().length > 500) problems.note = "Keep the note to 500 characters or fewer.";
    setErrors(problems);
    setFailure(null);
    const first = Object.keys(problems)[0];
    if (first) {
      document.getElementById(`assign-${first.replace("_", "-")}`)?.focus();
      return;
    }
    setBusy(true);
    const result = await adminAssignPackage(kind, accountId, {
      package_id: packageId,
      starts_on: startsOn || undefined,
      ends_on: endsOn || null,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      const fields = result.failure.fields ?? {};
      const fromApi: Errors = { package_id: fields.package_id, starts_on: fields.starts_on, ends_on: fields.ends_on, note: fields.note };
      if (Object.values(fromApi).some(Boolean)) {
        setErrors(fromApi);
        return;
      }
      setFailure({ text: packageMessage(result.failure), traceId: result.failure.traceId });
      return;
    }
    setPackageId("");
    setEndsOn("");
    setNote("");
    setStartsOn(today);
    const { assignment } = result.data;
    onDone(
      result.data.usage,
      `${assignment.package.name} was assigned in ${result.data.usage.market.name}, ${assignmentDates(assignment.starts_on, assignment.ends_on).replace(/^From/, "from")}.`,
    );
  }

  if (active.length === 0) {
    return (
      <EmptyState
        title="There is no active package you can assign"
        action={
          <ButtonLink href="/admin/packages/new" variant="secondary">
            Create a package
          </ButtonLink>
        }
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="assign-package-id" label="Package" error={errors.package_id}>
        <SearchableSelect
          id="assign-package-id"
          options={options}
          value={packageId}
          onValueChange={setPackageId}
          aria-required
          aria-invalid={Boolean(errors.package_id)}
          aria-describedby={fieldDescribedBy("assign-package-id", { error: errors.package_id })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="assign-starts-on" label="From" hint="Today or later (UTC dates)." error={errors.starts_on}>
          <Input
            id="assign-starts-on"
            type="date"
            min={today}
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            aria-invalid={Boolean(errors.starts_on)}
            aria-describedby={fieldDescribedBy("assign-starts-on", { hint: "x", error: errors.starts_on })}
          />
        </Field>
        <Field id="assign-ends-on" label="Until" optional hint="Inclusive. Empty: open-ended." error={errors.ends_on}>
          <Input
            id="assign-ends-on"
            type="date"
            min={startsOn || today}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            aria-invalid={Boolean(errors.ends_on)}
            aria-describedby={fieldDescribedBy("assign-ends-on", { hint: "x", error: errors.ends_on })}
          />
        </Field>
      </div>
      <Field id="assign-note" label="Note" optional hint="For administrators, such as the agreement it comes from." error={errors.note}>
        <Textarea
          id="assign-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={fieldDescribedBy("assign-note", { hint: "x", error: errors.note })}
        />
      </Field>
      <p className="text-sm text-muted">
        It replaces whatever package the account has in that country from the start date on. Listings already live stay live,
        even if the new limit is lower.
      </p>
      {failure && <Alert title={failure.text} traceId={failure.traceId} />}
      <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
        {busy ? "Assigning…" : "Assign the package"}
      </Button>
    </form>
  );
}

function Account({ kind, accountId }: Props) {
  const load = useCallback(async (): Promise<ApiResult<Loaded>> => {
    const [account, packages] = await Promise.all([adminGetAccountPackage(kind, accountId), adminListPackages({ include_inactive: false })]);
    if (!account.ok) return account;
    return { ok: true, status: 200, data: { account: account.data, packages: packages.ok ? packages.data.items : [] } };
  }, [kind, accountId]);
  const { state, reload } = useApi(load);
  const [notice, setNotice] = useState<string | null>(null);
  const [ending, setEnding] = useState<MarketUsage | null>(null);
  const [endNote, setEndNote] = useState("");
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState<string | undefined>();

  if (state.status === "loading") return <LoadingBlock label="Loading the package" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">{kind === "ORGANISATION" ? "We could not find that organisation" : "We could not find that account"}</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">It may have been deleted.</p>
          <ButtonLink href="/admin/packages" variant="secondary" className="mt-6">
            Back to listing packages
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const { account, packages } = state.data;

  async function end() {
    if (!ending) return;
    setEndBusy(true);
    setEndError(undefined);
    const result = await adminEndPackage(kind, accountId, { market_code: ending.market.code, note: endNote.trim() || undefined });
    setEndBusy(false);
    if (!result.ok) {
      setEndError(packageMessage(result.failure));
      return;
    }
    setNotice(
      `The package in ${ending.market.name} was ended. ${result.data.usage.package ? `The account now uses ${result.data.usage.package.name}.` : "No listing limit applies there now."}`,
    );
    setEnding(null);
    setEndNote("");
    reload();
  }

  return (
    <>
      <BackLink href="/admin/packages">Listing packages</BackLink>
      <p className="mt-2 text-sm text-muted">{kind === "ORGANISATION" ? "Organisation" : "Direct owner (their own listings)"}</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{account.account.name}</h1>
      {kind === "DIRECT_OWNER" && (
        <p className="mt-2 text-sm">
          <Link href={`/admin/users/${accountId}`} className="font-medium text-primary-ink hover:underline">
            Their account
          </Link>
        </p>
      )}

      <div aria-live="polite">{notice && <Alert tone="success" title={notice} className="mt-6" />}</div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="account-usage">
            <h2 id="account-usage" className="text-2xl">
              Package and usage
            </h2>
            {account.markets.length === 0 ? (
              <p className="mt-3 text-muted">No listings and no package in any country you manage.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {account.markets.map((usage) => (
                  <li key={usage.market.code}>
                    <Card>
                      <UsageMeterView usage={usage} audience="admin" headingLevel={3} />
                      {(usage.assignment || usage.scheduled) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setEndError(undefined);
                            setEnding(usage);
                          }}
                        >
                          End the package<span className="sr-only"> in {usage.market.name}</span>
                        </Button>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="account-history">
            <h2 id="account-history" className="text-2xl">
              History
            </h2>
            {account.assignments.length === 0 ? (
              <p className="mt-3 text-muted">No package has been assigned yet. The country&apos;s default applies.</p>
            ) : (
              <Card padded={false} className="mt-4">
                <ul className="divide-y divide-line">
                  {account.assignments.map((item) => {
                    const status = ASSIGNMENT_STATUS[item.status] ?? { label: item.status, tone: "neutral" as const };
                    return (
                      <li key={item.id} className="px-5 py-4">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{item.package.name}</span>
                          <span className="text-sm text-muted">{item.market_code}</span>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {item.source === "INVOICE" && <Badge tone="info">From an invoice</Badge>}
                        </p>
                        <p className="mt-1 text-sm text-ink">{assignmentDates(item.starts_on, item.ends_on)}</p>
                        <p className="mt-1 text-xs text-subtle">
                          Assigned by {item.assigned_by.name} · {formatWhen(item.created_at)}
                          {item.cancelled_at && ` · cancelled ${formatWhen(item.cancelled_at)}`}
                        </p>
                        {item.note && <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.note}</p>}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>
        </div>

        <aside aria-labelledby="assign-heading" className="min-w-0">
          <Card className="lg:sticky lg:top-24">
            <h2 id="assign-heading" className="font-sans text-lg font-semibold tracking-normal">
              Assign a package
            </h2>
            <div className="mt-4">
              <AssignForm
                kind={kind}
                accountId={accountId}
                packages={packages}
                onDone={(_usage, text) => {
                  setNotice(text);
                  reload();
                }}
              />
            </div>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={ending !== null}
        title={`End the package in ${ending?.market.name ?? ""}?`}
        confirmLabel="Yes, end it"
        busyLabel="Ending…"
        busy={endBusy}
        error={endError}
        onCancel={() => setEnding(null)}
        onConfirm={() => void end()}
      >
        <p>
          The current package ends yesterday (or is cancelled if it started today), and any package scheduled to start later is
          cancelled. The account then uses the country&apos;s default package. Listings already live stay live.
        </p>
        <Field id="end-note" label="Note" optional className="mt-4">
          <Textarea id="end-note" rows={2} maxLength={500} value={endNote} onChange={(event) => setEndNote(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

/** `/admin/packages/organisations/<id>` and `/admin/packages/users/<id>`: one account's packages, history and assignment. */
export function AccountPackage(props: Props) {
  return (
    <RoleGate roles={PACKAGE_ROLES} what="the listing packages">
      {() => <Account {...props} />}
    </RoleGate>
  );
}
