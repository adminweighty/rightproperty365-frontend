"use client";

import { useEffect, useRef, useState } from "react";
import type { ListingLocation } from "@/lib/api/types";
import { addTiles, approximateArea, inertMapOptions, L, markerIcon, wakeMap } from "./leaflet-base";

export type ListingMapProps = { location: ListingLocation; title: string };

/**
 * The listing page's small map. It starts still, so the page scrolls past it
 * and a swipe on a phone never gets caught; clicking it or reaching it with
 * the keyboard turns on dragging, zooming and the arrow keys.
 */
export default function ListingMapView({ location, title }: ListingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [awake, setAwake] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const approximate = location.precision === "APPROXIMATE";

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const map = L.map(node, { ...inertMapOptions, zoomControl: false });
    map.attributionControl.setPrefix(false);
    addTiles(map, () => setTilesFailed(true));
    const point: [number, number] = [location.latitude, location.longitude];
    if (approximate) {
      const area = approximateArea(...point).addTo(map);
      map.fitBounds(area.getBounds(), { padding: [16, 16], animate: false });
    } else {
      // Decorative: the address and the heading say where it is.
      L.marker(point, { icon: markerIcon("EXACT"), keyboard: false, interactive: false }).addTo(map);
      map.setView(point, 15, { animate: false });
    }
    let zoom: L.Control.Zoom | null = null;
    const wake = () => {
      if (zoom) return;
      wakeMap(map);
      zoom = L.control.zoom({ position: "topright" }).addTo(map);
      setAwake(true);
    };
    node.addEventListener("focusin", wake);
    node.addEventListener("pointerdown", wake);
    return () => {
      node.removeEventListener("focusin", wake);
      node.removeEventListener("pointerdown", wake);
      map.remove();
    };
  }, [location.latitude, location.longitude, approximate]);

  return (
    <div>
      <div
        ref={container}
        role="region"
        aria-roledescription="map"
        aria-label={`Map of ${approximate ? "the area of " : "where to find "}${title}. ${awake ? "Arrow keys move the map, plus and minus zoom." : "Select it to move and zoom."}`}
        className="rp-map h-56 w-full rounded-lg border border-line bg-sunken sm:h-64"
      />
      <p role="status" className="sr-only">
        {awake ? "The map can now be moved and zoomed." : ""}
      </p>
      {tilesFailed && <p className="mt-2 text-sm text-muted">Some of the map could not be loaded.</p>}
    </div>
  );
}
