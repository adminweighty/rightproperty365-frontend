"use client";

import type { ComponentProps, MouseEvent } from "react";
import { EASE, gsap, MOTION_OK } from "@/components/motion/gsap";

const CLEAR = "height,opacity,overflow";

/** A click on the summary: open or close the body with its height instead of at once. */
function toggle(event: MouseEvent<HTMLDetailsElement>) {
  const details = event.currentTarget;
  const summary = (event.target as Element).closest("summary");
  if (!summary || summary.parentElement !== details) return;
  // With reduced motion the browser opens and closes it, as it does without JavaScript.
  if (!window.matchMedia(MOTION_OK).matches) return;
  const body = Array.from(details.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute("data-details-body"),
  );
  if (!body) return;

  event.preventDefault();
  gsap.killTweensOf(body);
  // Clipped before it is measured: a clipped box contains its children's margins, so the height is the one it animates at.
  gsap.set(body, { overflow: "hidden" });

  if (details.open && !details.hasAttribute("data-closing")) {
    details.setAttribute("data-closing", "");
    gsap.fromTo(
      body,
      { height: body.offsetHeight },
      {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: EASE,
        onComplete: () => {
          details.open = false;
          details.removeAttribute("data-closing");
          gsap.set(body, { clearProps: CLEAR });
        },
      },
    );
    return;
  }

  // Opening, or opening again part of the way through closing.
  const from = details.open ? body.offsetHeight : 0;
  details.removeAttribute("data-closing");
  details.open = true;
  gsap.set(body, { clearProps: "height" });
  const full = body.offsetHeight;
  gsap.fromTo(
    body,
    { height: from, opacity: from > 0 ? gsap.getProperty(body, "opacity") : 0 },
    { height: full, opacity: 1, duration: 0.35, ease: EASE, clearProps: CLEAR },
  );
}

/**
 * A native `<details>` whose content opens and closes with its height.
 *
 * Give it a `<summary>` and one element marked `data-details-body` holding
 * everything else. The body must have no padding, border or margin of its
 * own (put those on what is inside it), so a height of zero is really zero.
 *
 * Without JavaScript, with reduced motion, when it is opened from a link
 * (`/faq#cookies`) or printed, it is the plain element: the browser opens and
 * closes it. With motion, a click on the summary (or Enter or Space on it) is
 * taken over: the body grows to its measured height, or shrinks to nothing
 * before the element is closed. While it is closing the element carries
 * `data-closing`, for a chevron to follow. The inline styles are removed when
 * the animation ends.
 */
export function MotionDetails({ children, onClick, ...rest }: ComponentProps<"details">) {
  return (
    <details
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle(event);
      }}
    >
      {children}
    </details>
  );
}
