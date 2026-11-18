"use client";

import { Crosshair } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { roundCoordinate } from "@/lib/map";
import { addTiles, approximateArea, L, markerIcon } from "./leaflet-base";

export type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  approximate: boolean;
  disabled?: boolean;
  /** A new position, already rounded to the 6 decimals the API keeps. */
  onPick: (latitude: number, longitude: number) => void;
};

/**
 * The editor's map: click the map or drag the pin to place it, or move the map
 * (arrow keys work once it has focus) and press "Use this position" to put the
 * pin at the cross in the middle. The latitude and longitude boxes beside it
 * are the same position in numbers, for anyone who would rather type.
 */
export default function LocationPickerView({ latitude, longitude, approximate, disabled = false, onPick }: LocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const areaRef = useRef<L.Circle | null>(null);
  const pickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    pickRef.current = onPick;
    disabledRef.current = disabled;
  });

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const map = L.map(node, { scrollWheelZoom: false, minZoom: 2 });
    map.attributionControl.setPrefix(false);
    addTiles(map, () => setTilesFailed(true));
    map.setView([10, 10], 2, { animate: false });
    // The wheel zooms only after the map was clicked or focused, so the form scrolls past it.
    const wake = () => map.scrollWheelZoom.enable();
    node.addEventListener("focusin", wake);
    map.on("click", (event: L.LeafletMouseEvent) => {
      wake();
      if (disabledRef.current) return;
      pickRef.current(roundCoordinate(event.latlng.lat), roundCoordinate(event.latlng.wrap().lng));
    });
    mapRef.current = map;
    return () => {
      node.removeEventListener("focusin", wake);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      areaRef.current = null;
    };
  }, []);

  // The pin follows the position, whether it came from the map or the boxes.
  const hasPin = latitude !== null && longitude !== null;
  const first = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    areaRef.current?.remove();
    areaRef.current = null;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const point = L.latLng(latitude, longitude);
    if (!markerRef.current) {
      const marker = L.marker(point, {
        icon: markerIcon("EXACT"),
        draggable: !disabled,
        keyboard: false,
        title: "The property's pin. Drag it to move it.",
        alt: "",
        autoPan: true,
      });
      marker.on("dragend", () => {
        const at = marker.getLatLng();
        pickRef.current(roundCoordinate(at.lat), roundCoordinate(at.wrap().lng));
      });
      marker.addTo(map);
      // A mouse convenience: the boxes and "Use this position" do the same without one.
      marker.getElement()?.setAttribute("aria-hidden", "true");
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(point);
    }
    if (approximate) areaRef.current = approximateArea(latitude, longitude).addTo(map);
    if (first.current) map.setView(point, 16, { animate: false });
    else if (!map.getBounds().pad(-0.1).contains(point)) map.panTo(point);
    first.current = false;
  }, [latitude, longitude, approximate, disabled]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker?.dragging) return;
    if (disabled) marker.dragging.disable();
    else marker.dragging.enable();
  }, [disabled, hasPin]);

  return (
    <div>
      <div className="relative">
        <div
          ref={container}
          role="region"
          aria-roledescription="map"
          aria-label="Map for placing the property's pin. Arrow keys move the map, plus and minus zoom; Use this position puts the pin at the cross in the middle."
          className="rp-map h-72 w-full rounded-lg border border-line bg-sunken sm:h-80"
        />
        {/* The cross that "Use this position" puts the pin on. */}
        <Crosshair
          className="pointer-events-none absolute left-1/2 top-1/2 z-[500] size-6 -translate-x-1/2 -translate-y-1/2 text-ink"
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            const centre = map.getCenter();
            onPick(roundCoordinate(centre.lat), roundCoordinate(centre.wrap().lng));
          }}
        >
          <Crosshair className="size-4" aria-hidden="true" />
          Use this position
        </Button>
        {tilesFailed && <p className="text-sm text-muted">Some of the map could not be loaded. You can still type the latitude and longitude.</p>}
      </div>
    </div>
  );
}
