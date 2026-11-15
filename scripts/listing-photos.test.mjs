// Checks the listing photo rules: the checks before an upload, the "7 of 20 photos" counter,
// reordering and the photo addresses. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apiPhotoUrl,
  moveItem,
  orderChanged,
  PHOTO_LIMIT,
  PHOTO_MAX_BYTES,
  photoCounter,
  photoDimensionsProblem,
  photoFileProblem,
  photoLimitMessage,
  photoSrcSet,
  photoVariantUrl,
  splitByRoom,
} from "../src/lib/listing-photos.ts";

const file = (name, type, size = 1024) => ({ name, type, size });

test("JPEG, PNG and WebP up to 15 MB may be sent", () => {
  assert.equal(photoFileProblem(file("house.jpg", "image/jpeg")), null);
  assert.equal(photoFileProblem(file("house.png", "image/png")), null);
  assert.equal(photoFileProblem(file("house.webp", "image/webp")), null);
  assert.equal(photoFileProblem(file("house.jpg", "image/jpeg", PHOTO_MAX_BYTES)), null);
});

test("other types, empty and large files are refused with a reason", () => {
  assert.match(photoFileProblem(file("plan.pdf", "application/pdf")), /^plan\.pdf is not a JPEG, PNG or WebP photo/);
  assert.match(photoFileProblem(file("logo.svg", "image/svg+xml")), /not a JPEG, PNG or WebP/);
  assert.match(photoFileProblem(file("anim.gif", "image/gif")), /not a JPEG, PNG or WebP/);
  assert.match(photoFileProblem(file("big.jpg", "image/jpeg", PHOTO_MAX_BYTES + 1)), /larger than 15 MB/);
  assert.match(photoFileProblem(file("empty.jpg", "image/jpeg", 0)), /is empty/);
});

test("without a type the file name decides", () => {
  assert.equal(photoFileProblem(file("IMG_0001.JPEG", "")), null);
  assert.match(photoFileProblem(file("notes.txt", "")), /not a JPEG/);
});

test("a photo needs 800 pixels on its longer side", () => {
  assert.equal(photoDimensionsProblem("a.jpg", 800, 600), null);
  assert.equal(photoDimensionsProblem("a.jpg", 400, 1200), null);
  assert.match(photoDimensionsProblem("a.jpg", 799, 500), /at least 800 pixels/);
  // An unreadable size is left to the API.
  assert.equal(photoDimensionsProblem("a.jpg", 0, 0), null);
});

test("the counter says how many of 20 and when the limit is reached", () => {
  assert.equal(PHOTO_LIMIT, 20);
  assert.deepEqual(photoCounter(0), { text: "0 of 20 photos", remaining: 20, full: false });
  assert.deepEqual(photoCounter(7), { text: "7 of 20 photos", remaining: 13, full: false });
  assert.deepEqual(photoCounter(20), { text: "20 of 20 photos", remaining: 0, full: true });
  assert.deepEqual(photoCounter(21), { text: "21 of 20 photos", remaining: 0, full: true });
  assert.equal(photoCounter(3, 5).text, "3 of 5 photos");
  assert.equal(photoLimitMessage(), "A property can have up to 20 photos.");
});

test("files beyond the limit are split off in the order chosen", () => {
  assert.deepEqual(splitByRoom(["a", "b", "c"], 18), { take: ["a", "b"], over: ["c"] });
  assert.deepEqual(splitByRoom(["a"], 20), { take: [], over: ["a"] });
  assert.deepEqual(splitByRoom(["a", "b"], 0), { take: ["a", "b"], over: [] });
});

test("moveItem moves one item and leaves the list it was given alone", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(ids, 2, 1), ["a", "c", "b", "d"]);
  assert.deepEqual(moveItem(ids, 0, 1), ["b", "a", "c", "d"]);
  assert.deepEqual(moveItem(ids, 3, 0), ["d", "a", "b", "c"]);
  // Past the ends it stops at the ends; an unknown index changes nothing.
  assert.deepEqual(moveItem(ids, 0, -1), ids);
  assert.deepEqual(moveItem(ids, 3, 9), ids);
  assert.deepEqual(moveItem(ids, 7, 0), ids);
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
  assert.equal(orderChanged(ids, moveItem(ids, 1, 2)), true);
  assert.equal(orderChanged(ids, [...ids]), false);
});

test("photo addresses get the public API address in front", () => {
  const base = "https://api.example.com";
  assert.equal(apiPhotoUrl("/v1/listing-photos/p1/large?v=1", base), "https://api.example.com/v1/listing-photos/p1/large?v=1");
  assert.equal(apiPhotoUrl("/assets/images/listing-house-borrowdale.jpg", base), "/assets/images/listing-house-borrowdale.jpg");
  assert.equal(apiPhotoUrl("https://cdn.example.com/x.jpg", base), "https://cdn.example.com/x.jpg");
});

test("variants become a srcset, widest first, and a size can be picked", () => {
  const base = "https://api.example.com";
  const variants = [
    { width: 640, height: 480, url: "/v1/listing-photos/p1/small?v=1" },
    { width: 2048, height: 1536, url: "/v1/listing-photos/p1/large?v=1" },
    { width: 1280, height: 960, url: "/v1/listing-photos/p1/medium?v=1" },
  ];
  assert.equal(
    photoSrcSet(variants, base),
    "https://api.example.com/v1/listing-photos/p1/large?v=1 2048w, https://api.example.com/v1/listing-photos/p1/medium?v=1 1280w, https://api.example.com/v1/listing-photos/p1/small?v=1 640w",
  );
  assert.equal(photoSrcSet([], base), undefined);
  assert.equal(photoSrcSet(undefined, base), undefined);
  const photo = { url: "/v1/listing-photos/p1/large?v=1", variants };
  assert.equal(photoVariantUrl(photo, "small", base), "https://api.example.com/v1/listing-photos/p1/small?v=1");
  assert.equal(photoVariantUrl(photo, "large", base), "https://api.example.com/v1/listing-photos/p1/large?v=1");
  assert.equal(photoVariantUrl(photo, "medium", base), "https://api.example.com/v1/listing-photos/p1/medium?v=1");
  // A managed photo names its sizes.
  const named = { url: "/x", variants: [{ size: "small", width: 500, height: 400, url: "/v1/listing-photos/p2/small?v=2" }] };
  assert.equal(photoVariantUrl(named, "small", base), "https://api.example.com/v1/listing-photos/p2/small?v=2");
  assert.equal(photoVariantUrl({ url: "/assets/images/a.jpg", variants: [] }, "small", base), "/assets/images/a.jpg");
});
