// Checks the notification rules: which links may be followed, the bell's
// badge, name and announcement, the polling back-off, relative times and the
// tolerant readers for the API's answers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bellLabel,
  changedPreferences,
  ESSENTIAL_REASON,
  essentialReason,
  MAX_POLL_INTERVAL_MS,
  notificationCountText,
  notificationHref,
  notificationsPageHref,
  pollDelay,
  preferenceErrorsByType,
  POLL_INTERVAL_MS,
  readNotificationPage,
  readPreferences,
  readUnreadCount,
  relativeTime,
  safeNotificationLink,
  stopsPolling,
  unreadAnnouncement,
  unreadBadgeText,
} from "../src/lib/notifications.ts";

test("safeNotificationLink keeps paths on this site", () => {
  assert.equal(safeNotificationLink("/agent/requests/123"), "/agent/requests/123");
  assert.equal(safeNotificationLink("/account/appointments?status=CONFIRMED#a1"), "/account/appointments?status=CONFIRMED#a1");
  assert.equal(safeNotificationLink("  /dashboard  "), "/dashboard");
  // Dot segments are resolved, and stay on the site.
  assert.equal(safeNotificationLink("/a/../../b"), "/b");
});

test("safeNotificationLink never follows anything off the site", () => {
  for (const value of [
    null,
    undefined,
    42,
    "",
    "https://evil.example/",
    "http://localhost:3000/account",
    "//evil.example/path",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,hi",
    "agent/requests/1",
    "/agent\n/requests",
    "/\t/evil.example",
    "/x\u007f",
    `/${"a".repeat(2001)}`,
  ]) {
    assert.equal(safeNotificationLink(value), null, JSON.stringify(value));
  }
});

test("notificationHref sends API paths with no page here to their list", () => {
  // The links of contract 0.35.0, "Links per type".
  assert.equal(notificationHref("/agent/requests/2b1d"), "/agent/requests/2b1d");
  assert.equal(notificationHref("/agent/enquiries/9"), "/agent/requests#business-enquiries");
  assert.equal(notificationHref("/agent/appointments/5"), "/agent/appointments");
  assert.equal(notificationHref("/account/appointments/5"), "/account/appointments");
  assert.equal(notificationHref("/agent/applications/7"), "/agent/applications/7");
  assert.equal(notificationHref("/account/applications/7"), "/account/applications/7");
  assert.equal(notificationHref("/agent/venue-bookings/3"), "/agent/venue-bookings");
  assert.equal(notificationHref("/account/hourly-bookings/3"), "/account/venue-bookings");
  assert.equal(notificationHref("/agent/listings/4"), "/agent/listings/4");
  assert.equal(notificationHref("/account/subscriptions/8"), "/account/subscription");
  assert.equal(notificationHref("/account"), "/account");
  assert.equal(notificationHref("/account/notifications"), "/account/notifications");
  // The lists themselves are left alone, and nothing unsafe gets through.
  assert.equal(notificationHref("/agent/appointments"), "/agent/appointments");
  assert.equal(notificationHref("https://evil.example/agent/requests/1"), null);
  assert.equal(notificationHref("//evil.example"), null);
});

test("the badge text and the bell's name", () => {
  assert.equal(unreadBadgeText(0), null);
  assert.equal(unreadBadgeText(null), null);
  assert.equal(unreadBadgeText(-3), null);
  assert.equal(unreadBadgeText(Number.NaN), null);
  assert.equal(unreadBadgeText(1), "1");
  assert.equal(unreadBadgeText(99), "99");
  assert.equal(unreadBadgeText(100), "99+");
  assert.equal(bellLabel(null), "Notifications");
  assert.equal(bellLabel(0), "Notifications, 0 unread");
  assert.equal(bellLabel(3), "Notifications, 3 unread");
  // The name gives the real number even when the badge is capped.
  assert.equal(bellLabel(140), "Notifications, 140 unread");
});

test("the count is announced only when it goes up", () => {
  assert.equal(unreadAnnouncement(null, 4), null, "the first count of a page");
  assert.equal(unreadAnnouncement(4, 4), null);
  assert.equal(unreadAnnouncement(4, 2), null, "reading notifications");
  assert.equal(unreadAnnouncement(0, 1), "You have 1 unread notification");
  assert.equal(unreadAnnouncement(2, 5), "You have 5 unread notifications");
  assert.equal(unreadAnnouncement(2, null), null);
});

test("polling backs off after failures and honours Retry-After", () => {
  assert.equal(POLL_INTERVAL_MS, 60_000);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 20].map((failures) => pollDelay(failures) / 60_000),
    [1, 2, 4, 8, 15, 15, 15],
  );
  assert.equal(pollDelay(-1), 60_000);
  assert.equal(pollDelay(Number.NaN), 60_000);
  assert.equal(pollDelay(1, 300), 300_000, "a longer Retry-After wins");
  assert.equal(pollDelay(3, 30), 8 * 60_000, "a shorter one does not shorten the back-off");
  assert.equal(pollDelay(1, 10 ** 9), MAX_POLL_INTERVAL_MS * 4, "an absurd Retry-After is capped");
  assert.equal(stopsPolling(401), true);
  assert.equal(stopsPolling(403), true);
  assert.equal(stopsPolling(500), false);
  assert.equal(stopsPolling(429), false);
  assert.equal(stopsPolling(0), false);
});

