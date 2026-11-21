// Checks the upload intent rules of the website (API 0.60.0). Run with `npm test`.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fallBackAfter, photoContentType, toHex } from "../src/lib/upload-intent.ts";

test("when to fall back to the multipart upload", () => {
  assert.equal(fallBackAfter("create", { status: 404, code: "NOT_FOUND" }), true);
  assert.equal(fallBackAfter("create", { status: 429, code: "UPLOAD_INTENTS_LIMIT" }), true);
  assert.equal(fallBackAfter("create", { status: 400, code: "VALIDATION_FAILED" }), false);
  assert.equal(fallBackAfter("put", { status: 0, code: "NETWORK_ERROR" }), true);
  assert.equal(fallBackAfter("put", { status: 403, code: "HTTP_403" }), true);
  assert.equal(fallBackAfter("complete", { status: 422, code: "UPLOAD_REJECTED" }), false);
  assert.equal(fallBackAfter("complete", { status: 503, code: "SCANNER_UNAVAILABLE" }), false);
  assert.equal(fallBackAfter("complete", { status: 409, code: "UPLOAD_REJECTED" }), false);
  assert.equal(fallBackAfter("complete", { status: 502, code: "HTTP_502" }), true);
});

test("hex digest and types", () => {
  const digest = createHash("sha256").update("photo").digest();
  assert.equal(toHex(new Uint8Array(digest)), createHash("sha256").update("photo").digest("hex"));
  assert.equal(photoContentType("IMAGE/JPEG"), "image/jpeg");
  assert.equal(photoContentType("image/gif"), null);
});
