"use client";

import { BellRing, CheckCircle2, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ContactForm, detailsBody, type ContactDetails } from "@/components/agent/contacts/contact-form";
import {
  ContactsShell,
  sourceLabel,
  StageBadge,
  typeLabel,
  useMembers,
  type ContactLabels,
} from "@/components/agent/contacts/shared";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import { listMyListings } from "@/lib/api/availability";
import {
  addContactNote,
  addContactReminder,
  deleteContact,
  getContact,
  getContactTimeline,
  linkContactListing,
  moveContactStage,
  setContactOwner,
  setContactReminderDone,
  unlinkContactListing,
  updateContact,
  type Contact,
  type ContactTimelineEntry,
} from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import {
  canReassignOwner,
  canWriteContacts,
  contactHref,
  contactsPath,
  isReminderDue,
  linkedItemHref,
  localDateTimeToIso,
  stageLabel,
  stageOptions,
} from "@/lib/contacts";

const NOTE_MAX = 2000;
const REMINDER_MAX = 500;

type Message = { tone: "success" | "danger" | "warning"; text: string; traceId?: string };

/** Runs a change, says how it went in a live region, and reads the contact again when it worked. */
function useChange(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const run = useCallback(
    async (action: () => Promise<ApiResult<unknown>>, success: string): Promise<ApiFailure | null> => {
      setPending(true);
      setMessage(null);
      const answer = await action();
      setPending(false);
      if (answer.ok) {
        setMessage({ tone: "success", text: success });
        onDone();
        return null;
      }
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return answer.failure;
    },
    [onDone],
  );
  return { pending, message, setMessage, run };
}

function Result({ message }: { message: Message | null }) {
  return (
    <div aria-live="polite" className="mt-3">
      {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
    </div>
  );
}

function detailsOf(contact: Contact): ContactDetails {
  return {
    name: contact.name,
    type: contact.type ?? "",
    emails: contact.emails.length ? [...contact.emails] : [""],
    phones: contact.phones.length ? [...contact.phones] : [""],
    tags: [...contact.tags],
    source: contact.source ?? "",
    marketing: { granted: Boolean(contact.marketing?.granted), source: contact.marketing?.source ?? "" },
  };
}

function StageControl({ contact, org, labels, writer, onChanged }: { contact: Contact; org: string; labels: ContactLabels; writer: boolean; onChanged: () => void }) {
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, message, setMessage, run } = useChange(onChanged);
  const options = stageOptions(labels.stages).filter((option) => option.value !== contact.stage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stage) {
      setError("Choose the stage it moves to.");
      setMessage(null);
      return;
    }
    setError(undefined);
    const failure = await run(() => moveContactStage(org, contact.id, stage, note.trim() || undefined), `Moved to ${stageLabel(stage, labels.stages)}.`);
    if (!failure) {
      setStage("");
      setNote("");
    } else if (failure.fields?.stage) {
      setError(failure.fields.stage);
    }
  }

  return (
    <section aria-labelledby="contact-stage">
      <h2 id="contact-stage" className="text-xl">
        Stage
      </h2>
      <p className="mt-2 text-ink">
        Now: <StageBadge stage={contact.stage} label={contact.stage_label} labels={labels} />
      </p>
      {writer && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          <Field id="contact-stage-to" label="Move it to" error={error}>
            <SearchableSelect
              key={contact.stage}
              id="contact-stage-to"
              options={[{ value: "", label: "Choose a stage…" }, ...options]}
              value={stage}
              onValueChange={setStage}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy("contact-stage-to", { error })}
            />
          </Field>
          <Field id="contact-stage-note" label="Why" optional>
            <Input id="contact-stage-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
            {pending ? "Moving…" : "Change the stage"}
          </Button>
        </form>
      )}
      <Result message={message} />
    </section>
  );
}

