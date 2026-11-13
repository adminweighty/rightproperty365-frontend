"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { dealLabels, type Listing } from "@/lib/data/listings";
import { formatMoney } from "@/lib/format";

gsap.registerPlugin(useGSAP);

const INTERVAL_MS = 4500;

/**
 * The hero's rotating showcase of featured listings. Slides cross-fade every
 * few seconds. Rotation pauses on hover and focus, stops for good once the
 * visitor picks a slide, and never starts under reduced motion; the dots
 * always work.
 */
export function HeroSpotlight({ listings }: { listings: Listing[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (held || stopped) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % listings.length),
      INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [held, stopped, listings.length]);

  useGSAP(
    () => {
      gsap.to("[data-slide]", {
        autoAlpha: (index) => (index === active ? 1 : 0),
        scale: (index) => (index === active ? 1 : 1.06),
        duration: 0.9,
        ease: "power2.out",
        overwrite: true,
      });
      gsap.fromTo(
        `[data-caption="${active}"]`,
        { y: 16, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, delay: 0.15, ease: "power3.out" },
      );
    },
    { scope: root, dependencies: [active] },
  );

  return (
    <div
      ref={root}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-deep shadow-lg ring-1 ring-white/20">
        {listings.map((listing, index) => (
          <div
            key={listing.id}
            data-slide
            aria-hidden={index !== active}
            className={cn("absolute inset-0", index !== 0 && "invisible opacity-0")}
          >
            <Image
              src={listing.image.src}
              alt={listing.image.alt}
              fill
              sizes="(min-width: 1024px) 560px, 0px"
              placeholder="blur"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              className="object-cover"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-brand-deep/90 via-transparent to-transparent" />
            <Link
              href={`/listings/${listing.slug}`}
              tabIndex={index === active ? undefined : -1}
              data-caption={index}
              className="absolute inset-x-0 bottom-0 block p-5 text-on-brand hover:underline"
            >
              <span className="inline-block rounded-full bg-brand-accent px-2.5 py-0.5 text-xs font-bold text-brand-deep">
                {dealLabels[listing.deal]}
              </span>
              <span className="mt-2 block text-3xl font-bold tabular-nums">
                {formatMoney(listing.price)}
                {listing.pricePeriod && <span className="text-base font-medium"> per month</span>}
              </span>
              <span className="mt-1 block font-medium">{listing.title}</span>
              <span className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
                <MapPin className="size-4" aria-hidden="true" />
                {listing.suburb}, {listing.city}
              </span>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-1" role="group" aria-label="Featured properties">
        {listings.map((listing, index) => (
          <button
            key={listing.id}
            type="button"
            aria-label={`Show ${listing.title}`}
            aria-current={index === active}
            onClick={() => {
              setStopped(true);
              setActive(index);
            }}
            className="flex size-8 items-center justify-center"
          >
            <span
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === active ? "w-7 bg-brand-accent" : "w-1.5 bg-white/50",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
