"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { managesForms, OrganisationShell, withOrg } from "@/components/applications/organisation-shell";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listForms, type QuestionnaireForm } from "@/lib/api/applications";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { allFields, type FormStatus } from "@/lib/questionnaires";

export const FORMS_PATH = "/agent/forms";

export const FORM_STATUS: Record<FormStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  RETIRED: { label: "Retired", tone: "neutral" },
};

const FILTERS: { key: string; label: string; status?: FormStatus }[] = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts", status: "DRAFT" },
  { key: "PUBLISHED", label: "Published", status: "PUBLISHED" },
  { key: "RETIRED", label: "Retired", status: "RETIRED" },
];

/** The versions of each form together, newest version first; families by their newest change. */
export function groupByFamily(forms: QuestionnaireForm[]): QuestionnaireForm[][] {
  const families = new Map<string, QuestionnaireForm[]>();
  for (const form of forms) families.set(form.family_id, [...(families.get(form.family_id) ?? []), form]);
  return [...families.values()]
    .map((versions) => versions.sort((a, b) => b.version - a.version))
    .sort((a, b) => (b[0].updated_at ?? "").localeCompare(a[0].updated_at ?? ""));
}

function List({ organisation, status }: { organisation: DashboardOrganisation; status?: FormStatus }) {
  const load = useCallback(() => listForms(organisation.id, { status }), [organisation.id, status]);
  const { state, reload } = useApi(load);
  const canManage = managesForms(organisation);

  if (state.status === "loading") return <LoadingBlock label="Loading the forms" rows={3} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (state.data.length === 0) {
    return (
      <EmptyState
        title={status ? `No ${FORM_STATUS[status].label.toLowerCase()} forms` : "No application forms yet"}
        action={canManage ? <ButtonLink href={withOrg(`${FORMS_PATH}/new`, organisation.id)} variant="secondary">Create a form</ButtonLink> : undefined}
      >
        A form holds the questions applicants answer. Publish it, then attach it to a listing to take applications.
      </EmptyState>
    );
  }
  const families = groupByFamily(state.data);
  return (
    <>
      <p role="status" className="text-sm text-muted">
        {families.length === 1 ? "1 form" : `${families.length} forms`}, newest change first
      </p>
      <ul className="mt-4 grid gap-4">
        {families.map((versions) => {
          const latest = versions[0];
          return (
            <li key={latest.family_id}>
              <Card>
                <h2 className="font-sans text-lg font-semibold tracking-normal">{latest.name || "Untitled form"}</h2>
                <p className="mt-1 text-sm text-muted">
                  {latest.market_code || "No country"} · {allFields(latest).length} questions · keeps answers for {latest.retention_days ?? "?"} days
                  {latest.expires_at && <> · expires {formatWhen(latest.expires_at)}</>}
                </p>
                <ol className="mt-4 divide-y divide-line rounded-md border border-line" aria-label={`Versions of ${latest.name || "this form"}`}>
                  {versions.map((form) => {
                    const href = withOrg(`${FORMS_PATH}/${form.id}`, organisation.id);
                    const editable = canManage && form.status === "DRAFT" && form.can_edit !== false;
                    return (
                      <li key={form.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2">
                            <Link href={href} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                              Version {form.version}
                            </Link>
                            <Badge tone={FORM_STATUS[form.status].tone}>{FORM_STATUS[form.status].label}</Badge>
                            {form.application_count !== null && (
                              <span className="text-sm text-muted">
                                {form.application_count === 1 ? "1 application" : `${form.application_count} applications`}
                              </span>
                            )}
                          </p>
                          {form.updated_at && <p className="text-xs text-subtle">Updated {formatWhen(form.updated_at)}</p>}
                        </div>
                        <ButtonLink href={href} size="sm" variant="secondary" className="self-start sm:self-auto">
                          {editable ? "Edit" : "View"}
                          <span className="sr-only">
                            {" "}
                            {latest.name}, version {form.version}
                          </span>
                        </ButtonLink>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Forms({ organisation }: { organisation: DashboardOrganisation }) {
  const params = useSearchParams();
  const filter = FILTERS.find((item) => item.key === params.get("status")) ?? FILTERS[0];
  const canManage = managesForms(organisation);
  return (
    <>
      {!canManage && (
        <Alert tone="info" title={`You can read ${organisation.name}'s forms.`} className="mb-6">
          Its owner and managers create, publish and retire them.
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChipNav
          label="Forms by status"
          items={FILTERS.map((item) => ({
            key: item.key,
            href: withOrg(FORMS_PATH, organisation.id, { status: item.status }),
            label: item.label,
            current: item.key === filter.key,
          }))}
        />
        {canManage && (
          <ButtonLink href={withOrg(`${FORMS_PATH}/new`, organisation.id)}>
            <Plus className="size-4" aria-hidden="true" />
            New form
          </ButtonLink>
        )}
      </div>
      <div className="mt-6">
        <List key={filter.key} organisation={organisation} status={filter.status} />
      </div>
    </>
  );
}

/** `/agent/forms`: an organisation's application forms, each with its versions. */
export function FormList() {
  return (
    <OrganisationShell
      path={FORMS_PATH}
      title="Application forms"
      back={{ href: "/agent/applications", label: "Applications" }}
      intro={
        <p>
          The questions people answer when they apply for one of your listings. Publish a form, then attach it to a
          listing. A published version never changes: editing it starts the next version, and every application keeps
          the questions it was made on.
        </p>
      }
      empty={{
        title: "Application forms belong to an organisation",
        body: "Forms are kept by a Real Estate Agency or another business that lists property. Ask the Agency Principal to add you to the team.",
      }}
    >
      {(organisation) => <Forms organisation={organisation} />}
    </OrganisationShell>
  );
}
