"use client";

import { ArrowDownLeft, ArrowUpRight, BookOpen, Download } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { isProfessional, type User } from "@/lib/api/auth";
import { listMyListings } from "@/lib/api/availability";
import { listContacts } from "@/lib/api/contacts";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { exportReport, getLedgerOptions, listCategories, type ExportReport } from "@/lib/api/ledger";
import { contactFiltersApiQuery } from "@/lib/contacts";
import {
  booksPath,
  canExportBooks,
  canManageCategories,
  directionLabel,
  fileNameFrom,
  LEDGER_QUERY_MAX,
  signedLedgerAmount,
  statusBadge,
  UNVERIFIED_WORDS,
  type LedgerCategory,
  type LedgerOptions,
} from "@/lib/ledger";

/*
 * Pieces shared by the books' pages (`/agent/books/*`): the organisation in
 * `?org=`, the banner, the section links, the status badge, money in and
 * out, and the pickers (categories, contacts from the contact book, listings).
 */

/**
 * The books the caller can open: every organisation they belong to. Someone
 * with no organisation may be an approved direct owner, whose personal book
 * has their own user id (as in the contact book of the API): it is offered
 * when the API answers for it, as "Your own books".
 */
async function loadBooks(userId: string): Promise<ApiResult<DashboardOrganisation[]>> {
  const dashboard = await getDashboard();
  if (!dashboard.ok) return dashboard;
  if (dashboard.data.organisations.length > 0) return { ok: true, status: 200, data: dashboard.data.organisations };
  const own = await getLedgerOptions(userId);
  if (!own.ok) return { ok: true, status: 200, data: [] };
  const personal: DashboardOrganisation = {
    id: userId,
    name: "Your own books",
    kind: "DIRECT_OWNER",
    market_code: "",
    role: own.data.permissions.manage === false ? "AGENT" : "OWNER",
    role_label: "owner of these books",
    can_see_members: false,
    can_assign_work: false,
    can_manage_listings: true,
  };
  return { ok: true, status: 200, data: [personal] };
}

/** `GET /options`: the types with their fixed direction, currencies with minor units, categories and branches. */
export function useLedgerOptions(org: string): LedgerOptions | null {
  const load = useCallback(() => getLedgerOptions(org), [org]);
  const { state } = useApi(load);
  return state.status === "ready" ? state.data : null;
}

export type BooksSection = "entries" | "new" | "reports" | "categories" | "other";

export function BooksNav({ organisation, current }: { organisation: DashboardOrganisation; current: BooksSection }) {
  const org = organisation.id;
  const items = [
    { key: "entries", href: booksPath("", org), label: "Entries", current: current === "entries" },
    { key: "reports", href: booksPath("/reports", org), label: "Reports", current: current === "reports" },
  ];
  if (canManageCategories(organisation.role)) {
    items.push({ key: "categories", href: booksPath("/categories", org), label: "Categories", current: current === "categories" });
  }
  return <ChipNav label="Books sections" items={items} />;
}

/** The words every page of the books starts with (BR-012, FSD section 6). */
export function BooksBanner() {
  return (
    <div className="flex gap-3 rounded-md border-l-4 border-info bg-info-soft p-4 text-sm text-ink">
      <BookOpen className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
      <p>
        Your organisation’s own books. Separate from your RightProperty365 subscription invoices. Entries you record are
        marked ‘{UNVERIFIED_WORDS}’.
      </p>
    </div>
  );
}

type ShellProps = {
  /** The page's address after `/agent/books`, for the organisation picker. */
  path: string;
  title?: string;
  intro?: ReactNode;
  section: BooksSection;
  back?: { href: (org: string) => string; label: string };
  children: (organisation: DashboardOrganisation, user: User) => ReactNode;
};

