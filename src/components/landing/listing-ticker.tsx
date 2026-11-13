"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Listing } from "@/lib/data/listings";
import { formatMoney } from "@/lib/format";

gsap.registerPlugin(useGSAP);

function Items({ listings, hidden }: { listings: Listing[]; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center">
      {listings.map((listing) => (
        <li key={listing.id} className="flex items-center whitespace-nowrap">
          <Link
            href={`/listings/${listing.slug}`}
            tabIndex={hidden ? -1 : undefined}
            className="flex items-center gap-2 px-5 py-3 text-sm hover:underline"
          >
            <span className="font-bold tabular-nums text-brand-accent">
              {formatMoney(listing.price)}
              {listing.pricePeriod && <span className="font-medium"> /mo</span>}
            </span>
            <span>{listing.title}</span>
            <span className="opacity-70">
              {listing.suburb}, {listing.city}
            </span>
          </Link>
          <span aria-hidden="true" className="size-1 rounded-full bg-brand-accent" />
        </li>
      ))}
    </ul>
  );
}

/**
 * A slow, continuous strip of the newest listings. The list is rendered twice
 * so the loop is seamless; the copy is hidden from assistive technology and
 * the tab order. It pauses on hover and focus and has a pause button (moving
 * content must be pausable). With reduced motion it does not move at all and
 * becomes an ordinary scrollable row.
 */
export function ListingTicker({ listings }: { listings: Listing[] }) {
  const root = useRef<HTMLDivElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const [paused, setPaused] = useState(false);
  const [animated, setAnimated] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        setAnimated(true);
        tween.current = gsap.to("[data-track]", {
          xPercent: -50,
          duration: listings.length * 6,
          ease: "none",
          repeat: -1,
        });
        return () => {
          tween.current = null;
          setAnimated(false);
        };
      });
    },
    { scope: root },
  );

  const hold = () => tween.current?.pause();
  const release = () => {
    if (!paused) tween.current?.resume();
  };

  function toggle() {
    const next = !paused;
    setPaused(next);
    if (next) tween.current?.pause();
    else tween.current?.resume();
  }

  return (
    <div ref={root} className="flex items-stretch bg-brand-deep text-on-brand">
      <p className="z-10 flex shrink-0 items-center gap-2 bg-brand-accent px-4 text-sm font-bold text-brand-deep">
        <span aria-hidden="true" className="size-2 rounded-full bg-brand-deep" />
        Just listed
      </p>
      <div
        className={animated ? "overflow-hidden" : "overflow-x-auto"}
        onMouseEnter={hold}
        onMouseLeave={release}
        onFocus={hold}
        onBlur={release}
      >
        <div data-track className="flex w-max">
          <Items listings={listings} />
          {animated && <Items listings={listings} hidden />}
        </div>
      </div>
      {animated && (
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? "Play the just listed ticker" : "Pause the just listed ticker"}
          className="ml-auto flex w-12 shrink-0 items-center justify-center border-l border-white/15 hover:bg-white/10"
        >
          {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
