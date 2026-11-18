"use client";

import { CircleAlert, X } from "lucide-react";

type Props = {
  /** The message to show; null shows nothing. A new message replaces the one on screen. */
  message: string | null;
  onDismiss: () => void;
};

/**
 * A short message about an action taken somewhere on the page that did not
 * go through, such as saving a property from a card. It sits at the bottom
 * of the screen, stays until it is dismissed or replaced (it never times
 * out), and is announced by screen readers. The live region is always in the
 * page so the message is read when it appears.
 */
export function Toast({ message, onDismiss }: Props) {
  return (
    <div
      role="alert"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {message && (
        <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line-strong border-l-4 border-l-danger bg-surface py-2 pl-3 pr-1 text-sm text-ink shadow-lg">
          <CircleAlert className="mt-2.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="flex-1 py-2">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
