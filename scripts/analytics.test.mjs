// Checks the pure rules of the first-party listing tracker (API 0.30.0): source and device classes,
// the Do Not Track / Global Privacy Control gate, the session pseudonym's rotation, and batching
// with de-duplication. Run with `npm test`.
// The session tests run in fixed time zones, so local midnight is known.
process.env.TZ = "Africa/Harare";

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANALYTICS_SCHEMA,
  batchBody,
  classifySource,
  dedupKey,
  deviceClass,
  EventQueue,
  formatSession,
  MAX_BATCH,
  newSession,
  nextLocalMidnight,
  PageViews,
  parseSession,
  readCookie,
  referrerHost,
  resolveSession,
  sessionCookie,
  sessionExpiry,
  sessionValid,
  trackingAllowed,
  uuidFromBytes,
} from "../src/lib/analytics/core.ts";

const own = "www.rightproperty365.com";
const source = (referrer, navigatedInApp = false) => classifySource({ referrer, ownHost: own, navigatedInApp });

test("no referrer is direct; this site is internal, with or without www", () => {
  assert.equal(source(""), "direct");
  assert.equal(source(null), "direct");
  assert.equal(source("not a url"), "direct");
  assert.equal(source("https://www.rightproperty365.com/listings?deal=rent"), "internal");
  assert.equal(source("https://rightproperty365.com/"), "internal");
});

test("after a navigation inside the site the source is internal, whatever the referrer says", () => {
  assert.equal(source("https://www.google.com/", true), "internal");
  assert.equal(source("", true), "internal");
});

test("search engines, including country domains and the Google app", () => {
  for (const referrer of [
    "https://www.google.com/",
    "https://www.google.co.zw/",
    "https://www.google.co.uk/search?q=x",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://search.yahoo.com/",
    "https://yandex.ru/",
    "https://search.brave.com/search?q=flat",
    "https://www.ecosia.org/",
    "android-app://com.google.android.googlequicksearchbox",
  ]) {
    assert.equal(source(referrer), "search_engine", referrer);
  }
});

test("web mail is email, before search: mail.google.com is not a search engine", () => {
  for (const referrer of [
    "https://mail.google.com/",
    "https://outlook.live.com/mail/0/",
    "https://outlook.office.com/",
    "https://mail.yahoo.com/",
    "https://webmail.example.co.zw/",
    "android-app://com.google.android.gm",
  ]) {
    assert.equal(source(referrer), "email", referrer);
  }
});

test("social sites and their short links", () => {
  for (const referrer of ["https://l.facebook.com/", "https://m.facebook.com/", "https://t.co/abc", "https://x.com/", "https://www.linkedin.com/", "https://lnkd.in/x", "https://wa.me/", "https://www.instagram.com/", "android-app://com.whatsapp"]) {
    assert.equal(source(referrer), "social", referrer);
  }
});

test("anything else is other, and look-alike hosts are not matched", () => {
  assert.equal(source("https://www.property24.com/"), "other");
  assert.equal(source("https://notfacebook.com/"), "other");
  assert.equal(source("https://facebook.com.evil.example/"), "other");
  assert.equal(source("https://rightproperty365.com.example/"), "other");
});

test("only the host is kept from a referrer", () => {
  assert.equal(referrerHost("https://www.Google.com/search?q=secret"), "google.com");
  assert.equal(referrerHost(""), null);
});

test("device class follows the site's breakpoints", () => {
  assert.equal(deviceClass(320), "mobile");
  assert.equal(deviceClass(767), "mobile");
  assert.equal(deviceClass(768), "tablet");
  assert.equal(deviceClass(1023), "tablet");
  assert.equal(deviceClass(1024), "desktop");
  assert.equal(deviceClass(2560), "desktop");
  assert.equal(deviceClass(0), "desktop");
  assert.equal(deviceClass(Number.NaN), "desktop");
});

test("Do Not Track 1 or Global Privacy Control on means nothing is sent", () => {
  assert.equal(trackingAllowed({}), true);
  assert.equal(trackingAllowed({ doNotTrack: "0" }), true);
  assert.equal(trackingAllowed({ doNotTrack: "unspecified", globalPrivacyControl: false }), true);
  assert.equal(trackingAllowed({ doNotTrack: "1" }), false);
  assert.equal(trackingAllowed({ globalPrivacyControl: true }), false);
  assert.equal(trackingAllowed({ doNotTrack: "1", globalPrivacyControl: true }), false);
  assert.equal(trackingAllowed(undefined), false);
});

