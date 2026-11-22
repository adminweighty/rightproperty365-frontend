"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { NoAccess, RequireAuth } from "@/components/auth/require-auth";
import { ChipNav, EmptyState } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { VenueBookingCard, type BookingAction } from "@/components/venues/venue-booking-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import {
  acceptMyVenueBooking,
  actOnHostedVenueBooking,
  cancelMyVenueBooking,
  getHostedVenueBooking,
  getMyVenueBooking,
  listHostedVenueBookings,
  listMyVenueBookings,
  type BookingPage,
  type HostFilters,
  type HostScope,
} from "@/lib/api/venues";
import { cn } from "@/lib/cn";
import {
  cancellationWindow,
  customerActions,
  hostActions,
  statusLabel,
  statusTone,
  VENUE_BOOKING_STATUSES,
  type VenueBooking,
} from "@/lib/venue-bookings";
import { addDaysTo, clockOf, dateText, localDateOf } from "@/lib/venue-time";
import { useDisplayZone } from "@/components/time/use-display-zone";

/*
 * Hourly venue bookings (API 0.33.0, FR-025): the customer's own under
 * `/account/venue-bookings`, and the ones a host receives under
 * `/agent/venue-bookings`. Kept apart from viewings and consultations
 * (FR-022). Read in the browser with the session cookie.
 */

/** The viewer's display zone (API 0.62.0): bookings show it next to the venue's time. */
const useVisitorZone = () => useDisplayZone().viewer;

const ACTIVE = "REQUESTED,CONFIRMED,RESCHEDULE_REQUESTED";
const PAST = "COMPLETED,NO_SHOW,DECLINED,CANCELLED";

/** "Thursday 3 December 2026, 14:00 (Africa/Harare time)". */
const instantText = (instant: number, timeZone: string) => `${dateText(localDateOf(instant, timeZone))}, ${clockOf(instant, timeZone)} (${timeZone} time)`;

function ListStates({ state, reload, empty, children }: {
  state: ReturnType<typeof useApi<BookingPage>>["state"];
  reload: () => void;
  empty: ReactNode;
  children: (items: VenueBooking[]) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading hourly bookings" className="space-y-4">
        <div className="h-40 rounded-lg bg-sunken" />
        <div className="h-40 rounded-lg bg-sunken" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <Alert title="We could not load the hourly bookings." traceId={state.failure.traceId}>
          {state.failure.message}
        </Alert>
        <Button variant="secondary" className="mt-4" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (state.data.items.length === 0) return <>{empty}</>;
  const { items, total } = state.data;
  return (
    <>
      <p className="text-sm text-muted" role="status">
        {total === 1 ? "1 booking" : `${total} bookings`}
        {total > items.length ? `, the first ${items.length} shown` : ""}
      </p>
      <ul className="mt-3 space-y-4">{children(items)}</ul>
    </>
  );
}

// ---- /account/venue-bookings ------------------------------------------------------

function MyBookings() {
  const show = useSearchParams().get("show") === "past" ? "past" : "active";
  const zone = useVisitorZone();
  const load = useCallback(() => listMyVenueBookings({ status: show === "past" ? PAST : ACTIVE }), [show]);
  const { state, reload } = useApi(load);

  const actionsFor = (item: VenueBooking): BookingAction[] => {
    const allowed = customerActions(item);
    const window = cancellationWindow(item);
    const freeUntil = window.freeUntil === null ? null : instantText(window.freeUntil, item.timeZone);
    return [
      ...(allowed.includes("accept")
        ? [{ key: "accept", label: "Accept the new time", variant: "primary" as const, run: () => acceptMyVenueBooking(item.id) }]
        : []),
      ...(allowed.includes("cancel")
        ? [
            {
              key: "cancel",
              label: "Cancel",
              variant: "danger" as const,
              needs: "optional-reason" as const,
              heading: "Cancel this booking",
              confirm: "Cancel the booking",
              explain: (
                <>
                  {window.free === true && (
                    <p className="font-medium text-success">Free cancellation: you are inside the free window, which ends {freeUntil}.</p>
                  )}
                  {window.free === false && (
                    <p className="font-medium text-warning">The free cancellation window ended {freeUntil}. The host’s policy applies.</p>
                  )}
                  {item.cancellationPolicy && <p className="mt-1 whitespace-pre-line">{item.cancellationPolicy}</p>}
                  <p className="mt-1">This cannot be undone. The host is told.</p>
                </>
              ),
              run: (reason: string) => cancelMyVenueBooking(item.id, reason),
            },
          ]
        : []),
    ];
  };

  return (
    <>
      <h1 className="text-4xl">Your hourly bookings</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Venues and showrooms you asked to book by the hour. A request is not a booking until the host confirms it, and
        no payment is taken on RightProperty365. Times are in the venue’s time zone.
      </p>
      <div className="mt-6">
        <ChipNav
          label="Hourly bookings"
          items={[
            { key: "active", href: "/account/venue-bookings", label: "Upcoming and waiting", current: show === "active" },
            { key: "past", href: "/account/venue-bookings?show=past", label: "Past and cancelled", current: show === "past" },
          ]}
        />
      </div>
      <div className="mt-6">
        <ListStates
          state={state}
          reload={reload}
          empty={
            <EmptyState
              title={show === "active" ? "You have no hourly bookings waiting or coming up" : "No past or cancelled hourly bookings"}
              action={
                show === "active" ? (
                  <ButtonLink href="/listings" variant="secondary">
                    Find a venue
                  </ButtonLink>
                ) : undefined
              }
            >
              {show === "active" ? "Choose a time on a venue’s listing to send a booking request." : undefined}
            </EmptyState>
          }
        >
          {(items) =>
            items.map((item) => (
              <li key={item.id}>
                <VenueBookingCard
                  booking={item}
                  viewer="CUSTOMER"
                  calendar={{ kind: "my-venue-booking", id: item.id }}
                  visitorZone={zone}
                  actions={actionsFor(item)}
                  onChanged={reload}
                  loadEvents={async (id) => {
                    const result = await getMyVenueBooking(id);
                    return result.ok ? result.data : null;
                  }}
                />
              </li>
            ))
          }
        </ListStates>
      </div>
    </>
  );
}

/** The signed-in person's own hourly bookings. */
export function CustomerVenueBookings() {
  return <RequireAuth>{() => <MyBookings />}</RequireAuth>;
}

// ---- /agent/venue-bookings ----------------------------------------------------------

const OWNER_ROLES = ["PRIVATE_SELLER", "LANDLORD"];

/** The places a host's bookings can come from: each organisation they may read them for, and their own listings. */
function scopesOf(user: User): { value: string; label: string; scope: HostScope }[] {
  const out: { value: string; label: string; scope: HostScope }[] = user.memberships
    .filter((membership) => membership.role !== "STAFF")
    .map((membership) => ({
      value: `org:${membership.organisation_id}`,
      label: membership.organisation_name,
      scope: { kind: "organisation", orgId: membership.organisation_id },
    }));
  if (user.account_roles?.some(({ role }) => OWNER_ROLES.includes(role))) {
    out.push({ value: "owner", label: "Your own listings", scope: { kind: "owner" } });
  }
  return out;
}

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: ACTIVE, label: "Waiting or confirmed" },
  ...VENUE_BOOKING_STATUSES.map((status) => ({ value: status, label: statusLabel(status) })),
];

