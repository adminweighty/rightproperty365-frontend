import {
  batchBody,
  classifySource,
  dedupKey,
  deviceClass,
  EventQueue,
  formatSession,
  PageViews,
  readCookie,
  resolveSession,
  SESSION_COOKIE,
  sessionCookie,
  trackingAllowed,
  uuidFromBytes,
  type AnalyticsEvent,
  type BrowserEventType,
  type Placement,
} from "@/lib/analytics/core";
import { CAMPAIGN_KEY, nextCampaign, type Campaign } from "@/lib/analytics/campaign";
import { env } from "@/lib/env";

/*
 * The browser side of the first-party tracker (API 0.30.0). Tiny and
 * self-contained: no third-party code. Events wait in a queue and are sent in
 * batches of up to 50 to POST /v1/analytics/events, a few seconds after the
 * first one and whenever the page is hidden or left (fetch with keepalive,
 * or navigator.sendBeacon where that is not available).
 *
 * Nothing is sent, and no pseudonym is kept, when the browser sends Do Not
 * Track or Global Privacy Control, or for an administrator session. Until the
 * session is known, events wait; an administrator's are then dropped.
 *
 * Only client components call this, from effects and event handlers, so the
 * pages themselves stay cached and the same for everyone.
 */

const ENDPOINT = "/v1/analytics/events";
const FLUSH_AFTER_MS = 5_000;

type Audience = "pending" | "visitor" | "admin";

let audience: Audience = "pending";
const queue = new EventQueue();
const pageViews = new PageViews();
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

const inBrowser = () => typeof window !== "undefined" && typeof navigator !== "undefined";

/** True when this browser may be measured at all (Do Not Track and Global Privacy Control are off). */
export function measurementAllowed(): boolean {
  return inBrowser() && trackingAllowed(navigator as Navigator & { globalPrivacyControl?: boolean });
}

/**
 * The campaign of this browser session (API 0.58.0): read from the current
 * address (a new utm_* landing replaces it) and kept in sessionStorage.
 * Nothing is read or kept under Do Not Track or Global Privacy Control, or
 * for an administrator session.
 */
export function currentCampaign(): Campaign | null {
  if (!measurementAllowed() || audience === "admin") return null;
  try {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(CAMPAIGN_KEY);
    } catch {
      // Storage blocked: the campaign of this page only.
    }
    const campaign = nextCampaign(window.location.search, stored);
    if (campaign) {
      try {
        window.sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
      } catch {
        // Storage blocked or full: nothing more to do.
      }
    }
    return campaign;
  } catch {
    return null;
  }
}

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytes;
}

function eventId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uuidFromBytes(randomBytes());
}

/** The session pseudonym: sessionStorage plus the first-party `rp_as` cookie, rotated at local midnight and within 24 hours. */
function sessionPseudonym(): string | null {
  try {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(SESSION_COOKIE);
    } catch {
      // Storage blocked: the cookie alone carries it.
    }
    const { record, fresh } = resolveSession(stored, readCookie(document.cookie, SESSION_COOKIE), Date.now(), randomBytes);
    if (fresh) {
      try {
        window.sessionStorage.setItem(SESSION_COOKIE, formatSession(record));
      } catch {
        // Not kept for the tab; the cookie still is.
      }
      document.cookie = sessionCookie(record, window.location.protocol === "https:");
    }
    return record.id;
  } catch {
    return null;
  }
}

function send(events: AnalyticsEvent[], leaving: boolean) {
  const body = batchBody(events, sessionPseudonym());
  const url = `${env.apiUrl}${ENDPOINT}`;
  if (typeof fetch === "function") {
    try {
      fetch(url, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => {
          // A 4xx is a batch the API will never take: drop it. A busy or failing API gets it again with the next batch.
          if (response.status >= 500 || response.status === 429) queue.putBack(events);
        })
        .catch(() => {
          if (!leaving) queue.putBack(events);
        });
      return;
    } catch {
      // keepalive refused (body too large, too many in flight): fall through to the beacon.
    }
  }
  if (typeof navigator.sendBeacon === "function") {
    // A CORS-safelisted type, so the beacon needs no preflight.
    navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }));
  }
}

/** Sends everything waiting, in batches of 50. */
export function flush(leaving = false): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (audience !== "visitor" || !measurementAllowed()) return;
  while (queue.size > 0) send(queue.take(), leaving);
}

function schedule() {
  if (audience !== "visitor") return;
  if (queue.size >= 50) {
    flush();
    return;
  }
  if (!timer) timer = setTimeout(() => flush(), FLUSH_AFTER_MS);
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) pageViews.restart();
  });
}

/**
 * Who is browsing, once the session is known: a visitor (signed in or not)
 * is measured; an administrator session never is.
 */
export function setAudience(next: Audience): void {
  audience = next;
  if (next === "admin") {
    queue.clear();
    if (timer) clearTimeout(timer);
    timer = null;
  } else if (next === "visitor" && queue.size > 0) {
    schedule();
  }
}

/** The current page view's number (a new one when the address changes). */
export function currentPageView(): number {
  return pageViews.current(`${window.location.pathname}${window.location.search}`);
}

type TrackInput = { type: BrowserEventType; listingId: string; placement?: Placement; rank?: number };

/** Records one event, at most once per page view (see `dedupKey`). */
export function track({ type, listingId, placement, rank }: TrackInput): void {
  if (!measurementAllowed() || audience === "admin" || !listingId) return;
  listen();
  const pageView = currentPageView();
  const event: AnalyticsEvent = {
    event_id: eventId(),
    type,
    occurred_at: new Date().toISOString(),
    listing_id: listingId,
    ...(type === "property_card_impression" && placement ? { placement, rank } : {}),
    source: classifySource({ referrer: document.referrer, ownHost: window.location.hostname, navigatedInApp: pageViews.navigated }),
    device: deviceClass(window.innerWidth || document.documentElement.clientWidth),
    session: null,
    consent: { analytics: true },
  };
  const campaign = currentCampaign();
  if (campaign) event.campaign = campaign;
  if (queue.add(event, dedupKey(pageView, type, listingId, placement))) schedule();
}

export const trackDetailView = (listingId: string) => track({ type: "listing_detail_view", listingId });
export const trackContactClick = (listingId: string) => track({ type: "contact_click", listingId });
export const trackYouTubePlay = (listingId: string) => track({ type: "youtube_play_intent", listingId });