// ---- Session pseudonym ------------------------------------------------------------

const bytes = (fill) => new Uint8Array(16).fill(fill);
const at = (local) => new Date(local).getTime(); // local time in TZ

test("a pseudonym is 128 random bits as 32 hex characters", () => {
  const record = newSession(bytes(0xab), 1);
  assert.equal(record.id, "ab".repeat(16));
  assert.throws(() => newSession(new Uint8Array(8), 1));
  assert.deepEqual(parseSession(formatSession(record)), record);
  assert.equal(parseSession("abc.1"), null);
  assert.equal(parseSession(""), null);
  assert.equal(parseSession(`${"AB".repeat(16)}.1`), null);
});

test("it rotates at local midnight", () => {
  const created = at("2026-11-18T23:59:00");
  assert.equal(nextLocalMidnight(created), at("2026-11-19T00:00:00"));
  assert.equal(sessionExpiry(created), at("2026-11-19T00:00:00"));
  const record = { id: "a".repeat(32), created };
  assert.equal(sessionValid(record, at("2026-11-18T23:59:59.999")), true);
  assert.equal(sessionValid(record, at("2026-11-19T00:00:00")), false);
});

test("a pseudonym made just after midnight lasts until the next midnight, never more than 24 hours", () => {
  const created = at("2026-11-18T00:00:00");
  assert.equal(sessionExpiry(created), at("2026-11-19T00:00:00"));
  assert.equal(sessionExpiry(created) - created, 24 * 60 * 60 * 1000);
});

test("a clock that went backwards rotates it", () => {
  const record = { id: "a".repeat(32), created: at("2026-11-18T12:00:00") };
  assert.equal(sessionValid(record, at("2026-11-18T11:00:00")), false);
  assert.equal(sessionValid(null, 0), false);
});

test("the tab's own pseudonym wins, then the cookie's, else a new one", () => {
  const now = at("2026-11-18T12:00:00");
  const tab = formatSession({ id: "1".repeat(32), created: now - 1000 });
  const cookie = formatSession({ id: "2".repeat(32), created: now - 2000 });
  const yesterday = formatSession({ id: "3".repeat(32), created: at("2026-11-17T22:00:00") });
  const fresh = () => bytes(0xcd);

  assert.deepEqual(resolveSession(tab, cookie, now, fresh), { record: parseSession(tab), fresh: false });
  assert.deepEqual(resolveSession(null, cookie, now, fresh), { record: parseSession(cookie), fresh: true });
  assert.deepEqual(resolveSession(yesterday, cookie, now, fresh), { record: parseSession(cookie), fresh: true });
  const made = resolveSession(yesterday, yesterday, now, fresh);
  assert.equal(made.fresh, true);
  assert.equal(made.record.id, "cd".repeat(16));
  assert.equal(made.record.created, now);
});

test("the cookie is first party, SameSite=Lax, and expires when the pseudonym rotates", () => {
  const record = { id: "f".repeat(32), created: at("2026-11-18T10:00:00") };
  const text = sessionCookie(record, true);
  assert.match(text, /^rp_as=f{32}\.\d+; Path=\/; Expires=/);
  assert.match(text, /SameSite=Lax; Secure$/);
  assert.ok(text.includes(new Date(at("2026-11-19T00:00:00")).toUTCString()));
  assert.doesNotMatch(sessionCookie(record, false), /Secure/);
  assert.doesNotMatch(text, /Domain=/);
  assert.equal(readCookie(`a=1; rp_as=${formatSession(record)}; b=2`, "rp_as"), formatSession(record));
  assert.equal(readCookie("a=1", "rp_as"), null);
});

