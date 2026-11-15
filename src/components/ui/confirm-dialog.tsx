"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  /** The words while the action runs: "Deleting…". */
  busyLabel?: string;
  cancelLabel?: string;
  /** `danger` for an action that removes something or takes it offline. */
  tone?: "danger" | "primary";
  busy?: boolean;
  /** The API's message when the action failed; the dialog stays open. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks before an action that cannot be undone or takes something offline.
 *
 * A native `<dialog>` opened with `showModal()`: the browser keeps focus
 * inside it, makes the page behind it inert, closes it on Escape and returns
 * focus to the button that opened it. Focus starts on the safe choice
 * ("Cancel"), so Enter never deletes by accident.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={children ? bodyId : undefined}
      onCancel={(event) => {
        // Escape: closing is the parent's decision, so the state stays true to the screen.
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-overlay"
    >
      <h2 id={titleId} className="font-sans text-xl font-semibold tracking-normal">
        {title}
      </h2>
      {children && (
        <div id={bodyId} className="mt-2 leading-relaxed text-muted">
          {children}
        </div>
      )}
      {error && <Alert title={error} className="mt-4" />}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
