"use client";

import { BellRing, Download, Mail, Phone, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  ContactsShell,
  StageBadge,
  typeLabel,
  useMembers,
  type ContactLabels,
  type Members,
} from "@/components/agent/contacts/shared";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import { exportContacts, listContacts, type ContactSummary } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import {
  canExportContacts,
  canWriteContacts,
  CONTACT_QUERY_MAX,
  CONTACT_STAGES,
  contactFilterChips,
  contactFiltersApiQuery,
  contactFiltersSearch,
  contactHref,
  contactsPath,
  hasNarrowingContactFilters,
  parseContactFilters,
  stageLabel,
  stageOptions,
  TAG_MAX,
  normaliseStageCounts,
  type ContactFilters,
} from "@/lib/contacts";

const PATH = "/agent/contacts";

const sortOptions: SelectOption[] = [
  { value: "", label: "Last contact, most recent first" },
  { value: "name", label: "Name, A to Z" },
  { value: "created", label: "Added, newest first" },
];

/** The owner choices: the organisation's members, or (when they cannot be read) just the caller. */
function ownerOptions(members: Members, user: User, current?: string): SelectOption[] {
  const any: SelectOption = { value: "", label: "Anyone" };
  if (members.status === "ready") return [any, ...members.options];
  const options = [any, { value: user.id, label: `${user.name} (you)` }];
  if (current && current !== user.id) options.push({ value: current, label: "The colleague chosen before" });
  return options;
}

function ownerName(members: Members, user: User, id: string) {
  if (id === user.id) return "you";
  return members.status === "ready" ? (members.names[id] ?? "a colleague") : "a colleague";
}

function Filters({
  filters,
  org,
  labels,
  owners,
  tags,
}: {
  filters: ContactFilters;
  org: string;
  labels: ContactLabels;
  owners: SelectOption[];
  tags: string[];
}) {
  const router = useRouter();
  const typeOptions: SelectOption[] = [
    { value: "", label: "Any type" },
    ...Object.entries(labels.types).map(([value, label]) => ({ value, label })),
  ];
  if (filters.type && !labels.types[filters.type]) typeOptions.push({ value: filters.type, label: filters.type });
  const tagOptions: SelectOption[] = [{ value: "", label: "Any tag" }, ...tags.map((tag) => ({ value: tag, label: tag }))];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = parseContactFilters({
      get: (name) => (name === "page" ? null : name === "due" ? (data.get("due") ? "1" : null) : String(data.get(name) ?? "")),
    });
    router.push(`${PATH}${contactFiltersSearch(next, org)}`, { scroll: false });
  }

  return (
    <form method="get" action={PATH} onSubmit={handleSubmit} role="search" aria-label="Filter contacts" className="rounded-lg border border-line bg-surface p-4">
      <input type="hidden" name="org" value={org} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="contacts-q" label="Search">
          <Input
            id="contacts-q"
            name="q"
            type="search"
            maxLength={CONTACT_QUERY_MAX}
            defaultValue={filters.q ?? ""}
            placeholder="Name, email or phone"
          />
        </Field>
        <Field id="contacts-type" label="Type">
          <SearchableSelect id="contacts-type" name="type" options={typeOptions} defaultValue={filters.type ?? ""} />
        </Field>
        <Field id="contacts-stage" label="Stage">
          <SearchableSelect
            id="contacts-stage"
            name="stage"
            options={[{ value: "", label: "Any stage" }, ...stageOptions(labels.stages)]}
            defaultValue={filters.stage ?? ""}
          />
        </Field>
        <Field id="contacts-tag" label="Tag">
          <SearchableSelect id="contacts-tag" name="tag" options={tagOptions} defaultValue={filters.tag ?? ""} />
        </Field>
        <Field id="contacts-owner" label="Relationship owner">
          <SearchableSelect id="contacts-owner" name="owner" options={owners} defaultValue={filters.owner ?? ""} />
        </Field>
        <Field id="contacts-sort" label="Order">
          <SearchableSelect id="contacts-sort" name="sort" options={sortOptions} defaultValue={filters.sort ?? ""} />
        </Field>
      </div>
      <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input type="checkbox" name="due" value="1" defaultChecked={Boolean(filters.due)} className="size-5 accent-primary" />
        <span className="text-ink">Only contacts with a reminder due</span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        {hasNarrowingContactFilters(filters) && (
          <ButtonLink href={`${PATH}${contactFiltersSearch({ stage: filters.stage, page: 1 }, org)}`} variant="ghost" scroll={false}>
            Clear filters
          </ButtonLink>
        )}
      </div>
    </form>
  );
}

