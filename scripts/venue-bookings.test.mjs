// Checks how hourly venue bookings are read, what each party may do and how refusals read. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SLOT_TAKEN_TEXT,
  cancellationWindow,
  customerActions,
  hostActions,
  normaliseBooking,
  normaliseBookings,
  refusalReason,
  slotUnavailableText,
  statusLabel,
  statusTone,
} from "../src/lib/venue-bookings.ts";

const base = {
  id: "b1",
  reference: "RPV-1",
  status: "REQUESTED",
  listing: { id: "l1", slug: "showroom", title: "Showroom", reference: "RP-1" },
  start: "2026-11-25T08:00:00Z",
  end: "2026-11-25T12:00:00Z",
  time_zone: "Africa/Harare",
  currency: "USD",
  quote: { lines: [{ code: "RATE", label: "4 h × USD 50.00", amount: "200.00" }], total_excluding_deposit: "230.00", deposit: "100.00" },
  cancellation_policy: "Free until 48 hours before.",
  free_cancellation_hours: 48,
};
const before = Date.parse("2026-11-20T08:00:00Z");
const after = Date.parse("2026-11-25T13:00:00Z");

test("a booking is read from the contract's fields", () => {
  const booking = normaliseBooking({ booking: base });
  assert.equal(booking.id, "b1");
  assert.equal(booking.statusLabel, "Requested");
  assert.equal(booking.listing.slug, "showroom");
  assert.equal(booking.lines[0].amount, "200.00");
  assert.equal(booking.totalExcludingDeposit, "230.00");
  assert.equal(booking.deposit, "100.00");
  assert.equal(booking.cancellationPolicy, "Free until 48 hours before.");
  assert.equal(booking.freeCancellationHours, 48);
  assert.equal(booking.proposed, null);
  assert.equal(normaliseBooking({}), null);
  assert.equal(normaliseBookings({ items: [base, { nope: true }] }).length, 1);
  assert.equal(normaliseBookings([base]).length, 1);
  assert.equal(statusLabel("NO_SHOW"), "No show");
  assert.equal(statusLabel("NO_SHOW", "No Show"), "No Show");
  assert.equal(statusTone("CONFIRMED"), "success");
});

test("the customer cancels until the start and accepts only a host's proposal", () => {
  assert.deepEqual(customerActions(normaliseBooking(base), before), ["cancel"]);
  assert.deepEqual(customerActions(normaliseBooking(base), after), []);
  const proposed = normaliseBooking({ ...base, status: "RESCHEDULE_REQUESTED", proposed: { start: "2026-11-26T08:00:00Z", end: "2026-11-26T12:00:00Z", by: "HOST" } });
  assert.deepEqual(customerActions(proposed, before), ["accept", "cancel"]);
  const own = normaliseBooking({ ...base, status: "RESCHEDULE_REQUESTED", proposed_start: "2026-11-26T08:00:00Z", proposed_end: "2026-11-26T12:00:00Z", proposed_by: "CUSTOMER" });
  assert.deepEqual(customerActions(own, before), ["cancel"]);
  assert.deepEqual(customerActions(normaliseBooking({ ...base, status: "CANCELLED" }), before), []);
  // The API's flags win.
  assert.deepEqual(customerActions(normaliseBooking({ ...base, can_cancel: false, can_accept: false }), before), []);
});

test("the host's actions follow the state machine", () => {
  assert.deepEqual(hostActions(normaliseBooking(base), before), ["confirm", "decline", "cancel"]);
  assert.deepEqual(hostActions(normaliseBooking({ ...base, status: "CONFIRMED" }), before), ["propose", "cancel"]);
  assert.deepEqual(hostActions(normaliseBooking({ ...base, status: "CONFIRMED" }), after), ["complete", "no_show"]);
  const customerAsked = normaliseBooking({ ...base, status: "RESCHEDULE_REQUESTED", proposed: { start: "2026-11-26T08:00:00Z", end: "2026-11-26T12:00:00Z", by: "CUSTOMER" } });
  assert.deepEqual(hostActions(customerAsked, before), ["confirm", "cancel"]);
  const hostAsked = normaliseBooking({ ...base, status: "RESCHEDULE_REQUESTED", proposed: { start: "2026-11-26T08:00:00Z", end: "2026-11-26T12:00:00Z", by: "HOST" } });
  assert.deepEqual(hostActions(hostAsked, before), ["cancel"]);
  for (const status of ["DECLINED", "CANCELLED", "COMPLETED", "NO_SHOW"]) {
    assert.deepEqual(hostActions(normaliseBooking({ ...base, status }), before), [], status);
  }
  assert.deepEqual(hostActions(normaliseBooking({ ...base, actions: ["confirm", "no-show"] }), before), ["confirm", "no_show"]);
});

