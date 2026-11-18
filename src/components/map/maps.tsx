"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ListingLocation } from "@/lib/api/types";
import type { ListingMapProps } from "./listing-map-view";
import type { LocationPickerProps } from "./location-picker-view";
import type { ResultsMapProps } from "./results-map-view";

/**
 * The three maps of the site (API 0.29.0). Each is a client-only island
 * loaded on demand with `next/dynamic` and `ssr: false`: Leaflet and its
 * stylesheet are not in any page's first download, the server renders only a
 * placeholder of the same size (so nothing shifts), and pages stay cached and
 * the same for everyone. Render them only when `env.map` is set.
 */

/** A result as the Map view needs it: plain text and numbers, ready to show. */
export type MapListing = {
  id: string;
  title: string;
  href: string;
  /** "USD 385,000" or "USD 1,200 per month". */
  price: string;
  /** "Borrowdale, Harare". */
  place: string;
  location: ListingLocation;
};

function MapPlaceholder({ className, error }: { className: string; error?: Error | null }) {
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center rounded-xl border border-dashed border-line-strong bg-sunken p-6 text-center text-sm text-muted`}>
        <p role="alert">The map could not be loaded. Check your connection and reload the page.</p>
      </div>
    );
  }
  return <div aria-busy="true" aria-label="Loading the map" className={`${className} animate-pulse rounded-xl bg-sunken`} />;
}

const resultsHeight = "h-[55vh] min-h-64 max-h-[36rem] w-full";

/** The Map view of /listings. The results are listed under it as well. */
export const ResultsMap = dynamic<ResultsMapProps>(() => import("./results-map-view"), {
  ssr: false,
  loading: ({ error }) => <MapPlaceholder className={resultsHeight} error={error} />,
});

const ListingMapLazy = dynamic<ListingMapProps>(() => import("./listing-map-view"), {
  ssr: false,
  loading: ({ error }) => <MapPlaceholder className="h-56 w-full sm:h-64" error={error} />,
});

/**
 * The small map under a listing's address. Nothing of it is fetched until it
 * is about to scroll into view.
 */
export function ListingMap(props: ListingMapProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = anchor.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Very old browsers: load it straight away.
      const timer = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={anchor}>
      {near ? <ListingMapLazy {...props} /> : <div aria-hidden="true" className="h-56 w-full rounded-lg bg-sunken sm:h-64" />}
    </div>
  );
}

/** The listing editor's map for placing the pin. */
export const LocationPicker = dynamic<LocationPickerProps>(() => import("./location-picker-view"), {
  ssr: false,
  loading: ({ error }) => <MapPlaceholder className="h-72 w-full sm:h-80" error={error} />,
});
