/**
 * Maps (API 0.29.0): which tiles to draw, the `bbox` of a map search, and
 * coordinates in words and in the editor's boxes.
 *
 * Pure functions with no imports, so `npm test` (scripts/map.test.mjs) runs
 * them directly. The map itself is Leaflet, loaded only in the browser
 * (`components/map`).
 */

// ---- Tiles ------------------------------------------------------------------

/** OpenStreetMap's public tiles: allowed for development and test sites only, never production traffic. */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapTiles = { url: string; attribution: string };

export type MapTileSettings = {
  /** NEXT_PUBLIC_MAP_TILE_URL. */
  tileUrl?: string;
  /** NEXT_PUBLIC_MAP_ATTRIBUTION. */
  attribution?: string;
  /** NODE_ENV of the build. */
  nodeEnv?: string;
  /** `env.testSite`. */
  testSite: boolean;
  /** NEXT_PUBLIC_SITE_URL. */
  siteUrl: string;
};

function isLocalSite(siteUrl: string): boolean {
  try {
    const host = new URL(siteUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost") || host.endsWith(".test");
  } catch {
    return false;
  }
}

/**
 * True for a production build of the real site: `next build` (NODE_ENV
 * production), not a test site, and not served from this computer.
 */
export function isProductionSite({ nodeEnv, testSite, siteUrl }: Pick<MapTileSettings, "nodeEnv" | "testSite" | "siteUrl">): boolean {
  return nodeEnv === "production" && !testSite && !isLocalSite(siteUrl);
}

/**
 * The tiles to draw, or null when no map may be shown. A configured tile URL
 * always wins (with its attribution, or OpenStreetMap's when none is set and
 * the URL is OpenStreetMap's). Without one, OpenStreetMap's public tiles are
 * used in development and on test sites; a production site gets no map at all,
 * and every list stays as it is.
 */
export function mapTiles(settings: MapTileSettings): MapTiles | null {
  const url = settings.tileUrl?.trim();
  const attribution = settings.attribution?.trim();
  if (url) {
    if (!/^https:\/\/[^\s]+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/][^\s]*$/.test(url)) return null;
    return { url, attribution: attribution || (url.includes("openstreetmap.org") ? OSM_ATTRIBUTION : "") };
  }
  if (isProductionSite(settings)) return null;
  return { url: OSM_TILE_URL, attribution: attribution || OSM_ATTRIBUTION };
}

// ---- The search box (`bbox=west,south,east,north`) --------------------------

export type Bbox = { west: number; south: number; east: number; north: number };

/** Decimals kept in a `bbox` address: 4 is about 11 m, plenty for a search box. */
const BBOX_DECIMALS = 4;
const NUMBER = /^-?\d{1,3}(\.\d{1,8})?$/;

/**
 * A `bbox` as the API takes it, or null when it would be refused: four
 * decimal numbers in range, south below north and west left of east (a box
 * across the antimeridian is not supported).
 */
export function parseBbox(text: string | undefined | null): Bbox | null {
  if (!text) return null;
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length !== 4 || !parts.every((part) => NUMBER.test(part))) return null;
  const [west, south, east, north] = parts.map(Number);
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  if (!(south < north) || !(west < east)) return null;
  return { west, south, east, north };
}

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  // `+ 0` turns -0 into 0, so a box never says "-0".
  return Math.round(value * factor) / factor + 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The box a map shows, as a `bbox` value. Rounded outwards to 4 decimals so
 * the box still covers what is on screen, and clamped to the world: a map
 * zoomed out past the antimeridian searches up to it.
 */
export function formatBbox({ west, south, east, north }: Bbox): string | null {
  const factor = 10 ** BBOX_DECIMALS;
  const down = (value: number) => Math.floor(value * factor) / factor + 0;
  const up = (value: number) => Math.ceil(value * factor) / factor + 0;
  const box = {
    west: clamp(down(west), -180, 180),
    south: clamp(down(south), -90, 90),
    east: clamp(up(east), -180, 180),
    north: clamp(up(north), -90, 90),
  };
  if (!(box.south < box.north) || !(box.west < box.east)) return null;
  return [box.west, box.south, box.east, box.north].map((value) => String(roundTo(value, BBOX_DECIMALS))).join(",");
}

/** True when two boxes are the same once written as addresses: the map has not really moved. */
export const sameBbox = (a: Bbox | null, b: Bbox | null) =>
  a === b || (a !== null && b !== null && formatBbox(a) === formatBbox(b));

// ---- Coordinates ------------------------------------------------------------

export type LocationPrecision = "EXACT" | "APPROXIMATE";

