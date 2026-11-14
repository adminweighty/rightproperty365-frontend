// Checks the location lines built from what a listing or profile names. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fullPlace, joinPlaces, narrowestPlace, profilePlace, shortPlace } from "../src/lib/places.ts";

const harare = {
  suburb: { code: "avondale", label: "Avondale" },
  city: { code: "harare", label: "Harare" },
  region: { code: "harare", label: "Harare" },
  country: { code: "ZW", name: "Zimbabwe" },
};
// A country with no reference places: free-text city and region, no suburb.
const grandBaie = {
  suburb: null,
  city: { code: null, label: "Grand Baie" },
  region: { code: null, label: "Rivière du Rempart" },
  country: { code: "MU", name: "Mauritius" },
};

test("joinPlaces leaves out empty parts and a part that repeats the one before", () => {
  assert.equal(joinPlaces(["Avondale", "", null, undefined, "Harare", "harare", " Zimbabwe "]), "Avondale, Harare, Zimbabwe");
  assert.equal(joinPlaces([null, undefined, "  "]), "");
});

test("fullPlace names everything once", () => {
  assert.equal(fullPlace(harare), "Avondale, Harare, Zimbabwe");
  assert.equal(fullPlace(grandBaie), "Grand Baie, Rivière du Rempart, Mauritius");
  assert.equal(fullPlace({ suburb: null, city: { code: "london", label: "London" }, region: null }), "London");
  assert.equal(fullPlace({}), "");
});

test("shortPlace is suburb and city, or the country where one is missing", () => {
  assert.equal(shortPlace(harare), "Avondale, Harare");
  assert.equal(shortPlace(grandBaie), "Grand Baie, Mauritius");
  assert.equal(shortPlace({ region: { code: null, label: "Highlands" }, country: { name: "Scotland" } }), "Highlands, Scotland");
  assert.equal(shortPlace({ suburb: null, city: null }), "");
});

test("no line ever prints a missing value", () => {
  for (const line of [fullPlace(grandBaie), shortPlace(grandBaie), narrowestPlace(grandBaie), profilePlace(grandBaie)]) {
    assert.doesNotMatch(line, /undefined|null|, ,|^,|,$/);
  }
});

test("narrowestPlace and profilePlace", () => {
  assert.equal(narrowestPlace(harare), "Avondale");
  assert.equal(narrowestPlace(grandBaie), "Grand Baie");
  assert.equal(narrowestPlace({ country: { name: "Mauritius" } }), "Mauritius");
  assert.equal(profilePlace(harare), "Harare, Zimbabwe");
  assert.equal(profilePlace({ city: { code: null, label: "Port Louis" } }), "Port Louis");
});
