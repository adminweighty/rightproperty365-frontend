// Checks the development showcase rules (API 0.44.0): price ranges, completion estimates, status labels,
// the public list's address and the structured data. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availabilityText,
  bedroomsText,
  compareAmounts,
  completionLabelFor,
  completionText,
  containsContactDetails,
  developmentJsonLd,
  developmentPath,
  developmentPlace,
  developmentsCollectionJsonLd,
  developmentsHeading,
  developmentsPath,
  developmentsQuery,
  developmentStatusLabel,
  groupAmount,
  isLocked,
  lockText,
  moderationStatusLabel,
  parseCompletionInput,
  parseDevelopmentsSearch,
  parsePriceInput,
  priceFromText,
  priceRangeText,
  sizeRangeText,
} from "../src/lib/developments.ts";

test("amounts are grouped as text, never rounded", () => {
  assert.equal(groupAmount("85000.00"), "85,000");
  assert.equal(groupAmount("1250000"), "1,250,000");
  assert.equal(groupAmount("950.5"), "950.50");
  assert.equal(groupAmount("123456789012.99"), "123,456,789,012.99");
  assert.equal(groupAmount("0.00"), "0");
  assert.equal(groupAmount("abc"), "abc");
});

test("the price range of a unit type", () => {
  assert.equal(priceRangeText({ on_request: false, from: "85000.00", to: null, currency: "USD" }), "From USD 85,000");
  assert.equal(priceRangeText({ on_request: false, from: "85000.00", to: "120000.00", currency: "USD" }), "USD 85,000 – 120,000");
  assert.equal(priceRangeText({ on_request: false, from: "85000.00", to: "85000.00", currency: "USD" }), "USD 85,000");
  assert.equal(priceRangeText({ on_request: true, from: null, to: null, currency: null }), "Price on request");
  assert.equal(priceRangeText(null), "Price on request");
});

test("the price on a project card", () => {
  assert.equal(priceFromText({ price_from: { amount: "95000.00", currency: "USD" }, price_on_request: false }), "From USD 95,000");
  assert.equal(priceFromText({ price_from: null, price_on_request: true }), "Price on request");
  assert.equal(priceFromText({ price_from: null, price_on_request: false }), null);
});

test("completion estimates", () => {
  assert.equal(completionLabelFor("2027-Q3"), "Q3 2027");
  assert.equal(completionLabelFor("2027-06-30"), "30 June 2027");
  assert.equal(completionLabelFor("2027-02-30"), null);
  assert.equal(completionLabelFor("2028-02-29"), "29 February 2028");
  assert.equal(completionText({ kind: "QUARTER", value: "2027-Q3", label: "Q3 2027" }), "Completion expected Q3 2027");
  assert.equal(completionText({ kind: "DATE", value: "2027-06-30", label: "" }), "Completion expected 30 June 2027");
  assert.equal(completionText({ kind: "QUARTER", value: "2025-Q1", label: "Q1 2025" }, "COMPLETED"), "Completed Q1 2025");
  assert.equal(completionText(null, "COMPLETED"), "Completed");
  assert.equal(completionText(null, "SELLING"), null);
});

test("what a developer types for a completion estimate", () => {
  assert.deepEqual(parseCompletionInput(""), { ok: true, value: null });
  assert.deepEqual(parseCompletionInput("2027-q3"), { ok: true, value: "2027-Q3" });
  assert.deepEqual(parseCompletionInput("Q3 2027"), { ok: true, value: "2027-Q3" });
  assert.deepEqual(parseCompletionInput(" 2027-06-30 "), { ok: true, value: "2027-06-30" });
  assert.equal(parseCompletionInput("2027-Q5").ok, false);
  assert.equal(parseCompletionInput("June 2027").ok, false);
});

test("status labels", () => {
  assert.equal(developmentStatusLabel("UNDER_CONSTRUCTION"), "Under construction");
  assert.equal(developmentStatusLabel({ code: "SELLING", label: "Now selling" }), "Now selling");
  assert.equal(developmentStatusLabel({ code: "SOLD_OUT", label: "" }), "Sold out");
  assert.equal(developmentStatusLabel("ON_HOLD"), "On hold");
  assert.equal(moderationStatusLabel("PENDING_REVIEW"), "Waiting for review");
  assert.equal(isLocked("PUBLISHED"), true);
  assert.equal(isLocked("REJECTED"), false);
  assert.match(lockText("PENDING_REVIEW") ?? "", /withdraw/);
  assert.equal(lockText("DRAFT"), null);
});