test("local midnight follows daylight saving (London, the night the clocks go back)", () => {
  process.env.TZ = "Europe/London";
  try {
    // 25 October 2026: clocks go back at 02:00 BST. Midnight before is 23:00 UTC, the one after 00:00 UTC.
    const created = Date.UTC(2026, 9, 24, 23, 30);
    assert.equal(nextLocalMidnight(created), Date.UTC(2026, 9, 26, 0, 0));
    // That local day is 25 hours long, so the 24-hour cap ends it first.
    assert.equal(sessionExpiry(Date.UTC(2026, 9, 24, 23, 0)), Date.UTC(2026, 9, 25, 23, 0));
  } finally {
    process.env.TZ = "Africa/Harare";
  }
});

test("event ids are version 4 UUIDs", () => {
  const id = uuidFromBytes(bytes(0xff));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ---- Page views, batching and de-duplication --------------------------------------

const event = (n, type = "listing_detail_view") => ({
  event_id: `id-${n}`,
  type,
  occurred_at: "2026-11-18T10:00:00.000Z",
  listing_id: `listing-${n}`,
  source: "direct",
  device: "mobile",
  session: null,
  consent: { analytics: true },
});

test("a page view is a new address; the hash and re-renders are not", () => {
  const views = new PageViews();
  assert.equal(views.current("/listings/a"), 1);
  assert.equal(views.navigated, false);
  assert.equal(views.current("/listings/a#video-heading"), 1);
  assert.equal(views.current("/listings/a"), 1);
  assert.equal(views.current("/listings/b"), 2);
  assert.equal(views.navigated, true);
  assert.equal(views.current("/listings/a"), 3);
  views.restart();
  assert.equal(views.current("/listings/a"), 4);
});

test("one detail view per listing per page view; impressions per placement", () => {
  assert.equal(dedupKey(1, "listing_detail_view", "x"), dedupKey(1, "listing_detail_view", "x"));
  assert.notEqual(dedupKey(1, "listing_detail_view", "x"), dedupKey(2, "listing_detail_view", "x"));
  assert.notEqual(dedupKey(1, "listing_detail_view", "x"), dedupKey(1, "contact_click", "x"));
  assert.notEqual(dedupKey(1, "property_card_impression", "x", "rail"), dedupKey(1, "property_card_impression", "x", "home"));
  assert.equal(dedupKey(1, "property_card_impression", "x", "rail"), dedupKey(1, "property_card_impression", "x", "rail"));
});

test("the queue refuses a key it has seen, even after the event was sent", () => {
  const queue = new EventQueue();
  assert.equal(queue.add(event(1), "k1"), true);
  assert.equal(queue.add(event(1), "k1"), false);
  assert.equal(queue.size, 1);
  queue.take();
  assert.equal(queue.add(event(1), "k1"), false);
  assert.equal(queue.size, 0);
});

test("batches hold at most 50 events, oldest first", () => {
  const queue = new EventQueue();
  for (let n = 0; n < 120; n += 1) queue.add(event(n), `k${n}`);
  const first = queue.take();
  assert.equal(first.length, MAX_BATCH);
  assert.equal(first[0].event_id, "id-0");
  assert.equal(queue.take(500).length, 50);
  assert.equal(queue.take().length, 20);
  assert.equal(queue.take().length, 0);
});

test("a batch that could not be sent goes back to the front; the queue keeps the newest when full", () => {
  const queue = new EventQueue(5);
  for (let n = 0; n < 7; n += 1) queue.add(event(n), `k${n}`);
  assert.equal(queue.size, 5);
  const batch = queue.take(2);
  assert.deepEqual(batch.map((item) => item.event_id), ["id-2", "id-3"]);
  queue.putBack(batch);
  assert.deepEqual(queue.take().map((item) => item.event_id), ["id-2", "id-3", "id-4", "id-5", "id-6"]);
  queue.add(event(9), "k9");
  queue.clear();
  assert.equal(queue.size, 0);
});

test("the body is schema 1 with the session on every event", () => {
  const body = JSON.parse(batchBody([event(1), event(2, "contact_click")], "a".repeat(32)));
  assert.equal(body.schema, ANALYTICS_SCHEMA);
  assert.equal(body.schema, 1);
  assert.equal(body.events.length, 2);
  assert.ok(body.events.every((item) => item.session === "a".repeat(32) && item.consent.analytics === true));
  assert.equal(body.events[1].type, "contact_click");
  assert.equal("referrer" in body.events[0], false);
});
