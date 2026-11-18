"use client";

import { Heart } from "lucide-react";
import { useSavedListings } from "@/components/listings/saved-listings-provider";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = {
  listingId: string;
  /** Read with the label by screen readers: "Save 3-bedroom house in Borrowdale". */
  title: string;
  /**
   * "overlay": a round 44px icon button on a card's photo. "inline": a
   * secondary button with the word beside the heart (the listing page).
   */
  variant?: "overlay" | "inline";
  className?: string;
};

/**
 * The heart that saves a listing. It starts empty on every render from the
 * server (pages are cached and the same for everyone) and fills in once the
 * browser knows what the signed-in person saved. Signed out, pressing it goes
 * to sign-in and back to this page. Not shown to administrator sessions,
 * which cannot save.
 */
export function SaveListingButton({ listingId, title, variant = "overlay", className }: Props) {
  const { canSave, isSaved, toggle } = useSavedListings();
  if (!canSave) return null;

  const saved = isSaved(listingId);
  const word = saved ? "Saved" : "Save";
  const icon = (
    <Heart
      className={cn("size-5 shrink-0", saved ? "fill-current text-primary" : "text-ink")}
      strokeWidth={2}
      aria-hidden="true"
    />
  );

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggle({ id: listingId, title })}
      className={
        variant === "overlay"
          ? cn(
              "flex size-11 items-center justify-center rounded-full border border-line bg-surface shadow-xs transition-colors hover:bg-sunken",
              className,
            )
          : buttonClasses("secondary", "md", className)
      }
    >
      {icon}
      {variant === "overlay" ? (
        <span className="sr-only">
          {word} {title}
        </span>
      ) : (
        <>
          <span>{word}</span>
          <span className="sr-only"> {title}</span>
        </>
      )}
    </button>
  );
}
