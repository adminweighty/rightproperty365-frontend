"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { isProfessional, type User } from "@/lib/api/auth";
import { listContacts } from "@/lib/api/contacts";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { listLeases } from "@/lib/api/leases";
import { listProperties } from "@/lib/api/properties";
import { contactFiltersApiQuery, contactsPath } from "@/lib/contacts";
import { inspectionsPath } from "@/lib/inspections";
import { maintenancePath } from "@/lib/maintenance";
import { formatLedgerAmount } from "@/lib/ledger";
import { arrearsHref } from "@/lib/rent";
import {
  addChosen,
  dueDayWords,
  frequencyPer,
  propertiesPath,
  propertyApiQuery,
  QUERY_MAX,
  removeChosen,
  tenanciesPath,
  tenancyStatusLabel,
  tenancyStatusTone,
  type Chosen,
  type Property,
  type Tenancy,
} from "@/lib/tenancies";

/*
 * Pieces shared by the property-management pages (`/agent/properties/*`,
 * `/agent/tenancies/*`): the book in `?org=`, the section links, the status
 * badge, the rent in words, the pickers (several contacts from the contact
 * book, the book's properties, its leases).
 */

export { formatDay } from "@/components/agent/books/shared";

/**
 * The books the caller can manage property in: every organisation they belong
 * to. Someone with no organisation may be an approved direct owner, whose
 * book has their own user id: it is offered, as "Your own properties", only
 * when the API answers for it.
 */
async function loadBooks(userId: string): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  if (dashboard.data.organisations.length > 0) return { ok: true, status: 200, data: dashboard.data.organisations };
  const own = await listProperties(userId, propertyApiQuery(1, "", 1));
  if (!own.ok) return { ok: true, status: 200, data: [] };
  const personal: DashboardOrganisation = {
    id: userId,
    name: "Your own properties",
    kind: "DIRECT_OWNER",
    market_code: "",
    role: "OWNER",
    role_label: "owner",
    can_see_members: false,
    can_assign_work: false,
    can_manage_listings: true,
  };
  return { ok: true, status: 200, data: [personal] };
}

export type Area = "properties" | "tenancies" | "arrears" | "maintenance" | "inspections";

const arrearsPath = (_path: string, org?: string) => arrearsHref(org);

const AREA_PATHS: Record<Area, (path: string, org?: string) => string> = {
  properties: propertiesPath,
  tenancies: tenanciesPath,
  arrears: arrearsPath,
  maintenance: maintenancePath,
  inspections: inspectionsPath,
};

const areaPath = (area: Area) => AREA_PATHS[area];

/** "Properties", "Tenancies", "Arrears", "Maintenance" and "Inspections" as one row of links, keeping the book. */
export function ManagementNav({ org, current }: { org: string; current: Area }) {
  return (
    <ChipNav
      label="Property management sections"
      items={[
        { key: "properties", href: propertiesPath("", org), label: "Properties", current: current === "properties" },
        { key: "tenancies", href: tenanciesPath("", org), label: "Tenancies", current: current === "tenancies" },
        { key: "arrears", href: arrearsHref(org), label: "Arrears", current: current === "arrears" },
        { key: "maintenance", href: maintenancePath("", org), label: "Maintenance", current: current === "maintenance" },
        { key: "inspections", href: inspectionsPath("", org), label: "Inspections", current: current === "inspections" },
      ]}
    />
  );
}

type ShellProps = {
  area: Area;
  /** The page's address after `/agent/properties`, `/agent/tenancies`, `/agent/maintenance` or `/agent/inspections` (none for `/agent/arrears`), for the book picker. */
  path: string;
  title?: string;
  intro?: ReactNode;
  /** Show the section links (list pages). */
  nav?: boolean;
  back?: { href: (org: string) => string; label: string };
  children: (organisation: DashboardOrganisation, user: User) => ReactNode;
};

