// Checks the map rules: which tiles a build may use, the `bbox` of a map search,
// coordinates in words and in the editor's boxes, and the "N of M" line. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coordinateForInput,
  formatBbox,
  formatCoordinates,
  isProductionSite,
  mappableText,
  mapTiles,
  openStreetMapHref,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  parseBbox,
  parseCoordinate,
  parseCoordinatePair,
  roundCoordinate,
  sameBbox,
} from "../src/lib/map.ts";

const production = { nodeEnv: "production", testSite: false, siteUrl: "https://www.rightproperty365.com" };

test("OpenStreetMap's public tiles are the default only outside production", () => {
  assert.deepEqual(mapTiles({ ...production, nodeEnv: "development" }), { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION });
  assert.deepEqual(mapTiles({ ...production, testSite: true }), { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION });
  // A production build run on this computer is not the production site.
  assert.notEqual(mapTiles({ ...production, siteUrl: "http://localhost:3000" }), null);
  assert.notEqual(mapTiles({ ...production, siteUrl: "http://rp.test" }), null);
  // Production with no tile URL: no map at all.
  assert.equal(mapTiles(production), null);
  assert.equal(mapTiles({ ...production, tileUrl: "   " }), null);
});

test("a configured tile URL wins everywhere, with its attribution", () => {
  const tiles = mapTiles({ ...production, tileUrl: "https://tiles.example.com/{z}/{x}/{y}.png", attribution: "© Example" });
  assert.deepEqual(tiles, { url: "https://tiles.example.com/{z}/{x}/{y}.png", attribution: "© Example" });
  // OpenStreetMap's own URL without an attribution still credits OpenStreetMap.
  assert.equal(mapTiles({ ...production, tileUrl: OSM_TILE_URL })?.attribution, OSM_ATTRIBUTION);
  // Only https (or a local http server) may be used.
  assert.equal(mapTiles({ ...production, tileUrl: "http://tiles.example.com/{z}/{x}/{y}.png" }), null);
  assert.equal(mapTiles({ ...production, tileUrl: "javascript:alert(1)" }), null);
  assert.notEqual(mapTiles({ ...production, tileUrl: "http://localhost:8081/{z}/{x}/{y}.png" }), null);
});

test("production means a production build of a real, non-test site", () => {
  assert.equal(isProductionSite(production), true);
  assert.equal(isProductionSite({ ...production, nodeEnv: undefined }), false);
  assert.equal(isProductionSite({ ...production, siteUrl: "https://staging.rightproperty365.com", testSite: true }), false);
  assert.equal(isProductionSite({ ...production, siteUrl: "not a url" }), true);
});

test("a bbox is four numbers, south below north and west left of east", () => {
  assert.deepEqual(parseBbox("31.0,-17.9,31.1,-17.7"), { west: 31, south: -17.9, east: 31.1, north: -17.7 });
  assert.deepEqual(parseBbox(" -0.2 , 51.4 , 0.1 , 51.6 "), { west: -0.2, south: 51.4, east: 0.1, north: 51.6 });
  assert.equal(parseBbox(undefined), null);
  assert.equal(parseBbox(""), null);
  assert.equal(parseBbox("1,2,3"), null);
  assert.equal(parseBbox("1,2,3,4,5"), null);
  assert.equal(parseBbox("a,2,3,4"), null);
  assert.equal(parseBbox("1e1,2,3,4"), null);
  // Across the antimeridian is not supported.
  assert.equal(parseBbox("170,-10,-170,10"), null);
  assert.equal(parseBbox("31,-17,31,-16"), null);
  assert.equal(parseBbox("31,-16,32,-17"), null);
  assert.equal(parseBbox("-181,0,10,10"), null);
  assert.equal(parseBbox("0,-91,10,10"), null);
  assert.equal(parseBbox("0,0,10,90.5"), null);
});

test("a map's box is written outwards to 4 decimals and kept inside the world", () => {
  assert.equal(formatBbox({ west: 31.04123456, south: -17.85555, east: 31.0611111, north: -17.80001 }), "31.0412,-17.8556,31.0612,-17.8");
  // Zoomed out past the edges of the world.
  assert.equal(formatBbox({ west: -250, south: -95, east: 400, north: 95 }), "-180,-90,180,90");
  assert.equal(formatBbox({ west: -0.00001, south: -0.00001, east: 0.00001, north: 0.00001 }), "-0.0001,-0.0001,0.0001,0.0001");
  // Never "-0".
  assert.equal(formatBbox({ west: -0, south: -1, east: 1, north: 1 }), "0,-1,1,1");
  // An empty box cannot be searched.
  assert.equal(formatBbox({ west: 200, south: 0, east: 300, north: 1 }), null);
  // What is written is read back the same.
  const text = formatBbox({ west: 31.04, south: -17.86, east: 31.07, north: -17.8 });
  assert.equal(formatBbox(parseBbox(text)), text);
});

