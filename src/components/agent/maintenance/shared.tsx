"use client";

import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { formatDay } from "@/components/agent/books/shared";
import { formatWhen } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { PrivateImage } from "@/components/ui/private-image";
import type { ApiResult } from "@/lib/api/http";
import { getMaintenanceOptions, photoSrc } from "@/lib/api/maintenance";
import { entryHref } from "@/lib/ledger";
import {
  actorWords,
  COMMENT_MAX,
  commentProblem,
  DEFAULT_PHOTO_RULES,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  maintenanceTimeline,
  megabytes,
  normaliseOptions,
  photoAccept,
  photoCountWords,
  photoTypeWords,
  priorityLabel,
  priorityTone,
  sortPhotos,
  timelineWords,
  type MaintenanceOptions,
  type MaintenancePhoto,
  type MaintenanceRequest,
  type PhotoRules,
} from "@/lib/maintenance";

/*
 * Pieces shared by the team's maintenance pages (`/agent/maintenance/*`, the
 * tenancy page's Maintenance section) and the tenant's (`/account/tenancies/<id>`):
 * the status and priority badges, the reference sets, the photo picker with
 * previews and upload progress, the photo gallery, the timeline and the
 * comment composer.
 */

export { formatDay };

export const sectionHeading = "font-sans text-xl font-semibold tracking-normal";