test("the free cancellation window ends free_cancellation_hours before the start", () => {
  const booking = normaliseBooking(base);
  const window = cancellationWindow(booking, before);
  assert.equal(window.free, true);
  assert.equal(window.freeUntil, Date.parse("2026-11-23T08:00:00Z"));
  assert.equal(cancellationWindow(booking, Date.parse("2026-11-24T08:00:00Z")).free, false);
  assert.equal(cancellationWindow(booking, Date.parse("2026-11-23T08:00:00Z")).free, true);
  assert.deepEqual(cancellationWindow(normaliseBooking({ ...base, free_cancellation_hours: null }), before), { free: null, freeUntil: null });
  // The API's own end of the window wins.
  const told = normaliseBooking({ ...base, free_cancellation_until: "2026-11-21T00:00:00Z" });
  assert.equal(cancellationWindow(told, before).freeUntil, Date.parse("2026-11-21T00:00:00Z"));
});

test("refusals are said in plain words", () => {
  assert.equal(refusalReason({ error: { code: "SLOT_UNAVAILABLE", reason: "BUFFER" } }), "BUFFER");
  assert.equal(refusalReason({ error: { details: { reason: "LEAD_TIME" } } }), "LEAD_TIME");
  assert.equal(refusalReason({ error: { fields: { reason: "CLOSED" } } }), "CLOSED");
  assert.equal(refusalReason({}, { reason: "TAKEN" }), "TAKEN");
  assert.equal(refusalReason(null), null);
  assert.equal(slotUnavailableText("taken"), "That time is already booked. Choose another time.");
  assert.match(slotUnavailableText("OUTSIDE_HORIZON"), /further ahead/);
  assert.match(slotUnavailableText("LEAD_TIME"), /more notice/);
  assert.match(slotUnavailableText("CLOSED"), /closed/);
  assert.match(slotUnavailableText("BUFFER"), /cleaned/);
  assert.equal(slotUnavailableText("SOMETHING", "The venue said no."), "The venue said no. Choose another time.");
  assert.match(SLOT_TAKEN_TEXT, /^Another booking for this time was confirmed first\./);
});

test("the API's binding shape: proposal, cancellation, actions and events", () => {
  const booking = normaliseBooking({
    ...base,
    status: "RESCHEDULE_REQUESTED",
    status_label: "Reschedule requested",
    quote: { quote_id: "q1", currency: "USD", lines: base.quote.lines, subtotal: "200.00", deposit: null, total_excluding_deposit: "230.00" },
    cancellation_policy: { text: "Free until 48 hours before.", free_cancellation_hours: 48, free_until: "2026-11-23T08:00:00Z" },
    proposal: { proposed_by: "HOST", start: "2026-11-26T08:00:00Z", end: "2026-11-26T12:00:00Z", quote: { total_excluding_deposit: "240.00" } },
    cancellation: null,
    decline_reason: null,
    actions: ["accept", "cancel"],
    customer: { name: "Tendai", email: "tenant@example.test" },
    events: [{ id: "e1", action: "PROPOSED", from_status: "CONFIRMED", to_status: "RESCHEDULE_REQUESTED", actor: "HOST", actor_name: "Sam", reason: null, start: "2026-11-26T08:00:00Z", end: "2026-11-26T12:00:00Z", at: "2026-11-20T09:00:00Z" }],
  });
  assert.equal(booking.statusLabel, "Reschedule requested");
  assert.equal(booking.deposit, null);
  assert.equal(booking.cancellationPolicy, "Free until 48 hours before.");
  assert.equal(booking.freeCancellationUntil, "2026-11-23T08:00:00Z");
  assert.equal(booking.proposed.by, "HOST");
  assert.equal(booking.proposed.totalExcludingDeposit, "240.00");
  assert.deepEqual(customerActions(booking, before), ["accept", "cancel"]);
  assert.equal(booking.customer.email, "tenant@example.test");
  assert.equal(booking.events[0].label, "Proposed a new time");
  assert.equal(booking.events[0].actorName, "Sam");
  const cancelled = normaliseBooking({ ...base, status: "CANCELLED", cancellation: { by: "CUSTOMER", reason: "Plans changed", at: "2026-11-21T00:00:00Z", free: true }, actions: [] });
  assert.equal(cancelled.reason, "Plans changed");
  assert.deepEqual(cancelled.cancellation, { by: "CUSTOMER", free: true, at: "2026-11-21T00:00:00Z" });
  assert.deepEqual(hostActions(cancelled, before), []);
});
