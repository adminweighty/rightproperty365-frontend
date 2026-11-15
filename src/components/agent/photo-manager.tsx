"use client";

import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ListingPhotoImage } from "@/components/agent/listing-photo-image";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/field";
import {
  deletePhoto,
  describePhoto,
  orderPhotos,
  uploadListingPhoto,
  type ManagedListing,
  type ManagedPhoto,
} from "@/lib/api/manage-listings";
import { cn } from "@/lib/cn";
import {
  ALT_MAX,
  moveItem,
  PHOTO_ACCEPT,
  photoCounter,
  photoDimensionsProblem,
  photoFileProblem,
  photoLimitMessage,
  splitByRoom,
} from "@/lib/listing-photos";

type Upload = {
  key: string;
  file: File;
  progress: number;
  status: "waiting" | "uploading" | "done" | "error";
  message?: string;
};

type Props = {
  listing: ManagedListing;
  editable: boolean;
  /** Every photo call answers with the whole listing: it becomes the page's listing. */
  onListing: (listing: ManagedListing) => void;
  /** Says a photo call failed because the listing changed state (it is read again). */
  onConflict: (message: string) => void;
};

let uploadKey = 0;

/** The pixel size of an image file, or null when the browser cannot read it (the API decides then). */
async function readSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

const CONFLICTS = new Set(["LISTING_IN_REVIEW", "LISTING_STATE_CONFLICT", "LISTING_CHANGED"]);

/**
 * The photos of a listing: add (drag and drop or the file picker, several at
 * once, uploaded one by one with progress), describe, put in order (buttons,
 * or drag and drop with a mouse) and delete. The first photo is the cover.
 * At most `photo_limit` (20) per property. Every change is saved at once.
 */
