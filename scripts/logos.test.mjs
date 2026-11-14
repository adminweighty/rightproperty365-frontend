// Checks logo addresses, the initials shown without a logo, and the rules for an uploaded logo. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LOGO_MAX_BYTES, logoProblem } from "../src/lib/logo-rules.ts";
import { logoUrl, monogram, monogramTone } from "../src/lib/logos.ts";

test("logoUrl puts the public API address in front of the API's path", () => {
  const logo = { url: "/v1/directory/agencies/sample-estates/logo?v=6ee9776d074c" };
  assert.equal(logoUrl(logo, "https://api.example.com"), "https://api.example.com/v1/directory/agencies/sample-estates/logo?v=6ee9776d074c");
  assert.equal(logoUrl({ url: "v1/x/logo" }, "https://api.example.com"), "https://api.example.com/v1/x/logo");
  // An address that is already absolute is left alone.
  assert.equal(logoUrl({ url: "https://cdn.example.com/a.png" }, "https://api.example.com"), "https://cdn.example.com/a.png");
});

test("monogram is up to two initials", () => {
  assert.equal(monogram("Sample Realty"), "SR");
  assert.equal(monogram("Sample Homes Bulawayo"), "SH");
  assert.equal(monogram("Grace Mhlanga"), "GM");
  assert.equal(monogram("Moyo and Dube"), "MD");
  assert.equal(monogram("  the   Agency of Harare "), "AH");
  assert.equal(monogram("Élan"), "É");
  assert.equal(monogram("(Pty) Ltd"), "PL");
  assert.equal(monogram(""), "?");
});

test("monogramTone gives one name one colour, inside the range", () => {
  assert.equal(monogramTone("Sample Realty", 6), monogramTone(" sample realty ", 6));
  for (const name of ["Sample Realty", "Grace Mhlanga", "A", "", "Élan Properties"]) {
    const tone = monogramTone(name, 6);
    assert.ok(Number.isInteger(tone) && tone >= 0 && tone < 6, `${name}: ${tone}`);
  }
  assert.equal(monogramTone("Anything", 0), 0);
});

test("logoProblem accepts PNG and JPEG up to 2 MB", () => {
  assert.equal(logoProblem({ name: "logo.png", size: 50_000, type: "image/png" }), null);
  assert.equal(logoProblem({ name: "me.jpg", size: LOGO_MAX_BYTES, type: "image/jpeg" }), null);
  assert.equal(logoProblem({ name: "unknown", size: 10, type: "" }), null, "no type: the API decides by content");
  assert.match(logoProblem({ name: "logo.svg", size: 10, type: "image/svg+xml" }), /not a PNG or JPEG/);
  assert.match(logoProblem({ name: "doc.pdf", size: 10, type: "application/pdf" }), /not a PNG or JPEG/);
  assert.match(logoProblem({ name: "big.png", size: LOGO_MAX_BYTES + 1, type: "image/png" }), /larger than 2 MB/);
});