function Shell({ path, title, intro, section, back, children, user }: ShellProps & { user: User }) {
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
      <div className="mt-4">
        <BooksBanner />
      </div>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading your organisations" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && !organisation && (
          <EmptyState
            title="The books belong to an organisation"
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to your dashboard
              </ButtonLink>
            }
          >
            Books are kept by a Real Estate Agency or another business you are a member of, or by an approved Landlord or
            Property Seller (Vendor) for their own properties. Ask the Agency Principal to add you to the team.
          </EmptyState>
        )}
        {state.status === "ready" && organisation && (
          <>
            {organisations.length > 1 && (
              <Field id="books-organisation" label="Organisation" className="mb-4 max-w-md">
                <SearchableSelect
                  id="books-organisation"
                  options={organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))}
                  value={organisation.id}
                  onValueChange={(value) => router.push(booksPath(path, value), { scroll: false })}
                />
              </Field>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{organisation.name}</span> · you are the {organisation.role_label}
              {organisation.role === "STAFF" && " · you can read the books but not record entries"}
            </p>
            {section !== "other" && (
              <div className="mt-4">
                <BooksNav organisation={organisation} current={section} />
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
export function BooksShell(props: ShellProps) {
  return <RequireAuth allow={isProfessional}>{(user) => <Shell {...props} user={user} />}</RequireAuth>;
}

/** "Recorded by you, not verified" or "Marked reconciled by your team": the only two wordings. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const badge = statusBadge(status);
  return <Badge tone={badge.tone}>{badge.words}</Badge>;
}

/** Money in or out, as an arrow and the words, never by colour alone. */
export function DirectionTag({ direction }: { direction: string }) {
  const out = direction === "OUT";
  const Icon = out ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
      <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
      {directionLabel(direction)}
    </span>
  );
}

/** "+USD 100.00" / "−USD 100.00" with "Money in" / "Money out" for screen readers. */
export function SignedAmount({ amount, currency, direction, className }: { amount: string; currency: string; direction: string; className?: string }) {
  return (
    <span className={className ?? "font-semibold tabular-nums whitespace-nowrap text-ink"}>
      <span className="sr-only">{directionLabel(direction)}: </span>
      {signedLedgerAmount(amount, currency, direction)}
    </span>
  );
}

export const linkClass = "font-medium text-primary-ink hover:underline";

export function BooksLink({ path, org, children, extra }: { path: string; org: string; children: ReactNode; extra?: Record<string, string | undefined> }) {
  return (
    <Link href={booksPath(path, org, extra)} className={linkClass}>
      {children}
    </Link>
  );
}

/** "15 November 2026" from YYYY-MM-DD, without moving it through a time zone. */
export function formatDay(day: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!match) return day ?? "";
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);
}

/** Today in the person's own calendar, as YYYY-MM-DD. */
export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ---- Categories ---------------------------------------------------------------------------

export type Categories = { status: "loading" } | { status: "ready"; items: LedgerCategory[] } | { status: "failed" };

export function useCategories(org: string): Categories {
  const load = useCallback(() => listCategories(org), [org]);
  const { state } = useApi(load);
  if (state.status === "ready") return { status: "ready", items: state.data };
  if (state.status === "error") return { status: "failed" };
  return { status: "loading" };
}

export const categoryWords = (categories: Categories, code: string | null | undefined, apiLabel?: string | null) =>
  apiLabel || (code ? (categories.status === "ready" ? (categories.items.find((item) => item.code === code)?.label ?? code) : code) : "");

/** Active categories, and the current one even when it was deactivated since. */
export function categoryOptions(categories: Categories, current?: string, any?: string): SelectOption[] {
  const options: SelectOption[] = any ? [{ value: "", label: any }] : [];
  if (categories.status !== "ready") {
    if (current) options.push({ value: current, label: current });
    return options;
  }
  for (const item of categories.items) {
    if (item.active || item.code === current) options.push({ value: item.code, label: item.active ? item.label : `${item.label} (no longer used)` });
  }
  if (current && !categories.items.some((item) => item.code === current)) options.push({ value: current, label: current });
  return options;
}

// ---- Listings ---------------------------------------------------------------------------------

export type ListingOptions = { status: "loading" } | { status: "ready"; options: SelectOption[]; names: Record<string, string> } | { status: "failed" };

/** The listings the caller manages (`GET /v1/me/listings`), up to five pages of 48. The API refuses any not of this book. */
export function useListingOptions(): ListingOptions {
  const [state, setState] = useState<ListingOptions>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = await listMyListings(1);
      if (cancelled) return;
      if (!first.ok) {
        setState({ status: "failed" });
        return;
      }
      const items = [...first.data.items];
      for (let page = 2; page <= Math.min(first.data.total_pages, 5); page++) {
        const next = await listMyListings(page);
        if (cancelled) return;
        if (next.ok) items.push(...next.data.items);
      }
      setState({
        status: "ready",
        options: items.map((item) => ({ value: item.id, label: item.title || item.reference, secondary: item.reference })),
        names: Object.fromEntries(items.map((item) => [item.id, item.title || item.reference])),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// ---- A contact from the contact book ---------------------------------------------------------------

type Found = { status: "idle" | "loading" } | { status: "ready"; options: SelectOption[] } | { status: "error"; message: string };

/**
 * Finds a contact in the organisation's contact book by name, email or phone
 * (`GET …/contacts?q=`) and offers the matches in a SearchableSelect. The
 * contact chosen (with its name) is the value; "" is no contact.
 */
export function ContactPicker({
  id,
  org,
  label = "Contact",
  value,
  valueLabel,
  onChange,
  error,
  hint,
  optional = true,
  name,
}: {
  id: string;
  org: string;
  label?: string;
  value: string;
  valueLabel?: string | null;
  onChange: (id: string, label: string | null) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  /** For a GET form: the chosen contact's id is submitted under this name. */
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found>({ status: "idle" });

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const text = q.trim().slice(0, LEDGER_QUERY_MAX);
    if (!text) return;
    setFound({ status: "loading" });
    const answer = await listContacts(org, contactFiltersApiQuery({ q: text, page: 1 }, 20));
    setFound(
      answer.ok
        ? { status: "ready", options: answer.data.items.map((item) => ({ value: item.id, label: item.name, secondary: item.emails[0] ?? item.phones[0] })) }
        : { status: "error", message: answer.failure.message },
    );
  }

  const options: SelectOption[] = [{ value: "", label: "No contact" }];
  if (found.status === "ready") options.push(...found.options);
  if (value && !options.some((option) => option.value === value)) options.push({ value, label: valueLabel || "The contact chosen" });
  const chosenLabel = options.find((option) => option.value === value)?.label;
  const searchId = `${id}-search`;

  return (
    <fieldset className="min-w-0 rounded-md border border-line p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
      </legend>
      <p className="text-sm text-muted">{value ? `Chosen: ${chosenLabel}` : "No contact chosen."}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id={searchId} label="Find in your contact book" className="flex-1">
          <Input
            id={searchId}
            type="search"
            maxLength={LEDGER_QUERY_MAX}
            value={q}
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
        <Button variant="secondary" onClick={() => void search()} disabled={found.status === "loading"} aria-busy={found.status === "loading"}>
          {found.status === "loading" ? "Searching…" : "Search"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-muted">
        {found.status === "ready" && (found.options.length === 0 ? "No contacts match that search." : `${found.options.length} found. Choose one below.`)}
        {found.status === "error" && <span className="text-danger">{found.message}</span>}
      </p>
      <Field id={id} label="Contact" hint={hint} error={error} className="mt-2">
        <SearchableSelect
          id={id}
          name={name}
          options={options}
          value={value}
          onValueChange={(next) => onChange(next, options.find((option) => option.value === next)?.label ?? null)}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy(id, { hint, error })}
        />
      </Field>
    </fieldset>
  );
}

// ---- Downloads ------------------------------------------------------------------------------------------

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Export as CSV", for the OWNER and MANAGER only (the API refuses anyone else). Audited. */
export function ExportButton({
  organisation,
  report,
  values,
  label,
}: {
  organisation: DashboardOrganisation;
  report: ExportReport;
  values?: Record<string, string | undefined>;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);
  if (!canExportBooks(organisation.role)) return null;

  async function download() {
    setBusy(true);
    setNotice(null);
    const answer = await exportReport(organisation.id, report, values);
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), `${report}-${new Date().toISOString().slice(0, 10)}.csv`);
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}. The export is recorded in the team's activity log.` });
  }

  return (
    <div>
      <Button variant="secondary" onClick={download} disabled={busy} aria-busy={busy}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing the file…" : label}
      </Button>
      <div aria-live="polite" className="mt-2">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
    </div>
  );
}

/** A table that scrolls sideways inside its own box at 320px; the page never does. */
export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-lg border border-line bg-surface">
      {children}
    </div>
  );
}

export const th = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase whitespace-nowrap";
export const thNum = "px-3 py-2 text-right text-xs font-semibold tracking-wide text-muted uppercase whitespace-nowrap";
export const td = "px-3 py-2 align-top text-sm text-ink";
export const tdNum = "px-3 py-2 align-top text-right text-sm tabular-nums whitespace-nowrap text-ink";
