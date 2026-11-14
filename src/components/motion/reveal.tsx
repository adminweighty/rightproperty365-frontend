"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useReveal, type RevealFrom } from "@/components/motion/gsap";

export type MotionTag = "div" | "section" | "aside" | "header" | "nav" | "ul" | "ol" | "li" | "dl" | "p" | "span";

type Props = HTMLAttributes<HTMLElement> & {
  /** The element to render. The wrapper adds no element of its own beyond this one. */
  as?: MotionTag;
  /** "up" rises 20px, "scale" grows from 95%, "fade" only fades. */
  from?: Exclude<RevealFrom, "right">;
  /** Seconds to wait once it is in view. */
  delay?: number;
  children?: ReactNode;
};

/**
 * Fades and moves its content in when it scrolls into view. The content is
 * rendered by the server as usual and is visible without JavaScript; see
 * `useReveal` for what is and is not animated.
 */
export function Reveal({ as = "div", from = "up", delay, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, { targets: "self", from, delay });
  // Every tag in `MotionTag` takes the same attributes; "div" stands for them all to the type checker.
  const Tag = as as "div";
  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}