export function PhotoManager({ listing, editable, onListing, onConflict }: Props) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<ManagedPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const focusAfterMove = useRef<{ id: string; direction: "up" | "down" } | null>(null);
  const running = useRef(false);
  const queue = useRef<Upload[]>([]);
  // The latest listing for the upload loop, which outlives renders.
  const latest = useRef(listing);
  useEffect(() => {
    latest.current = listing;
  }, [listing]);

  const byId = new Map(listing.photos.map((photo) => [photo.id, photo]));
  const ids = order ?? listing.photos.map((photo) => photo.id);
  const photos = ids.map((id) => byId.get(id)).filter((photo): photo is ManagedPhoto => photo !== undefined);
  const inFlight = uploads.filter((upload) => upload.status === "waiting" || upload.status === "uploading").length;
  const counter = photoCounter(listing.photos.length, listing.photo_limit);
  const full = listing.photos.length + inFlight >= listing.photo_limit;

  // Keep focus on the photo that moved, on the button that still works.
  const orderKey = ids.join(",");
  useEffect(() => {
    const wish = focusAfterMove.current;
    if (!wish) return;
    focusAfterMove.current = null;
    const { id, direction } = wish;
    const wanted = document.getElementById(`photo-${id}-${direction}`) as HTMLButtonElement | null;
    const other = document.getElementById(`photo-${id}-${direction === "up" ? "down" : "up"}`) as HTMLButtonElement | null;
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [orderKey]);

  const update = (key: string, change: Partial<Upload>) =>
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...change } : upload)));

  async function runQueue() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length > 0) {
      const item = queue.current.shift()!;
      const size = await readSize(item.file);
      const tooSmall = size && photoDimensionsProblem(item.file.name, size.width, size.height);
      if (tooSmall) {
        update(item.key, { status: "error", message: tooSmall });
        setAnnouncement(tooSmall);
        continue;
      }
      update(item.key, { status: "uploading", progress: 0 });
      setAnnouncement(`Uploading ${item.file.name}.`);
      const result = await uploadListingPhoto(latest.current.id, item.file, (progress) =>
        update(item.key, { progress }),
      );
      if (result.ok) {
        update(item.key, { status: "done", progress: 1 });
        setAnnouncement(`${item.file.name} was added. ${photoCounter(result.data.listing.photos.length, result.data.listing.photo_limit).text}.`);
        latest.current = result.data.listing;
        onListing(result.data.listing);
        continue;
      }
      const message = result.failure.message;
      update(item.key, { status: "error", message });
      setAnnouncement(`${item.file.name} was not added. ${message}`);
      if (result.failure.code === "PHOTO_LIMIT_REACHED" || CONFLICTS.has(result.failure.code)) {
        // Nothing after it can be added either.
        const rest = queue.current.splice(0);
        setUploads((current) =>
          current.map((upload) =>
            rest.some((other) => other.key === upload.key)
              ? { ...upload, status: "error", message: result.failure.code === "PHOTO_LIMIT_REACHED" ? photoLimitMessage(listing.photo_limit) : message }
              : upload,
          ),
        );
        if (CONFLICTS.has(result.failure.code)) onConflict(message);
      }
    }
    running.current = false;
  }

  function addFiles(files: File[]) {
    if (!editable || files.length === 0) return;
    const checked = files.map((file) => ({ file, problem: photoFileProblem(file) }));
    const fine = checked.filter((entry) => !entry.problem).map((entry) => entry.file);
    const { take, over } = splitByRoom(fine, latest.current.photos.length + inFlight, latest.current.photo_limit);
    const items: Upload[] = checked.map(({ file, problem }) => {
      uploadKey += 1;
      const key = `upload-${uploadKey}`;
      if (problem) return { key, file, progress: 0, status: "error", message: problem };
      if (over.includes(file)) {
        return { key, file, progress: 0, status: "error", message: `Not added. ${photoLimitMessage(latest.current.photo_limit)}` };
      }
      return { key, file, progress: 0, status: "waiting" };
    });
    // Finished rows of earlier rounds make way for the new ones.
    setUploads((current) => [...current.filter((upload) => upload.status !== "done"), ...items]);
    const refused = items.length - take.length;
    setAnnouncement(
      take.length === 0
        ? "No photos were added. See the messages under the photos."
        : `${take.length === 1 ? "1 photo" : `${take.length} photos`} will be uploaded one by one.${refused > 0 ? ` ${refused} cannot be added.` : ""}`,
    );
    queue.current.push(...items.filter((item) => item.status === "waiting"));
    void runQueue();
  }

  async function move(index: number, to: number, focus?: "up" | "down") {
    const next = moveItem(ids, index, to);
    if (next.join() === ids.join()) return;
    setOrder(next);
    setOrderError(null);
    const id = ids[index];
    const position = next.indexOf(id) + 1;
    setAnnouncement(position === 1 ? `Photo moved to the first place. It is now the cover photo.` : `Photo moved to place ${position} of ${next.length}.`);
    if (focus) focusAfterMove.current = { id, direction: focus };
    const result = await orderPhotos(listing.id, next);
    if (result.ok) {
      onListing(result.data.listing);
      setOrder(null);
    } else {
      // Back to the order the API has.
      setOrder(null);
      setOrderError(`The new order was not saved. ${result.failure.message}`);
      if (CONFLICTS.has(result.failure.code)) onConflict(result.failure.message);
    }
  }

  function onDropFiles(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (dragFrom !== null) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(undefined);
    const result = await deletePhoto(listing.id, toDelete.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.failure.message);
      return;
    }
    onListing(result.data.listing);
    setAnnouncement("The photo was deleted.");
    setToDelete(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-semibold tabular-nums text-ink">{counter.text}</span>. The first photo is the cover. JPEG,
          PNG or WebP, up to 15 MB, at least 800 pixels on the longer side.
        </p>
      </div>

      {editable && (
        <div
          onDragOver={(event) => {
            if (dragFrom !== null || full) return;
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropFiles}
          className={cn(
            "mt-4 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-primary bg-primary-soft" : "border-line-strong bg-soft",
          )}
        >
          <ImagePlus className="size-8 text-primary-ink" aria-hidden="true" />
          {full && inFlight === 0 ? (
            <p className="font-medium text-ink">{photoLimitMessage(listing.photo_limit)} Delete one to add another.</p>
          ) : (
            <p className="text-ink">Drag photos here, or choose them from your device. You can choose several at once.</p>
          )}
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            disabled={full}
            aria-describedby={full ? `${inputId}-full` : undefined}
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose photos
          </Button>
          {full && (
            <p id={`${inputId}-full`} className="sr-only">
              {photoLimitMessage(listing.photo_limit)}
            </p>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {uploads.length > 0 && (
        <ul aria-label="Uploads" className="mt-4 space-y-2">
          {uploads.map((upload) => (
            <li
              key={upload.key}
              className={cn(
                "rounded-md border p-3 text-sm",
                upload.status === "error" ? "border-danger bg-danger-soft" : "border-line bg-surface",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all font-medium text-ink">{upload.file.name}</span>
                <span className={upload.status === "error" ? "text-danger" : "text-muted"}>
                  {upload.status === "waiting" && "Waiting"}
                  {upload.status === "uploading" && `Uploading… ${Math.round(upload.progress * 100)}%`}
                  {upload.status === "done" && "Added"}
                  {upload.status === "error" && "Not added"}
                </span>
              </div>
              {(upload.status === "uploading" || upload.status === "waiting") && (
                <progress
                  value={upload.status === "uploading" ? upload.progress : 0}
                  max={1}
                  aria-label={`Upload of ${upload.file.name}`}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-sunken [&::-webkit-progress-value]:bg-primary"
                />
              )}
              {upload.message && <p className="mt-1 text-danger">{upload.message}</p>}
            </li>
          ))}
        </ul>
      )}

      {orderError && <Alert title={orderError} className="mt-4" />}

      {photos.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong p-6 text-center text-muted">
          No photos yet. A listing needs at least one photo before it can be submitted.
        </p>
      ) : (
        <ol aria-label="Photos, in order" className="mt-6 grid gap-4 sm:grid-cols-2">
          {photos.map((photo, index) => (
            <PhotoItem
              key={photo.id}
              photo={photo}
              index={index}
              count={photos.length}
              listing={listing}
              editable={editable}
              dragging={dragFrom === index}
              onMove={(to, focus) => void move(index, to, focus)}
              onDelete={() => {
                setDeleteError(undefined);
                setToDelete(photo);
              }}
              onListing={onListing}
              onConflict={onConflict}
              onDragStart={() => setDragFrom(index)}
              onDragEnd={() => setDragFrom(null)}
              onDropHere={() => {
                if (dragFrom !== null && dragFrom !== index) void move(dragFrom, index);
                setDragFrom(null);
              }}
            />
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this photo?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        busy={deleting}
        error={deleteError}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        {toDelete && (
          <>
            <span className="mb-3 block aspect-[4/3] w-40 overflow-hidden rounded-md">
              <ListingPhotoImage photo={toDelete} size="small" listingPublic={listing.public} alt="" className="size-full" />
            </span>
            The photo is removed at once{listing.public && toDelete.status === "APPROVED" ? ", also from the public listing" : ""}. This
            cannot be undone.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function PhotoItem({
  photo,
  index,
  count,
  listing,
  editable,
  dragging,
  onMove,
  onDelete,
  onListing,
  onConflict,
  onDragStart,
  onDragEnd,
  onDropHere,
}: {
  photo: ManagedPhoto;
  index: number;
  count: number;
  listing: ManagedListing;
  editable: boolean;
  dragging: boolean;
  onMove: (to: number, focus?: "up" | "down") => void;
  onDelete: () => void;
  onListing: (listing: ManagedListing) => void;
  onConflict: (message: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
}) {
  const [alt, setAlt] = useState(photo.alt);
  const [saved, setSaved] = useState(photo.alt);
  const [state, setState] = useState<{ status: "idle" | "saving" | "saved" | "error"; message?: string }>({ status: "idle" });
  const [over, setOver] = useState(false);
  const altId = `photo-${photo.id}-alt`;
  const number = index + 1;

  // A description changed elsewhere (another save of the listing) is shown, unless one is being typed.
  if (photo.alt !== saved && alt === saved) {
    setSaved(photo.alt);
    setAlt(photo.alt);
  }

  async function saveAlt() {
    const value = alt.replace(/\s+/g, " ").trim();
    if (value === saved) return;
    if (value.length > ALT_MAX) {
      setState({ status: "error", message: `Keep the description to ${ALT_MAX} characters or fewer.` });
      return;
    }
    setState({ status: "saving" });
    const result = await describePhoto(listing.id, photo.id, value);
    if (result.ok) {
      setSaved(value);
      setAlt(value);
      setState({ status: "saved" });
      onListing(result.data.listing);
    } else {
      setState({ status: "error", message: result.failure.fields?.alt ?? result.failure.message });
      if (CONFLICTS.has(result.failure.code)) onConflict(result.failure.message);
    }
  }

  const missing = saved.trim() === "" && alt.trim() === "";
  const error = state.status === "error" ? state.message : missing ? "Describe this photo before you submit the listing." : undefined;
  const describedBy = error ? `${altId}-error` : `${altId}-hint`;

  return (
    <li
      draggable={editable}
      onDragStart={(event) => {
        // Only a drag that starts on the photo itself reorders; text fields keep their own dragging.
        if ((event.target as HTMLElement).closest("input, button")) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", photo.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        onDropHere();
      }}
      className={cn(
        "rounded-lg border bg-surface p-3 shadow-xs",
        over ? "border-primary" : missing || state.status === "error" ? "border-danger" : "border-line",
        dragging && "opacity-60",
        editable && "cursor-grab",
      )}
    >
      <div className="relative">
        <ListingPhotoImage
          photo={photo}
          size="small"
          listingPublic={listing.public}
          alt={saved || `Photo ${number}, not described yet`}
          className="aspect-[4/3] w-full rounded-md"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className="rounded-sm bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">{number}</span>
          {index === 0 && (
            <span className="flex items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
              <Star className="size-3" aria-hidden="true" />
              Cover photo
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {photo.status === "PENDING_REVIEW" && <Badge tone="info">Waiting for review</Badge>}
        {missing && <Badge tone="warning">Description needed</Badge>}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={altId} className="text-sm font-medium text-ink">
          Description of photo {number}
        </label>
        <Input
          id={altId}
          value={alt}
          maxLength={ALT_MAX}
          disabled={!editable}
          placeholder="For example: Living room with a fireplace"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => {
            setAlt(event.target.value);
            if (state.status !== "idle") setState({ status: "idle" });
          }}
          onBlur={() => void saveAlt()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveAlt();
            }
          }}
        />
        {error ? (
          <p id={`${altId}-error`} className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p id={`${altId}-hint`} className="text-sm text-muted">
            What the photo shows, for people who cannot see it.
          </p>
        )}
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted">
          {state.status === "saving" ? "Saving the description…" : state.status === "saved" ? "Description saved." : ""}
        </p>
      </div>

      {editable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            id={`photo-${photo.id}-up`}
            variant="secondary"
            disabled={index === 0}
            onClick={() => onMove(index - 1, "up")}
            aria-label={`Move photo ${number} up`}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
            Up
          </Button>
          <Button
            id={`photo-${photo.id}-down`}
            variant="secondary"
            disabled={index === count - 1}
            onClick={() => onMove(index + 1, "down")}
            aria-label={`Move photo ${number} down`}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            Down
          </Button>
          {index > 0 && (
            <Button variant="ghost" onClick={() => onMove(0, "down")} aria-label={`Make photo ${number} the cover photo`}>
              Make cover
            </Button>
          )}
          <Button variant="ghost" onClick={onDelete} aria-label={`Delete photo ${number}`} className="ml-auto text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}
