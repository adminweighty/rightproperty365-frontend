// Checks the YouTube tour rules: the player address after a press of play, the watch link,
// the placeholder thumbnail of a removed video and the start time in words. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatStart,
  isPlaceholderThumbnail,
  isYouTubeId,
  playerSrc,
  startText,
  thumbnailFor,
  UNAVAILABLE_ERRORS,
  watchHref,
  watchUrlFor,
} from "../src/lib/youtube.ts";

const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1";

test("the player address is the embed address plus autoplay, nothing removed", () => {
  assert.equal(playerSrc(embed), `${embed}&autoplay=1`);
  assert.equal(
    playerSrc(`${embed}&start=65`),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=65&autoplay=1",
  );
});

test("with an origin the IFrame API is enabled for that origin", () => {
  const src = new URL(playerSrc(embed, "https://www.rightproperty365.com"));
  assert.equal(src.searchParams.get("autoplay"), "1");
  assert.equal(src.searchParams.get("enablejsapi"), "1");
  assert.equal(src.searchParams.get("origin"), "https://www.rightproperty365.com");
  assert.equal(src.searchParams.get("rel"), "0");
});

test("only a youtube-nocookie embed of a valid id becomes a player", () => {
  assert.equal(playerSrc("https://www.youtube.com/embed/dQw4w9WgXcQ"), null);
  assert.equal(playerSrc("http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), null);
  assert.equal(playerSrc("https://www.youtube-nocookie.com/embed/short"), null);
  assert.equal(playerSrc("https://evil.example/embed/dQw4w9WgXcQ"), null);
  assert.equal(playerSrc("javascript:alert(1)"), null);
  assert.equal(playerSrc("not a url"), null);
});

test("the watch link starts where the player would", () => {
  const watch = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  assert.equal(watchHref(watch, null), watch);
  assert.equal(watchHref(watch, 0), watch);
  assert.equal(watchHref(watch, 65), `${watch}&t=65s`);
  assert.equal(watchHref("https://evil.example/watch?v=dQw4w9WgXcQ", null), null);
  assert.equal(watchHref("nope", 5), null);
});

test("ids, thumbnails and watch addresses", () => {
  assert.ok(isYouTubeId("dQw4w9WgXcQ"));
  assert.ok(isYouTubeId("a_b-C1234_9"));
  assert.ok(!isYouTubeId("dQw4w9WgXc"));
  assert.ok(!isYouTubeId("dQw4w9WgXcQ1"));
  assert.ok(!isYouTubeId("dQw4w9WgX<Q"));
  assert.ok(!isYouTubeId(null));
  assert.equal(thumbnailFor("dQw4w9WgXcQ"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(watchUrlFor("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("a removed video's 120 by 90 placeholder is recognised", () => {
  assert.ok(isPlaceholderThumbnail(120, 90));
  assert.ok(isPlaceholderThumbnail(0, 0));
  assert.ok(!isPlaceholderThumbnail(480, 360));
  assert.ok(!isPlaceholderThumbnail(1280, 720));
});

test("the unavailable error codes", () => {
  assert.deepEqual([...UNAVAILABLE_ERRORS], [100, 101, 150]);
});

test("start times read as a clock", () => {
  assert.equal(formatStart(null), null);
  assert.equal(formatStart(undefined), null);
  assert.equal(formatStart(0), null);
  assert.equal(formatStart(-3), null);
  assert.equal(formatStart(5), "0:05");
  assert.equal(formatStart(65), "1:05");
  assert.equal(formatStart(600), "10:00");
  assert.equal(formatStart(3723), "1:02:03");
  assert.equal(formatStart(65.9), "1:05");
  assert.equal(startText(65), "Starts at 1:05");
  assert.equal(startText(0), null);
});
