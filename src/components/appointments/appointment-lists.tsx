"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AppointmentCard, type AppointmentAction } from "@/components/appointments/appointment-card";
import { RequireAuth } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  acceptMyAppointment,
  actOnReceivedAppointment,
  cancelMyAppointment,
  getMyAppointment,
  getReceivedAppointment,
  listMyAppointments,
  listReceivedAppointments,
  rescheduleMyAppointment,
  type CustomerAppointment,
  type ReceivedAppointment,
  type ReceivedFilters,
} from "@/lib/api/appointments";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import { cn } from "@/lib/cn";

type State<T> = { status: "loading" } | { status: "error"; failure: ApiFailure } | { status: "ready"; items: T[] };

/** Loads a list, and again whenever `reload` is called or `load` changes. */
function useList<T>(load: () => Promise<ApiResult<{ items: T[] }>>) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", items: result.data.items } : { status: "error", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [load, version]);
  return { state, reload: useCallback(() => setVersion((value) => value + 1), []) };
}

function ListStates<T>({
  state,
  reload,
  empty,
  children,
}: {
  state: State<T>;
  reload: () => void;
  empty: ReactNode;
  children: (items: T[]) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading appointments" className="space-y-4">
        <div className="h-40 rounded-lg bg-sunken" />
        <div className="h-40 rounded-lg bg-sunken" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <Alert title="We could not load your appointments." traceId={state.failure.traceId}>
          {state.failure.message}
        </Alert>
        <Button variant="secondary" className="mt-4" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-muted">{empty}</div>;
  }
  return (
    <>
      <p className="text-sm text-muted" role="status">
        {state.items.length === 1 ? "1 appointment" : `${state.items.length} appointments`}
      </p>
      <ul className="mt-3 space-y-4">{children(state.items)}</ul>
    </>
  );
}

const tab = "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors";

// ---- /account/appointments ---------------------------------------------------

