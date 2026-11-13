"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { dealLabels, type Listing } from "@/lib/data/listings";
import { formatMoney } from "@/lib/format";

gsap.registerPlugin(useGSAP);

const INTERVAL_MS = 6000;
const MOTION_OK = "(prefers-reduced-motion: no-preference)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(MOTION_OK);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Full-bleed hero background: featured listing photos that cross-fade with a
 * slow zoom, plus a caption card for the property on screen. It fills its
 * positioned parent. Rotation pauses on hover and focus of the caption, has a
 * pause button, stops once the visitor picks a slide, and never starts under
 * reduced motion (the first photo is then a still).
 */
export function HeroBackdrop({ listings }: { listings: Listing[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  // False on the server and under reduced motion, so the first photo is a still.
  const canAnimate = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(MOTION_OK).matches,
    () => false,
  );

  useEffect(() => {
    if (!canAnimate || held || paused) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % listings.length),
      INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [canAnimate, held, paused, listings.length]);

  useGSAP(
    () => {
      gsap.to("[data-slide]", {
        autoAlpha: (index) => (index === active ? 1 : 0),
        duration: 1.4,
        ease: "power2.inOut",
        overwrite: "auto",
      });
      if (canAnimate) {
        // Slow push-in on the photo that is showing.
        gsap.fromTo(
          `[data-slide="${active}"] img`,
          { scale: 1.02 },
          { scale: 1.14, duration: INTERVAL_MS / 1000 + 2, ease: "none", overwrite: "auto" },
        );
        gsap.fromTo(
          "[data-caption]",
          { y: 14, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" },
        );
        if (paused) gsap.set("[data-timer]", { scaleX: 1, overwrite: true });
        else {
          gsap.fromTo(
            "[data-timer]",
            { scaleX: 0 },
            { scaleX: 1, duration: INTERVAL_MS / 1000, ease: "none", overwrite: "auto" },
          );
        }
      }
    },
    { scope: root, dependencies: [active, canAnimate, paused] },
  );

  const listing = listings[active];

  return (
    <div ref={root} className="absolute inset-0 -z-10">
      {listings.map((slide, index) => (
        <div
          key={slide.id}
          data-slide={index}
          className={cn("absolute inset-0 overflow-hidden", index !== 0 && "invisible opacity-0")}
        >
          <Image
            src={slide.image.src}
            alt=""
            fill
            sizes="100vw"
            placeholder="blur"
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : undefined}
            className="object-cover"
          />
        </div>
      ))}

      {/* Indigo scrims keep white text readable over any photo. */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-brand-deep/95 via-brand-deep/55 to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-brand-deep/90 via-transparent to-brand-deep/55" />

      <div
        className="absolute bottom-28 right-4 z-10 hidden w-80 md:right-8 lg:block"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        <Link
          data-caption
          href={`/listings/${listing.slug}`}
          className="group block rounded-lg border border-white/20 bg-white/10 p-4 text-on-brand backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-brand-accent px-2.5 py-0.5 text-xs font-bold text-brand-deep">
              {dealLabels[listing.deal]}
            </span>
            <ArrowUpRight className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="mt-3 block text-2xl font-bold tabular-nums">
            {formatMoney(listing.price)}
            {listing.pricePeriod && <span className="text-sm font-medium"> per month</span>}
          </span>
          <span className="mt-1 block font-medium">{listing.title}</span>
          <span className="block text-sm opacity-85">
            {listing.suburb}, {listing.city}
          </span>
        </Link>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5" role="group" aria-label="Featured property photos">
            {listings.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show ${slide.title}`}
                aria-current={index === active}
                onClick={() => {
                  setPaused(true);
                  setActive(index);
                }}
                className="group flex h-8 flex-1 items-center"
              >
                <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-white/30">
                  <span
                    data-timer={index === active ? "" : undefined}
                    className={cn(
                      "absolute inset-0 origin-left bg-brand-accent",
                      index === active && !canAnimate ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              </button>
            ))}
          </div>
          {canAnimate && (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Play the photo slideshow" : "Pause the photo slideshow"}
              className="flex size-8 items-center justify-center rounded-full border border-white/30 text-on-brand hover:bg-white/15"
            >
              {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