test("sizes, bedrooms and availability", () => {
  assert.equal(sizeRangeText({ min: 180, max: 210 }), "180–210 m²");
  assert.equal(sizeRangeText({ min: 180, max: null }), "From 180 m²");
  assert.equal(sizeRangeText({ min: null, max: 1200 }), "Up to 1,200 m²");
  assert.equal(sizeRangeText({ min: 90, max: 90 }), "90 m²");
  assert.equal(sizeRangeText(null), null);
  assert.equal(bedroomsText(3), "3 bedrooms");
  assert.equal(bedroomsText(1), "1 bedroom");
  assert.equal(bedroomsText(0), "Studio");
  assert.equal(bedroomsText(null), null);
  assert.equal(availabilityText({ units_total: 24, units_available: 9 }), "9 of 24 available");
  assert.equal(availabilityText({ units_total: 24, units_available: 0 }), "All 24 units sold");
  assert.equal(availabilityText({ units_total: null, units_available: null }), null);
});

const context = {
  markets: ["ZW", "GB"],
  cities: [
    { code: "harare", market_code: "ZW" },
    { code: "london", market_code: "GB" },
  ],
};

test("the filter address round trip", () => {
  const filters = { market: "ZW", city: "harare", status: "SELLING", q: "garden" };
  const path = developmentsPath(filters, 2);
  assert.equal(path, "/developments?market=ZW&city=harare&status=SELLING&q=garden&page=2");
  const params = Object.fromEntries(new URL(path, "https://example.test").searchParams);
  const search = parseDevelopmentsSearch(params, context);
  assert.deepEqual(search.filters, filters);
  assert.equal(search.page, 2);
  assert.equal(search.path, path);
  assert.equal(search.invalid, false);
  assert.deepEqual(developmentsQuery(search), { market: "ZW", city: "harare", status: "SELLING", q: "garden", page: 2, page_size: 12 });
  assert.equal(developmentsPath({}), "/developments");
  assert.equal(developmentsPath({ market: "zw" }, 1), "/developments?market=ZW");
});

test("which list addresses are indexed", () => {
  assert.equal(parseDevelopmentsSearch({}, context).indexable, true);
  assert.equal(parseDevelopmentsSearch({ market: "ZW" }, context).indexable, true);
  assert.equal(parseDevelopmentsSearch({ city: "harare", page: "2" }, context).indexable, true);
  assert.equal(parseDevelopmentsSearch({ q: "garden" }, context).indexable, false);
  assert.equal(parseDevelopmentsSearch({ status: "SELLING" }, context).indexable, false);
  assert.equal(parseDevelopmentsSearch({ market: "ZW", city: "harare" }, context).indexable, false);
  // Unknown, invalid or badly cased values are dropped and never indexed.
  const odd = parseDevelopmentsSearch({ market: "FR", city: "london", status: "OPEN", sort: "x" }, context);
  assert.deepEqual(odd.filters, { city: "london" });
  assert.equal(odd.invalid, true);
  assert.equal(odd.indexable, false);
  assert.equal(parseDevelopmentsSearch({ market: "ZW", city: "london" }, context).filters.city, undefined);
  assert.equal(parseDevelopmentsSearch({ market: "zw" }, context).indexable, false);
  assert.equal(parseDevelopmentsSearch({ page: "0" }, context).invalid, true);
  // Empty parameters (a form sent without JavaScript) are ignored.
  const empty = parseDevelopmentsSearch({ market: "", city: "", q: "" }, context);
  assert.equal(empty.path, "/developments");
  assert.equal(empty.indexable, true);
});

test("headings, places and project addresses", () => {
  assert.equal(developmentsHeading({}), "New developments");
  assert.equal(developmentsHeading({ market: "ZW" }, { market: "Zimbabwe" }), "New developments in Zimbabwe");
  assert.equal(developmentsHeading({ status: "SELLING", city: "harare" }, { city: "Harare" }), "Selling developments in Harare");
  assert.equal(developmentPath({ market: { code: "ZW" }, slug: "borrowdale-heights" }), "/developments/zw/borrowdale-heights");
  const location = {
    country: { code: "ZW", name: "Zimbabwe" },
    region: { code: "harare", label: "Harare" },
    city: { code: "harare", label: "Harare" },
    suburb: { code: "borrowdale", label: "Borrowdale" },
    coordinates: null,
  };
  assert.equal(developmentPlace(location), "Borrowdale, Harare");
  assert.equal(developmentPlace({ ...location, suburb: null }), "Harare, Zimbabwe");
});

test("price checks keep amounts exact", () => {
  assert.deepEqual(parsePriceInput("185 000"), { ok: true, value: "185000" });
  assert.deepEqual(parsePriceInput("1,250.50"), { ok: true, value: "1250.50" });
  assert.equal(parsePriceInput("12.345").ok, false);
  assert.ok(compareAmounts("185000", "240000.00") < 0);
  assert.ok(compareAmounts("99999.99", "100000") < 0);
  assert.equal(compareAmounts("120000.0", "120000.00"), 0);
  assert.ok(compareAmounts("2.5", "2.05") > 0);
});