function HostBookings({ user }: { user: User }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const zone = useVisitorZone();
  const scopes = useMemo(() => scopesOf(user), [user]);
  const chosen = scopes.find((item) => item.value === params.get("scope")) ?? scopes[0];
  const view = params.get("view") === "day" ? "day" : "list";
  const today = new Date().toISOString().slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? (params.get("date") as string) : today;
  const [filters, setFilters] = useState<HostFilters>({ status: ACTIVE });

  const go = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
  };

  const scopeKey = chosen?.value ?? "";
  const effective = useMemo<HostFilters>(() => (view === "day" ? { listing_id: filters.listing_id, from: day, to: day } : filters), [view, filters, day]);
  const load = useCallback(
    () => (chosen ? listHostedVenueBookings(chosen.scope, effective) : Promise.resolve({ ok: true as const, status: 200, data: { items: [], page: 1, totalPages: 1, total: 0 } })),
    // The scope is identified by its key; the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey, effective],
  );
  const { state, reload } = useApi(load);

  if (!chosen) return <NoAccess />;

  // The API decides who may read the list: 403 and 404 for the organisation are the "no access" state.
  if (state.status === "error" && (state.failure.status === 403 || state.failure.code === "ORGANISATION_NOT_FOUND")) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You cannot see hourly bookings here</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          They are for the organisation’s Principal and Managers, the agent assigned to the venue, and approved
          Landlords and Property Sellers (Vendors) for their own listings.
        </p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
          Back to your dashboard
        </ButtonLink>
      </div>
    );
  }

  const listings = (() => {
    const seen = new Map<string, string>();
    const items = state.status === "ready" ? state.data.items : (state.status === "loading" ? state.previous?.items : undefined) ?? [];
    for (const item of items) if (item.listing?.id) seen.set(item.listing.id, item.listing.title);
    if (filters.listing_id && !seen.has(filters.listing_id)) seen.set(filters.listing_id, "The chosen venue");
    return [...seen].map(([value, label]) => ({ value, label }));
  })();

  const scope = chosen.scope;
  const act = (item: VenueBooking, action: Parameters<typeof actOnHostedVenueBooking>[2], body?: Record<string, string>) =>
    actOnHostedVenueBooking(scope, item.id, action, body);

  const actionsFor = (item: VenueBooking): BookingAction[] => {
    const allowed = hostActions(item);
    const out: BookingAction[] = [];
    if (allowed.includes("confirm")) {
      out.push({
        key: "confirm",
        label: item.status === "RESCHEDULE_REQUESTED" ? "Confirm the new time" : "Confirm",
        variant: "primary",
        needs: "confirmation",
        heading: "Confirm this booking",
        confirm: "Confirm the booking",
        explain: "The time is then held for this customer. Other requests for the same time can no longer be confirmed. The customer is emailed.",
        run: () => act(item, "confirm"),
      });
    }
    if (allowed.includes("propose")) {
      out.push({
        key: "propose",
        label: "Propose another time",
        needs: "time",
        heading: "Propose another time",
        confirm: "Send the new time",
        explain: "The customer is asked to accept it. Until they do, the confirmed time stays as it is.",
        run: (quoteId: string) => act(item, "propose", { quote_id: quoteId }),
      });
    }
    if (allowed.includes("decline")) {
      out.push({ key: "decline", label: "Decline", needs: "reason", heading: "Decline this request", confirm: "Decline the request", explain: "The customer is told, with your reason.", run: (reason: string) => act(item, "decline", { reason }) });
    }
    if (allowed.includes("complete")) {
      out.push({ key: "complete", label: "Mark as completed", needs: "confirmation", heading: "Mark this booking as completed", confirm: "Mark as completed", run: () => act(item, "complete") });
    }
    if (allowed.includes("no_show")) {
      out.push({ key: "no-show", label: "Customer did not arrive", needs: "confirmation", heading: "Record that the customer did not arrive", confirm: "Record a no show", explain: "This is final.", run: () => act(item, "no-show") });
    }
    if (allowed.includes("cancel")) {
      out.push({
        key: "cancel",
        label: "Cancel",
        variant: "danger",
        needs: "reason",
        heading: "Cancel this booking",
        confirm: "Cancel the booking",
        explain: "This cannot be undone. The customer is told, with your reason.",
        run: (reason: string) => act(item, "cancel", { reason }),
      });
    }
    return out;
  };

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim() || undefined;
    setFilters({ listing_id: text("listing_id"), status: text("status"), from: text("from"), to: text("to") });
  }

  const card = (item: VenueBooking) => (
    <VenueBookingCard
      booking={item}
      viewer="HOST"
      calendar={{ kind: "hosted-venue-booking", scope, id: item.id }}
      visitorZone={zone}
      actions={actionsFor(item)}
      onChanged={reload}
      loadEvents={async (id) => {
        const result = await getHostedVenueBooking(scope, id);
        return result.ok ? result.data : null;
      }}
    >
      {item.customer && (
        // Contact details appear only here, behind sign-in.
        <dl className="mt-3 border-t border-line pt-3 text-sm">
          <dt className="text-muted">Customer</dt>
          <dd className="text-ink">
            {item.customer.name}
            {item.customer.email && (
              <>
                {" · "}
                <a href={`mailto:${item.customer.email}`} className="inline-flex min-h-11 items-center break-all text-primary-ink hover:underline sm:min-h-0">
                  {item.customer.email}
                </a>
              </>
            )}
          </dd>
        </dl>
      )}
    </VenueBookingCard>
  );

  return (
    <>
      <h1 className="text-4xl">Hourly bookings</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Requests to book your venues and showrooms by the hour. Nothing is held until you confirm a request; no payment is
        taken on RightProperty365. Times are in each venue’s time zone.{" "}
        <Link href="/agent/appointments" className="font-medium text-primary-ink hover:underline">
          Viewings and consultations
        </Link>{" "}
        are kept apart.
      </p>

      {scopes.length > 1 && (
        <Field id="venue-bookings-scope" label="Bookings for" className="mt-6 max-w-md">
          <SearchableSelect id="venue-bookings-scope" value={chosen.value} onValueChange={(value) => go({ scope: value })} options={scopes.map(({ value, label }) => ({ value, label }))} />
        </Field>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="View">
        {(["list", "day"] as const).map((value) => (
          <Button key={value} variant={view === value ? "primary" : "secondary"} aria-pressed={view === value} onClick={() => go({ view: value === "day" ? "day" : undefined })}>
            {value === "list" ? "List" : "Day view"}
          </Button>
        ))}
      </div>

      {view === "list" ? (
        <form
          key={scopeKey}
          onSubmit={applyFilters}
          aria-label="Filter hourly bookings"
          className="mt-4 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end"
        >
          <Field id="venue-bookings-listing" label="Venue">
            <SearchableSelect id="venue-bookings-listing" name="listing_id" defaultValue={filters.listing_id ?? ""} options={[{ value: "", label: "Any venue" }, ...listings]} />
          </Field>
          <Field id="venue-bookings-status" label="Status">
            <SearchableSelect id="venue-bookings-status" name="status" defaultValue={filters.status ?? ""} options={STATUS_OPTIONS} />
          </Field>
          <Field id="venue-bookings-from" label="From">
            <Input id="venue-bookings-from" name="from" type="date" defaultValue={filters.from} />
          </Field>
          <Field id="venue-bookings-to" label="To">
            <Input id="venue-bookings-to" name="to" type="date" defaultValue={filters.to} />
          </Field>
          <Button type="submit">Show</Button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
          <Button variant="secondary" className="size-11 px-0" onClick={() => go({ date: addDaysTo(day, -1) })}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Previous day</span>
          </Button>
          <Field id="venue-bookings-day" label="Day" className="min-w-0 flex-1 basis-40">
            <Input id="venue-bookings-day" type="date" value={day} onChange={(event) => event.target.value && go({ date: event.target.value })} />
          </Field>
          <Button variant="secondary" className="size-11 px-0" onClick={() => go({ date: addDaysTo(day, 1) })}>
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Next day</span>
          </Button>
          {day !== today && (
            <Button variant="ghost" onClick={() => go({ date: undefined })}>
              Today
            </Button>
          )}
        </div>
      )}

      <div className="mt-6">
        <ListStates
          state={state}
          reload={reload}
          empty={
            <EmptyState title={view === "day" ? `No hourly bookings on ${dateText(day)}` : "No hourly bookings match"}>
              {view === "day"
                ? "Choose another day, or go back to the list."
                : "When a customer sends a request for one of your venues, it appears here. Hourly booking is switched on in each listing’s editor."}
            </EmptyState>
          }
        >
          {(items) =>
            view === "day" ? <DaySchedule items={items} day={day} card={card} /> : items.map((item) => <li key={item.id}>{card(item)}</li>)
          }
        </ListStates>
      </div>
    </>
  );
}

/**
 * The day view: each venue's bookings of one day in time order, as a
 * schedule (time, status, customer) that links to the full card below it.
 * Cancelled and declined requests are listed apart, so the schedule shows
 * only what may still take place.
 */
function DaySchedule({ items, day, card }: { items: VenueBooking[]; day: string; card: (item: VenueBooking) => ReactNode }) {
  const byVenue = new Map<string, VenueBooking[]>();
  for (const item of [...items].sort((a, b) => a.start.localeCompare(b.start))) {
    const key = item.listing?.title ?? "Venue";
    byVenue.set(key, [...(byVenue.get(key) ?? []), item]);
  }
  const gone = (item: VenueBooking) => item.status === "CANCELLED" || item.status === "DECLINED";
  return (
    <li className="list-none">
      <h2 className="text-2xl">{dateText(day)}</h2>
      {[...byVenue].map(([venue, bookings]) => (
        <section key={venue} aria-label={`${venue} on ${dateText(day)}`} className="mt-4">
          <h3 className="font-sans text-lg font-semibold tracking-normal text-ink">{venue}</h3>
          <ol className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            {bookings.filter((item) => !gone(item)).map((item) => {
              const start = Date.parse(item.start);
              const end = Date.parse(item.end);
              return (
                <li key={item.id} className="grid grid-cols-[6.5rem_1fr] gap-3 p-3 text-sm sm:grid-cols-[8rem_1fr]">
                  <p className="font-mono tabular-nums text-ink">
                    {clockOf(start, item.timeZone)}–{clockOf(end, item.timeZone)}
                  </p>
                  <div className="min-w-0">
                    <a href={`#day-booking-${item.id}`} className="font-medium text-primary-ink hover:underline">
                      {item.customer?.name ?? item.reference}
                    </a>{" "}
                    <Badge tone={statusTone(item.status)}>{item.statusLabel}</Badge>
                    {item.attendees !== null && <span className="text-muted"> · {item.attendees === 1 ? "1 person" : `${item.attendees} people`}</span>}
                  </div>
                </li>
              );
            })}
            {bookings.every(gone) && <li className="p-3 text-sm text-muted">Nothing still to take place.</li>}
          </ol>
        </section>
      ))}
      <ul className="mt-8 space-y-4">
        {items.map((item) => (
          <li key={item.id} id={`day-booking-${item.id}`} className={cn("scroll-mt-24", gone(item) && "opacity-90")}>
            {card(item)}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Hourly bookings received by the signed-in host: an organisation's, or a direct owner's own. */
export function HostVenueBookings() {
  return <RequireAuth>{(user) => <HostBookings user={user} />}</RequireAuth>;
}
