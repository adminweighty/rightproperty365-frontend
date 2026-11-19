"use client";

import { Download, Link2, Lock, Paperclip, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { EntryEditor } from "@/components/agent/books/entry-form";
import {
  BooksShell,
  categoryWords,
  DirectionTag,
  formatDay,
  linkClass,
  saveBlob,
  SignedAmount,
  StatusBadge,
  useCategories,
} from "@/components/agent/books/shared";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import type { SelectOption } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { addEntryNote, correctEntry, downloadEntryAttachment, getEntry, reconcileEntry, reverseEntry, uploadEntryAttachment } from "@/lib/api/ledger";
import { contactHref } from "@/lib/contacts";
import { tenancyHref } from "@/lib/tenancies";
import {
  booksPath,
  canCorrectEntry,
  canCorrectType,
  canReconcileEntry,
  canWriteBooks,
  entryHistory,
  entryHref,
  entryMarkers,
  isMemoType,
  entryRelations,
  entryTypeLabel,
  fileNameFrom,
  formFromEntry,
  methodLabel,
  NOTE_MAX,
  primaryEntryId,
  REASON_MAX,
  RECONCILED_WORDS,
  STATUS_RECONCILED,
  UNVERIFIED_WORDS,
  wordsFromCode,
  type LedgerEntry,
} from "@/lib/ledger";
import { fileProblem, fileSizeText } from "@/lib/questionnaires";

type Message = { tone: "success" | "danger"; text: string; traceId?: string };

function Result({ message }: { message: Message | null }) {
  return (
    <div aria-live="polite" className="mt-3">
      {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
    </div>
  );
}

function useChange(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const run = useCallback(
    async (action: () => Promise<ApiResult<unknown>>, success: string) => {
      setPending(true);
      setMessage(null);
      const answer = await action();
      setPending(false);
      if (answer.ok) {
        setMessage({ tone: "success", text: success });
        onDone();
        return answer;
      }
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return answer;
    },
    [onDone],
  );
  return { pending, message, setMessage, run };
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

// ---- Reconcile ------------------------------------------------------------------------------

function Reconcile({ entry, org, allowed, onChanged }: { entry: LedgerEntry; org: string; allowed: boolean; onChanged: () => void }) {
  const reconciled = entry.status === STATUS_RECONCILED;
  const [note, setNote] = useState("");
  const { pending, message, run } = useChange(onChanged);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () => reconcileEntry(org, entry.id, !reconciled, note.trim() || undefined),
      reconciled ? `Marked as not reconciled. It reads “${UNVERIFIED_WORDS}” again.` : `Marked reconciled. It reads “${RECONCILED_WORDS}”.`,
    );
    setNote("");
  }

  return (
    <section aria-labelledby="entry-reconcile">
      <h2 id="entry-reconcile" className="text-lg">
        Reconciliation
      </h2>
      <div className="mt-2">
        <StatusBadge status={entry.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        Reconciled means someone in your team checked this entry against your own statement. RightProperty365 does not see
        your bank and verifies nothing.
      </p>
      {reconciled && (entry.reconciledBy || entry.reconciledAt || entry.reconciledNote) && (
        <p className="mt-2 text-sm text-ink">
          {entry.reconciledBy ? `By ${entry.reconciledBy.name}` : "Marked"}
          {entry.reconciledAt ? `, ${formatWhen(entry.reconciledAt)}` : ""}
          {entry.reconciledNote ? `: “${entry.reconciledNote}”` : "."}
        </p>
      )}
      {allowed && (
        <form onSubmit={handleSubmit} className="mt-3">
          <Field id="entry-reconcile-note" label="Note" optional hint="For example the statement and line you checked">
            <Textarea
              id="entry-reconcile-note"
              rows={2}
              maxLength={REASON_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby="entry-reconcile-note-hint"
            />
          </Field>
          <Button type="submit" variant="secondary" className="mt-3" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : reconciled ? "Mark as not reconciled" : "Mark as reconciled"}
          </Button>
          <Result message={message} />
        </form>
      )}
    </section>
  );
}

// ---- Reverse ----------------------------------------------------------------------------------

function Reverse({ entry, org, onReversed }: { entry: LedgerEntry; org: string; onReversed: (reversalId: string | null) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const hint = "Kept with both entries in the history";

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Say why the entry is being reversed.");
      return;
    }
    setError(undefined);
    setFailure(undefined);
    setAsking(true);
  }

  async function confirm() {
    setBusy(true);
    const answer = await reverseEntry(org, entry.id, reason.trim());
    setBusy(false);
    if (!answer.ok) {
      setFailure(answer.failure.message);
      if (answer.failure.fields?.reason) setError(answer.failure.fields.reason);
      return;
    }
    setAsking(false);
    // `{entry: the reversal, created, updated}`.
    onReversed(primaryEntryId(answer.data));
  }

  return (
    <section aria-labelledby="entry-reverse">
      <h2 id="entry-reverse" className="text-lg">
        Reverse
      </h2>
      <p className="mt-2 text-sm text-muted">
        Records a reversal with the opposite sign that cancels this entry out. This entry stays in your books, marked as
        reversed.
      </p>
      <form onSubmit={ask} noValidate className="mt-3">
        <Field id="entry-reverse-reason" label="Why" hint={hint} error={error}>
          <Textarea
            id="entry-reverse-reason"
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("entry-reverse-reason", { hint, error })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-3">
          Reverse the entry
        </Button>
      </form>
      <ConfirmDialog
        open={asking}
        title="Reverse this entry?"
        confirmLabel="Yes, reverse it"
        busyLabel="Reversing…"
        cancelLabel="Keep it"
        busy={busy}
        error={failure}
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      >
        A reversal cannot be undone. Both entries stay in your books; to record the right figure, use Correct instead.
      </ConfirmDialog>
    </section>
  );
}

// ---- Attachments ----------------------------------------------------------------------------------

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const ACCEPTED = { accept: ["pdf", "jpg", "png", "webp"] };

function Attachments({ entry, org, writer, onChanged }: { entry: LedgerEntry; org: string; writer: boolean; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = fileProblem(file, ACCEPTED);
    if (problem) {
      setMessage({ tone: "danger", text: problem });
      return;
    }
    setMessage(null);
    setUpload({ name: file.name, progress: 0 });
    const answer = await uploadEntryAttachment(org, entry.id, file, (progress) => setUpload({ name: file.name, progress }));
    setUpload(null);
    if (!answer.ok) {
      setMessage({ tone: "danger", text: `${file.name} was not added. ${answer.failure.message}`, traceId: answer.failure.traceId });
      return;
    }
    setMessage({ tone: "success", text: `${file.name} added.` });
    onChanged();
  }

  async function download(id: string, name: string) {
    setDownloading(id);
    setMessage(null);
    const answer = await downloadEntryAttachment(org, entry.id, id);
    setDownloading(null);
    if (!answer.ok) {
      setMessage({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    saveBlob(answer.data.blob, fileNameFrom(answer.data.headers.get("Content-Disposition"), name));
  }

  return (
    <section aria-labelledby="entry-attachments">
      <h2 id="entry-attachments" className="text-xl">
        Attachments
      </h2>
      <p className="mt-2 text-sm text-muted">Receipts and slips. PDF, JPEG, PNG or WebP, up to 10 MB each. Only your team can open them, and each opening is recorded in the activity log.</p>
      {entry.attachments.length === 0 ? (
        <p className="mt-3 text-muted">No attachments yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line">
          {entry.attachments.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 p-3">
              <Paperclip className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-all text-ink">
                {file.name}
                <span className="block text-xs text-muted">
                  {[file.size !== null ? fileSizeText(file.size) : null, file.uploadedBy?.name, file.uploadedAt ? formatWhen(file.uploadedAt) : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button variant="secondary" onClick={() => download(file.id, file.name)} disabled={downloading === file.id} aria-busy={downloading === file.id}>
                <Download className="size-4" aria-hidden="true" />
                {downloading === file.id ? "Downloading…" : "Download"}
                <span className="sr-only"> {file.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {writer && (
        <div className="mt-4">
          <input ref={input} id="entry-attachment" type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={choose} />
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={Boolean(upload)} aria-busy={Boolean(upload)}>
            <Upload className="size-4" aria-hidden="true" />
            {upload ? "Uploading…" : "Add an attachment"}
          </Button>
          {upload && (
            <div className="mt-3">
              <p className="text-sm text-ink">
                Uploading {upload.name}… {Math.round(upload.progress * 100)}%
              </p>
              <progress className="mt-1 h-2 w-full accent-primary" max={1} value={upload.progress} aria-label={`Uploading ${upload.name}`} />
            </div>
          )}
        </div>
      )}
      <Result message={message} />
    </section>
  );
}

// ---- Notes ------------------------------------------------------------------------------------------

function Notes({ entry, org, writer, onChanged }: { entry: LedgerEntry; org: string; writer: boolean; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, message, run } = useChange(onChanged);
  const notes = [...entry.notes].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  const hint = `${text.length} of ${NOTE_MAX} characters. A note cannot be changed: to correct one, add another.`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) {
      setError("Write the note first.");
      return;
    }
    setError(undefined);
    const answer = await run(() => addEntryNote(org, entry.id, body), "Note saved.");
    if (answer.ok) setText("");
    else if (answer.failure.fields?.text) setError(answer.failure.fields.text);
  }

  return (
    <section aria-labelledby="entry-notes">
      <h2 id="entry-notes" className="text-xl">
        Notes
      </h2>
      <p className="mt-2 flex items-center gap-2 rounded-md bg-sunken p-3 text-sm text-ink">
        <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
        Only your team can see notes.
      </p>
      {writer && (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Field id="entry-note" label="Add a note" hint={hint} error={error}>
            <Textarea
              id="entry-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(undefined);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy("entry-note", { hint, error })}
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
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line p-3">
              <p className="whitespace-pre-line break-words text-ink">{note.text}</p>
              <p className="mt-1 text-xs text-muted">{[note.author?.name, note.createdAt ? formatWhen(note.createdAt) : null].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- History ------------------------------------------------------------------------------------------

const EVENT_WORDS: Record<string, string> = {
  CREATED: "Recorded",
  ENTRY_CREATED: "Recorded",
  REVERSED: "Reversed",
  ENTRY_REVERSED: "Reversed",
  CORRECTED: "Corrected",
  ENTRY_CORRECTED: "Corrected",
  RECONCILED: "Marked reconciled by your team",
  UNRECONCILED: "Marked as not reconciled",
  ATTACHMENT_ADDED: "Attachment added",
  ATTACHMENT_VIEWED: "Attachment opened",
  NOTE_ADDED: "Note added",
};

function History({ entry, related, org }: { entry: LedgerEntry; related: LedgerEntry[]; org: string }) {
  const events = entryHistory(entry, related);
  return (
    <section aria-labelledby="entry-history">
      <h2 id="entry-history" className="text-xl">
        History
      </h2>
      <p className="mt-2 text-sm text-muted">Every change, export and opening of an attachment is also recorded in your team&rsquo;s activity log.</p>
      {events.length === 0 ? (
        <p className="mt-3 text-muted">
          Recorded{entry.author ? ` by ${entry.author.name}` : ""}
          {entry.recordedAt ? `, ${formatWhen(entry.recordedAt)}` : ""}.
        </p>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {events.map((event) => (
            <li key={event.id}>
              <p className="font-medium text-ink">{event.label || EVENT_WORDS[event.kind] || wordsFromCode(event.kind)}</p>
              {event.text && <p className="break-words text-sm text-ink">“{event.text}”</p>}
              <p className="text-xs text-muted">{[event.actor?.name, event.at ? formatWhen(event.at) : null].filter(Boolean).join(" · ")}</p>
              {event.relatedId && event.relatedId !== entry.id && (
                <Link href={entryHref(event.relatedId, org)} className={`${linkClass} text-sm`}>
                  Open the linked entry
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** How a related entry stands to this one, in words. */
function relationWords(entry: LedgerEntry, item: LedgerEntry): string {
  if (item.reversal_of === entry.id) return "Its reversal";
  if (entry.reversal_of === item.id) return "The entry it reverses";
  if (item.correction_of === entry.id) return "Its correction";
  if (entry.correction_of === item.id) return "The entry it corrects";
  if (entry.transfer_pair === item.id || item.transfer_pair === entry.id) return "Other half of this transfer";
  if (item.settles === entry.id) return "A payment against it";
  if (entry.settles === item.id) return "The amount owed it settles";
  return "Linked";
}

// ---- The page -------------------------------------------------------------------------------------------

function EntryPage({ id, organisation, user, currencies }: { id: string; organisation: DashboardOrganisation; user: User; currencies: SelectOption[] }) {
  const org = organisation.id;
  const router = useRouter();
  const load = useCallback(() => getEntry(org, id), [org, id]);
  const { state, reload } = useApi(load);
  const categories = useCategories(org);
  const [correcting, setCorrecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // While a change is read again the entry stays on screen, with the result of the change.
  const shown = state.status === "ready" ? state.data : state.status === "loading" && state.previous?.entry.id === id ? state.previous : null;
  if (!shown && state.status !== "error") return <LoadingBlock label="Loading the entry" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState
          title="We could not find that entry"
          action={
            <ButtonLink href={booksPath("", org)} variant="secondary">
              Back to the entries
            </ButtonLink>
          }
        >
          It may belong to another organisation&rsquo;s books.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  if (!shown) return null;
  const { entry, related } = shown;
  const writer = canWriteBooks(organisation.role);
  const canNote = entry.can_note ?? writer;
  const canAttach = entry.can_attach ?? writer;
  const settlement = isMemoType(entry.type) && !entry.reversed_by && writer;
  const reversible = canCorrectEntry(organisation.role, entry, user.id, "reverse");
  // A tenancy receipt is reversed, never corrected (409 LEDGER_ENTRY_IS_RENT_RECEIPT): record a new receipt instead.
  const rentReceipt = Boolean(entry.tenancyId) && entry.type === "RENT_RECEIVED";
  const correctable = canCorrectEntry(organisation.role, entry, user.id, "correct") && canCorrectType(entry.type) && !rentReceipt;
  const reconcilable = canReconcileEntry(organisation.role, entry) && !entry.reversed_by;
  const relations = entryRelations(entry);
  const markers = entryMarkers(entry);

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{entryTypeLabel(entry.type, entry.typeLabel)}</Badge>
          <StatusBadge status={entry.status} />
          {markers.map((marker) => (
            <Badge key={marker} tone={marker === "Reversed" ? "neutral" : "info"}>
              {marker}
            </Badge>
          ))}
        </div>
        <h1 tabIndex={-1} className="mt-3 text-3xl break-words md:text-4xl">
          {entry.description || entryTypeLabel(entry.type, entry.typeLabel)}
        </h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <SignedAmount amount={entry.amount} currency={entry.currency} direction={entry.direction} className="text-2xl font-bold tabular-nums text-ink" />
          <DirectionTag direction={entry.direction} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {formatDay(entry.effectiveDate)}
          {entry.author ? ` · recorded by ${entry.author.id === user.id ? "you" : entry.author.name}` : ""}
          {entry.recordedAt ? ` · ${formatWhen(entry.recordedAt)}` : ""}
        </p>
      </header>

      {notice && <Alert tone="success" title={notice} />}

      {entry.tenancyId && (
        <Alert tone="info" title={rentReceipt ? "Rent received for a tenancy" : "Linked to a tenancy"}>
          {rentReceipt && "Reversing this entry undoes the payment on the tenancy: the rent it paid shows as outstanding again. To change the figure, reverse it and record the payment again on the tenancy. "}
          <Link href={tenancyHref(entry.tenancyId, org)} className={linkClass}>
            Open the tenancy
          </Link>
        </Alert>
      )}

      {entry.reversed_by && (
        <Alert tone="info" title="This entry was reversed">
          It stays in your books for the record. The reversal cancels it out in every total.
        </Alert>
      )}

      {related.length > 0 && (
        <section aria-labelledby="entry-related">
          <h2 id="entry-related" className="text-lg">
            Linked entries
          </h2>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line">
            {related.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <Link href={entryHref(item.id, org)} className={`min-w-0 break-words ${linkClass}`}>
                  {relationWords(entry, item)}: {item.description || entryTypeLabel(item.type, item.typeLabel)}
                </Link>
                <span className="text-sm text-muted">{formatDay(item.effectiveDate)}</span>
                <SignedAmount amount={item.amount} currency={item.currency} direction={item.direction} className="ml-auto text-sm font-semibold tabular-nums text-ink" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {related.length === 0 && relations.length > 0 && (
        <nav aria-label="Linked entries">
          <ul className="flex flex-col gap-2">
            {relations.map((relation) => (
              <li key={`${relation.kind}-${relation.id}`}>
                <Link href={entryHref(relation.id, org)} className={`inline-flex min-h-11 items-center gap-2 ${linkClass}`}>
                  <Link2 className="size-4" aria-hidden="true" />
                  {relation.words}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          <Card>
            <h2 className="text-xl">Details</h2>
            <dl className="mt-4 space-y-3">
              <Detail label="Amount">
                <SignedAmount amount={entry.amount} currency={entry.currency} direction={entry.direction} />
              </Detail>
              <Detail label="Category">{entry.category ? categoryWords(categories, entry.category, entry.categoryLabel) : "None"}</Detail>
              <Detail label="Method">{entry.method ? methodLabel(entry.method, entry.methodLabel) : "—"}</Detail>
              {entry.branch && <Detail label="Branch">{entry.branch}</Detail>}
              <Detail label="Reference">{entry.reference || "None"}</Detail>
              <Detail label="Contact">
                {entry.contact ? (
                  <Link href={contactHref(entry.contact.id, org)} className={linkClass}>
                    {entry.contact.label || "Open the contact"}
                  </Link>
                ) : (
                  "None"
                )}
              </Detail>
              <Detail label="Listing">
                {entry.listing ? (
                  <Link href={`/agent/listings/${encodeURIComponent(entry.listing.id)}`} className={linkClass}>
                    {entry.listing.label || entry.listing.reference || "Open the listing"}
                  </Link>
                ) : (
                  "None"
                )}
              </Detail>
              {entry.reason && <Detail label="Reason given">{entry.reason}</Detail>}
            </dl>
          </Card>

          {correcting && (
            <Card>
              <h2 className="text-xl">Correct this entry</h2>
              <div className="mt-4">
                <EntryEditor
                  org={org}
                  mode="correct"
                  initial={formFromEntry(entry)}
                  contactLabel={entry.contact?.label}
                  currencies={currencies}
                  submitLabel="Save the correction"
                  busyLabel="Saving the correction…"
                  send={(body) => correctEntry(org, entry.id, body)}
                  onSent={(data) => {
                    setCorrecting(false);
                    const next = primaryEntryId(data);
                    if (next && next !== entry.id) router.push(entryHref(next, org));
                    else {
                      setNotice("Corrected. The original and its reversal stay in your books.");
                      reload();
                    }
                  }}
                  onCancel={() => setCorrecting(false)}
                />
              </div>
            </Card>
          )}

          <Card>
            <Attachments entry={entry} org={org} writer={canAttach} onChanged={reload} />
          </Card>
          <Card>
            <Notes entry={entry} org={org} writer={canNote} onChanged={reload} />
          </Card>
          <Card>
            <History entry={entry} related={related} org={org} />
          </Card>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Actions">
          <Card>
            <Reconcile entry={entry} org={org} allowed={reconcilable} onChanged={reload} />
          </Card>
          {settlement && (
            <Card>
              <h2 className="text-lg">{entry.type === "RECEIVABLE" ? "Payment received" : "Payment made"}</h2>
              <p className="mt-2 text-sm text-muted">
                Record the money that {entry.type === "RECEIVABLE" ? "came in" : "went out"} against this amount owed. What is still open shows in the receivables report.
              </p>
              <ButtonLink href={booksPath("/new", org, { settles: entry.id })} variant="secondary" className="mt-3">
                Record a payment against it
              </ButtonLink>
            </Card>
          )}
          {correctable && !correcting && (
            <Card>
              <h2 className="text-lg">Correct</h2>
              <p className="mt-2 text-sm text-muted">Opens this entry&rsquo;s figures to change. The original stays, a reversal of it is recorded, and the corrected entry is linked to both.</p>
              <Button variant="secondary" className="mt-3" onClick={() => setCorrecting(true)}>
                Correct the entry
              </Button>
            </Card>
          )}
          {reversible && (
            <Card>
              <Reverse
                entry={entry}
                org={org}
                onReversed={(reversalId) => {
                  setNotice("Reversed. Both entries stay in your books.");
                  if (reversalId) router.push(entryHref(reversalId, org));
                  else reload();
                }}
              />
            </Card>
          )}
          {!reversible && !correctable && writer && !entry.reversed_by && entry.type !== "REVERSAL" && (
            <p className="text-sm text-muted">
              {entry.status === STATUS_RECONCILED
                ? "This entry is reconciled. The Agency Principal or a Manager can reverse or correct it."
                : "Only the person who recorded it, the Agency Principal or a Manager can reverse or correct this entry."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** `/agent/books/<id>`: one entry, its links, actions, attachments, notes and history. */
export function EntryDetail({ id, currencies }: { id: string; currencies: SelectOption[] }) {
  return (
    <BooksShell path={`/${id}`} section="other" back={{ href: (org) => booksPath("", org), label: "Books" }}>
      {(organisation, user) => <EntryPage id={id} organisation={organisation} user={user} currencies={currencies} />}
    </BooksShell>
  );
}
