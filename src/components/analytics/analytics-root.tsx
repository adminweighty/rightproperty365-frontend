"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { isPlacement } from "@/lib/analytics/core";
import { currentPageView, measurementAllowed, setAudience, track } from "@/lib/analytics/tracker";

/** A card counts as seen when at least half of it is on screen for a whole second. */
const VISIBLE_RATIO = 0.5;
const DWELL_MS = 1_000;

/**
 * Watches every listing card marked `data-rp-impression` (ListingCard with an
 * `impression`, the saved list) and records one `property_card_impression`
 * per card per page view. Cards are found as they enter the page, so server
 * components only add data attributes and every page stays cached.
 */
function observeImpressions(): () => void {
  if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return () => undefined;

  let observed = new WeakSet<Element>();
  let fired = new WeakSet<Element>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  let pageView = currentPageView();

  const cancel = (element: Element) => {
    const pending = timers.get(element);
    if (pending) clearTimeout(pending);
    timers.delete(element);
  };

  const fire = (element: Element) => {
    timers.delete(element);
    if (!element.isConnected || fired.has(element) || document.visibilityState !== "visible") return;
    const listingId = element.getAttribute("data-rp-listing");
    const placement = element.getAttribute("data-rp-impression");
    const rank = Number(element.getAttribute("data-rp-rank"));
    if (!listingId || !isPlacement(placement)) return;
    fired.add(element);
    io.unobserve(element);
    track({ type: "property_card_impression", listingId, placement, rank: Number.isInteger(rank) && rank > 0 ? rank : undefined });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO && document.visibilityState === "visible") {
          if (!timers.has(entry.target)) timers.set(entry.target, setTimeout(() => fire(entry.target), DWELL_MS));
        } else {
          cancel(entry.target);
        }
      }
    },
    { threshold: [0, VISIBLE_RATIO, 1] },
  );

  const scan = () => {
    // A new address is a new page view: cards that stayed on screen are counted again.
    const now = currentPageView();
    if (now !== pageView) {
      pageView = now;
      for (const element of timers.keys()) cancel(element);
      io.disconnect();
      observed = new WeakSet();
      fired = new WeakSet();
    }
    document.querySelectorAll("[data-rp-impression]").forEach((element) => {
      if (observed.has(element)) return;
      observed.add(element);
      io.observe(element);
    });
  };

  let frame = 0;
  const rescan = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scan();
    });
  };
  const mutations = new MutationObserver(rescan);
  mutations.observe(document.body, { childList: true, subtree: true });

  // A hidden tab sees nothing: stop the clocks, and look again when it is back.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      for (const element of timers.keys()) cancel(element);
      return;
    }
    document.querySelectorAll("[data-rp-impression]").forEach((element) => {
      if (fired.has(element) || !observed.has(element)) return;
      io.unobserve(element);
      io.observe(element);
    });
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("popstate", rescan);
  scan();

  return () => {
    mutations.disconnect();
    io.disconnect();
    for (const element of timers.keys()) cancel(element);
    if (frame) cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("popstate", rescan);
  };
}

/**
 * The tracker's one island in the root layout. It tells the tracker who is
 * browsing (an administrator session is never measured) and watches the
 * cards. It renders nothing.
 */
export function AnalyticsRoot() {
  const auth = useAuth();
  const audience = auth.status === "loading" ? "pending" : auth.status === "authenticated" && auth.scope === "admin" ? "admin" : "visitor";

  useEffect(() => {
    setAudience(audience);
  }, [audience]);

  useEffect(() => {
    if (!measurementAllowed()) return;
    return observeImpressions();
  }, []);

  return null;
}

/** Records `listing_detail_view` once per listing per page view. Renders nothing. */
export function ListingViewBeacon({ listingId }: { listingId: string }) {
  useEffect(() => {
    track({ type: "listing_detail_view", listingId });
  }, [listingId]);
  return null;
}
