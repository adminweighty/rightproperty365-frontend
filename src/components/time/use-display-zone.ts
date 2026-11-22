"use client";

import { useSyncExternalStore } from "react";
import { displayZoneServerSnapshot, displayZoneSnapshot, subscribeDisplayZone } from "@/lib/display-zone";

/**
 * The viewer's display zone (API 0.62.0): `viewer` for instants (class A),
 * `market` for market days and organisation figures, `setting` as stored.
 * The component re-renders when the person changes it.
 */
export function useDisplayZone() {
  return useSyncExternalStore(subscribeDisplayZone, displayZoneSnapshot, displayZoneServerSnapshot);
}