test("relativeTime", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  const ago = (seconds) => new Date(now - seconds * 1000).toISOString();
  assert.equal(relativeTime(ago(5), now), "just now");
  assert.equal(relativeTime(ago(-30), now), "just now");
  assert.equal(relativeTime(ago(60), now), "1 minute ago");
  assert.equal(relativeTime(ago(59 * 60), now), "59 minutes ago");
  assert.equal(relativeTime(ago(3600), now), "1 hour ago");
  assert.equal(relativeTime(ago(5 * 3600), now), "5 hours ago");
  assert.equal(relativeTime(ago(30 * 3600), now), "yesterday");
  assert.equal(relativeTime(ago(4 * 86400), now), "4 days ago");
  assert.equal(relativeTime(ago(8 * 86400), now), "1 week ago");
  assert.equal(relativeTime(ago(60 * 86400), now), null);
  assert.equal(relativeTime("not a date", now), null);
});

test("readUnreadCount and readNotificationPage tolerate missing parts", () => {
  assert.equal(readUnreadCount({ unread_count: 3 }), 3);
  assert.equal(readUnreadCount({ unread_count: "7" }), 7);
  assert.equal(readUnreadCount({}), null);
  assert.equal(readUnreadCount(null), null);
  assert.equal(readUnreadCount({ unread_count: -1 }), null);

  const page = readNotificationPage(
    {
      items: [
        { id: "n1", type: "NEW_ENQUIRY", title: "New property enquiry", body: "RP-ZW-10001 · Borrowdale", link: "/agent/requests/1", reference: "RP-ZW-10001", created_at: "2026-11-19T10:00:00Z", read_at: null },
        { id: "n2", type: "LISTING_REVIEWED", title: "", body: "", link: "https://evil.example/", created_at: "2026-11-18T10:00:00Z", read_at: "2026-11-18T11:00:00Z" },
        { type: "NO_ID" },
        "junk",
      ],
      unread_count: 1,
      page: 2,
      page_size: 20,
      total: 41,
    },
    2,
  );
  assert.equal(page.items.length, 2);
  assert.equal(page.items[0].link, "/agent/requests/1");
  assert.equal(page.items[1].link, null, "an absolute link is dropped");
  assert.equal(page.items[1].title, "Listing reviewed", "a missing title is made from the type");
  assert.equal(page.items[1].reference, null);
  assert.equal(page.total_pages, 3);
  assert.equal(page.page, 2);

  const empty = readNotificationPage(null, 4);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.page, 4);
  assert.equal(empty.total_pages, 1);
  assert.equal(empty.unread_count, 0);
});

test("readPreferences keeps in-app on and essential types on", () => {
  const items = readPreferences({
    items: [
      { type: "NEW_LEAD", label: "New leads", essential: false, email: true, push: false, in_app: false },
      { type: "ACCOUNT", label: "", essential: true, email: false, push: false, reason: "Needed for your account's security." },
      { label: "no type" },
    ],
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { type: "NEW_LEAD", label: "New leads", essential: false, essential_reason: null, email: true, push: false, in_app: true });
  assert.equal(items[1].label, "Account");
  assert.equal(items[1].email, true);
  assert.equal(items[1].push, true);
  assert.equal(items[1].essential_reason, "Needed for your account's security.");
  assert.deepEqual(readPreferences(undefined), []);
});

test("changedPreferences sends only what changed, never an essential type", () => {
  const saved = readPreferences({
    items: [
      { type: "NEW_LEAD", essential: false, email: true, push: true },
      { type: "TEAM_INVITATION", essential: false, email: true, push: false },
      { type: "ACCOUNT", essential: true, email: true, push: true },
    ],
  });
  assert.deepEqual(changedPreferences(saved, saved), []);
  const draft = saved.map((item) =>
    item.type === "NEW_LEAD" ? { ...item, push: false } : item.type === "ACCOUNT" ? { ...item, email: false } : item,
  );
  assert.deepEqual(changedPreferences(saved, draft), [{ type: "NEW_LEAD", email: true, push: false }]);
});

test("preferenceErrorsByType maps positions to types and drops the code", () => {
  const sent = [{ type: "NEW_LEAD" }, { type: "ACCOUNT" }];
  assert.deepEqual(
    preferenceErrorsByType(
      { "items[1].email": "PREFERENCE_ESSENTIAL: Account notices cannot be switched off.", "items[0].type": "Unknown type.", "items[9].push": "x", other: "y" },
      sent,
    ),
    { ACCOUNT: "Account notices cannot be switched off.", NEW_LEAD: "Unknown type." },
  );
  assert.deepEqual(preferenceErrorsByType({ "items[0].push": "PREFERENCE_ESSENTIAL:" }, sent), { NEW_LEAD: "This change cannot be saved." });
  assert.deepEqual(preferenceErrorsByType(undefined, sent), {});
});

test("essentialReason", () => {
  assert.equal(essentialReason({ type: "ACCOUNT", essential_reason: "From the API." }), "From the API.");
  assert.equal(essentialReason({ type: "SECURITY", essential_reason: null }), "Always on. Needed for your account's security.");
  assert.match(essentialReason({ type: "SUBSCRIPTION_INVOICE", essential_reason: null }), /Invoices/);
  assert.equal(essentialReason({ type: "SIGNING_CODE", essential_reason: null }), ESSENTIAL_REASON);
});

test("the list's addresses and count line", () => {
  assert.equal(notificationsPageHref(1), "/account/notifications");
  assert.equal(notificationsPageHref(3), "/account/notifications?page=3");
  assert.equal(notificationsPageHref(1, true), "/account/notifications?unread=1");
  assert.equal(notificationsPageHref(2, true), "/account/notifications?unread=1&page=2");
  assert.equal(
    notificationCountText({ total: 12, unread_count: 3, page: 1, total_pages: 1 }),
    "12 notifications, 3 unread, newest first",
  );
  assert.equal(
    notificationCountText({ total: 1, unread_count: 1, page: 2, total_pages: 2 }, true),
    "1 unread notification, page 2 of 2, newest first",
  );
});
