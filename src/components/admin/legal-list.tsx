"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { LEGAL_ADMIN_ROLES, type User } from "@/lib/api/auth";
import { adminListLegalVersions } from "@/lib/api/legal";
import { LEGAL_INDEX_PATH } from "@/lib/legal";
import {
  formatUtc,
  LEGAL_KINDS,
  legalKindLabel,
  legalMarketScope,
  marketLabel,
  versionStatusLabel,
} from "@/lib/legal-versions";

const PATH = "/admin/legal";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PUBLISHED", label: "Published" },
  { key: "RETIRED", label: "Retired" },
] as const;

const KIND_OPTIONS: SelectOption[] = [{ value: "", label: "Every document" }, ...LEGAL_KINDS.map((kind) => ({ value: kind, label: legalKindLabel(kind) }))];

function hrefFor(filters: { kind: string; market: string; status: string }) {
  const query = new URLSearchParams();
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.market) query.set("market", filters.market);
  if (filters.status) query.set("status", filters.status);
  const text = query.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** The note every legal page of the console carries: the API's texts are not the live ones yet. */
export function LegalSourceNote() {
  return (
    <p className="mt-3 max-w-2xl rounded-md bg-info-soft p-3 text-sm text-ink">
      <strong className="font-semibold">The site still shows its own legal pages.</strong> The pages under{" "}
      <Link href={LEGAL_INDEX_PATH} className="font-medium text-primary-ink underline underline-offset-2">
        /legal
      </Link>{" "}
      are what people read. The versions here are kept for when your lawyers&rsquo; text is ready; the ones the API
      started with are placeholders that say &ldquo;DRAFT — awaiting legal review&rdquo;.
    </p>
  );
}

function Versions({ user, markets }: { user: User; markets: SelectOption[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const kind = LEGAL_KINDS.find((item) => item === params.get("kind")?.toUpperCase()) ?? "";
  const market = (params.get("market") ?? "").toUpperCase();
  const status = STATUS_FILTERS.find((item) => item.key === params.get("status")?.toUpperCase())?.key ?? "";
  const load = useCallback(() => adminListLegalVersions({ kind, market, status }), [kind, market, status]);
  const { state, reload } = useApi(load);
  const scope = legalMarketScope(user.platform_roles);
  const names = Object.fromEntries(markets.map((option) => [option.value, option.label]));

  const marketOptions: SelectOption[] = [
    { value: "", label: "Every market" },
    { value: "GLOBAL", label: "Every country (GLOBAL)" },
    ...markets,
  ];
  if (market && !marketOptions.some((option) => option.value === market)) marketOptions.push({ value: market, label: market });

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Legal documents</h1>
          <p className="mt-2 max-w-2xl text-muted">
            The versions of the Terms, Privacy Policy and the other documents, per market. A draft can be changed; once
            published a version never changes, and a change is a new version.
          </p>
          {scope && <p className="mt-1 text-sm text-muted">You manage the documents of: {scope.join(", ") || "no countries"}.</p>}
          <LegalSourceNote />
        </div>
        <ButtonLink href={hrefFor({ kind, market, status: "" }).replace(PATH, `${PATH}/new`)}>
          <Plus className="size-4" aria-hidden="true" />
          New draft
        </ButtonLink>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
        <Field id="legal-kind" label="Document">
          <SearchableSelect
            id="legal-kind"
            options={KIND_OPTIONS}
            value={kind}
            onValueChange={(value) => router.replace(hrefFor({ kind: value, market, status }), { scroll: false })}
          />
        </Field>
        <Field id="legal-market" label="Market">
          <SearchableSelect
            id="legal-market"
            options={marketOptions}
            value={market}
            onValueChange={(value) => router.replace(hrefFor({ kind, market: value, status }), { scroll: false })}
          />
        </Field>
      </div>
      <div className="mt-4">
        <ChipNav
          label="Version status"
          items={STATUS_FILTERS.map((item) => ({
            key: item.key || "all",
            href: hrefFor({ kind, market, status: item.key }),
            label: item.label,
            current: item.key === status,
          }))}
        />
      </div>

      <p role="status" className="sr-only">
        {state.status === "ready" ? `${state.data.versions.length} versions.` : ""}
      </p>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading the versions" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.versions.length === 0 && (
          <EmptyState
            title={kind || market || status ? "No versions match these filters" : "No versions yet"}
            action={
              <ButtonLink href={`${PATH}/new`} variant="secondary">
                Start a draft
              </ButtonLink>
            }
          >
            Nothing needs to be published for the site to work: its own legal pages are shown in the meantime.
          </EmptyState>
        )}
        {state.status === "ready" && state.data.versions.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {state.data.versions.map((version) => {
                const label = versionStatusLabel(version);
                return (
                  <li key={version.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`${PATH}/${version.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                          {version.title || legalKindLabel(version.kind)}
                        </Link>
                        <Badge tone={label.tone}>{label.label}</Badge>
                        {version.draft_notice && <Badge tone="warning">DRAFT notice</Badge>}
                        {version.requires_reacceptance && <Badge tone="info">Asks to accept again</Badge>}
                      </p>
                      <p className="text-sm text-ink">
                        Version <span className="font-mono">{version.version}</span> · {marketLabel(version.market_code, names)} ·{" "}
                        {version.lang}
                      </p>
                      <p className="text-xs text-subtle">
                        Takes effect {formatUtc(version.effective_from)} · created by {version.created_by.name}
                        {version.published_at && ` · published ${formatWhen(version.published_at)}`}
                        {version.published_by && ` by ${version.published_by.name}`}
                      </p>
                    </div>
                    <ButtonLink href={`${PATH}/${version.id}`} size="sm" variant="secondary">
                      {version.status === "DRAFT" ? "Edit" : "View"}
                      <span className="sr-only">
                        {" "}
                        {version.title} {version.version}
                      </span>
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

/** `/admin/legal` (SUPER_ADMIN, CONTENT_ADMIN, MARKET_ADMIN for its own market). */
export function LegalList({ markets }: { markets: SelectOption[] }) {
  return (
    <RoleGate roles={LEGAL_ADMIN_ROLES} what="the legal documents">
      {(user) => <Versions user={user} markets={markets} />}
    </RoleGate>
  );
}