function ContactCard({ item, org, labels, user }: { item: ContactSummary; org: string; labels: ContactLabels; user: User }) {
  const owner = item.owner;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        {item.type && <Badge tone="primary">{typeLabel(labels, item.type, item.type_label)}</Badge>}
        <StageBadge stage={item.stage} label={item.stage_label} labels={labels} />
        {item.has_reminder_due && (
          <Badge tone="warning">
            <BellRing className="mr-1 inline size-3.5" aria-hidden="true" />
            Reminder due
          </Badge>
        )}
      </div>
      <h3 className="mt-3 font-sans text-lg font-medium tracking-normal">
        <Link href={contactHref(item.id, org)} className="break-words text-primary-ink hover:underline">
          {item.name}
        </Link>
      </h3>
      <ul className="mt-2 space-y-1 text-sm text-ink">
        {item.emails[0] && (
          <li className="flex items-center gap-1.5">
            <Mail className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="break-all">{item.emails[0]}</span>
            {item.emails.length > 1 && <span className="text-muted">+{item.emails.length - 1}</span>}
          </li>
        )}
        {item.phones[0] && (
          <li className="flex items-center gap-1.5">
            <Phone className="size-4 shrink-0 text-muted" aria-hidden="true" />
            {item.phones[0]}
            {item.phones.length > 1 && <span className="text-muted">+{item.phones.length - 1}</span>}
          </li>
        )}
      </ul>
      {item.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {item.tags.map((tag) => (
            <li key={tag}>
              <Badge>{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
        <span className="flex items-center gap-1.5 text-ink">
          <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
          {owner ? (
            <>
              <span className="text-muted">Owner</span>
              <span className="font-medium">{owner.user_id === user.id ? "You" : owner.name}</span>
            </>
          ) : (
            <span className="text-muted">No relationship owner</span>
          )}
        </span>
        <span className="text-muted sm:ml-auto">
          {item.last_contact_at ? `Last contact ${formatWhen(item.last_contact_at)}` : `Added ${formatWhen(item.created_at)}`}
        </span>
      </div>
    </Card>
  );
}

function ExportButton({ organisation }: { organisation: DashboardOrganisation }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);

  async function download() {
    setBusy(true);
    setNotice(null);
    const answer = await exportContacts(organisation.id);
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const { blob, headers } = answer.data;
    const named = /filename="?([^";]+)"?/i.exec(headers.get("Content-Disposition") ?? "")?.[1];
    const name = named ?? `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNotice({ tone: "success", text: `Downloaded ${name}. The export is recorded in the team's activity log.` });
  }

  return (
    <div>
      <Button variant="secondary" onClick={download} disabled={busy} aria-busy={busy}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing the file…" : "Export as CSV"}
      </Button>
      <div aria-live="polite" className="mt-2">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
    </div>
  );
}

function List({ organisation, labels, user }: { organisation: DashboardOrganisation; labels: ContactLabels; user: User }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseContactFilters(new URLSearchParams(search)), [search]);
  const apiQuery = contactFiltersApiQuery(filters);
  const load = useCallback(() => listContacts(org, apiQuery), [org, apiQuery]);
  const { state, reload } = useApi(load);
  const members = useMembers(org);
  const owners = ownerOptions(members, user, filters.owner);
  const writer = canWriteContacts(organisation.role);
  const hrefFor = (next: ContactFilters) => `${PATH}${contactFiltersSearch(next, org)}`;

  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const item of page?.items ?? []) for (const tag of item.tags) seen.add(tag);
    if (filters.tag) seen.add(filters.tag);
    return [...seen].filter((tag) => tag.length <= TAG_MAX).sort((a, b) => a.localeCompare(b));
  }, [page, filters.tag]);
  const counts = normaliseStageCounts(page?.stage_counts);
  const countOf = (stage: string) => counts.find((item) => item.stage === stage)?.count;
  const all = counts.length ? counts.reduce((sum, item) => sum + item.count, 0) : undefined;
  const narrowed = hasNarrowingContactFilters(filters) || Boolean(filters.stage);
  const chips = contactFilterChips(
    filters,
    { type: (code) => typeLabel(labels, code), owner: (id) => ownerName(members, user, id) },
    hrefFor,
  );

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {writer && <ButtonLink href={contactsPath("/new", org)}>Add a contact</ButtonLink>}
        {writer && (
          <ButtonLink href={contactsPath("/merge", org)} variant="secondary">
            Merge contacts
          </ButtonLink>
        )}
        {canExportContacts(organisation.role) && <ExportButton organisation={organisation} />}
      </div>

      <div className="mt-6 space-y-4">
        <ChipNav
          label="Contacts by stage"
          items={[
            { key: "all", href: hrefFor({ ...filters, stage: undefined, page: 1 }), label: "All", count: all, current: !filters.stage },
            ...CONTACT_STAGES.map((stage) => ({
              key: stage,
              href: hrefFor({ ...filters, stage, page: 1 }),
              label: stageLabel(stage, labels.stages, counts.find((item) => item.stage === stage)?.label),
              count: countOf(stage),
              current: filters.stage === stage,
            })),
          ]}
        />
        <Filters key={search} filters={filters} org={org} labels={labels} owners={owners} tags={tags} />
        {chips.length > 0 && (
          <nav aria-label="Filters in use">
            <ul className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={chip.href}
                    scroll={false}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-sunken"
                  >
                    <span className="sr-only">Remove filter: </span>
                    {chip.label}
                    <X className="size-4 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={hrefFor({ page: 1 })} scroll={false} className="flex min-h-11 items-center px-2 text-sm font-medium text-primary-ink hover:underline">
                  Clear all
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </div>

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          (state.data.total === 1 ? "1 contact" : `${state.data.total} contacts`) +
            (narrowed ? " match" : "") +
            (state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : "")}
        {state.status === "loading" && "Loading contacts…"}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading contacts" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these contacts`}
              action={
                <ButtonLink href={hrefFor({ ...filters, page: 1 })} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : narrowed ? (
            <EmptyState
              title="No contacts match these filters"
              action={
                <ButtonLink href={hrefFor({ page: 1 })} variant="secondary">
                  Show every contact
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No contacts yet"
              action={
                writer ? (
                  <ButtonLink href={contactsPath("/new", org)} variant="secondary">
                    Add a contact
                  </ButtonLink>
                ) : undefined
              }
            >
              Add the people you work with, or use “Create contact” on a request, an enquiry or an appointment.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <ContactCard item={item} org={org} labels={labels} user={user} />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.total_pages}
              hrefFor={(value) => hrefFor({ ...filters, page: value })}
              label="Contacts"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/contacts`: the organisation's contact book, the primary accessible view. */
export function ContactList({ labels }: { labels: ContactLabels }) {
  return (
    <ContactsShell
      path=""
      section="list"
      title="Contacts"
      intro={
        <p>
          Your organisation’s private contact book. Everyone in the team sees every contact; the relationship owner is
          who looks after them. The customer never sees it.
        </p>
      }
    >
      {(organisation, user) => <List organisation={organisation} labels={labels} user={user} />}
    </ContactsShell>
  );
}
