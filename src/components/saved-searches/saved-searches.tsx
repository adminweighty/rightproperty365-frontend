"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { deleteSavedSearch, listSavedSearches, updateSavedSearch, type SavedSearch } from "@/lib/api/saved-searches";
import { FREQUENCIES, frequencyLabel, savedSearchErrorText, searchHref, type AlertFrequency } from "@/lib/saved-searches";

type Outcome = { tone: "success" | "danger"; text: string; traceId?: string } | null;

function Row({ item, onChanged, onDelete }: { item: SavedSearch; onChanged: (text: string) => void; onDelete: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(patch: { name?: string; frequency?: AlertFrequency }, text: string) {
    setBusy(true);
    const answer = await updateSavedSearch(item.id, patch);
    setBusy(false);
    if (answer.ok) {
      setError(null);
      setRenaming(false);
      onChanged(text);
      return;
    }
    setError(answer.failure.fields?.name ?? savedSearchErrorText(answer.failure.code) ?? answer.failure.message);
  }
  const id = `ss-${item.id}`;
  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_16rem] sm:items-start">
      <div className="min-w-0">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ name }, "Renamed.");
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Field id={`${id}-name`} label="Name" error={error ?? undefined} className="min-w-0 flex-1 basis-48">
              <Input id={`${id}-name`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
              {item.name}
              {item.frequency === "OFF" && <Badge tone="neutral">Alerts off</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {item.last_alert_at ? `Last alert ${formatWhen(item.last_alert_at)}` : "No alert yet"} · saved {formatWhen(item.created_at)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ButtonLink href={searchHref(item.query)} size="sm" variant="secondary">
                <Search className="size-4" aria-hidden="true" />
                See results<span className="sr-only"> for {item.name}</span>
              </ButtonLink>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
                Rename<span className="sr-only"> {item.name}</span>
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={onDelete}>
                Delete<span className="sr-only"> {item.name}</span>
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </>
        )}
      </div>
      <Field id={`${id}-frequency`} label="Email me new listings">
        <SearchableSelect
          id={`${id}-frequency`}
          value={item.frequency}
          disabled={busy}
          onValueChange={(v) => void save({ frequency: v as AlertFrequency }, `Alerts for “${item.name}”: ${frequencyLabel(v).toLowerCase()}.`)}
          options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
        />
      </Field>
    </li>
  );
}

function Page() {
  const load = useCallback(() => listSavedSearches(), []);
  const { state, reload } = useApi(load);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [deleting, setDeleting] = useState<SavedSearch | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const answer = await deleteSavedSearch(deleting.id);
    setBusy(false);
    if (!answer.ok) {
      setDeleteError(savedSearchErrorText(answer.failure.code) ?? answer.failure.message);
      return;
    }
    setOutcome({ tone: "success", text: `“${deleting.name}” is deleted.` });
    setDeleting(null);
    reload();
  }

  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Saved searches</h1>
      <p className="mt-2 max-w-2xl text-muted">
        We email you when new listings match a saved search, as often as you choose. Every email has a link to stop it. Save a search from the{" "}
        <Link href="/listings" className="font-medium text-primary-ink underline underline-offset-2">
          search results
        </Link>
        .
      </p>
      <div aria-live="polite" className="mt-4">
        {outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}
      </div>
      {state.status === "loading" && <LoadingBlock label="Loading your saved searches" rows={3} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-line-strong p-8 text-center">
            <Bell className="mx-auto size-8 text-muted" aria-hidden="true" />
            <p className="mt-3 font-medium text-ink">No saved searches yet</p>
            <p className="mt-1 text-sm text-muted">Search for properties, then choose “Save this search”.</p>
            <ButtonLink href="/listings" className="mt-5">
              Search properties
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
            {state.data.items.map((item) => (
              <Row
                key={item.id}
                item={item}
                onChanged={(text) => {
                  setOutcome({ tone: "success", text });
                  reload();
                }}
                onDelete={() => {
                  setDeleteError(undefined);
                  setDeleting(item);
                }}
              />
            ))}
          </ul>
        ))}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this saved search?"
        confirmLabel="Delete the search"
        busyLabel="Deleting…"
        busy={busy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      >
        “{deleting?.name}” and its alerts are removed. The listings themselves are not affected.
      </ConfirmDialog>
    </>
  );
}

/** `/account/saved-searches` (API 0.52.0). */
export function SavedSearches() {
  return <RequireAuth>{() => <Page />}</RequireAuth>;
}
