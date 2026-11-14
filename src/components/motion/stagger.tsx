"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useReveal, type RevealFrom } from "@/components/motion/gsap";
import type { MotionTag } from "@/components/motion/reveal";

type Props = HTMLAttributes<HTMLElement> & {
  /** The element to render: usually the `ul` of a grid or a row. */
  as?: MotionTag;
  /**
   * "up" for grids and lists, "scale" for photo tiles, "right" only inside a
   * row that already scrolls sideways (anywhere else it could widen the page).
   */
  from?: RevealFrom;
  /** Seconds between one child and the next. */
  stagger?: number;
  /** How many leading children only move and never fade (the first row of listing cards). */
  solid?: number;
  children?: ReactNode;
};

/**
 * Brings its direct children in one after another as they scroll into view:
 * card grids, tile rows, lists. Children that enter the screen together are
 * staggered together, so a long grid animates row by row as it is scrolled.
 */
export function Stagger({ as = "div", from = "up", stagger, solid, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { targets: "children", from, stagger, solid });
  // Every tag in `MotionTag` takes the same attributes; "div" stands for them all to the type checker.
  const Tag = as as "div";
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}