/** Decimals the API stores (about 11 cm). */
export const COORDINATE_DECIMALS = 6;
/** Decimals of the public position of an approximate listing (about 1 km), as the API rounds it. */
export const APPROXIMATE_DECIMALS = 2;
/** Radius of the circle drawn for an approximate listing: the rounding is up to ~0.005° either way. */
export const APPROXIMATE_RADIUS_METRES = 800;

/** A coordinate with at most 6 decimals, as the API takes it (a dragged pin has many more). */
export const roundCoordinate = (value: number, decimals = COORDINATE_DECIMALS) => roundTo(value, decimals);

/** -17.8248, 31.0498 for display: 6 decimals for an exact pin, 2 for an approximate area. */
export function formatCoordinates(latitude: number, longitude: number, precision: LocationPrecision = "EXACT"): string {
  const decimals = precision === "APPROXIMATE" ? APPROXIMATE_DECIMALS : COORDINATE_DECIMALS;
  return `${roundTo(latitude, decimals).toFixed(decimals)}, ${roundTo(longitude, decimals).toFixed(decimals)}`;
}

/** The number a coordinate box shows: no trailing zeros, never "-0". */
export const coordinateForInput = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? "" : String(roundTo(value, COORDINATE_DECIMALS));

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const AXES = {
  latitude: { label: "latitude", min: -90, max: 90, example: "-17.824858" },
  longitude: { label: "longitude", min: -180, max: 180, example: "31.049800" },
} as const;

/** One coordinate box: a decimal number in range with at most 6 decimals, or null when empty. */
export function parseCoordinate(text: string, axis: keyof typeof AXES): Parsed<number | null> {
  const rule = AXES[axis];
  // A decimal comma is read as a point; a minus sign typed as "−" too.
  const value = text.trim().replace(",", ".").replace("−", "-");
  if (value === "") return { ok: true, value: null };
  if (!/^[-+]?\d{1,3}(\.\d+)?$/.test(value)) {
    return { ok: false, message: `Enter the ${rule.label} as a decimal number, such as ${rule.example}.` };
  }
  if (/\.\d{7,}$/.test(value)) {
    return { ok: false, message: `Enter the ${rule.label} with at most ${COORDINATE_DECIMALS} decimal places.` };
  }
  const number = Number(value);
  if (number < rule.min || number > rule.max) {
    return { ok: false, message: `Enter a ${rule.label} from ${rule.min} to ${rule.max}.` };
  }
  return { ok: true, value: number + 0 };
}

export type CoordinatePair =
  | { ok: true; value: { latitude: number; longitude: number } | null }
  | { ok: false; errors: Partial<Record<"latitude" | "longitude", string>> };

/**
 * The two boxes together, as the API takes them: both set or both empty.
 * (0, 0) is refused, as the API does: it is the sea off West Africa and
 * almost always a pin that was never placed.
 */
export function parseCoordinatePair(latitudeText: string, longitudeText: string): CoordinatePair {
  const latitude = parseCoordinate(latitudeText, "latitude");
  const longitude = parseCoordinate(longitudeText, "longitude");
  const errors: Partial<Record<"latitude" | "longitude", string>> = {};
  if (!latitude.ok) errors.latitude = latitude.message;
  if (!longitude.ok) errors.longitude = longitude.message;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const lat = (latitude as { value: number | null }).value;
  const lng = (longitude as { value: number | null }).value;
  if (lat === null && lng === null) return { ok: true, value: null };
  if (lat === null) return { ok: false, errors: { latitude: "Enter the latitude as well, or clear both boxes." } };
  if (lng === null) return { ok: false, errors: { longitude: "Enter the longitude as well, or clear both boxes." } };
  if (lat === 0 && lng === 0) {
    return { ok: false, errors: { latitude: "Pick the property's location: 0, 0 is in the sea off West Africa." } };
  }
  return { ok: true, value: { latitude: lat, longitude: lng } };
}

// ---- Words ------------------------------------------------------------------

/** "12 of 20 results can be shown on the map", or null when there is nothing to say. */
export function mappableText(mappable: number | undefined, total: number): string | null {
  if (mappable === undefined || total === 0) return null;
  if (mappable >= total) return total === 1 ? "The result can be shown on the map." : `All ${total} results can be shown on the map.`;
  if (mappable === 0) return total === 1 ? "The result has no location, so it cannot be shown on the map." : `None of the ${total} results has a location, so none can be shown on the map.`;
  return `${mappable} of ${total} results can be shown on the map.`;
}

/** An OpenStreetMap link to a position, for reviewers to check it in a new tab. */
export function openStreetMapHref(latitude: number, longitude: number, zoom = 16): string {
  const lat = roundTo(latitude, COORDINATE_DECIMALS);
  const lng = roundTo(longitude, COORDINATE_DECIMALS);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
