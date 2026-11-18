"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBbox, parseBbox, sameBbox, type Bbox } from "@/lib/map";
import { addTiles, approximateArea, L, markerIcon } from "./leaflet-base";
import type { MapListing } from "./maps";

export type ResultsMapProps = {
  listings: MapListing[];
  /** The `bbox` of the search shown, if it has one. */
  bbox: string | null;
  /** The address of the same search without a box (keeps `view=map`); the box is added to it. */
  searchBase: string;
};

/** How long the map must be still before "Search this area" is offered. */
const SETTLE_MS = 400;

const boxOf = (bounds: L.LatLngBounds): Bbox => ({
  west: bounds.getWest(),
  south: bounds.getSouth(),
  east: bounds.getEast(),
  north: bounds.getNorth(),
});

/** The small card a marker opens: built with DOM calls, so nothing from the API is read as HTML. */
function popupCard(listing: MapListing): HTMLElement {
  const card = document.createElement("div");
  card.className = "rp-map-card";
  const link = document.createElement("a");
  link.href = listing.href;
  link.className = "rp-map-card-title";
  link.textContent = listing.title;
  card.append(link);
  for (const line of [listing.price, listing.place]) {
    if (!line) continue;
    const p = document.createElement("p");
    p.textContent = line;
    card.append(p);
  }
  if (listing.location.precision === "APPROXIMATE") {
    const note = document.createElement("p");
    note.className = "rp-map-card-note";
    note.textContent = "Approximate location";
    card.append(note);
  }
  return card;
}

/**
 * The Map view's map: one marker per result, each a keyboard-focusable button
 * named after its listing that opens a card linking to it. Moving the map
 * never searches by itself: once it has been still for a moment, "Search this
 * area" offers to search the box on screen.
 */
export default function ResultsMapView({ listings, bbox, searchBase }: ResultsMapProps) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  /** The box this code last moved the map to (fitting the results): a move there is not the visitor's. */
  const fitted = useRef<string | null>(null);
  /** When a card last opened: Leaflet pans the map to fit it, which is not the visitor moving it. */
  const cardOpenedAt = useRef(0);
  const [area, setArea] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [searching, startSearch] = useTransition();
  const shownBox = parseBbox(bbox);

  // The map itself, once.
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { worldCopyJump: false, minZoom: 2, scrollWheelZoom: false, zoomSnap: 0.5 });
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    addTiles(map, () => setTilesFailed(true));
    map.attributionControl.setPrefix(false);
    // The wheel zooms only once the map has been clicked or focused, so scrolling the page never gets stuck on it.
    const wake = () => map.scrollWheelZoom.enable();
    container.current.addEventListener("focusin", wake);
    map.on("click", wake);
    let timer: ReturnType<typeof setTimeout> | undefined;
    map.on("movestart", () => clearTimeout(timer));
    map.on("moveend", () => {
      clearTimeout(timer);
      if (Date.now() - cardOpenedAt.current < 1000) {
        fitted.current = formatBbox(boxOf(map.getBounds()));
        return;
      }
      const box = formatBbox(boxOf(map.getBounds()));
      // Checked when the map has settled: a fit sets `fitted` straight after its own move.
      timer = setTimeout(() => {
        setArea(box === fitted.current ? null : box);
      }, SETTLE_MS);
    });
    const node = container.current;
    return () => {
      clearTimeout(timer);
      node.removeEventListener("focusin", wake);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // The markers, again for every new set of results.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const listing of listings) {
      const { latitude, longitude, precision } = listing.location;
      const approximate = precision === "APPROXIMATE";
      if (approximate) layer.addLayer(approximateArea(latitude, longitude));
      const name = `${listing.title}${listing.price ? `, ${listing.price}` : ""}${approximate ? ", approximate location" : ""}`;
      const marker = L.marker([latitude, longitude], {
        icon: markerIcon(precision),
        keyboard: true,
        title: listing.title,
        alt: listing.title,
        riseOnHover: true,
      });
      marker.bindPopup(() => popupCard(listing), { className: "rp-map-popup", maxWidth: 260, autoPanPadding: [16, 16] });
      marker.on("add", () => {
        const element = marker.getElement();
        if (!element) return;
        element.setAttribute("aria-label", name);
        element.setAttribute("aria-expanded", "false");
        // Enter opens the card (Leaflet); Space does too, as on any button.
        element.addEventListener("keydown", (event) => {
          if (event.key === " ") {
            event.preventDefault();
            marker.openPopup();
          }
        });
      });
      marker.on("popupopen", () => {
        cardOpenedAt.current = Date.now();
        marker.getElement()?.setAttribute("aria-expanded", "true");
        // Into the card, so the link is the next thing a keyboard reaches.
        const link = marker.getPopup()?.getElement()?.querySelector("a");
        if (link && container.current?.contains(document.activeElement)) link.focus({ preventScroll: true });
      });
      marker.on("popupclose", () => {
        const element = marker.getElement();
        element?.setAttribute("aria-expanded", "false");
        // The card's link had focus and is gone: back to the marker that opened it.
        const active = document.activeElement;
        if (element && (active === null || active === document.body)) element.focus({ preventScroll: true });
      });
      layer.addLayer(marker);
    }
  }, [listings]);

  // Show the box of the search, else the results, else the whole world.
  const boxKey = bbox ?? "";
  const listingsKey = listings.map((listing) => listing.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let current: string | null = null;
    try {
      current = formatBbox(boxOf(map.getBounds()));
    } catch {
      // No view yet: this is the first fit.
    }
    const box = parseBbox(boxKey);
    if (box) {
      // Already on screen (the visitor just searched this area): leave the map where it is.
      if (current === boxKey) return;
      map.fitBounds(
        [
          [box.south, box.west],
          [box.north, box.east],
        ],
        { animate: false },
      );
    } else {
      const points = listingsKey ? listings.map((listing) => [listing.location.latitude, listing.location.longitude] as [number, number]) : [];
      if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15, animate: false });
      else map.setView([10, 10], 2, { animate: false });
    }
    fitted.current = formatBbox(boxOf(map.getBounds()));
    // `listings` is read through `listingsKey`: the same results need no new fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxKey, listingsKey]);

  const canSearch = area !== null && !sameBbox(parseBbox(area), shownBox);

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-roledescription="map"
        aria-label="Map of the results. Arrow keys move the map, plus and minus zoom. Each property is a button."
        className="rp-map h-[55vh] min-h-64 max-h-[36rem] w-full rounded-xl border border-line bg-sunken"
      />
      {canSearch && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
          <Button
            size="md"
            className="pointer-events-auto shadow-md"
            aria-busy={searching || undefined}
            disabled={searching}
            onClick={() =>
              startSearch(() => {
                const join = searchBase.includes("?") ? "&" : "?";
                router.push(`${searchBase}${join}bbox=${encodeURIComponent(area)}`, { scroll: false });
              })
            }
          >
            <Search className="size-4" aria-hidden="true" />
            {searching ? "Searching…" : "Search this area"}
          </Button>
        </div>
      )}
      <p role="status" className="mt-2 text-sm text-muted">
        {tilesFailed ? "Some of the map could not be loaded. Every result is also listed below the map." : ""}
      </p>
    </div>
  );
}