test("contact details in free text", () => {
  assert.equal(containsContactDetails("Call +263 77 123 4567"), true);
  assert.equal(containsContactDetails("Ring 0771 234 567 today"), true);
  assert.equal(containsContactDetails("sales@example.test"), true);
  assert.equal(containsContactDetails("https://wa.me/263771234567"), true);
  assert.equal(containsContactDetails("Priced 185000-240000 in phase 1"), false);
  assert.equal(containsContactDetails("Completion 2027-06-30"), false);
});

const origins = { site: "https://www.example.test", api: "https://api.example.test" };

const development = {
  id: "d1",
  market: { code: "ZW", name: "Zimbabwe" },
  slug: "borrowdale-heights",
  name: "Borrowdale Heights",
  summary: "Cluster homes in Borrowdale.",
  description: "Gated cluster homes.",
  status: { code: "SELLING", label: "Selling" },
  completion: { kind: "QUARTER", value: "2027-Q3", label: "Q3 2027" },
  location: {
    country: { code: "ZW", name: "Zimbabwe" },
    region: { code: "harare", label: "Harare" },
    city: { code: "harare", label: "Harare" },
    suburb: { code: "borrowdale", label: "Borrowdale" },
    coordinates: { latitude: -17.75, longitude: 31.09, precision: "APPROXIMATE" },
  },
  cover_photo: { url: "/v1/development-photos/p1/large?v=1", alt: "Street", width: 2048, height: 1365, variants: [] },
  price_from: { amount: "95000.00", currency: "USD" },
  price_on_request: false,
  unit_type_count: 3,
  developer: { kind: "developers", slug: "sample-developments", name: "Sample Developments", verified: true, logo: null },
  published_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  amenities: [{ code: "clubhouse", label: "Clubhouse" }],
  investment_highlights: { stated_by: "DEVELOPER", disclaimer: "Stated by the developer.", items: [] },
  photos: [
    { url: "/v1/development-photos/p1/large?v=1", alt: "Street", width: 2048, height: 1365, variants: [] },
    { url: "/assets/images/listing-house-borrowdale.jpg", alt: "House", width: 1600, height: 1067, variants: [] },
  ],
  video: null,
  phases: [],
  available_units: [],
};

test("the project page's structured data", () => {
  const data = developmentJsonLd(development, origins);
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "WebPage");
  assert.equal(data.url, "https://www.example.test/developments/zw/borrowdale-heights");
  assert.equal(data.breadcrumb["@type"], "BreadcrumbList");
  assert.deepEqual(
    data.breadcrumb.itemListElement.map((item) => [item.position, item.name, item.item]),
    [
      [1, "Home", "https://www.example.test/"],
      [2, "New developments", "https://www.example.test/developments"],
      [3, "Zimbabwe", "https://www.example.test/developments?market=ZW"],
      [4, "Borrowdale Heights", "https://www.example.test/developments/zw/borrowdale-heights"],
    ],
  );
  assert.equal(data.about["@type"], "Place");
  assert.deepEqual(data.mainEntity, { "@id": data.about["@id"] });
  assert.deepEqual(data.about.address, {
    "@type": "PostalAddress",
    addressLocality: "Borrowdale, Harare",
    addressRegion: "Harare",
    addressCountry: "ZW",
  });
  // An approximate position is an area: no geo.
  assert.equal("geo" in data.about, false);
  assert.deepEqual(data.about.photo, [
    "https://api.example.test/v1/development-photos/p1/large?v=1",
    "https://www.example.test/assets/images/listing-house-borrowdale.jpg",
  ]);
  assert.equal(data.about.amenityFeature[0].name, "Clubhouse");
  assert.equal(data.mentions.url, "https://www.example.test/directory/developers/sample-developments");
  // No offer, and no contact details anywhere.
  const text = JSON.stringify(data);
  assert.equal(text.includes("Offer"), false);
  assert.equal(/telephone|email/i.test(text), false);

  const exact = developmentJsonLd(
    { ...development, location: { ...development.location, coordinates: { latitude: -17.751, longitude: 31.092, precision: "EXACT" } } },
    origins,
  );
  assert.deepEqual(exact.about.geo, { "@type": "GeoCoordinates", latitude: -17.751, longitude: 31.092 });
});

test("the list page's structured data", () => {
  const data = developmentsCollectionJsonLd({ path: "/developments?market=ZW&page=2", page: 2 }, "New developments in Zimbabwe", { items: [development], total: 13 }, origins);
  assert.equal(data["@type"], "CollectionPage");
  assert.equal(data.url, "https://www.example.test/developments?market=ZW&page=2");
  assert.equal(data.mainEntity["@type"], "ItemList");
  assert.equal(data.mainEntity.numberOfItems, 13);
  assert.deepEqual(data.mainEntity.itemListElement[0], {
    "@type": "ListItem",
    position: 13,
    url: "https://www.example.test/developments/zw/borrowdale-heights",
    name: "Borrowdale Heights",
  });
});
