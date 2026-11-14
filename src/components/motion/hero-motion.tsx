"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { DURATION, EASE, gsap, MOTION_OK, STAGGER, useGSAP, useWasHydrated } from "@/components/motion/gsap";

type Props = HTMLAttributes<HTMLElement> & { children: ReactNode };

/**
 * The landing page's hero `section`, with motion on what surrounds its
 * heading and photograph rather than on them:
 *
 *   - the frame marked `data-hero-photo` drifts down more slowly than the
 *     page as it is scrolled (parallax) and settles with a very slow zoom.
 *     Both are transforms on the frame; the photograph inside is painted as
 *     soon as it loads and is never hidden.
 *   - elements marked `data-hero-item` rise in one after another, but only
 *     when the page was reached by a client-side navigation. On a first load
 *     they are already on screen and stay as they are; the white panel has
 *     its own transform-only entrance in CSS (`enter-rise`).
 *
 * The `h1` is never one of the items.
 */
export function HeroMotion({ children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  const wasHydrated = useWasHydrated();

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const media = gsap.matchMedia();
      media.add(MOTION_OK, () => {
        const photo = root.querySelector("[data-hero-photo]");
        if (photo) {
          gsap.to(photo, {
            yPercent: 6,
            ease: "none",
            // From the top of the page (the hero sits just under the header) until the hero has left the screen.
            scrollTrigger: { trigger: root, start: "clamp(top bottom)", end: "bottom top", scrub: true },
          });
          gsap.to(photo, { scale: 1.04, duration: 8, ease: "power1.out" });
        }
        const items = root.querySelectorAll("[data-hero-item]");
        if (!wasHydrated.current && items.length > 0) {
          const entrance = gsap.from(items, {
            opacity: 0,
            y: 12,
            duration: DURATION.enter,
            ease: EASE,
            stagger: STAGGER,
            delay: 0.1,
            clearProps: "opacity,transform",
          });
          // Someone who is already in the search form does not wait for it.
          const finish = () => entrance.progress(1);
          root.addEventListener("focusin", finish);
          return () => root.removeEventListener("focusin", finish);
        }
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} {...rest}>
      {children}
    </section>
  );
}
