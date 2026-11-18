"use client";

import { useCallback, useState, type FormEvent } from "react";
import { BooksShell } from "@/components/agent/books/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { createCategory, listCategories, updateCategory } from "@/lib/api/ledger";
import { booksPath, CATEGORY_LABEL_MAX, canManageCategories, directionLabel, type LedgerCategory } from "@/lib/ledger";

type Message = { tone: "success" | "danger"; text: string; traceId?: string };

function AddCategory({ org, existing, onAdded }: { org: string; existing: LedgerCategory[]; onAdded: () => void }) {
  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const hint = "As your team will see it in the books, for example “Office rent”.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = label.trim();
    if (!/[\p{L}\p{N}]/u.test(name)) {
      setError("Enter the category's name, with at least one letter or figure.");
      return;
    }
    if (existing.some((item) => item.label.toLowerCase() === name.toLowerCase())) {
      setError("There is already a category with that name.");
      return;
    }
    setError(undefined);
    setBusy(true);
    // The API makes the code from the name.
    const answer = await createCategory(org, { label: name, kind: direction === "IN" || direction === "OUT" ? direction : "ANY" });
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.code === "LEDGER_CATEGORY_EXISTS" ? "There is already a category with that name." : (answer.failure.fields?.label ?? answer.failure.fields?.code));
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setLabel("");
    setDirection("");
    setMessage({ tone: "success", text: `${name} added.` });
    onAdded();
  }

  return (
    <Card>
      <h2 className="text-xl">Add a category</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field id="category-new" label="Name" hint={hint} error={error}>
          <Input
            id="category-new"
            maxLength={CATEGORY_LABEL_MAX}
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("category-new", { hint, error })}
          />
        </Field>
        <Field id="category-direction" label="Used for" optional>
          <SearchableSelect
            id="category-direction"
            options={[
              { value: "", label: "Money in and out" },
              { value: "IN", label: directionLabel("IN") },
              { value: "OUT", label: directionLabel("OUT") },
            ]}
            value={direction}
            onValueChange={setDirection}
          />
        </Field>
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Adding…" : "Add the category"}
        </Button>
      </form>
      <div aria-live="polite" className="mt-3">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
    </Card>
  );
}

function CategoryRow({ org, item, manager, onChanged }: { org: string; item: LedgerCategory; manager: boolean; onChanged: () => void }) {
  const [label, setLabel] = useState(item.label);
  const [busy, setBusy] = useState<"rename" | "active" | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | undefined>();
  const id = `category-${item.code}`;

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = label.trim();
    if (!name) {
      setError("Enter a name.");
      return;
    }
    if (name === item.label) return;
    setError(undefined);
    setBusy("rename");
    const answer = await updateCategory(org, item.code, { label: name });
    setBusy(null);
    if (!answer.ok) {
      setError(answer.failure.fields?.label);
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setMessage({ tone: "success", text: `Renamed to ${name}. Entries already recorded keep this category.` });
    onChanged();
  }

  async function toggle() {
    setBusy("active");
    const answer = await updateCategory(org, item.code, { active: !item.active });
    setBusy(null);
    if (!answer.ok) {
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setMessage({
      tone: "success",
      text: item.active ? `${item.label} deactivated. It is no longer offered for new entries; entries already recorded keep it.` : `${item.label} is offered again.`,
    });
    onChanged();
  }

  return (
    <li className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium break-words text-ink">{item.label}</span>
        <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "In use" : "Deactivated"}</Badge>
        {item.direction && <Badge>{directionLabel(item.direction)}</Badge>}
        {item.isDefault && <Badge tone="info">Default</Badge>}
      </div>
      {manager && (
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
          <form onSubmit={rename} noValidate className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <Field id={id} label={`Rename ${item.label}`} error={error} className="flex-1">
              <Input
                id={id}
                maxLength={CATEGORY_LABEL_MAX}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy(id, { error })}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null || label.trim() === item.label} aria-busy={busy === "rename"}>
              {busy === "rename" ? "Saving…" : "Save the name"}
            </Button>
          </form>
          <Button variant="ghost" onClick={toggle} disabled={busy !== null} aria-busy={busy === "active"}>
            {busy === "active" ? "Saving…" : item.active ? `Deactivate ${item.label}` : `Use ${item.label} again`}
          </Button>
        </div>
      )}
      <div aria-live="polite" className="mt-2">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
    </li>
  );
}

function Categories({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const load = useCallback(() => listCategories(org), [org]);
  const { state, reload } = useApi(load);
  const manager = canManageCategories(organisation.role);
  // While a change is read again, the rows stay on screen (with their messages).
  const items = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <div className="space-y-6">
      {!manager && <Alert tone="info" title="Only the Agency Principal and Managers can change the categories." />}
      {manager && items && <AddCategory org={org} existing={items} onAdded={reload} />}
      <section aria-labelledby="categories-list">
        <h2 id="categories-list" className="text-xl">
          Your categories
        </h2>
        <p className="mt-1 text-sm text-muted">A category that has been used is never deleted. Deactivate it to stop offering it for new entries.</p>
        <div className="mt-4">
          {state.status === "loading" && !items && <LoadingBlock label="Loading the categories" rows={2} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {items && items.length === 0 && <EmptyState title="No categories yet">Add the first one above.</EmptyState>}
          {items && items.length > 0 && (
            <ul className="space-y-3">
              {[...items]
                .sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label))
                .map((item) => (
                  <CategoryRow key={item.code} org={org} item={item} manager={manager} onChanged={reload} />
                ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/** `/agent/books/categories`. */
export function BooksCategories() {
  return (
    <BooksShell path="/categories" section="categories" title="Categories" back={{ href: (org) => booksPath("", org), label: "Books" }}>
      {(organisation) => <Categories organisation={organisation} />}
    </BooksShell>
  );
}