test("two boxes are the same when their addresses are", () => {
  const a = { west: 31.04001, south: -17.86, east: 31.07, north: -17.8 };
  assert.equal(sameBbox(a, { ...a, west: 31.040011 }), true);
  assert.equal(sameBbox(a, { ...a, west: 31.03 }), false);
  assert.equal(sameBbox(a, null), false);
  assert.equal(sameBbox(null, null), true);
});

test("coordinates are rounded to 6 decimals for the API and shown by precision", () => {
  assert.equal(roundCoordinate(-17.82485812345), -17.824858);
  assert.equal(roundCoordinate(-0.0000001), 0);
  assert.equal(formatCoordinates(-17.824858, 31.0498), "-17.824858, 31.049800");
  assert.equal(formatCoordinates(-17.824858, 31.0498, "APPROXIMATE"), "-17.82, 31.05");
  assert.equal(coordinateForInput(31.0498), "31.0498");
  assert.equal(coordinateForInput(-17.82485812), "-17.824858");
  assert.equal(coordinateForInput(null), "");
  assert.equal(coordinateForInput(undefined), "");
});

test("an OpenStreetMap link points at the position", () => {
  assert.equal(openStreetMapHref(-17.8248581, 31.0498), "https://www.openstreetmap.org/?mlat=-17.824858&mlon=31.0498#map=16/-17.824858/31.0498");
});

test("a coordinate box takes a decimal number in range with up to 6 decimals", () => {
  assert.deepEqual(parseCoordinate("", "latitude"), { ok: true, value: null });
  assert.deepEqual(parseCoordinate(" -17.824858 ", "latitude"), { ok: true, value: -17.824858 });
  assert.deepEqual(parseCoordinate("−17,5", "latitude"), { ok: true, value: -17.5 });
  assert.deepEqual(parseCoordinate("+31", "longitude"), { ok: true, value: 31 });
  assert.equal(parseCoordinate("-0", "latitude").ok && Object.is(parseCoordinate("-0", "latitude").value, 0), true);
  assert.equal(parseCoordinate("abc", "latitude").ok, false);
  assert.equal(parseCoordinate("17.1234567", "latitude").ok, false);
  assert.equal(parseCoordinate("90.5", "latitude").ok, false);
  assert.deepEqual(parseCoordinate("179.9", "longitude"), { ok: true, value: 179.9 });
  assert.equal(parseCoordinate("181", "longitude").ok, false);
  assert.match(parseCoordinate("91", "latitude").message, /from -90 to 90/);
});

test("the two boxes are saved together, or cleared together", () => {
  assert.deepEqual(parseCoordinatePair("", ""), { ok: true, value: null });
  assert.deepEqual(parseCoordinatePair("-17.8", "31.05"), { ok: true, value: { latitude: -17.8, longitude: 31.05 } });
  assert.deepEqual(Object.keys(parseCoordinatePair("-17.8", "").errors), ["longitude"]);
  assert.deepEqual(Object.keys(parseCoordinatePair("", "31").errors), ["latitude"]);
  assert.deepEqual(Object.keys(parseCoordinatePair("x", "y").errors), ["latitude", "longitude"]);
  // (0, 0) is a pin that was never placed.
  assert.equal(parseCoordinatePair("0", "0").ok, false);
  assert.equal(parseCoordinatePair("0", "0.1").ok, true);
});

test("the map says how many results it can show", () => {
  assert.equal(mappableText(12, 20), "12 of 20 results can be shown on the map.");
  assert.equal(mappableText(20, 20), "All 20 results can be shown on the map.");
  assert.equal(mappableText(1, 1), "The result can be shown on the map.");
  assert.equal(mappableText(0, 3), "None of the 3 results has a location, so none can be shown on the map.");
  assert.equal(mappableText(0, 1), "The result has no location, so it cannot be shown on the map.");
  assert.equal(mappableText(undefined, 20), null);
  assert.equal(mappableText(0, 0), null);
});
