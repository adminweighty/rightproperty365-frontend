"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ContactsShell, StageBadge, type ContactLabels } from "@/components/agent/contacts/shared";
import { NoAccess } from "@/components/auth/require-auth";
import { formatWhen, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { getContact, listContacts, mergeContacts, type Contact, type ContactSummary } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import {
  canWriteContacts,
  CONTACT_QUERY_MAX,
  contactFiltersApiQuery,
  contactHref,
  contactsPath,
  isUuid,
  mergePreview,
  type MergePreview,
} from "@/lib/contacts";

/** At most this many contacts are merged at once. */
const MERGE_MAX = 10;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function ContactLine({ contact, labels }: { contact: ContactSummary; labels: ContactLabels }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex flex-wrap items-center gap-2">
        <span className="break-words font-medium text-ink">{contact.name}</span>
        <StageBadge stage={contact.stage} label={contact.stage_label} labels={labels} />
      </span>
      <span className="break-all text-sm text-muted">
        {[contact.emails[0], contact.phones[0]].filter(Boolean).join(" · ") || "No email address or phone number"}
        {" · added "}
        {formatWhen(contact.created_at)}
      </span>
    </span>
  );
}

function Choose({
  org,
  labels,
  selected,
  keepId,
  onToggle,
  onKeep,
  onPreview,
}: {
  org: string;
  labels: ContactLabels;
  selected: ContactSummary[];
  keepId: string;
  onToggle: (contact: ContactSummary) => void;
  onKeep: (id: string) => void;
  onPreview: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ status: "idle" | "loading" } | { status: "ready"; items: ContactSummary[] } | { status: "error"; failure: ApiFailure }>({ status: "idle" });
  const [error, setError] = useState<string | undefined>();
  const chosen = new Set(selected.map((item) => item.id));

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = q.trim();
    if (!text) return;
    setResults({ status: "loading" });
    const answer = await listContacts(org, contactFiltersApiQuery({ q: text.slice(0, CONTACT_QUERY_MAX), page: 1 }, 20));
    setResults(answer.ok ? { status: "ready", items: answer.data.items } : { status: "error", failure: answer.failure });
  }

  function preview() {
    if (selected.length < 2) {
      setError("Choose at least two contacts: the one to keep and one to merge into it.");
      return;
    }
    if (!chosen.has(keepId)) {
      setError("Choose which contact to keep.");
      return;
    }
    setError(undefined);
    onPreview();
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="text-xl">1. Find the contacts</h2>
        <form onSubmit={search} role="search" aria-label="Find contacts to merge" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field id="merge-q" label="Name, email or phone" className="flex-1">
            <Input id="merge-q" type="search" maxLength={CONTACT_QUERY_MAX} value={q} onChange={(event) => setQ(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <div className="mt-4" aria-live="polite">
          {results.status === "loading" && <LoadingBlock label="Searching" rows={1} />}
          {results.status === "error" && <Alert title={results.failure.message} traceId={results.failure.traceId} />}
          {results.status === "ready" && results.items.length === 0 && <p className="text-muted">No contacts match that search.</p>}
          {results.status === "ready" && results.items.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-ink">Tick the contacts that are the same person</legend>
              <ul className="mt-2 space-y-2">
                {results.items.map((item) => (
                  <li key={item.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-primary"
                        checked={chosen.has(item.id)}
                        disabled={!chosen.has(item.id) && selected.length >= MERGE_MAX}
                        onChange={() => onToggle(item)}
                      />
                      <ContactLine contact={item} labels={labels} />
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl">2. Choose the one to keep</h2>
        {selected.length === 0 ? (
          <p className="mt-2 text-muted">No contacts chosen yet.</p>
        ) : (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-ink">Keep this contact; the others are merged into it</legend>
            <ul className="mt-2 space-y-2">
              {selected.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-md border border-line p-3 hover:bg-sunken has-checked:border-primary has-checked:bg-tint">
                    <input
                      type="radio"
                      name="keep"
                      className="mt-1 size-5 shrink-0 accent-primary"
                      checked={keepId === item.id}
                      onChange={() => onKeep(item.id)}
                    />
                    <ContactLine contact={item} labels={labels} />
                  </label>
                  <Button variant="ghost" onClick={() => onToggle(item)}>
                    Remove<span className="sr-only"> {item.name} from the merge</span>
                  </Button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button className="mt-4" onClick={preview}>
          Preview the merge
        </Button>
      </Card>
    </div>
  );
}

type Loaded = { status: "loading" } | { status: "ready"; keep: Contact; others: Contact[]; preview: MergePreview } | { status: "error"; failure: ApiFailure };

function Preview({
  org,
  keepId,
  mergeIds,
  onBack,
}: {
  org: string;
  keepId: string;
  mergeIds: string[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const heading = useRef<HTMLHeadingElement>(null);
  const key = [keepId, ...mergeIds].join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = key.split(",");
    Promise.all(ids.map((id) => getContact(org, id))).then((answers) => {
      if (cancelled) return;
      const failed = answers.find((answer) => !answer.ok);
      if (failed && !failed.ok) {
        setLoaded({ status: "error", failure: failed.failure });
        return;
      }
      const contacts = answers.map((answer) => (answer.ok ? answer.data.contact : null)).filter((item): item is Contact => Boolean(item));
      const [keep, ...others] = contacts;
      setLoaded({ status: "ready", keep, others, preview: mergePreview(keep, others) });
    });
    return () => {
      cancelled = true;
    };
  }, [org, key]);

  useEffect(() => {
    if (loaded.status === "ready") heading.current?.focus();
  }, [loaded.status]);

  if (loaded.status === "loading") return <LoadingBlock label="Working out what moves" rows={2} />;
  if (loaded.status === "error") {
    return (
      <div>
        <Alert title={loaded.failure.message} traceId={loaded.failure.traceId} />
        <Button variant="secondary" className="mt-4" onClick={onBack}>
          Back to the choice
        </Button>
      </div>
    );
  }

  const { keep, others, preview } = loaded;

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const answer = await mergeContacts(org, keep.id, others.map((item) => item.id));
    setBusy(false);
    if (answer.ok) {
      router.push(contactHref(keep.id, org));
      return;
    }
    setError(answer.failure.message);
  }

  const moves = [
    preview.emails.length > 0 && `${plural(preview.emails.length, "email address", "email addresses")}: ${preview.emails.join(", ")}`,
    preview.phones.length > 0 && `${plural(preview.phones.length, "phone number", "phone numbers")}: ${preview.phones.join(", ")}`,
    preview.tags.length > 0 && `${plural(preview.tags.length, "tag", "tags")}: ${preview.tags.join(", ")}`,
    preview.notes > 0 && plural(preview.notes, "note", "notes"),
    preview.reminders > 0 && plural(preview.reminders, "reminder", "reminders"),
    preview.listings > 0 && plural(preview.listings, "linked listing", "linked listings"),
    preview.links > 0 && plural(preview.links, "linked request, enquiry or appointment", "linked requests, enquiries and appointments"),
  ].filter((item): item is string => Boolean(item));

  return (
    <Card>
      <h2 ref={heading} tabIndex={-1} className="text-xl outline-none">
        3. Check what moves
      </h2>
      <p className="mt-3 text-ink">
        <span className="font-medium">{keep.name}</span> stays. {others.map((item) => item.name).join(", ")}{" "}
        {others.length === 1 ? "is" : "are"} merged into it and kept only as a pointer to it. Nothing is lost, and the merge is
        recorded in the timeline.
      </p>
      <h3 className="mt-6 font-sans text-base font-semibold tracking-normal">Moved onto {keep.name}</h3>
      {moves.length === 0 ? (
        <p className="mt-2 text-muted">Nothing new: {keep.name} already has every email address, phone number and tag. Their history is still joined.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
          {moves.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">The history of every contact is joined. {keep.name}’s name, type, stage and owner stay as they are.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => setOpen(true)}>Merge the contacts</Button>
        <Button variant="secondary" onClick={onBack}>
          Back to the choice
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        tone="primary"
        title={`Merge ${plural(others.length + 1, "contact", "contacts")} into ${keep.name}?`}
        confirmLabel="Yes, merge them"
        busyLabel="Merging…"
        cancelLabel="Not yet"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
      >
        A merge cannot be undone. The merged contacts leave the list and point to {keep.name}.
      </ConfirmDialog>
    </Card>
  );
}

function Merge({ organisation, labels }: { organisation: DashboardOrganisation; labels: ContactLabels }) {
  const org = organisation.id;
  const params = useSearchParams();
  const wanted = params.get("keep");
  const [selected, setSelected] = useState<ContactSummary[]>([]);
  const [keepId, setKeepId] = useState("");
  const [step, setStep] = useState<"choose" | "preview">("choose");

  // The contact the flow was opened from is chosen and kept to begin with.
  useEffect(() => {
    if (!isUuid(wanted)) return;
    let cancelled = false;
    getContact(org, wanted!).then((answer) => {
      if (cancelled || !answer.ok) return;
      const contact = answer.data.contact;
      setSelected((current) => (current.some((item) => item.id === contact.id) ? current : [contact, ...current]));
      setKeepId((current) => current || contact.id);
    });
    return () => {
      cancelled = true;
    };
  }, [org, wanted]);

  if (!canWriteContacts(organisation.role)) return <NoAccess />;

  function toggle(contact: ContactSummary) {
    setSelected((current) => {
      const next = current.some((item) => item.id === contact.id)
        ? current.filter((item) => item.id !== contact.id)
        : [...current, contact].slice(0, MERGE_MAX);
      if (!next.some((item) => item.id === keepId)) setKeepId(next[0]?.id ?? "");
      return next;
    });
  }

  return step === "choose" ? (
    <Choose
      org={org}
      labels={labels}
      selected={selected}
      keepId={keepId}
      onToggle={toggle}
      onKeep={setKeepId}
      onPreview={() => setStep("preview")}
    />
  ) : (
    <Preview
      org={org}
      keepId={keepId}
      mergeIds={selected.filter((item) => item.id !== keepId).map((item) => item.id)}
      onBack={() => setStep("choose")}
    />
  );
}

/** `/agent/contacts/merge`: choose contacts that are the same person, preview what moves, then confirm. */
export function ContactMerge({ labels }: { labels: ContactLabels }) {
  return (
    <ContactsShell
      path="/merge"
      section="other"
      title="Merge contacts"
      back={{ href: (org) => contactsPath("", org), label: "Contacts" }}
      intro={<p>When the same person is in the book twice, merge them: notes, reminders, links, email addresses, phone numbers, tags and history all move to the contact you keep.</p>}
    >
      {(organisation) => <Merge organisation={organisation} labels={labels} />}
    </ContactsShell>
  );
}
