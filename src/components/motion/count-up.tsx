"use client";

import { useRef } from "react";
import { DURATION, gsap, MOTION_OK, useGSAP, whenSeen } from "@/components/motion/gsap";
import { cn } from "@/lib/cn";

type Props = {
  /** A whole number. The server prints it as it is; that is also what is shown without JavaScript. */
  value: number;
  className?: string;
};

/** A space as wide as a digit, so the number keeps its width while it counts. */
const FIGURE_SPACE = " ";

/**
 * A number that counts up from zero the first time it scrolls into view.
 * Tabular digits and figure-space padding keep its width constant, so
 * nothing beside it moves.
 */
export function CountUp({ value, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      // The text node React rendered: its data is changed, the node is kept.
      const element = ref.current;
      const text = element?.firstChild;
      if (!element || !text || !Number.isFinite(value) || value < 2) return;
      const final = String(value);
      const media = gsap.matchMedia();
      media.add(MOTION_OK, () => {
        const counter = { value: 0 };
        const tween = gsap.to(counter, {
          value,
          duration: DURATION.count,
          ease: "power2.out",
          paused: true,
          onUpdate: () => {
            text.nodeValue = String(Math.round(counter.value)).padStart(final.length, FIGURE_SPACE);
          },
          onComplete: () => {
            text.nodeValue = final;
          },
        });
        const stopWatching = whenSeen([element], () => tween.play());
        return () => {
          stopWatching();
          text.nodeValue = final;
        };
      });
    },
    { dependencies: [value], revertOnUpdate: true },
  );

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value}
    </span>
  );
}