function OwnerControl({ contact, organisation, user, onChanged }: { contact: Contact; organisation: DashboardOrganisation; user: User; onChanged: () => void }) {
  const org = organisation.id;
  const ownerId = contact.owner?.user_id ?? contact.owner_user_id ?? null;
  const allowed = canReassignOwner(organisation.role, ownerId, user.id);
  const members = useMembers(org);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, message, run } = useChange(onChanged);

  const options: SelectOption[] =
    members.status === "ready" && members.options.length > 0
      ? members.options
      : [{ value: user.id, label: `${user.name} (you)` }];
  const ownerHint =
    members.status === "failed"
      ? "Only the Agency Principal and managers can see the whole team, so here you can give it to yourself."
      : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || chosen === ownerId) {
      setError(chosen ? "They already own this contact. Choose someone else." : "Choose who looks after this contact.");
      return;
    }
    setError(undefined);
    const name = options.find((option) => option.value === chosen)?.label ?? "them";
    const failure = await run(() => setContactOwner(org, contact.id, chosen), `Given to ${name}. The change is in the timeline.`);
    if (!failure) setChosen("");
    else if (failure.fields?.user_id) setError(failure.fields.user_id);
  }

  return (
    <section aria-labelledby="contact-owner">
      <h2 id="contact-owner" className="text-xl">
        Relationship owner
      </h2>
      <p className="mt-2 text-ink">
        {contact.owner ? (
          <span className="font-medium">{contact.owner.user_id === user.id ? `${contact.owner.name} (you)` : contact.owner.name}</span>
        ) : (
          <span className="text-muted">Nobody yet.</span>
        )}
      </p>
      <p className="mt-1 text-sm text-muted">Everyone in the team sees this contact whoever owns it.</p>
      {allowed && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          {members.status === "loading" ? (
            <div aria-busy="true" aria-label="Loading the team" className="h-11 rounded-md bg-sunken" />
          ) : (
            <Field id="contact-owner-to" label="Give it to" error={error} hint={ownerHint}>
              <SearchableSelect
                id="contact-owner-to"
                options={[{ value: "", label: "Choose someone…" }, ...options]}
                value={chosen}
                onValueChange={setChosen}
                aria-invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy("contact-owner-to", { error, hint: ownerHint })}
              />
            </Field>
          )}
          <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Save the owner"}
          </Button>
        </form>
      )}
      <Result message={message} />
    </section>
  );
}