function Shell({ area, path, title, intro, nav, back, children, user }: ShellProps & { user: User }) {
  const load = useCallback(() => loadBooks(user.id), [user.id]);
  const { state, reload } = useApi(load);
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("org");
  const organisations = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const organisation = organisations.find((item) => item.id === wanted) ?? organisations[0];

  return (
    <>
      {back && organisation ? <BackLink href={back.href(organisation.id)}>{back.label}</BackLink> : <BackLink href="/dashboard">Dashboard</BackLink>}
      {title && <h1 className="mt-1 text-3xl md:text-4xl">{title}</h1>}
      {intro && <div className="mt-2 max-w-2xl text-muted">{intro}</div>}
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your organisations" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState
            title="Properties belong to an organisation or a landlord"
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            Properties and tenancies are managed by a Real Estate Agency or another business you are a member of, or by an
            approved Landlord for their own properties. Ask the Agency Principal to add you to the team.
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id={`${area}-organisation`} label="Organisation" className="mb-4 max-w-md">
                <SearchableSelect
                  id={`${area}-organisation`}
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(areaPath(area)(path, value), { scroll: false })}
                />
              </Field>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{organisation.name}</span> · you are the {organisation.role_label}
              {organisation.role === "STAFF" && " · you can read the properties and tenancies but not change them"}
            </p>
            {nav && (
              <div className="mt-4">
                <ManagementNav org={organisation.id} current={area} />
              </div>
            )}
            {/* key: nothing of one book stays on screen for another. */}
            <div key={organisation.id} className="mt-6">
              {children(organisation, user)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Signed in, a member of an organisation (or a direct owner), and that book chosen. */
export function ManagementShell(props: ShellProps) {
  return <RequireAuth allow={isProfessional}>{(user) => <Shell {...props} user={user} />}</RequireAuth>;
}

export const linkClass = "font-medium text-primary-ink hover:underline";

export function TenancyStatusBadge({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={tenancyStatusTone(status)}>{tenancyStatusLabel(status, label)}</Badge>;
}

/** "USD 450.00 a month, due on the 1st of each month". The digits are the API's, never rounded. */
export function rentWords(rent: Tenancy["rent"]): string {
  if (!rent) return "Rent not set";
  const due = dueDayWords(rent.frequency, rent.dueDay);
  return `${formatLedgerAmount(rent.amount, rent.currency)} ${frequencyPer(rent.frequency)}${due ? `, ${due}` : ""}`;
}

export function Linked({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

// ---- Several contacts from the contact book ---------------------------------------------------------

type Found = { status: "idle" | "loading" } | { status: "ready"; options: SelectOption[] } | { status: "error"; message: string };

/**
 * Chooses one or more contacts from the book's contact book (`GET
 * …/contacts?q=`), as `ContactPicker` in the books does for one: a list of
 * those chosen, each with a 44px "Remove", then a search and a
 * SearchableSelect of the matches; choosing a match adds it.
 */
export function ContactsPicker({
  id,
  org,
  legend,
  noun,
  value,
  onChange,
  error,
  hint,
  optional,
  disabled,
}: {
  id: string;
  org: string;
  /** "Tenants". */
  legend: string;
  /** "tenant": "Add a tenant", "Remove tenant Rudo Moyo". */
  noun: string;
  value: Chosen[];
  onChange: (next: Chosen[]) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found>({ status: "idle" });
  const [announce, setAnnounce] = useState("");

  async function search() {
    const text = q.trim().slice(0, QUERY_MAX);
    if (!text) return;
    setFound({ status: "loading" });
    const answer = await listContacts(org, contactFiltersApiQuery({ q: text, page: 1 }, 20));
    setFound(
      answer.ok
        ? { status: "ready", options: answer.data.items.map((item) => ({ value: item.id, label: item.name, secondary: item.emails[0] ?? item.phones[0] })) }
        : { status: "error", message: answer.failure.message },
    );
  }

  const matches = found.status === "ready" ? found.options.filter((option) => !value.some((item) => item.id === option.value)) : [];
  const options: SelectOption[] = [{ value: "", label: `Choose a ${noun} to add` }, ...matches];
  const searchId = `${id}-search`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <fieldset className="min-w-0 rounded-md border border-line p-4" aria-describedby={error ? errorId : hint ? hintId : undefined}>
      <legend className="px-1 text-sm font-medium text-ink">
        {legend}
        {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
      </legend>
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
      {value.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No {noun}s chosen yet.</p>
      ) : (
        <ul className="mt-2 space-y-2" aria-label={`${legend} chosen`}>
          {value.map((item) => (
            <li key={item.id} className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line bg-sunken pl-3">
              <span className="min-w-0 break-words text-sm font-medium text-ink">{item.label}</span>
              <Button
                variant="ghost"
                className="w-11 shrink-0 px-0"
                disabled={disabled}
                aria-label={`Remove ${noun} ${item.label}`}
                onClick={() => {
                  onChange(removeChosen(value, item.id));
                  setAnnounce(`${item.label} removed.`);
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id={searchId} label="Find in your contact book" className="flex-1">
          <Input
            id={searchId}
            type="search"
            maxLength={QUERY_MAX}
            value={q}
            disabled={disabled}
            placeholder="Name, email or phone"
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              // Enter searches here instead of sending the whole form.
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
          />
        </Field>
        <Button variant="secondary" onClick={() => void search()} disabled={disabled || found.status === "loading"} aria-busy={found.status === "loading"}>
          {found.status === "loading" ? "Searching…" : "Search"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-muted">
        {announce && <span className="block">{announce}</span>}
        {found.status === "ready" &&
          (found.options.length === 0 ? (
            <>
              No contacts match that search.{" "}
              <Link href={contactsPath("/new", org)} className={linkClass}>
                Add a contact
              </Link>{" "}
              to your contact book first.
            </>
          ) : (
            `${matches.length} found. Choose one below to add it.`
          ))}
        {found.status === "error" && <span className="text-danger">{found.message}</span>}
      </p>
      {found.status === "ready" && matches.length > 0 && (
        <Field id={id} label={`Add a ${noun}`} className="mt-2">
          <SearchableSelect
            id={id}
            options={options}
            value=""
            disabled={disabled}
            aria-describedby={fieldDescribedBy(id, {})}
            onValueChange={(next) => {
              const option = matches.find((item) => item.value === next);
              if (!option) return;
              onChange(addChosen(value, { id: option.value, label: option.label }));
              setAnnounce(`${option.label} added as a ${noun}.`);
            }}
          />
        </Field>
      )}
    </fieldset>
  );
}

// ---- The book's properties and leases -----------------------------------------------------------------

export type PropertyChoices = { status: "loading" } | { status: "ready"; items: Property[] } | { status: "failed"; message: string };

/** The book's properties, up to five pages of 100, for the tenancy form and the list filter. */
export function useProperties(org: string): PropertyChoices {
  const [state, setState] = useState<PropertyChoices>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const firstPage = await listProperties(org, propertyApiQuery(1, "", 100));
      if (cancelled) return;
      if (!firstPage.ok) {
        setState({ status: "failed", message: firstPage.failure.message });
        return;
      }
      const items = [...firstPage.data.items];
      for (let page = 2; page <= Math.min(firstPage.data.totalPages, 5); page++) {
        const next = await listProperties(org, propertyApiQuery(page, "", 100));
        if (cancelled) return;
        if (next.ok) items.push(...next.data.items);
      }
      setState({ status: "ready", items });
    })();
    return () => {
      cancelled = true;
    };
  }, [org]);
  return state;
}

export type LeaseChoices = { status: "loading" } | { status: "ready"; options: SelectOption[] } | { status: "failed" };

/**
 * The leases of this book (`GET /v1/me/leases`, up to five pages, those whose
 * organisation is this one; for a direct owner, those with no organisation).
 */
export function useLeaseOptions(org: string, personal: boolean): LeaseChoices {
  const [state, setState] = useState<LeaseChoices>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const firstPage = await listLeases({ page: 1 });
      if (cancelled) return;
      if (!firstPage.ok) {
        setState({ status: "failed" });
        return;
      }
      const items = [...firstPage.data.items];
      for (let page = 2; page <= Math.min(firstPage.data.total_pages, 5); page++) {
        const next = await listLeases({ page });
        if (cancelled) return;
        if (next.ok) items.push(...next.data.items);
      }
      const mine = items.filter((lease) => (personal ? !lease.organisation : lease.organisation?.id === org) && lease.status !== "CANCELLED");
      setState({
        status: "ready",
        options: mine.map((lease) => ({
          value: lease.id,
          label: `${lease.reference} · ${lease.property_address || lease.listing?.title || "No address"}`,
          secondary: lease.tenants.map((tenant) => tenant.name).join(", ") || undefined,
          keywords: [lease.status],
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [org, personal]);
  return state;
}
