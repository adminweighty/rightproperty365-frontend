/**
 * The signed-in viewer's display zone (API 0.62.0), held once for the whole
 * page so that every shared formatter (`formatWhen`, the books' dates, ...)
 * uses the same zone without each component asking for it.
 *
 * The auth provider sets it from `user.time_zone` (and clears it on sign-out);
 * components re-render on a change through `useDisplayZone` — `useApi` subscribes,
 * so every screen that loads data follows. The last setting is remembered in
 * this browser so that a reload starts in the right zone before /v1/me answers.
 * With nothing known, it is market time in the home market (Harare).
 */
import { HOME_MARKET_ZONE, readTimeZoneSetting, viewerZone, type TimeZoneSetting } from "@/lib/time-zone";

const STORAGE_KEY = "rp365.time-zone";

type Snapshot = { setting: TimeZoneSetting | null; viewer: string; market: string; version: number };

let snapshot: Snapshot = { setting: null, viewer: HOME_MARKET_ZONE, market: HOME_MARKET_ZONE, version: 0 };
const listeners = new Set<() => void>();

function compute(setting: TimeZoneSetting | null, version: number): Snapshot {
  return { setting, viewer: viewerZone(setting), market: setting?.market_zone ?? HOME_MARKET_ZONE, version };
}

/** Reads the remembered setting (in the browser only; never throws). */
function remembered(): TimeZoneSetting | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? readTimeZoneSetting(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Called once on the client before the first data loads (by the auth provider). */
export function restoreDisplayZone(): void {
  const setting = remembered();
  if (setting) set(setting, false);
}

/** Sets the viewer's setting (null: signed out, market time). */
export function setDisplayZone(raw: unknown | null): void {
  set(raw == null ? null : readTimeZoneSetting(raw), true);
}

function set(setting: TimeZoneSetting | null, remember: boolean): void {
  const next = compute(setting, snapshot.version + 1);
  if (remember) {
    try {
      if (typeof window !== "undefined") {
        if (setting) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
        else window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private mode or blocked storage: the zone still applies to this page.
    }
  }
  if (next.viewer === snapshot.viewer && next.market === snapshot.market && next.setting?.mode === snapshot.setting?.mode &&
    next.setting?.zone === snapshot.setting?.zone) {
    snapshot = { ...next, version: snapshot.version };
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeDisplayZone(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const displayZoneSnapshot = (): Snapshot => snapshot;

/** The server (and the first render) always uses the home market's time. */
const serverSnapshot: Snapshot = compute(null, 0);
export const displayZoneServerSnapshot = (): Snapshot => serverSnapshot;

/** The viewer's zone V now (class A). */
export const currentViewerZone = (): string => snapshot.viewer;
/** The viewer's market zone now (classes C/D for instants, "today"). */
export const currentMarketZone = (): string => snapshot.market;
