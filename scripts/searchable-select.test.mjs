// Checks the pure logic of SearchableSelect. Run with `npm test` (Node 22.18 or later,
// which runs the TypeScript source directly).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PAGE_SIZE,
  closedState,
  comboReducer,
  effectiveValue,
  filterOptions,
  flattenOptions,
  normalise,
  toSections,
} from "../src/lib/searchable-select.ts";

const places = flattenOptions([
  { value: "", label: "Any location" },
  { label: "Country", options: [{ value: "zw", label: "Zimbabwe", secondary: "(12)" }, { value: "ci", label: "Côte d’Ivoire", keywords: ["Ivory Coast"] }] },
  {
    label: "City or town",
    options: [
      { value: "harare", label: "Harare", secondary: "(6)" },
      { value: "bulawayo", label: "Bulawayo", disabled: true },
      { value: "sao-tome", label: "São Tomé" },
    ],
  },
]);

const run = (actions, options = places, value = "", state = closedState) =>
  actions.reduce((current, action) => comboReducer(current, action, options, value), state);

test("normalise removes case, diacritics and extra spaces", () => {
  assert.equal(normalise("  São   TOMÉ "), "sao tome");
});

test("flattenOptions keeps order, groups and text", () => {
  assert.deepEqual(places.map((option) => option.value), ["", "zw", "ci", "harare", "bulawayo", "sao-tome"]);
  assert.equal(places[1].group, "Country");
  assert.equal(places[0].group, undefined);
  assert.equal(places[3].text, "Harare (6)");
});

test("filterOptions matches anywhere, without case or diacritics", () => {
  const values = (query) => filterOptions(places, query).map((option) => option.value);
  assert.deepEqual(values("ARA"), ["harare"]);
  assert.deepEqual(values("sao"), ["sao-tome"]);
  assert.deepEqual(values("cote"), ["ci"]);
  assert.deepEqual(values("ivory"), ["ci"], "keywords");
  assert.deepEqual(values("(12)"), ["zw"], "secondary text");
  assert.deepEqual(values("city"), ["harare", "bulawayo", "sao-tome"], "group heading");
  assert.deepEqual(values("tome city"), ["sao-tome"], "every word must match");
  assert.deepEqual(values("xyz"), []);
  assert.equal(values("").length, places.length);
  assert.equal(values(null).length, places.length);
  assert.equal(values("   ").length, places.length);
});

test("toSections groups runs and caps the list", () => {
  const { sections, hidden } = toSections(places, 4);
  assert.deepEqual(sections.map((section) => section.label), [undefined, "Country", "City or town"]);
  assert.deepEqual(sections.map((section) => section.options.map(({ index }) => index)), [[0], [1, 2], [3]]);
  assert.equal(hidden, 2);
  assert.equal(toSections(places, 100).hidden, 0);
  // A heading stays while any of its options match.
  assert.deepEqual(toSections(filterOptions(places, "harare"), 100).sections.map((section) => section.label), ["City or town"]);
  // Two groups with the same label are not merged.
  const twins = flattenOptions([{ label: "A", options: [{ value: "1", label: "One" }] }, { label: "A", options: [{ value: "2", label: "Two" }] }]);
  assert.equal(toSections(twins, 100).sections.length, 2);
});

test("effectiveValue falls back to the first enabled option", () => {
  assert.equal(effectiveValue(places, "harare"), "harare");
  assert.equal(effectiveValue(places, "nowhere"), "");
  assert.equal(effectiveValue(places, undefined), "");
  assert.equal(effectiveValue(flattenOptions([{ value: "a", label: "A", disabled: true }, { value: "b", label: "B" }]), undefined), "b");
});

test("opening makes the selected option active", () => {
  const state = run([{ type: "open" }], places, "harare");
  assert.deepEqual({ open: state.open, active: state.active, navigated: state.navigated }, { open: true, active: 3, navigated: false });
});

test("typing opens, filters and makes the first enabled match active without navigating", () => {
  const state = run([{ type: "type", text: "a" }]);
  assert.equal(state.open, true);
  assert.equal(state.query, "a");
  assert.equal(state.active, 0);
  assert.equal(state.navigated, false);
  assert.equal(run([{ type: "type", text: "bul" }]).active, -1, "a disabled match is never active");
  assert.equal(run([{ type: "type", text: "" }]).active, -1, "nothing typed, nothing active");
});

test("arrow keys skip disabled options and do not wrap", () => {
  let state = run([{ type: "open" }, { type: "move", delta: 1 }], places, "harare");
  assert.equal(state.active, 5, "skips disabled Bulawayo");
  assert.equal(state.navigated, true);
  state = run([{ type: "move", delta: 1 }], places, "harare", state);
  assert.equal(state.active, 5, "stays on the last option");
  state = run([{ type: "first" }, { type: "move", delta: -1 }], places, "harare", state);
  assert.equal(state.active, 0);
  assert.equal(run([{ type: "last" }], places, "", state).active, 5);
});

test("arrow down on a closed list opens it on the selected or first option", () => {
  assert.equal(run([{ type: "move", delta: 1 }], places, "zw").active, 1);
  assert.equal(run([{ type: "move", delta: -1 }], flattenOptions([{ value: "a", label: "A" }, { value: "b", label: "B" }]), "zz").active, 1);
});

test("close keeps the typed text and reset forgets it", () => {
  const typed = run([{ type: "type", text: "har" }, { type: "close" }]);
  assert.deepEqual(typed, { ...closedState, query: "har" });
  assert.deepEqual(run([{ type: "reset" }], places, "", typed), closedState);
});

test("long lists render in pages and every option stays reachable", () => {
  const many = flattenOptions(Array.from({ length: 250 }, (_, index) => ({ value: `c${index}`, label: `Country ${index}` })));
  let state = run([{ type: "open" }], many, "c0");
  assert.equal(state.limit, PAGE_SIZE);
  assert.equal(toSections(many, state.limit).hidden, 150);
  for (let step = 0; step < 120; step += 1) state = comboReducer(state, { type: "move", delta: 1 }, many, "c0");
  assert.equal(state.active, 120);
  assert.equal(state.limit, 200);
  state = comboReducer(state, { type: "last" }, many, "c0");
  assert.equal(state.active, 249);
  assert.equal(state.limit, 300);
  assert.equal(run([{ type: "open" }], many, "c180").limit, 200, "opens with the selected option rendered");
  const more = run([{ type: "open" }, { type: "more" }], many, "c0");
  assert.equal(more.limit, 200);
  assert.equal(run([{ type: "more" }, { type: "more" }, { type: "more" }], many, "c0", more).limit, 300, "stops when all are rendered");
});
