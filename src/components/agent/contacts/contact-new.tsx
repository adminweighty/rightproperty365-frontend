"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ContactForm, detailsBody, emptyDetails, type ContactDetails } from "@/components/agent/contacts/contact-form";
import { ContactsShell, StageBadge, useMembers, type ContactLabels } from "@/components/agent/contacts/shared";
import { NoAccess } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import { createContact, getContact, type Contact } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { canWriteContacts, contactHref, contactIdFrom, contactsPath, duplicateIdsFrom, stageOptions } from "@/lib/contacts";

const NOTE_MAX = 2000;

/** The contacts a 409 named, read for their names. Ids that cannot be read are still offered. */
function useDuplicates(org: string, ids: string[]) {
  const [contacts, setContacts] = useState<Record<string, Contact | null>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(",").map((id) => getContact(org, id))).then((answers) => {
      if (cancelled) return;
      const next: Record<string, Contact | null> = {};
      key.split(",").forEach((id, index) => {
        const answer = answers[index];
        next[id] = answer.ok ? answer.data.contact : null;
      });
      setContacts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [org, key]);
  return contacts;
}

function DuplicateBanner({
  org,
  ids,
  labels,
  onCreateAnyway,
  busy,
}: {
  org: string;
  ids: string[];
  labels: ContactLabels;
  onCreateAnyway: () => void;
  busy: boolean;
}) {
  const contacts = useDuplicates(org, ids);
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div ref={heading} tabIndex={-1} className="rounded-md border-l-4 border-warning bg-warning-soft p-4 outline-none" role="alert">
      <p className="font-medium text-ink">
        {ids.length > 1
          ? `${ids.length} contacts with the same email address or phone number are already in your book.`
          : "A contact with the same email address or phone number is already in your book."}
      </p>
      <p className="mt-1 text-sm text-ink">Open it to add what you know there, or create a separate contact anyway. You can merge them later.</p>
      <ul className="mt-3 space-y-2 empty:hidden">
        {ids.map((id) => {
          const contact = contacts[id];
          return (
            <li key={id} className="flex flex-wrap items-center gap-2">
              <Link href={contactHref(id, org)} className="inline-flex min-h-11 items-center font-semibold text-primary-ink hover:underline">
                Open the existing contact{contact ? `: ${contact.name}` : ""}
              </Link>
              {contact && <StageBadge stage={contact.stage} label={contact.stage_label} labels={labels} />}
              {contact && (contact.emails[0] || contact.phones[0]) && (
                <span className="break-all text-sm text-muted">{contact.emails[0] ?? contact.phones[0]}</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" className="mt-3" onClick={onCreateAnyway} disabled={busy} aria-busy={busy}>
        {busy ? "Creating…" : "Create anyway"}
      </Button>
    </div>
  );
}

function NewContact({ organisation, labels, user }: { organisation: DashboardOrganisation; labels: ContactLabels; user: User }) {
  const org = organisation.id;
  const router = useRouter();
  const members = useMembers(org);
  const [stage, setStage] = useState("NEW");
  const [owner, setOwner] = useState(user.id);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
  const [last, setLast] = useState<ContactDetails | null>(null);
  const [anyway, setAnyway] = useState<{ busy: boolean; failure: ApiFailure | null }>({ busy: false, failure: null });

  if (!canWriteContacts(organisation.role)) return <NoAccess />;

  const ownerOptions: SelectOption[] =
    members.status === "ready" && members.options.length > 0
      ? [{ value: "", label: "Nobody yet" }, ...members.options]
      : [
          { value: "", label: "Nobody yet" },
          { value: user.id, label: `${user.name} (you)` },
        ];
  const noteHint = `${note.length} of ${NOTE_MAX} characters. Only your team sees notes.`;

  async function send(details: ContactDetails, allowDuplicate: boolean): Promise<ApiFailure | null> {
    if (note.length > NOTE_MAX) {
      setNoteError(`A note can be at most ${NOTE_MAX} characters.`);
      return { code: "LOCAL", status: 0, message: "Check the note." };
    }
    setNoteError(undefined);
    const answer = await createContact(
      org,
      {
        ...detailsBody(details),
        stage,
        ...(owner ? { owner_user_id: owner } : {}),
        ...(note.trim() ? { notes: note.trim() } : {}),
      },
      allowDuplicate,
    );
    if (answer.ok) {
      const id = contactIdFrom(answer.data);
      router.push(id ? contactHref(id, org) : contactsPath("", org));
      return null;
    }
    if (answer.failure.code === "CONTACT_DUPLICATE" || answer.failure.status === 409) {
      setLast(details);
      setDuplicates(duplicateIdsFrom(answer.failure.body));
      return { ...answer.failure, code: "CONTACT_DUPLICATE" };
    }
    if (answer.failure.fields?.notes) setNoteError(answer.failure.fields.notes);
    return answer.failure;
  }

  async function createAnyway() {
    if (!last) return;
    setAnyway({ busy: true, failure: null });
    const failure = await send(last, true);
    setAnyway({ busy: false, failure });
  }

  return (
    <ContactForm
      idPrefix="new-contact"
      initial={emptyDetails()}
      labels={labels}
      submitLabel="Add the contact"
      busyLabel="Adding…"
      onSubmit={(details) => {
        setDuplicates(null);
        return send(details, false);
      }}
      extra={
        <div className="grid gap-6 md:grid-cols-2">
          <Field id="new-contact-stage" label="Stage">
            <SearchableSelect id="new-contact-stage" options={stageOptions(labels.stages)} value={stage} onValueChange={setStage} />
          </Field>
          <Field id="new-contact-owner" label="Relationship owner" hint="Who looks after this contact. Everyone in the team still sees it.">
            <SearchableSelect
              id="new-contact-owner"
              options={ownerOptions}
              value={owner}
              onValueChange={setOwner}
              aria-describedby="new-contact-owner-hint"
            />
          </Field>
          <Field id="new-contact-note" label="First note" optional hint={noteHint} error={noteError} className="md:col-span-2">
            <Textarea
              id="new-contact-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={Boolean(noteError)}
              aria-describedby={fieldDescribedBy("new-contact-note", { hint: noteHint, error: noteError })}
            />
          </Field>
        </div>
      }
      banner={
        duplicates ? (
          <>
            <DuplicateBanner org={org} ids={duplicates} labels={labels} onCreateAnyway={createAnyway} busy={anyway.busy} />
            {anyway.failure && anyway.failure.code !== "CONTACT_DUPLICATE" && (
              <Alert className="mt-3" title={anyway.failure.message} traceId={anyway.failure.traceId} />
            )}
          </>
        ) : null
      }
    />
  );
}

/** `/agent/contacts/new`: add a contact by hand. */
export function ContactNew({ labels }: { labels: ContactLabels }) {
  return (
    <ContactsShell
      path="/new"
      section="other"
      title="Add a contact"
      back={{ href: (org) => contactsPath("", org), label: "Contacts" }}
      intro={<p>If someone with the same email address or phone number is already in the book, we say so before adding them twice.</p>}
    >
      {(organisation, user) => <NewContact organisation={organisation} labels={labels} user={user} />}
    </ContactsShell>
  );
}
