"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Keep animations on wall-clock time. By default GSAP stretches them when
// frames are slow, which on a busy or low-end phone would leave content that
// starts hidden invisible for seconds.
gsap.ticker.lagSmoothing(0);

/**
 * Adds entrance and scroll animation to the server-rendered content inside
 * it. Children opt in with data attributes, so the markup stays in Server
 * Components and remains complete without JavaScript:
 *
 *   data-hero          fades up in sequence when the page loads
 *   data-reveal        fades up when scrolled into view
 *   data-reveal-group  its direct children fade up one after another
 *   data-parallax      drifts slowly while its section scrolls past
 *   data-float         bobs gently (decorative cards)
 *
 * The matching "start hidden" rules live in globals.css and apply only when
 * scripting is on and the visitor has not asked for reduced motion. With
 * reduced motion nothing is hidden and nothing moves.
 */
export function PageMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const select = gsap.utils.selector(scope);
        const rise = { opacity: 0, y: 28 };
        const settle = { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" };

        gsap.fromTo(select("[data-hero]"), rise, { ...settle, stagger: 0.09, delay: 0.1 });

        for (const element of select("[data-reveal]")) {
          gsap.fromTo(element, rise, {
            ...settle,
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        }

        for (const group of select("[data-reveal-group]")) {
          gsap.fromTo(group.children, rise, {
            ...settle,
            duration: 0.7,
            stagger: 0.08,
            scrollTrigger: { trigger: group, start: "top 85%", once: true },
          });
        }

        for (const element of select("[data-parallax]")) {
          gsap.to(element, {
            yPercent: 12,
            ease: "none",
            scrollTrigger: {
              trigger: element.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });
        }

        select("[data-float]").forEach((element, index) => {
          gsap.to(element, {
            y: index % 2 === 0 ? -10 : 10,
            duration: 3 + index * 0.4,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
        });
      });
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
