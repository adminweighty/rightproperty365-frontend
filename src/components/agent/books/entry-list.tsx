"use client";

import { Link2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  BooksShell,
  categoryOptions,
  categoryWords,
  ContactPicker,
  ExportButton,
  formatDay,
  StatusBadge,
  TableRegion,
  td,
  tdNum,
  th,
  thNum,
  useCategories,
  useListingOptions,
  type Categories,
  type ListingOptions,
} from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { listEntries } from "@/lib/api/ledger";
import {
  booksPath,
  canWriteBooks,
  ENTRY_TYPES,
  entryHref,
  entryMarkers,
  entryRelations,
  entryTypeLabel,
  FILTER_STATUSES,
  formatLedgerAmount,
  hasLedgerFilters,
  LEDGER_QUERY_MAX,
  ledgerFilterChips,
  ledgerFiltersApiQuery,
  ledgerFiltersSearch,
  methodLabel,
  METHODS,
  parseLedgerFilters,
  statusBadge,
  type LedgerEntry,
  type LedgerFilters,
} from "@/lib/ledger";

const PATH = "/agent/books";

export type CurrencyOption = SelectOption;

function Filters({
  filters,
  org,
  currencies,
  categories,
  listings,
  contactLabel,
}: {
  filters: LedgerFilters;
  org: string;
  currencies: CurrencyOption[];
  categories: Categories;
  listings: ListingOptions;
  contactLabel?: string | null;
}) {
  const router = useRouter();
  const [contact, setContact] = useState(filters.contact ?? "");
  const [contactName, setContactName] = useState<string | null>(contactLabel ?? null);

  const currencyOptions: SelectOption[] = [{ value: "", label: "Any currency" }, ...currencies];
  if (filters.currency && !currencies.some((option) => option.value === filters.currency)) currencyOptions.push({ value: filters.currency, label: filters.currency });
  const typeOptions: SelectOption[] = [
    { value: "", label: "Any type" },
    ...[...ENTRY_TYPES, "REVERSAL"].map((type) => ({ value: type, label: entryTypeLabel(type) })),
  ];
  const methodOptions: SelectOption[] = [{ value: "", label: "Any method" }, ...METHODS.map((method) => ({ value: method, label: methodLabel(method) }))];
  const statusOptions: SelectOption[] = [{ value: "", label: "Any status" }, ...FILTER_STATUSES.map((status) => ({ value: status, label: statusBadge(status).words }))];
  const listingOptions: SelectOption[] = [{ value: "", label: "Any listing" }, ...(listings.status === "ready" ? listings.options : [])];
  if (filters.listing && !listingOptions.some((option) => option.value === filters.listing)) listingOptions.push({ value: filters.listing, label: "The listing chosen" });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = parseLedgerFilters({
      get: (name) => (name === "page" ? null : name === "contact" ? contact : String(data.get(name) ?? "")),
    });
    router.push(`${PATH}${ledgerFiltersSearch(next, org)}`, { scroll: false });
  }

  return (
    <form method="get" action={PATH} onSubmit={handleSubmit} role="search" aria-label="Filter entries" className="rounded-lg border border-line bg-surface p-4">
      <input type="hidden" name="org" value={org} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="books-q" label="Search">
          <Input id="books-q" name="q" type="search" maxLength={LEDGER_QUERY_MAX} defaultValue={filters.q ?? ""} placeholder="Description or reference" />
        </Field>
        <Field id="books-currency" label="Currency">
          <SearchableSelect id="books-currency" name="currency" options={currencyOptions} defaultValue={filters.currency ?? ""} />
        </Field>
        <Field id="books-type" label="Type">
          <SearchableSelect id="books-type" name="type" options={typeOptions} defaultValue={filters.type ?? ""} />
        </Field>
        <Field id="books-category" label="Category">
          <SearchableSelect id="books-category" name="category" options={categoryOptions(categories, filters.category, "Any category")} defaultValue={filters.category ?? ""} />
        </Field>
        <Field id="books-method" label="Method">
          <SearchableSelect id="books-method" name="method" options={methodOptions} defaultValue={filters.method ?? ""} />
        </Field>
        <Field id="books-status" label="Status">
          <SearchableSelect id="books-status" name="status" options={statusOptions} defaultValue={filters.status ?? ""} />
        </Field>
        <Field id="books-from" label="From" hint="Effective date, inclusive">
          <Input id="books-from" name="from" type="date" defaultValue={filters.from ?? ""} aria-describedby="books-from-hint" />
        </Field>
        <Field id="books-to" label="To" hint="Effective date, inclusive">
          <Input id="books-to" name="to" type="date" defaultValue={filters.to ?? ""} aria-describedby="books-to-hint" />
        </Field>
        <Field id="books-listing" label="Listing">
          <SearchableSelect id="books-listing" name="listing" options={listingOptions} defaultValue={filters.listing ?? ""} />
        </Field>
      </div>
      <div className="mt-4">
        <ContactPicker
          id="books-contact"
          org={org}
          name="contact"
          value={contact}
          valueLabel={contactName}
          onChange={(id, label) => {
            setContact(id);
            setContactName(label);
          }}
        />
      </div>
      <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input type="checkbox" name="hide_reversed" value="1" defaultChecked={Boolean(filters.hideReversed)} className="size-5 accent-primary" />
        <span className="text-ink">Hide reversed entries and their reversals</span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        {hasLedgerFilters(filters) && (
          <ButtonLink href={`${PATH}${ledgerFiltersSearch({ page: 1 }, org)}`} variant="ghost" scroll={false}>
            Clear filters
          </ButtonLink>
        )}
      </div>
    </form>
  );
}

