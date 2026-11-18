"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { isProfessional, type User } from "@/lib/api/auth";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { listTeamMembers } from "@/lib/api/team";
import { canExportContacts, contactsPath, stageLabel, stageTone } from "@/lib/contacts";

/*
 * Pieces shared by the contact book's pages (`/agent/contacts/*`): the
 * organisation in `?org=`, the section links, stage badges and the
 * organisation's members for the relationship owner.
 */

/** code -> label maps of the API's reference sets, loaded by each page on the server. */
export type ContactLabels = {
  types: Record<string, string>;
  sources: Record<string, string>;
  /** Only when the API has a set of stage labels; otherwise the stages' fallback words are used. */
  stages: Record<string, string>;
};

export const typeLabel = (labels: ContactLabels, code: string | null | undefined, apiLabel?: string | null) =>
  apiLabel || (code ? (labels.types[code] ?? code) : "");

export const sourceLabel = (labels: ContactLabels, code: string | null | undefined, apiLabel?: string | null) =>
  apiLabel || (code ? (labels.sources[code] ?? code) : "");

export function StageBadge({ stage, label, labels }: { stage: string; label?: string | null; labels: ContactLabels }) {
  return <Badge tone={stageTone(stage)}>{stageLabel(stage, labels.stages, label)}</Badge>;
}

/** The organisations whose contact book the caller can open: every organisation they belong to. */
async function loadOrganisations(): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  return { ok: true, status: 200, data: dashboard.data.organisations };
}

type Section = "list" | "pipeline" | "import" | "other";

/** "Contacts", "Pipeline" and (for an OWNER or MANAGER) "Import" as one row of links. */
export function ContactsNav({ organisation, current }: { organisation: DashboardOrganisation; current: Section }) {
  const org = organisation.id;
  const items = [
    { key: "list", href: contactsPath("", org), label: "List", current: current === "list" },
    { key: "pipeline", href: contactsPath("/pipeline", org), label: "Pipeline", current: current === "pipeline" },
  ];
  if (canExportContacts(organisation.role)) {
    items.push({ key: "import", href: contactsPath("/import", org), label: "Import", current: current === "import" });
  }
  return <ChipNav label="Contact book sections" items={items} />;
}

type ShellProps = {
  /** The page's address after `/agent/contacts`, for the organisation picker ("", "/pipeline"…). */
  path: string;
  /** The h1. Left out when the page names itself (a contact's page shows the contact's name). */
  title?: string;
  intro?: ReactNode;
  section: Section;
  /** Where the back link goes; the dashboard by default. */
  back?: { href: (org: string) => string; label: string };
  /** The page's content for the chosen organisation. */
  children: (organisation: DashboardOrganisation, user: User) => ReactNode;
};

function Shell({ path, title, intro, section, back, children, user }: ShellProps & { user: User }) {
  // A module function is stable, so it is read once per visit (and again on "Try again").
  const { state, reload } = useApi(loadOrganisations);
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("org");
  const organisations = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const organisation = organisations.find((item) => item.id === wanted) ?? organisations[0];

  return (
    <>
      {back && organisation ? (
        <BackLink href={back.href(organisation.id)}>{back.label}</BackLink>
      ) : (
        <BackLink href="/dashboard">Dashboard</BackLink>
      )}
      {title && <h1 className="mt-1 text-3xl md:text-4xl">{title}</h1>}
      {intro && <div className="mt-2 max-w-2xl text-muted">{intro}</div>}

      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your organisations" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState
            title="The contact book belongs to an organisation"
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            Contacts are kept by a Real Estate Agency or another business you are a member of. Ask the Agency Principal
            to add you to the team.
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id="contacts-organisation" label="Organisation" className="mb-4 max-w-md">
                <SearchableSelect
                  id="contacts-organisation"
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(contactsPath(path, value), { scroll: false })}
                />
              </Field>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{organisation.name}</span> · you are the {organisation.role_label}
              {organisation.role === "STAFF" && " · you can read the contacts but not change them"}
            </p>
            {section !== "other" && (
              <div className="mt-4">
                <ContactsNav organisation={organisation} current={section} />
              </div>
            )}
            {/* key: nothing of one organisation stays on screen for another. */}
            <div key={organisation.id} className="mt-6">
              {children(organisation, user)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Signed in, a member of an organisation, and that organisation chosen. */
export function ContactsShell(props: ShellProps) {
  return <RequireAuth allow={isProfessional}>{(user) => <Shell {...props} user={user} />}</RequireAuth>;
}

export type Members = { status: "loading" } | { status: "ready"; options: SelectOption[]; names: Record<string, string> } | { status: "failed" };

/**
 * The organisation's members who can own a relationship (ACTIVE OWNER,
 * MANAGER or AGENT). The members list is open to OWNER and MANAGER only, so
 * for anyone else it fails and the caller falls back to "you" and the
 * current owner.
 */
export function useMembers(organisationId: string): Members {
  const [members, setMembers] = useState<Members>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    listTeamMembers(organisationId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setMembers({ status: "failed" });
        return;
      }
      const usable = result.data.items.filter((member) => member.status === "ACTIVE" && member.can_hold_leads !== false);
      setMembers({
        status: "ready",
        options: usable.map((member) => ({
          value: member.user_id,
          label: member.is_you ? `${member.name} (you)` : member.name,
          secondary: member.job_title ?? member.role_label,
        })),
        names: Object.fromEntries(result.data.items.map((member) => [member.user_id, member.name])),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [organisationId]);
  return members;
}

export const linkClass = "font-medium text-primary-ink hover:underline";

/** A link in body text to another page of the book, keeping the organisation. */
export function BookLink({ path, org, children, extra }: { path: string; org: string; children: ReactNode; extra?: Record<string, string | undefined> }) {
  return (
    <Link href={contactsPath(path, org, extra)} className={linkClass}>
      {children}
    </Link>
  );
}
