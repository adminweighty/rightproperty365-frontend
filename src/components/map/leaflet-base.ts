// Leaflet and its stylesheet. Imported only by the map views in this folder,
// which are loaded with next/dynamic and `ssr: false` (maps.tsx): Leaflet
// reads `window` as soon as it loads, and most pages never need it.
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { env } from "@/lib/env";
import { APPROXIMATE_RADIUS_METRES } from "@/lib/map";

export { L };

/** Adds the configured tiles (`env.map`). `onError` hears a tile that could not be loaded. */
export function addTiles(map: L.Map, onError?: () => void): void {
  if (!env.map) return;
  const layer = L.tileLayer(env.map.url, { attribution: env.map.attribution, maxZoom: 19 });
  if (onError) layer.on("tileerror", onError);
  layer.addTo(map);
}

/**
 * A marker's look, drawn in CSS (`.rp-map-pin`, `.rp-map-area-dot` in
 * globals.css) so no image files are needed: a pin for an exact position,
 * a ring for an approximate one.
 */
export function markerIcon(precision: "EXACT" | "APPROXIMATE"): L.DivIcon {
  return precision === "APPROXIMATE"
    ? L.divIcon({ className: "rp-map-area-dot", html: "", iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] })
    : L.divIcon({
        className: "rp-map-pin",
        html: '<span class="rp-map-pin-head"></span>',
        iconSize: [28, 36],
        iconAnchor: [14, 34],
        popupAnchor: [0, -32],
      });
}

/** The area around an approximate position: the public point is rounded to about 1 km. */
export function approximateArea(latitude: number, longitude: number): L.Circle {
  return L.circle([latitude, longitude], {
    radius: APPROXIMATE_RADIUS_METRES,
    interactive: false,
    className: "rp-map-area",
  });
}

/** Turns on the map's own handlers once the visitor clicks or focuses it (see `inertMapOptions`). */
export function wakeMap(map: L.Map): void {
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();
}

/** A map that does not move with the page's scrolling or a swipe until it is woken. */
export const inertMapOptions: L.MapOptions = {
  dragging: false,
  touchZoom: false,
  doubleClickZoom: false,
  scrollWheelZoom: false,
  boxZoom: false,
  keyboard: true,
};