function Notes({ contact, org, writer, onChanged }: { contact: Contact; org: string; writer: boolean; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, message, run } = useChange(onChanged);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const notes = [...(contact.notes ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const hint = `${text.length} of ${NOTE_MAX} characters. A note cannot be changed: to correct one, add another.`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) {
      setError("Write the note first.");
      textarea.current?.focus();
      return;
    }
    if (body.length > NOTE_MAX) {
      setError(`A note can be at most ${NOTE_MAX} characters.`);
      textarea.current?.focus();
      return;
    }
    setError(undefined);
    const failure = await run(() => addContactNote(org, contact.id, body), "Note saved.");
    if (!failure) setText("");
    else if (failure.fields?.text) setError(failure.fields.text);
  }

  return (
    <section aria-labelledby="contact-notes">
      <h2 id="contact-notes" className="text-xl">
        Notes
      </h2>
      <p className="mt-2 flex items-center gap-2 rounded-md bg-sunken p-3 text-sm text-ink">
        <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Only your team can see notes. The contact never does.
      </p>
      {writer && (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Field id="contact-note" label="Add a note" hint={hint} error={error}>
            <Textarea
              ref={textarea}
              id="contact-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(undefined);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy("contact-note", { hint, error })}
            />
          </Field>
          <Button type="submit" variant="secondary" className="mt-3" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Save the note"}
          </Button>
          <Result message={message} />
        </form>
      )}
      {notes.length === 0 ? (
        <p className="mt-4 text-muted">No notes yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line p-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{note.author?.name ?? note.author_name ?? "Your team"}</span>, {formatWhen(note.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line break-words leading-relaxed text-ink">{note.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Reminders({ contact, org, writer, onChanged }: { contact: Contact; org: string; writer: boolean; onChanged: () => void }) {
  const [due, setDue] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<{ due?: string; text?: string }>({});
  const { pending, message, run } = useChange(onChanged);
  const toggle = useChange(onChanged);
  // When the page was opened: a reminder due since then shows as due after the next read.
  const [now] = useState(() => Date.now());
  const reminders = [...(contact.reminders ?? [])].sort((a, b) => Number(a.done) - Number(b.done) || Date.parse(a.due_at) - Date.parse(b.due_at));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = localDateTimeToIso(due);
    const found: typeof errors = {};
    if (!at) found.due = "Choose the day and time of the reminder.";
    if (!text.trim()) found.text = "Say what to do, such as “Call about the second viewing”.";
    else if (text.trim().length > REMINDER_MAX) found.text = `A reminder can be at most ${REMINDER_MAX} characters.`;
    setErrors(found);
    if (!at || found.text) return;
    const failure = await run(() => addContactReminder(org, contact.id, { due_at: at, text: text.trim() }), `Reminder set for ${formatWhen(at)}.`);
    if (!failure) {
      setDue("");
      setText("");
    } else {
      setErrors({ due: failure.fields?.due_at, text: failure.fields?.text });
    }
  }

  return (
    <section aria-labelledby="contact-reminders">
      <h2 id="contact-reminders" className="text-xl">
        Reminders
      </h2>
      {reminders.length === 0 ? (
        <p className="mt-2 text-muted">No reminders.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {reminders.map((reminder) => {
            const overdue = isReminderDue(reminder, now);
            return (
              <li key={reminder.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {reminder.done ? (
                    <Badge tone="success">
                      <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden="true" />
                      Done
                    </Badge>
                  ) : overdue ? (
                    <Badge tone="warning">
                      <BellRing className="mr-1 inline size-3.5" aria-hidden="true" />
                      Due
                    </Badge>
                  ) : (
                    <Badge>Coming up</Badge>
                  )}
                  <span className="text-sm text-muted">{formatWhen(reminder.due_at)}</span>
                </div>
                <p className={reminder.done ? "mt-1 text-muted line-through" : "mt-1 text-ink"}>{reminder.text}</p>
                {writer && (
                  <Button
                    variant="ghost"
                    className="mt-1 -ml-3"
                    disabled={toggle.pending}
                    onClick={() =>
                      toggle.run(
                        () => setContactReminderDone(org, contact.id, reminder.id, !reminder.done),
                        reminder.done ? "Reminder opened again." : "Reminder marked as done.",
                      )
                    }
                  >
                    {reminder.done ? "Mark as not done" : "Mark as done"}
                    <span className="sr-only">: {reminder.text}</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Result message={toggle.message} />
      {writer && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 border-t border-line pt-4">
          <h3 className="font-sans text-base font-semibold tracking-normal">Add a reminder</h3>
          <Field id="reminder-due" label="When" hint="In your time zone." error={errors.due}>
            <Input
              id="reminder-due"
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-invalid={Boolean(errors.due)}
              aria-describedby={fieldDescribedBy("reminder-due", { hint: "In your time zone.", error: errors.due })}
            />
          </Field>
          <Field id="reminder-text" label="What to do" error={errors.text}>
            <Input
              id="reminder-text"
              maxLength={REMINDER_MAX}
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={Boolean(errors.text)}
              aria-describedby={fieldDescribedBy("reminder-text", { error: errors.text })}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Add the reminder"}
          </Button>
          <Result message={message} />
        </form>
      )}
    </section>
  );
}

type ListingOptions = { status: "loading" } | { status: "ready"; options: SelectOption[] } | { status: "failed" };

/** The listings the caller manages (`GET /v1/me/listings`), up to five pages of 48. The API refuses any not of this organisation. */
function useListingOptions(enabled: boolean): ListingOptions {
  const [state, setState] = useState<ListingOptions>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
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
        options: items.map((item) => ({ value: item.id, label: item.title || item.reference, secondary: item.reference, keywords: item.city?.label ? [item.city.label] : undefined })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return state;
}

function Listings({ contact, org, writer, onChanged }: { contact: Contact; org: string; writer: boolean; onChanged: () => void }) {
  const listings = contact.listings ?? [];
  const options = useListingOptions(writer);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, message, run } = useChange(onChanged);
  const linked = new Set(listings.map((item) => item.listing_id));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) {
      setError("Choose a listing.");
      return;
    }
    if (linked.has(chosen)) {
      setError("That listing is already linked.");
      return;
    }
    setError(undefined);
    const failure = await run(() => linkContactListing(org, contact.id, chosen), "Listing linked.");
    if (!failure) setChosen("");
    else if (failure.fields?.listing_id) setError(failure.fields.listing_id);
  }

  return (
    <section aria-labelledby="contact-listings">
      <h2 id="contact-listings" className="text-xl">
        Linked listings
      </h2>
      {listings.length === 0 ? (
        <p className="mt-2 text-muted">No listings linked.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {listings.map((item) => (
            <li key={item.listing_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Link href={`/agent/listings/${encodeURIComponent(item.listing_id)}`} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                {item.title ?? item.reference ?? "A listing"}
              </Link>
              {item.reference && <span className="font-mono text-xs text-subtle">{item.reference}</span>}
              {writer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  disabled={pending}
                  onClick={() => run(() => unlinkContactListing(org, contact.id, item.listing_id), "Listing unlinked.")}
                >
                  Unlink<span className="sr-only"> {item.title ?? item.reference}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {writer && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
          {options.status === "loading" && <div aria-busy="true" aria-label="Loading your listings" className="h-11 rounded-md bg-sunken" />}
          {options.status === "failed" && <p className="text-sm text-muted">Your listings could not be loaded, so none can be linked right now.</p>}
          {options.status === "ready" && (
            <>
              <Field id="contact-listing" label="Link a listing" error={error}>
                <SearchableSelect
                  id="contact-listing"
                  options={[{ value: "", label: "Choose a listing…" }, ...options.options.filter((option) => !linked.has(option.value))]}
                  value={chosen}
                  onValueChange={setChosen}
                  aria-invalid={Boolean(error)}
                  aria-describedby={fieldDescribedBy("contact-listing", { error })}
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
                {pending ? "Linking…" : "Link the listing"}
              </Button>
            </>
          )}
        </form>
      )}
      <Result message={message} />
    </section>
  );
}

/** The words of a timeline entry: the API's label, else made from its kind. */
function entryText(entry: ContactTimelineEntry, labels: ContactLabels): string {
  if (entry.label) return entry.label;
  switch (entry.kind) {
    case "NOTE_ADDED":
    case "NOTE":
      return "Note added";
    case "STAGE_CHANGED":
      return entry.to_stage ? `Moved to ${stageLabel(entry.to_stage, labels.stages)}` : "Stage changed";
    case "OWNER_CHANGED":
      return entry.to_owner ? `Given to ${entry.to_owner.name}` : "Relationship owner changed";
    case "REMINDER_ADDED":
    case "REMINDER":
      return "Reminder set";
    case "REMINDER_DONE":
      return "Reminder done";
    case "PROPERTY_REQUEST":
      return "Property request";
    case "BUSINESS_ENQUIRY":
      return "Business enquiry";
    case "APPOINTMENT":
      return "Appointment";
    case "APPLICATION":
      return "Application";
    case "MERGED":
      return "Contacts merged into this one";
    case "CREATED":
      return "Contact added";
    default:
      return stageLabel(entry.kind);
  }
}

function Timeline({ contact, org, labels, version }: { contact: Contact; org: string; labels: ContactLabels; version: number }) {
  const id = contact.id;
  // `version` changes after every change to the contact, so the timeline is read again.
  const load = useCallback(() => getContactTimeline(org, id), [org, id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const { state, reload } = useApi(load);
  const items = state.status === "ready" ? state.data.items : state.status === "loading" ? state.previous?.items : undefined;

  return (
    <section aria-labelledby="contact-timeline">
      <h2 id="contact-timeline" className="text-xl">
        Timeline
      </h2>
      <p className="mt-1 text-sm text-muted">Notes, changes, reminders and the requests, enquiries and appointments linked to this contact, newest first.</p>
      <div className="mt-4">
        {!items && state.status === "loading" && <LoadingBlock label="Loading the timeline" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {items && items.length === 0 && <p className="text-muted">Nothing yet.</p>}
        {items && items.length > 0 && (
          <ol className="space-y-4 border-l-2 border-line pl-4">
            {items.map((entry, index) => {
              const ref = entry.ref;
              const href = ref ? linkedItemHref(ref.kind, ref.id, org) : null;
              const who = entry.actor?.name ?? entry.actor_name;
              // The API's label often names the reference already ("Appointment AP-…: …").
              const showRef = Boolean(ref?.reference) && !entryText(entry, labels).includes(ref?.reference ?? "");
              return (
                <li key={entry.id ?? `${entry.at}-${index}`}>
                  <p className="font-medium text-ink">
                    {href ? (
                      <Link href={href} className="text-primary-ink hover:underline">
                        {entryText(entry, labels)}
                        {showRef && <> <span className="font-mono text-xs">{ref?.reference}</span></>}
                      </Link>
                    ) : (
                      <>
                        {entryText(entry, labels)}
                        {showRef && <> <span className="font-mono text-xs text-subtle">{ref?.reference}</span></>}
                      </>
                    )}
                  </p>
                  {(entry.text || ref?.label) && (
                    <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words text-sm text-ink">{entry.text ?? ref?.label}</p>
                  )}
                  <p className="text-sm text-muted">
                    {who ? `${who}, ` : ""}
                    {formatWhen(entry.at)}
                    {entry.due_at && ` · due ${formatWhen(entry.due_at)}`}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function DeleteContact({ contact, org }: { contact: Contact; org: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const answer = await deleteContact(org, contact.id);
    setBusy(false);
    if (answer.ok) {
      router.push(contactsPath("", org));
      return;
    }
    setError(answer.failure.message);
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Delete the contact
      </Button>
      <ConfirmDialog
        open={open}
        title={`Delete ${contact.name}?`}
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
      >
        It leaves the contact book for everyone in your team. Its history is kept, but you will no longer find it in the list.
      </ConfirmDialog>
    </>
  );
}

function Detail({ id, organisation, labels, user }: { id: string; organisation: DashboardOrganisation; labels: ContactLabels; user: User }) {
  const org = organisation.id;
  const load = useCallback(() => getContact(org, id), [org, id]);
  const { state, reload } = useApi(load);
  const [version, setVersion] = useState(0);
  const writer = canWriteContacts(organisation.role);
  const changed = useCallback(() => {
    reload();
    setVersion((value) => value + 1);
  }, [reload]);

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the contact" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState
          title="We could not find that contact"
          action={
            <ButtonLink href={contactsPath("", org)} variant="secondary">
              Back to contacts
            </ButtonLink>
          }
        >
          It may have been deleted, belong to another organisation, or the address may be wrong.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const contact = state.status === "ready" ? state.data.contact : state.previous!.contact;

  if (contact.merged_into) {
    return (
      <EmptyState
        title={`${contact.name} was merged into another contact`}
        action={
          <ButtonLink href={contactHref(contact.merged_into, org)} variant="secondary">
            Open the contact it was merged into
          </ButtonLink>
        }
      >
        Its notes, reminders, links and history were moved there. Nothing was lost.
      </EmptyState>
    );
  }

  async function saveDetails(details: ContactDetails): Promise<ApiFailure | null> {
    const answer = await updateContact(org, contact.id, detailsBody(details));
    if (answer.ok) {
      changed();
      return null;
    }
    return answer.failure;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {contact.type && <Badge tone="primary">{typeLabel(labels, contact.type, contact.type_label)}</Badge>}
        <StageBadge stage={contact.stage} label={contact.stage_label} labels={labels} />
        {contact.source && <span className="text-sm text-muted">From {sourceLabel(labels, contact.source, contact.source_label).toLowerCase()}</span>}
      </div>
      <h1 className="mt-2 break-words text-3xl md:text-4xl">{contact.name}</h1>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {contact.emails.map((email) => (
          <li key={email}>
            <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
              <Mail className="size-4" aria-hidden="true" />
              <span className="break-all">{email}</span>
            </a>
          </li>
        ))}
        {contact.phones.map((phone) => (
          <li key={phone}>
            <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
              <Phone className="size-4" aria-hidden="true" />
              {phone}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-muted">
        Added {formatWhen(contact.created_at)}
        {contact.last_contact_at && ` · last contact ${formatWhen(contact.last_contact_at)}`}
      </p>
      {writer && (
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={contactsPath("/merge", org, { keep: contact.id })} variant="secondary">
            Merge with another contact
          </ButtonLink>
          <DeleteContact contact={contact} org={org} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-8">
          <Card>
            <section aria-labelledby="contact-details">
              <h2 id="contact-details" className="text-xl">
                Details
              </h2>
              {!writer && <p className="mt-1 text-sm text-muted">You can read these details; Agency Staff cannot change them.</p>}
              <div className="mt-2">
                <ContactForm
                  key={contact.id}
                  idPrefix="contact"
                  initial={detailsOf(contact)}
                  labels={labels}
                  submitLabel="Save the details"
                  busyLabel="Saving…"
                  successText="Details saved."
                  onSubmit={saveDetails}
                  disabled={!writer}
                  marketing={contact.marketing ?? null}
                />
              </div>
            </section>
          </Card>
          <Card>
            <Notes contact={contact} org={org} writer={writer} onChanged={changed} />
          </Card>
          <Card>
            <Timeline contact={contact} org={org} labels={labels} version={version} />
          </Card>
        </div>
        <div className="min-w-0 space-y-8">
          <Card>
            <StageControl contact={contact} org={org} labels={labels} writer={writer} onChanged={changed} />
          </Card>
          <Card>
            <OwnerControl contact={contact} organisation={organisation} user={user} onChanged={changed} />
          </Card>
          <Card>
            <Reminders contact={contact} org={org} writer={writer} onChanged={changed} />
          </Card>
          <Card>
            <Listings contact={contact} org={org} writer={writer} onChanged={changed} />
          </Card>
        </div>
      </div>
    </>
  );
}

/** `/agent/contacts/<id>`: one contact, its details, notes, reminders, links and timeline. */
export function ContactDetail({ id, labels }: { id: string; labels: ContactLabels }) {
  return (
    <ContactsShell
      path={`/${id}`}
      section="other"
      back={{ href: (org) => contactsPath("", org), label: "Contacts" }}
    >
      {(organisation, user) => <Detail id={id} organisation={organisation} labels={labels} user={user} />}
    </ContactsShell>
  );
}