function MyAppointments() {
  const when = useSearchParams().get("when") === "past" ? "past" : "upcoming";
  const load = useCallback(() => listMyAppointments(when), [when]);
  const { state, reload } = useList<CustomerAppointment>(load);

  const actionsFor = (item: CustomerAppointment): AppointmentAction[] => [
    ...(item.can_accept
      ? [{ key: "accept", label: "Accept the new time", variant: "primary" as const, run: () => acceptMyAppointment(item.id) }]
      : []),
    ...(item.can_reschedule
      ? [
          {
            key: "reschedule",
            label: "Propose a new time",
            needs: "time" as const,
            confirm: "Send the new time",
            run: (startUtc: string) => rescheduleMyAppointment(item.id, startUtc),
          },
        ]
      : []),
    ...(item.can_cancel
      ? [
          {
            key: "cancel",
            label: "Cancel",
            variant: "danger" as const,
            needs: "optional-reason" as const,
            heading: "Cancel this appointment",
            confirm: "Cancel the appointment",
            explain: "This cannot be undone. To meet at another time, propose a new time instead.",
            run: (reason: string) => cancelMyAppointment(item.id, reason),
          },
        ]
      : []),
  ];

  return (
    <>
      <h1 className="text-4xl">Your appointments</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Viewings and consultations you asked for. Times are shown in the time zone of the property or business.
      </p>
      <nav aria-label="Appointments" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {(["upcoming", "past"] as const).map((value) => (
            <li key={value}>
              <Link
                href={value === "upcoming" ? "/account/appointments" : "/account/appointments?when=past"}
                aria-current={value === when ? "page" : undefined}
                className={cn(tab, value === when ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-sunken")}
              >
                {value === "upcoming" ? "Upcoming" : "Past"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        <ListStates
          state={state}
          reload={reload}
          empty={
            when === "upcoming" ? (
              <>
                <p>You have no upcoming appointments. Ask for a viewing from any listing.</p>
                <ButtonLink href="/listings" variant="secondary" className="mt-4">
                  Browse listings
                </ButtonLink>
              </>
            ) : (
              <p>You have no past appointments.</p>
            )
          }
        >
          {(items) =>
            items.map((item) => (
              <li key={item.id}>
                <AppointmentCard
                  appointment={item}
                  viewer="CUSTOMER"
                  actions={actionsFor(item)}
                  onChanged={reload}
                  loadTimeline={async (id) => {
                    const result = await getMyAppointment(id);
                    return result.ok ? (result.data.appointment.timeline ?? []) : null;
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

/** The signed-in person's own viewings and consultations. */
export function CustomerAppointments() {
  return <RequireAuth>{() => <MyAppointments />}</RequireAuth>;
}

// ---- /agent/appointments --------------------------------------------------------

/** The API's status and type enums, in the order they happen. Labels are the API's `status_label` words. */
const statusOptions = [
  ["REQUESTED", "Requested"],
  ["RESCHEDULE_REQUESTED", "Reschedule Requested"],
  ["CONFIRMED", "Confirmed"],
  ["COMPLETED", "Completed"],
  ["NO_SHOW", "No Show"],
  ["CANCELLED", "Cancelled"],
];
const typeOptions = [
  ["VIEWING", "Viewing"],
  ["CONSULTATION", "Consultation"],
];

/** A date from a date input as the start of that day in UTC. */
const dayStart = (date: string, addDays = 0) =>
  date ? new Date(Date.parse(`${date}T00:00:00Z`) + addDays * 86_400_000).toISOString() : undefined;

function Received() {
  const [filters, setFilters] = useState<ReceivedFilters>({});
  const load = useCallback(() => listReceivedAppointments(filters), [filters]);
  const { state, reload } = useList<ReceivedAppointment>(load);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    setFilters({
      status: text("status") || undefined,
      type: text("type") || undefined,
      from: dayStart(text("from")),
      // "To" includes the whole of that day.
      to: dayStart(text("to"), 1),
    });
  }

  // The API decides who may read this list: a 403 is the "no access" state.
  if (state.status === "error" && state.failure.status === 403) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You do not have access to this page</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          It is for members of a Real Estate Agency or another verified business, Landlords and
          Property Sellers (Vendors). Appointments you asked for are under your account.
        </p>
        <ButtonLink href="/account/appointments" variant="secondary" className="mt-6">
          Go to your appointments
        </ButtonLink>
      </div>
    );
  }

  const actionsFor = (item: ReceivedAppointment): AppointmentAction[] => {
    const act = (action: Parameters<typeof actOnReceivedAppointment>[1], body?: Record<string, string>) =>
      actOnReceivedAppointment(item.id, action, body);
    return [
      ...(item.can_confirm
        ? [
            {
              key: "confirm",
              label: item.proposed_start_utc ? "Accept the new time" : "Confirm",
              variant: "primary" as const,
              run: () => act("confirm"),
            },
          ]
        : []),
      ...(item.can_reschedule
        ? [
            {
              key: "reschedule",
              label: "Propose a new time",
              needs: "time" as const,
              confirm: "Send the new time",
              run: (startUtc: string) => act("reschedule", { start_utc: startUtc }),
            },
          ]
        : []),
      ...(item.can_complete
        ? [{ key: "complete", label: "Mark as completed", needs: "confirmation" as const, heading: "Mark this appointment as completed", confirm: "Mark as completed", run: () => act("complete") }]
        : []),
      ...(item.can_no_show
        ? [{ key: "no-show", label: "Customer did not arrive", needs: "confirmation" as const, heading: "Record that the customer did not arrive", confirm: "Record a no show", explain: "This is final.", run: () => act("no-show") }]
        : []),
      ...(item.can_cancel
        ? [
            {
              key: "cancel",
              label: "Cancel",
              variant: "danger" as const,
              needs: "reason" as const,
              heading: "Cancel this appointment",
              confirm: "Cancel the appointment",
              explain: "This cannot be undone. The customer is told, with your reason.",
              run: (reason: string) => act("cancel", { reason }),
            },
          ]
        : []),
    ];
  };

  return (
    <>
      <h1 className="text-4xl">Appointments</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Viewings and consultations customers asked you or your organisation for.{" "}
        <Link href="/agent/requests" className="font-medium text-primary-ink hover:underline">
          Request inbox
        </Link>
      </p>

      <form onSubmit={applyFilters} aria-label="Filter appointments" className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <Field id="appointments-status" label="Status">
          <Select id="appointments-status" name="status" defaultValue="">
            <option value="">Any status</option>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="appointments-type" label="Type">
          <Select id="appointments-type" name="type" defaultValue="">
            <option value="">Any type</option>
            {typeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="appointments-from" label="From">
          <Input id="appointments-from" name="from" type="date" />
        </Field>
        <Field id="appointments-to" label="To">
          <Input id="appointments-to" name="to" type="date" />
        </Field>
        <Button type="submit">Apply</Button>
      </form>

      <div className="mt-6">
        <ListStates state={state} reload={reload} empty={<p>No appointments match. When a customer asks for a viewing with a time, it appears here.</p>}>
          {(items) =>
            items.map((item) => (
              <li key={item.id}>
                <AppointmentCard
                  appointment={item}
                  viewer="PROFESSIONAL"
                  actions={actionsFor(item)}
                  onChanged={reload}
                  loadTimeline={async (id) => {
                    const result = await getReceivedAppointment(id);
                    return result.ok ? (result.data.appointment.timeline ?? []) : null;
                  }}
                >
                  {/* Contact details appear only here, behind sign-in. */}
                  <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-line pt-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">Customer</dt>
                      <dd className="text-ink">
                        {item.contact.name}
                        {item.contact.email && (
                          <>
                            {" · "}
                            <a href={`mailto:${item.contact.email}`} className="break-all text-primary-ink hover:underline">
                              {item.contact.email}
                            </a>
                          </>
                        )}
                        {item.contact.phone && (
                          <>
                            {" · "}
                            <a href={`tel:${item.contact.phone}`} className="text-primary-ink hover:underline">
                              {item.contact.phone}
                            </a>
                          </>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Assigned to</dt>
                      <dd className="text-ink">{item.assigned_to?.name ?? "Nobody yet"}</dd>
                    </div>
                  </dl>
                </AppointmentCard>
              </li>
            ))
          }
        </ListStates>
      </div>
    </>
  );
}

/** Appointments received by the signed-in professional or their organisation. */
export function ProfessionalAppointments() {
  return <RequireAuth>{() => <Received />}</RequireAuth>;
}