function Markers({ entry, org }: { entry: LedgerEntry; org: string }) {
  const markers = entryMarkers(entry);
  const relations = entryRelations(entry);
  if (!markers.length && !relations.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {markers.map((marker) => (
        <Badge key={marker} tone={marker === "Reversed" ? "neutral" : "info"}>
          {marker}
        </Badge>
      ))}
      {relations.map((relation) => (
        <Link key={`${relation.kind}-${relation.id}`} href={entryHref(relation.id, org)} className="inline-flex min-h-6 items-center gap-1 text-xs font-medium text-primary-ink hover:underline">
          <Link2 className="size-3.5" aria-hidden="true" />
          {relation.words}
        </Link>
      ))}
    </div>
  );
}

function EntriesTable({ items, org, categories }: { items: LedgerEntry[]; org: string; categories: Categories }) {
  return (
    <TableRegion label="Entries, scrolls sideways">
      <table className="w-full min-w-[56rem] border-collapse">
        <caption className="sr-only">Entries in your books, by effective date. Money in and money out are separate columns, each with its currency.</caption>
        <thead className="border-b border-line bg-sunken">
          <tr>
            <th scope="col" className={th}>Date</th>
            <th scope="col" className={th}>Entry</th>
            <th scope="col" className={th}>Type and category</th>
            <th scope="col" className={th}>Method</th>
            <th scope="col" className={thNum}>Money in</th>
            <th scope="col" className={thNum}>Money out</th>
            <th scope="col" className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const amount = formatLedgerAmount(entry.amount, entry.currency);
            return (
              <tr key={entry.id} className={entry.reversed_by ? "border-b border-line bg-sunken/50" : "border-b border-line"}>
                <td className={`${td} whitespace-nowrap`}>{formatDay(entry.effectiveDate)}</td>
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Link href={entryHref(entry.id, org)} className="font-medium break-words text-primary-ink hover:underline">
                    {entry.description || entryTypeLabel(entry.type, entry.typeLabel)}
                  </Link>
                  {entry.reference && <span className="block text-xs text-muted">Ref. {entry.reference}</span>}
                  {entry.contact?.label && <span className="block text-xs text-muted">{entry.contact.label}</span>}
                  <Markers entry={entry} org={org} />
                </th>
                <td className={td}>
                  {entryTypeLabel(entry.type, entry.typeLabel)}
                  {entry.category && <span className="block text-xs text-muted">{categoryWords(categories, entry.category, entry.categoryLabel)}</span>}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {entry.method ? methodLabel(entry.method, entry.methodLabel) : "—"}
                  {entry.branch && <span className="block text-xs text-muted">{entry.branch}</span>}
                </td>
                <td className={tdNum}>{entry.direction === "IN" ? <span><span className="sr-only">Money in: </span>+{amount}</span> : <span aria-hidden="true">—</span>}</td>
                <td className={tdNum}>{entry.direction === "OUT" ? <span><span className="sr-only">Money out: </span>−{amount}</span> : <span aria-hidden="true">—</span>}</td>
                <td className={td}>
                  <StatusBadge status={entry.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableRegion>
  );
}

function List({ organisation, currencies }: { organisation: DashboardOrganisation; currencies: CurrencyOption[] }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseLedgerFilters(new URLSearchParams(search)), [search]);
  const apiQuery = ledgerFiltersApiQuery(filters);
  const load = useCallback(() => listEntries(org, apiQuery), [org, apiQuery]);
  const { state, reload } = useApi(load);
  const categories = useCategories(org);
  const listings = useListingOptions();
  const writer = canWriteBooks(organisation.role);
  const hrefFor = (next: LedgerFilters) => `${PATH}${ledgerFiltersSearch(next, org)}`;
  const page = state.status === "ready" ? state.data : undefined;
  const contactName = filters.contact ? page?.items.find((entry) => entry.contact?.id === filters.contact)?.contact?.label : undefined;
  const chips = ledgerFilterChips(
    filters,
    {
      category: (code) => categoryWords(categories, code),
      contact: () => contactName ?? "chosen contact",
      listing: (id) => (listings.status === "ready" ? (listings.names[id] ?? "chosen listing") : "chosen listing"),
    },
    hrefFor,
  );
  const narrowed = hasLedgerFilters(filters);
  const exportValues = Object.fromEntries(new URLSearchParams(apiQuery.slice(1)).entries());
  delete exportValues.page;
  delete exportValues.page_size;

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {writer && (
          <>
            <ButtonLink href={booksPath("/new", org)}>
              <Plus className="size-4" aria-hidden="true" />
              Record an entry
            </ButtonLink>
            <ButtonLink href={booksPath("/new", org, { kind: "transfer" })} variant="secondary">
              Record a transfer
            </ButtonLink>
            <ButtonLink href={booksPath("/new", org, { kind: "opening" })} variant="secondary">
              Opening balance
            </ButtonLink>
          </>
        )}
        <ExportButton organisation={organisation} report="entries" values={exportValues} label="Export entries as CSV" />
      </div>

      <div className="mt-6 space-y-4">
        <Filters key={search} filters={filters} org={org} currencies={currencies} categories={categories} listings={listings} contactLabel={contactName} />
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
          (state.data.total === 1 ? "1 entry" : `${state.data.total} entries`) +
            (narrowed ? " match" : "") +
            (state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : "")}
        {state.status === "loading" && "Loading entries…"}
      </p>
      <p className="mt-1 text-sm text-muted">Amounts are shown in their own currency. Currencies are never added together.</p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading entries" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (state.data.total > 0 ? (
            <EmptyState
              title={`There is no page ${filters.page} of these entries`}
              action={
                <ButtonLink href={hrefFor({ ...filters, page: 1 })} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : narrowed ? (
            <EmptyState
              title="No entries match these filters"
              action={
                <ButtonLink href={hrefFor({ page: 1 })} variant="secondary">
                  Show every entry
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No entries yet"
              action={
                writer ? (
                  <ButtonLink href={booksPath("/new", org, { kind: "opening" })} variant="secondary">
                    Record an opening balance
                  </ButtonLink>
                ) : undefined
              }
            >
              Start with an opening balance for each currency and method, then record money in and out as it happens.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <EntriesTable items={state.data.items} org={org} categories={categories} />
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={state.data.totalPages}
              hrefFor={(value) => hrefFor({ ...filters, page: value })}
              label="Entries"
            />
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/books`: the organisation's own books, entries first. */
export function EntryList({ currencies }: { currencies: CurrencyOption[] }) {
  return (
    <BooksShell path="" section="entries" title="Books">
      {(organisation) => <List organisation={organisation} currencies={currencies} />}
    </BooksShell>
  );
}
