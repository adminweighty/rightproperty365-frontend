"use client";

import { useEffect } from "react";

/**
 * Marks the site header with `data-scrolled` once the page has scrolled. On
 * pages whose hero sits under the header (`data-overlay-hero`), globals.css
 * keeps the header transparent until then.
 */
export function HeaderScrollWatcher() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;

    const update = () => {
      if (window.scrollY > 24) header.dataset.scrolled = "";
      else delete header.dataset.scrolled;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return null;
}
