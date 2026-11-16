"use client";

import { Copy, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TemplateEditor, type TemplateEditorMode } from "@/components/admin/lease-template-editor";
import { failureNotice, NoticeArea, type Notice } from "@/components/agreements/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { canUseInbox } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import {
  createOrgLeaseTemplate,
  editOrgLeaseTemplate,
  getOrgLeaseTemplate,
  listOfferedLeaseTemplates,
  listOrgLeaseTemplateEvents,
  listOrgLeaseTemplates,
  publishOrgLeaseTemplate,
  retireOrgLeaseTemplate,
  type LeaseTemplate,
  type LeaseTemplateStatus,
} from "@/lib/api/leases";
import { ORG_TEMPLATE_STATUS, statusOf } from "@/lib/signing";

/*
 * An organisation's own lease templates (API 0.26.0): agencies and landlords
 * design, publish and retire them, starting from scratch or from a copy of a
 * sample. The organisation is chosen the way a new lease chooses it: the
 * organisations the person drafts leases for, picked when there are several.
 */

const PATH = "/agent/lease-templates";

type Option = { value: string; label: string };

/** The organisations the person drafts leases for, as /agent/leases/new reads them. */
async function loadOrganisations(): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  return { ok: true, status: 200, data: dashboard.data.organisations.filter((item) => item.can_create_leases ?? item.can_manage_listings) };
}

/** OWNER or MANAGER of an organisation that manages listings design its templates; the API decides. */
const managesTemplates = (organisation: DashboardOrganisation) =>
  (organisation.role === "OWNER" || organisation.role === "MANAGER") && organisation.can_manage_listings;

const withOrg = (path: string, orgId: string, extra?: Record<string, string>) => {
  const params = new URLSearchParams({ org: orgId, ...extra });
  return `${path}?${params}`;
};

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The organisation in `?org=`, or the only one. */
function useChosen(organisations: DashboardOrganisation[]) {
  const params = useSearchParams();
  const wanted = params.get("org") ?? "";
  const chosen = organisations.find((item) => item.id === wanted) ?? (organisations.length === 1 ? organisations[0] : null);
  return chosen;
}

function OrganisationPicker({ organisations, chosen, onChoose }: { organisations: DashboardOrganisation[]; chosen: DashboardOrganisation | null; onChoose: (id: string) => void }) {
  if (organisations.length < 2) return null;
  return (
    <Field id="templates-organisation" label="Templates of" className="w-full max-w-sm">
      <SearchableSelect
        id="templates-organisation"
        options={[{ value: "", label: "Choose an organisation…" }, ...organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))]}
        value={chosen?.id ?? ""}
        onValueChange={onChoose}
      />
    </Field>
  );
}

function NoOrganisation() {
  return (
    <EmptyState title="No organisation to design templates for" action={<ButtonLink href="/agent/leases" variant="secondary">Back to leases</ButtonLink>}>
      Lease templates belong to an agency or a landlord&rsquo;s organisation. Ask its owner to give you access.
    </EmptyState>
  );
}

const STATUSES: { key: string; label: string; status?: LeaseTemplateStatus }[] = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts", status: "DRAFT" },
  { key: "APPROVED", label: "Published", status: "APPROVED" },
  { key: "RETIRED", label: "Retired", status: "RETIRED" },
];

const kindLabel = (kind: string) => (kind === "COMMERCIAL" ? "Commercial" : "Residential");

