"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { dealLabels, type Listing } from "@/lib/data/listings";
import { formatMoney } from "@/lib/format";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The featured collection as large editorial cards. On desktop the section
 * pins while the page scrolls and the cards travel sideways (GSAP
 * ScrollTrigger). On touch screens, narrow screens and under reduced motion
 * it is an ordinary horizontally scrolling row.
 */
export function ShowcaseScroll({ listings, heading }: { listings: Listing[]; heading: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [pinned, setPinned] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
        const section = root.current;
        const row = track.current;
        if (!section || !row) return;
        setPinned(true);

        const distance = () => Math.max(0, row.scrollWidth - section.clientWidth);
        gsap.to(row, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            // Stop just under the sticky header.
            start: "top 65px",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        gsap.fromTo(
          "[data-showcase-progress]",
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 65px",
              end: () => `+=${distance()}`,
              scrub: 0.6,
            },
          },
        );
        return () => setPinned(false);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="overflow-hidden bg-brand-deep py-16 text-on-brand md:py-20">
      <div className="mx-auto w-full max-w-[75rem] px-4 md:px-8">
        {heading}
        <div aria-hidden="true" className="mt-8 hidden h-px bg-white/15 lg:block">
          <div data-showcase-progress className="h-px origin-left scale-x-0 bg-brand-accent" />
        </div>
      </div>

      <ul
        ref={track}
        tabIndex={pinned ? undefined : 0}
        role={pinned ? undefined : "region"}
        aria-label={pinned ? undefined : "Featured properties, scrollable"}
        className={cn(
          "mt-10 flex gap-6 px-4 md:px-8 lg:px-[max(2rem,calc((100vw-75rem)/2+2rem))]",
          pinned ? "w-max" : "snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:thin]",
        )}
      >
        {listings.map((listing, index) => (
          <li key={listing.id} className="w-[19rem] shrink-0 snap-start sm:w-[26rem] lg:w-[34rem]">
            <Link href={`/listings/${listing.slug}`} className="group block">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-brand">
                <Image
                  src={listing.image.src}
                  alt={listing.image.alt}
                  fill
                  sizes="(min-width: 1024px) 544px, (min-width: 640px) 416px, 304px"
                  placeholder="blur"
                  className="object-cover transition-transform duration-700 ease-standard group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-brand-accent px-3 py-1 text-xs font-bold text-brand-deep">
                  {dealLabels[listing.deal]}
                </span>
                <span className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white text-brand-deep opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ArrowUpRight className="size-5" aria-hidden="true" />
                </span>
              </span>
              <span className="mt-5 flex items-start gap-5">
                <span aria-hidden="true" className="text-5xl font-bold tabular-nums leading-none text-white/25">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold tabular-nums text-brand-accent md:text-3xl">
                    {formatMoney(listing.price)}
                    {listing.pricePeriod && <span className="text-sm font-medium"> per month</span>}
                  </span>
                  <span className="mt-1 block text-lg font-semibold group-hover:underline">{listing.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm opacity-85">
                    <MapPin className="size-4" aria-hidden="true" />
                    {listing.suburb}, {listing.city}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
