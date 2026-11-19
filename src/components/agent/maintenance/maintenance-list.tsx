"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { td, TableRegion, th } from "@/components/agent/books/shared";
import { ManagementShell, useProperties } from "@/components/agent/property/shared";
import { ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { changeStatus, listRequests } from "@/lib/api/maintenance";
import {
  boardColumns,
  canWriteMaintenance,
  categoryLabel,
  hasMaintenanceFilters,
  allowedTransitions,
  maintenanceApiQuery,
  maintenanceHref,
  maintenanceListHref,
  maintenancePath,
  maintenanceStatusLabel,
  MAINTENANCE_STATUSES,
  moveNeedsNote,
  moveNoteProblem,
  moveWords,
  NOTE_MAX,
  parseMaintenanceFilters,
  QUERY_MAX,
  requestPlace,
  type MaintenanceFilters,
  type MaintenancePage,
  type MaintenanceRequest,
} from "@/lib/maintenance";
import { MaintenanceStatusBadge, PriorityBadge, useMaintenanceOptions } from "./shared";

/** `/agent/maintenance`: the book's requests as a list (filters, pages) or a board by status. */
export function MaintenanceList() {
  return (
    <ManagementShell
      area="maintenance"
      path=""
      nav
      title="Maintenance"
      intro="Repairs reported by tenants or by your team, from the first report to the finished job: who does the work and what it cost."
    >
      {(organisation) => <List organisation={organisation} />}
    </ManagementShell>
  );
}

/** The board shows every request (up to five pages of 100), whatever the page. */
async function loadBoard(org: string, filters: MaintenanceFilters): Promise<ApiResult<MaintenancePage>> {
  const base = { priority: filters.priority, category: filters.category, property: filters.property, tenancy: filters.tenancy };
  const firstPage = await listRequests(org, maintenanceApiQuery({ ...base, page: 1 }, 100));
  if (!firstPage.ok) return firstPage;
  const items = [...firstPage.data.items];
  for (let page = 2; page <= Math.min(firstPage.data.totalPages, 5); page++) {
    const next = await listRequests(org, maintenanceApiQuery({ ...base, page }, 100));
    if (next.ok) items.push(...next.data.items);
  }
  return { ok: true, status: 200, data: { ...firstPage.data, items } };
}

function List({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const params = useSearchParams();
  const search = params.toString();
  const filters = useMemo(() => parseMaintenanceFilters(new URLSearchParams(search)), [search]);
  const board = filters.view === "board";
  const load = useCallback(() => (board ? loadBoard(org, filters) : listRequests(org, maintenanceApiQuery(filters))), [org, filters, board]);
  const { state, reload } = useApi(load);
  const properties = useProperties(org);
  const options = useMaintenanceOptions(org);
  const writer = canWriteMaintenance(organisation.role);
  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.statusCounts ?? [];
  const countOf = (status?: string) =>
    counts.length === 0 ? undefined : status ? (counts.find((item) => item.status === status)?.count ?? 0) : counts.reduce((sum, item) => sum + item.count, 0);
  const filtered = hasMaintenanceFilters(filters);
  // Kept here, not in the board: the board is redrawn when it is read again after a move.
  const [announce, setAnnounce] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const keep = { priority: filters.priority, category: filters.category, property: filters.property, tenancy: filters.tenancy };

  const propertyOptions: SelectOption[] = [{ value: "", label: "All properties" }];
  if (properties.status === "ready") propertyOptions.push(...properties.items.map((item) => ({ value: item.id, label: item.name, secondary: item.address })));
  if (filters.property && !propertyOptions.some((option) => option.value === filters.property)) propertyOptions.push({ value: filters.property, label: "The property chosen" });
  const priorityOptions: SelectOption[] = [{ value: "", label: "Any priority" }, ...options.priorities.map((item) => ({ value: item.code, label: item.label }))];
  if (filters.priority && !priorityOptions.some((option) => option.value === filters.priority)) priorityOptions.push({ value: filters.priority, label: filters.priority });
  const categoryOptions: SelectOption[] = [{ value: "", label: "Any category" }, ...options.categories.map((item) => ({ value: item.code, label: item.label }))];
  if (filters.category && !categoryOptions.some((option) => option.value === filters.category)) categoryOptions.push({ value: filters.category, label: categoryLabel(filters.category) });
  const statusOptions: SelectOption[] = [{ value: "", label: "Any status" }, ...MAINTENANCE_STATUSES.map((status) => ({ value: status, label: maintenanceStatusLabel(status) }))];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {writer && (
          <ButtonLink href={maintenancePath("/new", org)}>
            <Plus className="size-4" aria-hidden="true" />
            Report an issue
          </ButtonLink>
        )}
      </div>

      <div className="mt-6">
        <ChipNav
          label="Show as"
          items={[
            { key: "list", href: maintenanceListHref({ ...keep, status: filters.status, view: "list" }, org), label: "List", current: !board },
            { key: "board", href: maintenanceListHref({ ...keep, view: "board" }, org), label: "Board by status", current: board },
          ]}
        />
      </div>

      {!board && (
        <div className="mt-4">
          <ChipNav
            label="Requests by status"
            items={[
              { key: "all", href: maintenanceListHref(keep, org), label: "All", count: countOf(), current: !filters.status },
              ...MAINTENANCE_STATUSES.map((status) => ({
                key: status,
                href: maintenanceListHref({ ...keep, status }, org),
                label: maintenanceStatusLabel(status),
                count: countOf(status),
                current: filters.status === status,
              })),
            ]}
          />
        </div>
      )}

      {/* A GET form: works without JavaScript and keeps the book and the view. */}
      <form method="get" action="/agent/maintenance" role="search" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="org" value={org} />
        {board && <input type="hidden" name="view" value="board" />}
        {filters.tenancy && <input type="hidden" name="tenancy" value={filters.tenancy} />}
        {!board && (
          <Field id="maintenance-status" label="Status">
            <SearchableSelect id="maintenance-status" name="status" options={statusOptions} defaultValue={filters.status ?? ""} />
          </Field>
        )}
        <Field id="maintenance-priority" label="Priority">
          <SearchableSelect id="maintenance-priority" name="priority" options={priorityOptions} defaultValue={filters.priority ?? ""} />
        </Field>
        <Field id="maintenance-category" label="Category">
          <SearchableSelect id="maintenance-category" name="category" options={categoryOptions} defaultValue={filters.category ?? ""} />
        </Field>
        <Field id="maintenance-property" label="Property">
          <SearchableSelect id="maintenance-property" name="property" options={propertyOptions} defaultValue={filters.property ?? ""} />
        </Field>
        <Field id="maintenance-q" label="Reference or title" className="sm:col-span-2">
          <Input id="maintenance-q" name="q" type="search" maxLength={QUERY_MAX} defaultValue={filters.q ?? ""} placeholder="RPM-2026-000001 or tap" />
        </Field>
        <div className="self-end sm:col-span-2">
          <Button type="submit" variant="secondary">
            Show requests
          </Button>
        </div>
      </form>
      {filtered && (
        <p className="mt-3">
          <ButtonLink href={maintenanceListHref({ view: filters.view }, org)} variant="ghost">
            Clear filters
          </ButtonLink>
        </p>
      )}
      {filters.tenancy && <p className="mt-2 text-sm text-muted">Showing the requests of one tenancy.</p>}

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          (board
            ? `${state.data.items.length === 1 ? "1 request" : `${state.data.items.length} requests`}${filtered ? " match" : ""}${state.data.total > state.data.items.length ? ` (the first ${state.data.items.length} of ${state.data.total})` : ""}`
            : `${state.data.total === 1 ? "1 request" : `${state.data.total} requests`}${filtered ? " match" : ""}${
                state.data.totalPages > 1 ? `, page ${state.data.page} of ${state.data.totalPages}` : ""
              }`)}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading the requests" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" &&
          state.data.items.length === 0 &&
          (filters.page > 1 && !board ? (
            <EmptyState
              title={`There is no page ${filters.page} of these requests`}
              action={
                <ButtonLink href={maintenanceListHref({ ...filters, page: 1 }, org)} variant="secondary">
                  Go to page 1
                </ButtonLink>
              }
            />
          ) : filtered ? (
            <EmptyState
              title="No requests match these filters"
              action={
                <ButtonLink href={maintenanceListHref({ view: filters.view }, org)} variant="secondary">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="No maintenance requests yet"
              action={
                writer ? (
                  <ButtonLink href={maintenancePath("/new", org)} variant="secondary">
                    Report an issue
                  </ButtonLink>
                ) : undefined
              }
            >
              Requests appear here when your team reports an issue or a tenant reports a problem from their account.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && !board && <Table org={org} page={state.data} filters={filters} />}
        {state.status === "ready" && state.data.items.length > 0 && board && (
          <Board
            org={org}
            role={organisation.role}
            transitions={options.transitions}
            items={state.data.items}
            focusId={focusId}
            onMoved={(id, words) => {
              setAnnounce(words);
              setFocusId(id);
              reload();
            }}
          />
        )}
      </div>
    </>
  );
}

function Table({ org, page, filters }: { org: string; page: MaintenancePage; filters: MaintenanceFilters }) {
  return (
    <>
      <TableRegion label="Maintenance requests, scrolls sideways">
        <table className="w-full min-w-[48rem] border-collapse">
          <caption className="sr-only">Maintenance requests</caption>
          <thead className="border-b border-line bg-sunken">
            <tr>
              <th scope="col" className={th}>
                Request
              </th>
              <th scope="col" className={th}>
                Property
              </th>
              <th scope="col" className={th}>
                Category
              </th>
              <th scope="col" className={th}>
                Priority
              </th>
              <th scope="col" className={th}>
                Status
              </th>
              <th scope="col" className={th}>
                Reported
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {page.items.map((item) => (
              <tr key={item.id}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Link href={maintenanceHref(item.id, org)} className="font-medium break-words text-primary-ink hover:underline">
                    {item.title}
                  </Link>
                  {item.reference && <span className="block text-xs text-muted">{item.reference}</span>}
                </th>
                <td className={td}>
                  {item.property?.name ?? "—"}
                  {item.unit && <span className="block text-xs text-muted">{item.unit.label}</span>}
                </td>
                <td className={td}>{categoryLabel(item.category, item.categoryLabel)}</td>
                <td className={td}>
                  <PriorityBadge priority={item.priority} label={item.priorityLabel} />
                </td>
                <td className={td}>
                  <MaintenanceStatusBadge status={item.status} label={item.statusLabel} />
                  {item.provider && <span className="mt-1 block text-xs text-muted">{item.provider.name}</span>}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {item.createdAt ? formatWhen(item.createdAt) : "—"}
                  {item.raisedBy?.kind === "TENANT" && <span className="block text-xs text-muted">by the tenant</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
      <Pagination page={page.page} totalPages={page.totalPages} hrefFor={(n) => maintenanceListHref({ ...filters, page: n }, org)} label="Maintenance requests" className="mt-8" />
    </>
  );
}

// ---- The board ------------------------------------------------------------------------------------------

/**
 * One column per status. Each card has a "Move to…" SearchableSelect with the
 * moves the request may make (the API's list when it sends one); a
 * cancellation or a reopening asks for the reason first. Moving reads the
 * board again, announces the move and puts focus on the card in its new
 * column.
 */
function Board({
  org,
  role,
  transitions,
  items,
  focusId,
  onMoved,
}: {
  org: string;
  role: string;
  transitions: Record<string, string[]> | null;
  items: MaintenanceRequest[];
  focusId: string | null;
  onMoved: (id: string, words: string) => void;
}) {
  const columns = boardColumns(items);

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Use &ldquo;Move to&rdquo; on a card to change its status. A provider is assigned from the request&rsquo;s own page.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <section key={column.status} aria-labelledby={`column-${column.status}`} className="min-w-0 rounded-lg border border-line bg-sunken p-3">
            <h2 id={`column-${column.status}`} className="flex items-center justify-between gap-2 font-sans text-base font-semibold tracking-normal">
              {maintenanceStatusLabel(column.status)}
              <span className="rounded-full bg-surface px-2 text-xs text-muted tabular-nums">
                {column.items.length}
                <span className="sr-only">{column.items.length === 1 ? " request" : " requests"}</span>
              </span>
            </h2>
            {column.items.length === 0 ? (
              <p className="mt-2 text-sm text-muted">None.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {column.items.map((item) => (
                  <li key={item.id}>
                    <BoardCard
                      org={org}
                      role={role}
                      transitions={transitions}
                      request={item}
                      focus={focusId === item.id}
                      onMoved={(words) => onMoved(item.id, words)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function BoardCard({
  org,
  role,
  transitions,
  request,
  focus,
  onMoved,
}: {
  org: string;
  role: string;
  transitions: Record<string, string[]> | null;
  request: MaintenanceRequest;
  focus: boolean;
  onMoved: (words: string) => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  // A summary carries no `can`: the book's transitions (options) and the role decide; the API checks again.
  const moves = canWriteMaintenance(role) ? allowedTransitions(request.status, transitions?.[request.status] ?? null) : [];
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [error, setError] = useState<{ message: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectId = `move-${request.id}`;
  const noteId = `move-note-${request.id}`;

  useEffect(() => {
    if (focus) link.current?.focus();
  }, [focus]);

  async function move(to: string, reason = "") {
    setBusy(true);
    setError(null);
    const answer = await changeStatus(org, request.id, to, reason);
    setBusy(false);
    if (!answer.ok) {
      const field = answer.failure.fields?.note;
      if (field) setProblem(field);
      else if (answer.failure.code === "MAINTENANCE_INVALID_TRANSITION") {
        // Someone else moved it meanwhile: say so; the board is read again.
        setPending(null);
        onMoved(`${request.title} was not moved: ${answer.failure.message}`);
      } else setError({ message: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setPending(null);
    setNote("");
    onMoved(`${request.title} moved to ${maintenanceStatusLabel(to).toLowerCase()}.`);
  }

  function choose(to: string) {
    if (!to) return;
    setError(null);
    setProblem(undefined);
    if (moveNeedsNote(request.status, to)) {
      setPending(to);
      return;
    }
    void move(to);
  }

  const options: SelectOption[] = [{ value: "", label: "Move to…" }, ...moves.map((to) => ({ value: to, label: moveWords(request.status, to) }))];

  return (
    <article className="rounded-md border border-line bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={request.priority} label={request.priorityLabel} />
        {request.reference && <span className="text-xs text-muted">{request.reference}</span>}
      </div>
      <h3 className="mt-2 font-sans text-sm font-semibold tracking-normal break-words">
        <Link ref={link} href={maintenanceHref(request.id, org)} className="text-primary-ink hover:underline">
          {request.title}
        </Link>
      </h3>
      <p className="mt-1 text-xs break-words text-muted">
        {requestPlace(request)} · {categoryLabel(request.category, request.categoryLabel)}
      </p>
      {request.provider && <p className="mt-1 text-xs break-words text-muted">Assigned to {request.provider.name}</p>}
      {moves.length > 0 && !pending && (
        <Field id={selectId} label="Move to" className="mt-3">
          <SearchableSelect id={selectId} options={options} value="" disabled={busy} onValueChange={choose} />
        </Field>
      )}
      {busy && !pending && <p className="mt-2 text-xs text-muted">Moving…</p>}
      {pending && (
        <form
          className="mt-3 grid gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const found = moveNoteProblem(request.status, pending, note);
            setProblem(found ?? undefined);
            if (!found) void move(pending, note.trim());
          }}
        >
          <Field id={noteId} label={pending === "CANCELLED" ? "Why is it cancelled?" : "Why is it reopened?"} error={problem}>
            <Textarea
              id={noteId}
              rows={2}
              value={note}
              maxLength={NOTE_MAX}
              autoFocus
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={Boolean(problem)}
              aria-describedby={fieldDescribedBy(noteId, { error: problem })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant={pending === "CANCELLED" ? "danger" : "primary"} disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : moveWords(request.status, pending)}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Not now
            </Button>
          </div>
        </form>
      )}
      {error && <Alert className="mt-2" title={error.message} traceId={error.traceId} />}
    </article>
  );
}