export function MaintenanceStatusBadge({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={maintenanceStatusTone(status)}>{maintenanceStatusLabel(status, label)}</Badge>;
}

/** The priority, in words (never colour alone). */
export function PriorityBadge({ priority, label }: { priority: string; label?: string | null }) {
  return (
    <Badge tone={priorityTone(priority)}>
      <span className="sr-only">Priority: </span>
      {priorityLabel(priority, label)}
    </Badge>
  );
}

const FALLBACK = normaliseOptions(null);

/**
 * The categories, priorities, transitions, currencies, methods and photo
 * rules: the book's (`GET /maintenance/options`, keyed by the book) or the
 * tenant's (`getMyMaintenanceOptions`, keyed by the tenancy). The seeded
 * defaults until (or when) the API answers otherwise. `read` must be stable.
 */
export function useMaintenanceOptions(key: string, read: (key: string) => Promise<ApiResult<MaintenanceOptions>> = getMaintenanceOptions): MaintenanceOptions {
  const load = useCallback(async (): Promise<ApiResult<MaintenanceOptions>> => {
    const answer = await read(key);
    return answer.ok ? answer : { ok: true, status: 200, data: FALLBACK };
  }, [key, read]);
  const { state } = useApi(load);
  return state.status === "ready" ? state.data : FALLBACK;
}

// ---- Choosing photos ------------------------------------------------------------------------------------

export type ChosenPhoto = { key: string; file: File; preview: string; progress: number | null; error: string | null; done: boolean };

/**
 * The photos chosen for a new request, with previews made in the browser.
 * The previews' object URLs are released when a photo is removed or the
 * form goes away.
 */
export function useChosenPhotos() {
  const [photos, setPhotos] = useState<ChosenPhoto[]>([]);
  const urls = useRef(new Set<string>());
  const next = useRef(0);

  useEffect(() => {
    const live = urls.current;
    return () => {
      for (const url of live) URL.revokeObjectURL(url);
      live.clear();
    };
  }, []);

  const add = useCallback((files: File[]) => {
    const made = files.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      next.current += 1;
      return { key: `photo-${next.current}`, file, preview, progress: null, error: null, done: false };
    });
    setPhotos((current) => [...current, ...made]);
  }, []);

  const remove = useCallback((key: string) => {
    setPhotos((current) => {
      const gone = current.find((item) => item.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        urls.current.delete(gone.preview);
      }
      return current.filter((item) => item.key !== key);
    });
  }, []);

  const update = useCallback((key: string, change: Partial<ChosenPhoto>) => {
    setPhotos((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  /** Forgets the photos already sent (after they show on the request). */
  const clearSent = useCallback(() => {
    setPhotos((current) => {
      for (const item of current) {
        if (item.done) {
          URL.revokeObjectURL(item.preview);
          urls.current.delete(item.preview);
        }
      }
      return current.filter((item) => !item.done);
    });
  }, []);

  return { photos, add, remove, update, clearSent };
}

/**
 * Sends the photos one after the other, showing each one's progress. Returns
 * the names of those that could not be sent (the request itself is saved).
 */
export async function uploadChosen(
  photos: readonly ChosenPhoto[],
  upload: (file: File, onProgress: (fraction: number) => void) => Promise<ApiResult<unknown>>,
  update: (key: string, change: Partial<ChosenPhoto>) => void,
): Promise<string[]> {
  const failed: string[] = [];
  for (const photo of photos) {
    if (photo.done) continue;
    update(photo.key, { progress: 0, error: null });
    const answer = await upload(photo.file, (fraction) => update(photo.key, { progress: fraction }));
    if (answer.ok) update(photo.key, { progress: 1, done: true });
    else {
      update(photo.key, { progress: null, error: answer.failure.message });
      failed.push(photo.file.name);
    }
  }
  return failed;
}

/**
 * "Add photos": a file input for images only (several at once), the
 * previews with a 44px "Remove" each, a count against the limit, and the
 * type and size problems in words. Each preview shows its upload progress
 * once the form is sent.
 */
export function PhotoPicker({
  id,
  photos,
  onAdd,
  onRemove,
  disabled,
  already = 0,
  rules = DEFAULT_PHOTO_RULES,
  legend = "Photos",
}: {
  id: string;
  photos: ChosenPhoto[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
  /** Photos the request already has. */
  already?: number;
  rules?: PhotoRules;
  legend?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const count = already + photos.filter((photo) => !photo.done).length;
  const full = count >= rules.maxPhotos;
  const hintId = `${id}-hint`;
  const problemsId = `${id}-problems`;

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const sorted = sortPhotos(files, count, rules);
    setProblems(sorted.problems);
    if (sorted.accepted.length) {
      onAdd(sorted.accepted);
      setAnnounce(`${sorted.accepted.length === 1 ? "1 photo" : `${sorted.accepted.length} photos`} added.`);
    }
  }

  return (
    <fieldset className="min-w-0 rounded-md border border-line p-4" aria-describedby={problems.length ? `${hintId} ${problemsId}` : hintId}>
      <legend className="px-1 text-sm font-medium text-ink">
        {legend} <span className="font-normal text-subtle">(optional)</span>
      </legend>
      <p id={hintId} className="text-sm text-muted">
        {photoTypeWords(rules)}, up to {megabytes(rules.maxBytes)} each. {photoCountWords(count, rules.maxPhotos)}. Kept private: only the
        people who manage the property and the tenant see them, and location and camera details are removed.
      </p>
      {problems.length > 0 && (
        <ul id={problemsId} role="alert" className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Photos chosen">
          {photos.map((photo) => (
            <li key={photo.key} className="min-w-0 rounded-md border border-line bg-sunken p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a preview of a file on this device: there is nothing for next/image to optimise */}
              <img src={photo.preview} alt={`Preview of ${photo.file.name}`} className="aspect-[4/3] w-full rounded object-cover" />
              <div className="mt-2 flex items-start justify-between gap-1">
                <span className="min-w-0 text-xs break-all text-ink">{photo.file.name}</span>
                {!photo.done && photo.progress === null && (
                  <Button
                    variant="ghost"
                    className="w-11 shrink-0 px-0"
                    disabled={disabled}
                    aria-label={`Remove photo ${photo.file.name}`}
                    onClick={() => {
                      onRemove(photo.key);
                      setAnnounce(`${photo.file.name} removed.`);
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {photo.progress !== null && !photo.done && (
                <>
                  <progress className="mt-1 h-2 w-full accent-primary" max={1} value={photo.progress} aria-label={`Uploading ${photo.file.name}`} />
                  <p className="text-xs text-muted tabular-nums">{Math.round(photo.progress * 100)}%</p>
                </>
              )}
              {photo.done && <p className="mt-1 text-xs font-medium text-success">Sent</p>}
              {photo.error && <p className="mt-1 text-xs text-danger">{photo.error}</p>}
            </li>
          ))}
        </ul>
      )}
      <input ref={input} id={id} type="file" accept={photoAccept(rules)} multiple className="sr-only" tabIndex={-1} onChange={choose} />
      <Button variant="secondary" className="mt-3" onClick={() => input.current?.click()} disabled={disabled || full}>
        <ImagePlus className="size-4" aria-hidden="true" />
        {full ? "Photo limit reached" : "Add photos"}
      </Button>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </fieldset>
  );
}

/**
 * "Add photos" on an existing request: choose, preview, send, each with its
 * progress; the request is read again once they are sent.
 */
export function AddPhotos({
  id,
  already,
  rules,
  upload,
  onSent,
}: {
  id: string;
  already: number;
  rules: PhotoRules;
  upload: (file: File, onProgress: (fraction: number) => void) => Promise<ApiResult<unknown>>;
  onSent: () => void;
}) {
  const chosen = useChosenPhotos();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const waiting = chosen.photos.filter((photo) => !photo.done);

  async function send() {
    setBusy(true);
    const names = await uploadChosen(waiting, upload, chosen.update);
    setBusy(false);
    setFailed(names);
    if (names.length < waiting.length) onSent();
    chosen.clearSent();
  }

  return (
    <div className="mt-4 grid gap-3">
      <PhotoPicker id={id} photos={chosen.photos} onAdd={chosen.add} onRemove={chosen.remove} disabled={busy} already={already} rules={rules} legend="Add photos" />
      {waiting.length > 0 && (
        <div>
          <Button onClick={() => void send()} disabled={busy} aria-busy={busy}>
            {busy ? "Sending…" : waiting.length === 1 ? "Send 1 photo" : `Send ${waiting.length} photos`}
          </Button>
        </div>
      )}
      <div aria-live="polite">{failed.length > 0 && <Alert title={`Not sent: ${failed.join(", ")}.`}>Try again, or remove them.</Alert>}</div>
    </div>
  );
}

// ---- Showing photos ---------------------------------------------------------------------------------------

/** The request's photos, each read with the session (private storage, re-encoded without metadata). */
export function PhotoGallery({ photos, title = "Photos", children }: { photos: MaintenancePhoto[]; title?: string; children?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const shownIndex = photos.findIndex((photo) => photo.id === open);
  const shown = shownIndex >= 0 ? photos[shownIndex] : null;
  const shownSrc = shown ? photoSrc(shown.url) : null;
  return (
    <section aria-labelledby="request-photos">
      <h2 id="request-photos" className={sectionHeading}>
        {title}
      </h2>
      {photos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No photos yet.</p>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => {
              const src = photoSrc(photo.url);
              const alt = `Photo ${index + 1}${photo.uploadedBy ? `, added by ${photo.uploadedBy}` : ""}`;
              return (
                <li key={photo.id} className="min-w-0">
                  {src ? (
                    <button
                      type="button"
                      className="block min-h-11 w-full rounded-md"
                      aria-expanded={open === photo.id}
                      aria-controls="request-photo-large"
                      onClick={() => setOpen(open === photo.id ? null : photo.id)}
                    >
                      <span className="sr-only">{open === photo.id ? "Hide the larger view of " : "Show a larger view of "}</span>
                      <PrivateImage src={src} alt={alt} className="aspect-[4/3] w-full" />
                    </button>
                  ) : (
                    <span className="block p-2 text-xs text-muted">{alt}</span>
                  )}
                  {photo.uploadedAt && <p className="mt-1 text-xs text-muted">{formatWhen(photo.uploadedAt)}</p>}
                </li>
              );
            })}
          </ul>
          <div id="request-photo-large">
            {shown && shownSrc && (
              <figure className="mt-4">
                <PrivateImage src={shownSrc} alt={`Photo ${shownIndex + 1}, larger`} className="max-h-[32rem] w-full" />
                <figcaption className="mt-1 text-xs text-muted">
                  Photo {shownIndex + 1} of {photos.length}
                  {shown.uploadedBy && ` · added by ${shown.uploadedBy}`}
                </figcaption>
              </figure>
            )}
          </div>
        </>
      )}
      {children}
    </section>
  );
}

// ---- The timeline ---------------------------------------------------------------------------------------

/**
 * Status changes, comments, the assignment, costs and photos, oldest first.
 * `org` (the team's view) links a cost to its book entry and marks internal
 * notes; the tenant sees no ledger links, and the API never sends them
 * internal comments or costs.
 */
export function RequestTimeline({ request, org }: { request: MaintenanceRequest; org?: string }) {
  const items = maintenanceTimeline(request);
  const costs = new Map(request.costs.map((cost) => [cost.id, cost]));
  return (
    <section aria-labelledby="request-timeline">
      <h2 id="request-timeline" className={sectionHeading}>
        Timeline
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {items.map((item) => {
            const who = actorWords(item.actor, Boolean(org));
            const comment = item.type === "COMMENT";
            const cost = item.details?.costId ? costs.get(item.details.costId) : undefined;
            return (
              <li key={item.id} className="relative">
                <span
                  className={`absolute top-1.5 -left-[1.4rem] size-3 rounded-full border-2 border-surface ${comment ? "bg-accent" : "bg-primary"}`}
                  aria-hidden="true"
                />
                <p className="font-medium break-words text-ink">
                  {comment ? `${who ?? "Someone"} ${item.internal ? "wrote a note for the team" : "commented"}` : timelineWords(item)}
                  {item.internal && <Badge className="ml-2 align-middle">Team only</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {item.at && <time dateTime={item.at}>{formatWhen(item.at)}</time>}
                  {!comment && who && ` · by ${who}`}
                </p>
                {item.text && (
                  <p className={`mt-1 text-sm whitespace-pre-line break-words text-ink ${comment ? "rounded-md bg-sunken p-3" : ""}`}>
                    {!comment && <span className="text-muted">Note: </span>}
                    {item.text}
                  </p>
                )}
                {item.type === "ASSIGNED" && item.details?.enquiryReference && (
                  <p className="mt-1 text-sm text-muted">Business enquiry {item.details.enquiryReference} sent to the provider.</p>
                )}
                {item.type === "COST_ADDED" && item.details?.description && <p className="mt-1 text-sm break-words text-ink">{item.details.description}</p>}
                {org && cost?.ledgerEntryId && (
                  <p className="mt-1 text-sm">
                    <Link href={entryHref(cost.ledgerEntryId, org)} className="font-medium text-primary-ink hover:underline">
                      Open the book entry
                    </Link>
                    {cost.reversed && <span className="text-muted"> (reversed)</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---- Comments -------------------------------------------------------------------------------------------

/**
 * A comment box; `send` answers with the API's result. The timeline is read
 * again after a comment is added. `allowInternal` (the team's) adds "For the
 * team only", a note never shown to the tenant.
 */
export function CommentComposer({
  id,
  send,
  onSent,
  hint,
  allowInternal,
}: {
  id: string;
  send: (text: string, internal: boolean) => Promise<ApiResult<unknown>>;
  onSent: () => void;
  hint: string;
  allowInternal?: boolean;
}) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = commentProblem(text);
    setProblem(found ?? undefined);
    setSent(null);
    if (found) return;
    setBusy(true);
    setFailure(null);
    const answer = await send(text.trim(), allowInternal ? internal : false);
    setBusy(false);
    if (!answer.ok) {
      const field = answer.failure.fields?.text;
      if (field) setProblem(field);
      else setFailure({ message: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    setText("");
    setSent(internal ? "Note added for the team." : "Comment added.");
    setInternal(false);
    onSent();
  }

  const fullHint = `${hint} ${text.length} of ${COMMENT_MAX} characters.`;
  return (
    <Card>
      <h2 className={sectionHeading}>Add a comment</h2>
      <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
        <Field id={id} label="Comment" hint={fullHint} error={problem}>
          <Textarea
            id={id}
            rows={3}
            value={text}
            maxLength={COMMENT_MAX}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy(id, { hint: fullHint, error: problem })}
          />
        </Field>
        {allowInternal && (
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" className="size-5 accent-primary" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
            For the team only (the tenant never sees it)
          </label>
        )}
        <div>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Sending…" : internal ? "Add the note" : "Send the comment"}
          </Button>
        </div>
        <div aria-live="polite">
          {sent && <Alert tone="success" title={sent} />}
          {failure && <Alert title={failure.message} traceId={failure.traceId} />}
        </div>
      </form>
    </Card>
  );
}
