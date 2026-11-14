"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/components/motion/gsap";

/**
 * Rendered once, in the root layout. It draws nothing.
 *
 *   - Marks the header `data-scrolled` once the page has moved, so its CSS
 *     can add a shadow and draw the logo a little smaller. The header keeps
 *     its height: nothing under it moves.
 *   - Measures the scroll positions again whenever the page changes height
 *     (a client-side navigation, content that streams in, an opened answer),
 *     so every scroll-driven animation starts where its element now is.
 */
export function SiteMotion() {
  useEffect(() => {
    const header = document.querySelector("[data-site-header]");
    const mark = () => header?.toggleAttribute("data-scrolled", window.scrollY > 8);
    mark();
    window.addEventListener("scroll", mark, { passive: true });

    let timer: number | undefined;
    let height = document.body.offsetHeight;
    const observer = new ResizeObserver(() => {
      // Width changes are the window's, which ScrollTrigger follows by itself.
      if (document.body.offsetHeight === height) return;
      height = document.body.offsetHeight;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    });
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", mark);
      window.clearTimeout(timer);
      observer.disconnect();
      header?.removeAttribute("data-scrolled");
    };
  }, []);

  return null;
}