function Samples({ organisation, canManage, countryName }: { organisation: DashboardOrganisation; canManage: boolean; countryName: (code: string) => string }) {
  const router = useRouter();
  const load = useCallback(() => listOfferedLeaseTemplates(undefined, organisation.id), [organisation.id]);
  const { state, reload } = useApi(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function copy(template: LeaseTemplate) {
    setBusy(template.id);
    setNotice(null);
    const result = await createOrgLeaseTemplate(organisation.id, { copy_from_template_id: template.id });
    if (result.ok) {
      router.push(withOrg(`${PATH}/${result.data.template.id}`, organisation.id));
      return;
    }
    setBusy(null);
    setNotice(failureNotice(result.failure));
  }

  const samples =
    state.status === "ready"
      ? state.data.items
          .filter((item) => item.source === "SAMPLE" || item.organisation_id === null)
          // The organisation's own country first.
          .sort((a, b) => Number(b.market_code === organisation.market_code) - Number(a.market_code === organisation.market_code) || a.name.localeCompare(b.name, "en-GB"))
      : [];

  return (
    <section aria-labelledby="sample-gallery" className="mt-12">
      <h2 id="sample-gallery" className="text-2xl">
        Start from a sample
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        Copy a sample as a draft of your own, then change its wording to suit {organisation.name}. Samples are starting
        points, not legal advice: check your template suits your leases before you publish it.
      </p>
      <NoticeArea notice={notice} />
      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the samples" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && samples.length === 0 && <p className="text-muted">No sample templates are offered yet.</p>}
        {samples.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {samples.map((template) => (
              <li key={template.id}>
                <Card className="flex h-full flex-col">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{template.name}</span>
                    <Badge tone="accent">{template.market_code}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {kindLabel(template.lease_kind)} · {countryName(template.market_code)} · {template.sections.length} sections · {template.optional_clauses.length} optional clauses
                  </p>
                  {template.description && <p className="mt-2 text-sm text-ink">{template.description}</p>}
                  <div className="mt-auto pt-4">
                    {canManage ? (
                      <Button size="sm" variant="secondary" disabled={busy !== null} aria-busy={busy === template.id || undefined} onClick={() => void copy(template)}>
                        <Copy className="size-4" aria-hidden="true" />
                        {busy === template.id ? "Copying…" : "Use this sample"}
                        <span className="sr-only">: {template.name}</span>
                      </Button>
                    ) : (
                      <p className="text-xs text-subtle">Anyone drafting a lease can use it as it is.</p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Templates({ organisations, countries }: { organisations: DashboardOrganisation[]; countries: Option[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const chosen = useChosen(organisations);
  const filter = STATUSES.find((item) => item.key === params.get("status")) ?? STATUSES[0];
  const countryName = (code: string) => countries.find((country) => country.value === code)?.label ?? code;

  const href = (status?: string) => (chosen ? withOrg(PATH, chosen.id, status ? { status } : undefined) : PATH);

  return (
    <>
      <BackLink href="/agent/leases">Leases</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Lease templates</h1>
          <p className="mt-2 max-w-2xl text-muted">
            The wording your leases are drafted from. Design your own, or start from a sample. Only a published template
            is offered when someone drafts a lease; editing a published one starts its next version.
          </p>
        </div>
        {chosen && managesTemplates(chosen) && (
          <ButtonLink href={withOrg(`${PATH}/new`, chosen.id)}>
            <Plus className="size-4" aria-hidden="true" />
            New template
          </ButtonLink>
        )}
      </div>
      {organisations.length === 0 && (
        <div className="mt-8">
          <NoOrganisation />
        </div>
      )}
      {organisations.length > 1 && (
        <div className="mt-6">
          <OrganisationPicker organisations={organisations} chosen={chosen} onChoose={(id) => router.push(id ? withOrg(PATH, id) : PATH, { scroll: false })} />
        </div>
      )}
      {!chosen && organisations.length > 1 && <p className="mt-6 text-muted">Choose the organisation whose templates you want to see.</p>}
      {chosen && (
        <>
          {!managesTemplates(chosen) && (
            <Alert tone="info" title={`You can read ${chosen.name}'s templates.`} className="mt-6">
              Its owner and managers design, publish and retire them.
            </Alert>
          )}
          <div className="mt-8">
            <ChipNav label="Template status" items={STATUSES.map((item) => ({ key: item.key, href: href(item.status), label: item.label, current: item.key === filter.key }))} />
          </div>
          <OrgList key={`${chosen.id}-${filter.key}`} organisation={chosen} status={filter.status} countryName={countryName} />
          <Samples organisation={chosen} canManage={managesTemplates(chosen)} countryName={countryName} />
        </>
      )}
    </>
  );
}

function OrgList({ organisation, status, countryName }: { organisation: DashboardOrganisation; status?: LeaseTemplateStatus; countryName: (code: string) => string }) {
  const load = useCallback(() => listOrgLeaseTemplates(organisation.id, { status }), [organisation.id, status]);
  const { state, reload } = useApi(load);
  return (
    <div className="mt-6">
      {state.status === "loading" && <LoadingBlock label="Loading the templates" rows={3} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" && state.data.items.length === 0 && (
        <EmptyState
          title={status ? `No templates are ${statusOf(ORG_TEMPLATE_STATUS, status).label.toLowerCase()}` : "No templates yet"}
          action={managesTemplates(organisation) ? <ButtonLink href={withOrg(`${PATH}/new`, organisation.id)} variant="secondary">Write a template</ButtonLink> : undefined}
        >
          Write one from scratch, or copy one of the samples below.
        </EmptyState>
      )}
      {state.status === "ready" && state.data.items.length > 0 && (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {state.data.items.map((template) => {
              const { label, tone } = statusOf(ORG_TEMPLATE_STATUS, template.status);
              const href = withOrg(`${PATH}/${template.id}`, organisation.id);
              return (
                <li key={template.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={href} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                        {template.name}
                      </Link>
                      <Badge tone={tone}>{label}</Badge>
                      <Badge tone="accent">{template.market_code}</Badge>
                    </p>
                    <p className="text-sm text-muted">
                      Version {template.version} · {kindLabel(template.lease_kind)} · {countryName(template.market_code)} · {template.sections.length} sections ·{" "}
                      {template.optional_clauses.length} optional clauses
                    </p>
                    <p className="text-xs text-subtle">
                      By {template.created_by_name} · updated {formatWhen(template.updated_at)}
                    </p>
                  </div>
                  <ButtonLink href={href} size="sm" variant="secondary">
                    {template.can_edit && template.status !== "RETIRED" ? "Open" : "View"}
                    <span className="sr-only"> {template.name}, version {template.version}</span>
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function modeFor(organisation: DashboardOrganisation): TemplateEditorMode {
  const orgId = organisation.id;
  return {
    kind: "organisation",
    path: PATH,
    query: `?org=${encodeURIComponent(orgId)}`,
    backLabel: "Lease templates",
    defaultMarket: organisation.market_code,
    read: async (id) => {
      const [one, events] = await Promise.all([getOrgLeaseTemplate(orgId, id), listOrgLeaseTemplateEvents(orgId, id)]);
      if (!one.ok) return one;
      let variables = one.data.variables;
      if (!variables) {
        const list = await listOrgLeaseTemplates(orgId);
        if (!list.ok) return list;
        variables = list.data.variables;
      }
      return { ok: true, status: one.status, data: { template: one.data.template, events: events.ok ? events.data.items : [], variables } };
    },
    variables: async () => {
      const list = await listOrgLeaseTemplates(orgId);
      return list.ok ? { ok: true, status: list.status, data: list.data.variables } : list;
    },
    create: (input) => createOrgLeaseTemplate(orgId, input),
    edit: (id, input) => editOrgLeaseTemplate(orgId, id, input),
    retire: (id) => retireOrgLeaseTemplate(orgId, id),
    publish: (id) => publishOrgLeaseTemplate(orgId, id),
  };
}

function EditorFor({ organisation, templateId, countries }: { organisation: DashboardOrganisation; templateId: string | null; countries: Option[] }) {
  const mode = useMemo(() => modeFor(organisation), [organisation]);
  if (!templateId && !managesTemplates(organisation)) {
    return (
      <>
        <BackLink href={withOrg(PATH, organisation.id)}>Lease templates</BackLink>
        <Alert tone="info" title={`Only ${organisation.name}'s owner and managers design its templates.`} className="mt-4" />
      </>
    );
  }
  return <TemplateEditor templateId={templateId} countries={countries} mode={mode} />;
}

/** A link without `?org=` from someone in several organisations: the organisation that has the template. */
function FindOrganisation({ organisations, templateId, countries }: { organisations: DashboardOrganisation[]; templateId: string; countries: Option[] }) {
  const [found, setFound] = useState<DashboardOrganisation | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const organisation of organisations) {
        const result = await getOrgLeaseTemplate(organisation.id, templateId);
        if (cancelled) return;
        if (result.ok) {
          setFound(organisation);
          return;
        }
      }
      if (!cancelled) setFound(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [organisations, templateId]);
  if (found === undefined) return <LoadingBlock label="Loading the template" rows={4} />;
  if (found === null) {
    return (
      <EmptyState title="We could not find that template" action={<ButtonLink href={PATH} variant="secondary">Lease templates</ButtonLink>}>
        It may belong to an organisation you are no longer part of.
      </EmptyState>
    );
  }
  return <EditorFor organisation={found} templateId={templateId} countries={countries} />;
}

function Editor({ organisations, templateId, countries }: { organisations: DashboardOrganisation[]; templateId: string | null; countries: Option[] }) {
  const router = useRouter();
  const chosen = useChosen(organisations);
  if (organisations.length === 0) return <NoOrganisation />;
  if (chosen) return <EditorFor key={chosen.id} organisation={chosen} templateId={templateId} countries={countries} />;
  if (templateId && UUID.test(templateId)) return <FindOrganisation organisations={organisations} templateId={templateId} countries={countries} />;
  return (
    <>
      <BackLink href={PATH}>Lease templates</BackLink>
      <h1 className="mt-1 text-4xl">New lease template</h1>
      <div className="mt-6">
        <OrganisationPicker organisations={organisations} chosen={null} onChoose={(id) => id && router.replace(withOrg(`${PATH}/new`, id))} />
      </div>
    </>
  );
}

function WithOrganisations({ children }: { children: (organisations: DashboardOrganisation[]) => ReactNode }) {
  const { state, reload } = useApi(loadOrganisations);
  if (state.status === "loading") return <LoadingBlock label="Loading your organisations" rows={3} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  return <>{children(state.data)}</>;
}

/** `/agent/lease-templates`: an organisation's templates by status, and the sample gallery. */
export function OrgLeaseTemplates({ countries }: { countries: Option[] }) {
  return (
    <RequireAuth allow={canUseInbox}>
      {() => <WithOrganisations>{(organisations) => <Templates organisations={organisations} countries={countries} />}</WithOrganisations>}
    </RequireAuth>
  );
}

/** `/agent/lease-templates/new` and `/agent/lease-templates/<id>`: the same editor as the samples, without the legal review. */
export function OrgLeaseTemplateEditor({ templateId, countries }: { templateId: string | null; countries: Option[] }) {
  return (
    <RequireAuth allow={canUseInbox}>
      {() => <WithOrganisations>{(organisations) => <Editor organisations={organisations} templateId={templateId} countries={countries} />}</WithOrganisations>}
    </RequireAuth>
  );
}
