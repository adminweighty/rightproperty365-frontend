"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useSyncExternalStore, type RefObject } from "react";

/*
 * The one place GSAP is loaded and its plugins are registered. Everything in
 * `components/motion` imports GSAP from here, and nothing outside a client
 * component may import this file: GSAP must stay out of the server code.
 *
 * Rules of the motion layer (design/components/README.md, "Motion"):
 *   - the server HTML is always fully visible; hidden starting states are
 *     set here, from JavaScript, and only on elements nobody has seen yet
 *   - `prefers-reduced-motion: reduce` means no movement at all
 *   - only `transform` and `opacity` are animated
 */
gsap.registerPlugin(ScrollTrigger, useGSAP);
// A phone's address bar showing and hiding is not a reason to measure the page again.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, useGSAP };

/** Every animation is created inside `gsap.matchMedia().add(MOTION_OK, …)`. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** Seconds. `enter` and `emphasis` mirror `motion.duration` in design/tokens/tokens.json. */
export const DURATION = { enter: 0.6, emphasis: 0.8, count: 1.2 } as const;
/** Pixels an element travels as it enters. */
export const DISTANCE = 20;
/** Seconds between the items of a group. */
export const STAGGER = 0.06;

/**
 * Calls `enter` once for each element, the first time any part of it is on
 * screen, with the elements that arrived together in page order. The browser
 * does the watching (IntersectionObserver), so nothing is measured here and
 * nothing goes stale when the page changes height: the last row of a page,
 * a row inside a sideways scroller and an element that was not displayed at
 * first are all reported when they can really be seen.
 */
export function whenSeen(elements: Element[], enter: (seen: Element[]) => void): () => void {
  const observer = new IntersectionObserver((entries) => {
    const seen = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    if (seen.length === 0) return;
    for (const element of seen) observer.unobserve(element);
    enter(seen);
  });
  for (const element of elements) observer.observe(element);
  return () => observer.disconnect();
}

/** A CSS `cubic-bezier()` as a GSAP ease, so the tokens' curves are used as they are. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  const slope = (t: number, a: number, b: number) => 3 * a * (1 - t) * (1 - 3 * t) + 3 * b * t * (2 - 3 * t) + 3 * t * t;
  return (x: number) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = at(t, x1, x2) - x;
      const d = slope(t, x1, x2);
      if (Math.abs(dx) < 1e-5 || d === 0) break;
      t = Math.min(1, Math.max(0, t - dx / d));
    }
    return at(t, y1, y2);
  };
}

/** `motion.easing.standard` in the tokens: quick to start, long to settle. */
export const EASE = cubicBezier(0.2, 0, 0, 1);

const never = () => () => {};

/**
 * True when this component was drawn by the server and is being hydrated;
 * false when the browser drew it itself (a client-side navigation).
 *
 * It matters because of what the visitor has already seen. Server HTML is on
 * screen before any script runs, so hiding it to animate it in would make it
 * blink. After a client-side navigation the effect runs before the first
 * paint, so an entrance can start from hidden without anything blinking.
 */
export function useWasHydrated(): RefObject<boolean> {
  const hydrating = useSyncExternalStore(never, () => false, () => true);
  // The value of the first render is the one that says how the element got here.
  return useRef(hydrating);
}

export type RevealFrom = "up" | "right" | "scale" | "fade";

export type RevealOptions = {
  /** What moves: the element itself, or each of its children (one after another). */
  targets: "self" | "children";
  from?: RevealFrom;
  /** Seconds before the first item starts. */
  delay?: number;
  /** Seconds between items. */
  stagger?: number;
  /**
   * How many leading items never fade, only move: the first row of listing
   * cards, whose photos are the largest thing on the screen.
   */
  solid?: number;
};

const CLEAR = "opacity,transform";

function hidden(from: RevealFrom, solid: boolean): gsap.TweenVars {
  const vars: gsap.TweenVars = solid ? {} : { opacity: 0 };
  if (from === "up") vars.y = DISTANCE;
  if (from === "right") vars.x = DISTANCE;
  if (from === "scale") vars.scale = 0.95;
  // An item that may not fade still needs something to do.
  if (solid && from === "fade") vars.y = DISTANCE;
  return vars;
}

/**
 * Animates an element, or its children in sequence, as they come on screen.
 *
 *   - Nothing is hidden in the HTML or the CSS. The starting state is set
 *     here, before the browser paints, and removed again when the animation
 *     ends, so no inline style or transform is left behind.
 *   - After hydration, anything already on screen (or above it) is left
 *     alone: it has been seen. Only what is still below the screen is
 *     prepared for an entrance.
 *   - Moving focus into an item that is still waiting shows it at once.
 *   - Descendants marked `data-draw` (the logo-colour rule of a heading) are
 *     drawn from left to right as their item enters.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, options: RevealOptions) {
  const wasHydrated = useWasHydrated();
  const { targets: pick, from = "up", delay = 0, stagger = STAGGER, solid = 0 } = options;

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current;
      if (!root) return;
      const media = gsap.matchMedia();
      media.add(MOTION_OK, () => {
        const all = pick === "self" ? [root] : Array.from(root.children).filter((child) => child instanceof HTMLElement);
        const solidItems = new Set(all.slice(0, solid));
        const items = wasHydrated.current
          ? all.filter((item) => item.getBoundingClientRect().top >= window.innerHeight)
          : all;
        if (items.length === 0) return;

        for (const item of items) {
          gsap.set(item, hidden(from, solidItems.has(item)));
          // For the print stylesheet: paper shows everything, entered or not.
          item.setAttribute("data-motion", "");
        }

        // Created later, from the observer: `contextSafe` keeps these animations in this component's context.
        const enter = (batch: Element[]) => {
          gsap.to(batch, {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: DURATION.enter,
            ease: EASE,
            delay,
            stagger,
            overwrite: true,
            clearProps: CLEAR,
          });
          const rules = batch.flatMap((item) => Array.from(item.querySelectorAll("[data-draw]")));
          if (rules.length > 0) {
            gsap.fromTo(
              rules,
              { scaleX: 0, transformOrigin: "0 50%" },
              { scaleX: 1, duration: DURATION.emphasis, ease: EASE, delay: delay + 0.1, clearProps: "transform,transformOrigin" },
            );
          }
        };
        const stopWatching = whenSeen(items, contextSafe ? contextSafe(enter) : enter);

        // Keyboard focus can reach an item before it has scrolled far enough to start.
        const showFocused = (event: FocusEvent) => {
          const focused = items.filter((item) => item.contains(event.target as Node));
          if (focused.length === 0) return;
          gsap.killTweensOf(focused);
          gsap.set(focused, { clearProps: CLEAR });
        };
        root.addEventListener("focusin", showFocused);
        return () => {
          stopWatching();
          root.removeEventListener("focusin", showFocused);
        };
      });
    },
    { scope },
  );
}
