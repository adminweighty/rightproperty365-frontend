"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { hasPlatformRole, LEASE_TEMPLATE_ROLES, type PlatformRole, type User } from "@/lib/api/auth";
import { adminListLeaseTemplates, type LeaseTemplateStatus } from "@/lib/api/leases";
import { isSampleReview, statusOf, TEMPLATE_STATUS } from "@/lib/signing";

const PATH = "/admin/lease-templates";

/** The "no access" state of an admin page for roles that do not work on it. */
export function RoleNoAccess({ roles, what }: { roles: readonly PlatformRole[]; what: string }) {
  const names: Record<string, string> = { SUPER_ADMIN: "Super Administrators", CONTENT_ADMIN: "Content Administrators", SUPPORT: "Support" };
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">You do not have access to {what}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">It is for {roles.map((role) => names[role] ?? role).join(" and ")}.</p>
      <ButtonLink href="/admin" variant="secondary" className="mt-6">
        Back to the overview
      </ButtonLink>
    </div>
  );
}

/** An admin page for some platform roles only. The API enforces the same rule. */
export function RoleGate({ roles, what, children }: { roles: readonly PlatformRole[]; what: string; children: (user: User) => ReactNode }) {
  return <AdminGate>{(user) => (hasPlatformRole(user, roles) ? children(user) : <RoleNoAccess roles={roles} what={what} />)}</AdminGate>;
}

const STATUSES: { key: string; label: string; status?: LeaseTemplateStatus }[] = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts", status: "DRAFT" },
  { key: "APPROVED", label: "Approved", status: "APPROVED" },
  { key: "RETIRED", label: "Retired", status: "RETIRED" },
];

function href(status?: string, market?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (market) params.set("market", market);
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

function Templates({ countries }: { countries: { value: string; label: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = STATUSES.find((item) => item.key === params.get("status")) ?? STATUSES[0];
  const market = /^[A-Z]{2}$/.test(params.get("market") ?? "") ? params.get("market")! : "";
  const load = useCallback(() => adminListLeaseTemplates({ status: filter.status, market: market || undefined }), [filter.status, market]);
  const { state, reload } = useApi(load);
  const name = (code: string) => countries.find((country) => country.value === code)?.label ?? code;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Lease templates</h1>
          <p className="mt-2 max-w-2xl text-muted">
            The wording leases are drafted from, per country. Only an approved template is offered, and approving needs a
            legal review. Editing an approved template starts its next version.
          </p>
        </div>
        <ButtonLink href={`${PATH}/new`}>
          <Plus className="size-4" aria-hidden="true" />
          New template
        </ButtonLink>
      </div>
      <div className="mt-8 flex flex-wrap items-end gap-4">
        <ChipNav label="Template status" items={STATUSES.map((item) => ({ key: item.key, href: href(item.status, market), label: item.label, current: item.key === filter.key }))} />
        <Field id="templates-market" label="Country" className="w-64">
          <SearchableSelect
            id="templates-market"
            options={[{ value: "", label: "Every country" }, ...countries]}
            value={market}
            onValueChange={(value) => router.push(href(filter.status, value), { scroll: false })}
          />
        </Field>
      </div>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading the templates" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          <EmptyState title="No templates here" action={<ButtonLink href={`${PATH}/new`} variant="secondary">Write a template</ButtonLink>}>
            Change the filters, or write the first template for a country.
          </EmptyState>
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {state.data.items.map((template) => {
                const { label, tone } = statusOf(TEMPLATE_STATUS, template.status);
                const sample = template.status !== "DRAFT" && isSampleReview(template.legal_review);
                return (
                  <li key={template.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`${PATH}/${template.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                          {template.name}
                        </Link>
                        <Badge tone={tone}>{label}</Badge>
                        <Badge tone="accent">{template.market_code}</Badge>
                        {sample && <Badge tone="warning">Sample wording</Badge>}
                      </p>
                      <p className="text-sm text-muted">
                        Version {template.version} · {template.lease_kind === "COMMERCIAL" ? "Commercial" : "Residential"} · {name(template.market_code)} · {template.sections.length} sections ·{" "}
                        {template.optional_clauses.length} optional clauses
                      </p>
                      <p className="text-xs text-subtle">
                        {template.legal_review
                          ? `Reviewed by ${template.legal_review.reviewer_name}, ${template.legal_review.organisation}, ${template.legal_review.reviewed_on}`
                          : "Not reviewed yet"}{" "}
                        · updated {formatWhen(template.updated_at)}
                      </p>
                    </div>
                    <ButtonLink href={`${PATH}/${template.id}`} size="sm" variant="secondary">
                      {template.status === "RETIRED" ? "View" : "Open"}
                      <span className="sr-only"> {template.name}, version {template.version}</span>
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

/** `/admin/lease-templates` (SUPER_ADMIN, CONTENT_ADMIN). */
export function LeaseTemplates({ countries }: { countries: { value: string; label: string }[] }) {
  return (
    <RoleGate roles={LEASE_TEMPLATE_ROLES} what="the lease templates">
      {() => <Templates countries={countries} />}
    </RoleGate>
  );
}
