"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { ListingCard } from "@/components/listings/listing-card";
import type { Listing } from "@/lib/api/types";

type Props = {
  /** Names the scrolling region for assistive technology, e.g. "Just listed". */
  label: string;
  listings: Listing[];
  /** Ids to mark with a "New" badge. */
  newIds?: string[];
};

/**
 * A horizontally scrolling row of listing cards. It is a native scroll
 * container with scroll snapping, so touch, trackpad and keyboard scrolling
 * work without JavaScript; the arrow buttons are a convenience on top.
 */
export function ListingRail({ label, listings, newIds = [] }: Props) {
  const track = useRef<HTMLUListElement>(null);

  function scroll(direction: 1 | -1) {
    const element = track.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  const arrow =
    "hidden size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm transition-colors hover:bg-brand hover:text-on-brand md:flex";

  return (
    <div className="relative">
      <ul
        ref={track}
        tabIndex={0}
        role="region"
        aria-label={`${label}, scrollable`}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4 [scrollbar-width:thin] md:-mx-8 md:scroll-px-8 md:px-8"
      >
        {listings.map((listing) => (
          <li key={listing.id} className="flex w-[18.5rem] shrink-0 snap-start [&>article]:w-full sm:w-[21rem]">
            <ListingCard listing={listing} isNew={newIds.includes(listing.id)} />
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className={arrow} aria-label={`Scroll ${label} back`} onClick={() => scroll(-1)}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button type="button" className={arrow} aria-label={`Scroll ${label} forward`} onClick={() => scroll(1)}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
