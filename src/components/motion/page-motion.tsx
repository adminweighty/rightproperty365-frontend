"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

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
 *   data-split         headline revealed word by word (on load inside the
 *                      hero, otherwise when scrolled into view)
 *   data-reveal        fades up when scrolled into view
 *   data-reveal-group  its direct children fade up one after another
 *   data-reveal-clip   photo wipes in from the bottom when scrolled into view
 *   data-parallax      drifts slowly while its section scrolls past
 *   data-float         bobs gently (decorative chips)
 *   data-magnetic      leans towards the pointer (mouse only)
 *
 * It also draws the scroll progress bar. The matching "start hidden" rules
 * live in globals.css and apply only when scripting is on and the visitor has
 * not asked for reduced motion. With reduced motion nothing is hidden and
 * nothing moves.
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

        gsap.fromTo(select("[data-hero]"), rise, { ...settle, stagger: 0.09, delay: 0.35 });

        // Word-by-word headline reveal behind a line mask. SplitText keeps
        // the full text available to screen readers (aria: "auto") and
        // re-splits when fonts load or the width changes.
        for (const element of select("[data-split]")) {
          const inHero = element.closest("[data-overlay-hero]") !== null;
          SplitText.create(element, {
            type: "lines,words",
            mask: "lines",
            aria: "auto",
            autoSplit: true,
            onSplit: (split) => {
              gsap.set(element, { visibility: "visible" });
              return gsap.from(split.words, {
                yPercent: 110,
                duration: 0.9,
                ease: "power4.out",
                stagger: 0.045,
                delay: inHero ? 0.1 : 0,
                scrollTrigger: inHero ? undefined : { trigger: element, start: "top 88%", once: true },
              });
            },
          });
        }

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

        for (const element of select("[data-reveal-clip]")) {
          gsap.to(element, {
            clipPath: "inset(0% 0 0 0)",
            duration: 1.1,
            ease: "power4.inOut",
            scrollTrigger: { trigger: element, start: "top 85%", once: true },
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

        gsap.to(select("[data-progress]"), {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });
      });

      // Magnetic buttons only make sense with a mouse.
      media.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const select = gsap.utils.selector(scope);
        const cleanups = select("[data-magnetic]").map((element: HTMLElement) => {
          const moveX = gsap.quickTo(element, "x", { duration: 0.4, ease: "power3.out" });
          const moveY = gsap.quickTo(element, "y", { duration: 0.4, ease: "power3.out" });
          const onMove = (event: PointerEvent) => {
            const box = element.getBoundingClientRect();
            moveX((event.clientX - (box.left + box.width / 2)) * 0.3);
            moveY((event.clientY - (box.top + box.height / 2)) * 0.3);
          };
          const onLeave = () => {
            moveX(0);
            moveY(0);
          };
          element.addEventListener("pointermove", onMove);
          element.addEventListener("pointerleave", onLeave);
          return () => {
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerleave", onLeave);
          };
        });
        return () => cleanups.forEach((cleanup) => cleanup());
      });
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <div
        data-progress
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-0 bg-brand-accent"
      />
      {children}
    </div>
  );
}
