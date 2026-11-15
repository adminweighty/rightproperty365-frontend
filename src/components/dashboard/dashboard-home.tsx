"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { CountUp } from "@/components/motion/count-up";
import { Stagger } from "@/components/motion/stagger";
import { EmptyState, formatWhen, LoadError, LoadingBlock, StatTile } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatInZone } from "@/lib/api/appointments";
import {
  getDashboard,
  type Dashboard,
  type DashboardAction,
  type DashboardCounter,
  type DashboardCounterGroup,
  type DashboardOnboarding,
  type DashboardOrganisation,
} from "@/lib/api/dashboard";
import { listJoinRequests, listTeamInvitations } from "@/lib/api/team";
import { customerStatusTones } from "@/lib/api/my-requests";
import { onboardingStatusTones, roleToSlug } from "@/lib/api/onboarding";
import { cn } from "@/lib/cn";
import { actionHref as nextActionHref, counterHref } from "@/lib/portal";

/** Numbers that ask for something to be done, shown in the primary colour when above zero. */
const ACTION_KEYS = new Set([
  "requests.new",
  "business_enquiries.new",
  "appointments.requested",
  "appointments.reschedule_requested",
  "short_stays.calendar_stale",
  "listings.status.CHANGES_REQUESTED",
  "my_appointments.needs_reply",
]);

const groupTitles: Record<DashboardCounterGroup, string> = {
  my_activity: "Your requests and viewings",
  requests: "Property requests",
  requests_by_stage: "Requests by stage",
  business_enquiries: "Business enquiries",
  appointments: "Appointments received",
  listings: "Your listings",
};

/**
 * An onboarding action opens that role's application, a listing action the
 * listings filtered to it; every other action uses its target.
 */
const actionHref = (action: DashboardAction) => nextActionHref(action, (role) => `/onboarding/${roleToSlug(role)}`);

const intro: Record<Dashboard["kind"], string> = {
  SEEKER: "Your requests, your viewings and a quick way to find your next property.",
  PROFESSIONAL_PENDING:
    "We check every professional, business and owner before their role is active. Here is where your application stands.",
  PROFESSIONAL: "What came in, what needs an answer and how your listings are doing.",
  DIRECT_OWNER: "Requests and appointments for the property you advertise, and how your listings are doing.",
  ADMIN: "",
};

function NextActions({ actions, quietText }: { actions: DashboardAction[]; quietText: string }) {
  return (
    <section aria-labelledby="dash-actions">
      <h2 id="dash-actions" className="text-2xl">
        What needs your attention
      </h2>
      {actions.length === 0 ? (
        <p className="mt-3 text-muted">{quietText}</p>
      ) : (
        <Stagger as="ul" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => {
            const href = actionHref(action);
            const body = (
              <>
                {action.count !== null && (
                  <span className="text-4xl font-bold tabular-nums text-primary-ink">
                    <CountUp value={action.count} />
                  </span>
                )}
                <span className="font-medium leading-snug text-ink">{action.text}</span>
                {href && (
                  <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary-ink" aria-hidden="true">
                    Open <ArrowRight className="size-4" />
                  </span>
                )}
              </>
            );
            const box = "flex h-full min-h-32 flex-col gap-2 rounded-lg border-2 p-5";
            return (
              <li key={`${action.code}-${action.role ?? ""}`}>
                {href ? (
                  <Link
                    href={href}
                    className={cn(box, "border-primary bg-tint transition-colors hover:bg-primary-soft")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={cn(box, "border-line bg-surface")}>{body}</div>
                )}
              </li>
            );
          })}
        </Stagger>
      )}
    </section>
  );
}

const onboardingActions: Record<string, { label: string; primary: boolean }> = {
  DRAFT: { label: "Continue your application", primary: true },
  CHANGES_REQUESTED: { label: "Fix and resubmit", primary: true },
  SUBMITTED: { label: "View your application", primary: false },
  REJECTED: { label: "Apply again", primary: true },
  APPROVED: { label: "View your application", primary: false },
};

function missingText(entry: DashboardOnboarding): string | null {
  const parts = [
    entry.missing_fields > 0 ? `${entry.missing_fields} ${entry.missing_fields === 1 ? "detail" : "details"}` : null,
    entry.missing_documents > 0
      ? `${entry.missing_documents} ${entry.missing_documents === 1 ? "document" : "documents"}`
      : null,
  ].filter(Boolean);
  return parts.length ? `Still needed: ${parts.join(" and ")}.` : null;
}

const onboardingNextStep: Record<string, string> = {
  DRAFT: "Next step: add what is missing and send your application.",
  CHANGES_REQUESTED: "Next step: make the changes the reviewer asked for and send it again.",
  SUBMITTED: "Next step: nothing for now. We will email you when it has been checked.",
  REJECTED: "Next step: read the reason, then apply again if it can be put right.",
  APPROVED: "Your role is active.",
};

function Onboarding({ entries }: { entries: DashboardOnboarding[] }) {
  return (
    <section aria-labelledby="dash-onboarding">
      <h2 id="dash-onboarding" className="text-2xl">
        Your applications
      </h2>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {entries.map((entry) => {
          const action = onboardingActions[entry.status] ?? onboardingActions.SUBMITTED;
          const missing = entry.status === "DRAFT" || entry.status === "CHANGES_REQUESTED" ? missingText(entry) : null;
          return (
            <li key={entry.role}>
              <Card className="flex h-full flex-col">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-sans text-lg font-semibold tracking-normal">{entry.role_label}</h3>
                  <Badge tone={onboardingStatusTones[entry.status] ?? "neutral"}>{entry.status_label}</Badge>
                </div>
                {missing && <p className="mt-2 text-ink">{missing}</p>}
                {entry.decision_reason && (
                  <p className="mt-2 rounded-md bg-warning-soft p-3 text-sm text-ink">
                    <span className="font-medium">Reason given: </span>
                    {entry.decision_reason}
                  </p>
                )}
                {entry.submitted_at && entry.status === "SUBMITTED" && (
                  <p className="mt-2 text-sm text-muted">Sent {formatWhen(entry.submitted_at)}</p>
                )}
                <p className="mt-2 text-sm text-muted">{onboardingNextStep[entry.status]}</p>
                <div className="mt-auto pt-4">
                  <ButtonLink
                    href={`/onboarding/${roleToSlug(entry.role)}`}
                    variant={action.primary ? "primary" : "secondary"}
                  >
                    {action.label}
                    <span className="sr-only">: {entry.role_label}</span>
                  </ButtonLink>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CounterGroup({ group, counters, title }: { group: DashboardCounterGroup; counters: DashboardCounter[]; title?: string }) {
  const id = `dash-${group}`;
  if (group === "requests_by_stage") {
    return (
      <section aria-labelledby={id}>
        <h2 id={id} className="text-xl">
          {title ?? groupTitles[group]}
        </h2>
        {/* The pipeline in order: each stage with how many requests are at it. */}
        <Stagger as="ol" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {counters.map((counter, index) => {
            const href = counterHref(counter);
            const body = (
              <>
                <span className="text-xs text-subtle">Stage {index + 1}</span>
                <span className="text-sm leading-snug text-ink">{counter.label}</span>
                <span className="text-2xl font-bold tabular-nums text-ink">{counter.value}</span>
              </>
            );
            const box = "flex h-full flex-col gap-1 rounded-md border border-line bg-surface p-3";
            return (
              <li key={counter.key}>
                {href ? (
                  <Link href={href} className={cn(box, "transition-colors hover:border-primary hover:bg-tint")}>
                    {body}
                  </Link>
                ) : (
                  <div className={box}>{body}</div>
                )}
              </li>
            );
          })}
        </Stagger>
      </section>
    );
  }
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl">
        {title ?? groupTitles[group]}
      </h2>
      <Stagger as="ul" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {counters.map((counter) => (
          <li key={counter.key}>
            <StatTile
              label={counter.label}
              value={counter.value}
              href={counterHref(counter)}
              emphasis={ACTION_KEYS.has(counter.key)}
            />
          </li>
        ))}
      </Stagger>
    </section>
  );
}

function Counters({ data }: { data: Dashboard }) {
  const order: DashboardCounterGroup[] =
    data.kind === "SEEKER" || data.kind === "PROFESSIONAL_PENDING"
      ? ["my_activity", "requests", "requests_by_stage", "business_enquiries", "appointments", "listings"]
      : ["requests", "requests_by_stage", "business_enquiries", "appointments", "listings", "my_activity"];
  const groups = order
    .map((group) => ({ group, counters: data.counters.filter((counter) => counter.group === group) }))
    .filter(({ counters }) => counters.length > 0);
  if (groups.length === 0) return null;
  const ownActivityTitle = data.kind === "SEEKER" ? undefined : "Your own requests and viewings";
  return (
    <div className="space-y-8">
      {groups.map(({ group, counters }) => (
        <CounterGroup
          key={group}
          group={group}
          counters={counters}
          title={group === "my_activity" ? ownActivityTitle : undefined}
        />
      ))}
    </div>
  );
}

const listLink = "font-medium text-primary-ink hover:underline";

function ReceivedRequests({ data }: { data: Dashboard }) {
  const items = data.recent.received_requests;
  return (
    <section aria-labelledby="dash-received">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dash-received" className="text-xl">
          Latest requests
        </h2>
        <Link href="/agent/requests" className={listLink}>
          See all requests
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-muted">When a customer asks about one of your listings, it appears here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.request_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
              <Link href={`/agent/requests/${item.request_id}`} className={cn(listLink, "min-h-11 content-center")}>
                {item.contact.name}
              </Link>
              <span className="text-sm text-muted">about {item.listing?.title ?? "a listing"}</span>
              {item.stage_label && <Badge tone={item.stage === "NEW_ENQUIRY" ? "primary" : "neutral"}>{item.stage_label}</Badge>}
              <span className="text-sm text-subtle sm:ml-auto">{formatWhen(item.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MyRequests({ data }: { data: Dashboard }) {
  const items = data.recent.my_requests;
  if (items.length === 0 && data.kind !== "SEEKER") return null;
  return (
    <section aria-labelledby="dash-mine">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dash-mine" className="text-xl">
          {data.kind === "SEEKER" ? "Your latest requests" : "Requests you sent"}
        </h2>
        {items.length > 0 && (
          <Link href="/account/requests" className={listLink}>
            See all your requests
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="You have not sent a request yet"
            action={
              <ButtonLink href="/listings" variant="secondary">
                Find a property
              </ButtonLink>
            }
          >
            Ask an advertiser about any listing and you can follow it here.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.request_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
              <Link href={`/account/requests/${item.request_id}`} className={cn(listLink, "min-h-11 content-center")}>
                {item.listing?.title ?? "A listing that is no longer shown"}
              </Link>
              <Badge tone={customerStatusTones[item.status] ?? "neutral"}>{item.status_label}</Badge>
              <span className="text-sm text-subtle sm:ml-auto">Sent {formatWhen(item.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Appointments({ data }: { data: Dashboard }) {
  const items = data.recent.appointments;
  const receives = data.capabilities.manages_appointments;
  return (
    <section aria-labelledby="dash-appointments">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="dash-appointments" className="text-xl">
          Next appointments
        </h2>
        <div className="flex flex-wrap gap-x-4">
          {receives && (
            <Link href="/agent/appointments" className={listLink}>
              Appointments received
            </Link>
          )}
          <Link href="/account/appointments" className={listLink}>
            {receives ? "Appointments you asked for" : "All your appointments"}
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-muted">
          No upcoming viewings or consultations.{data.kind === "SEEKER" && " Ask for a viewing from any listing."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
              <Link
                href={item.side === "PROFESSIONAL" ? "/agent/appointments" : "/account/appointments"}
                className={cn(listLink, "min-h-11 content-center")}
              >
                {formatInZone(item.start_utc, item.timezone)}
              </Link>
              <span className="text-sm text-muted">{item.listing?.title ?? item.reference}</span>
              <Badge>{item.status_label}</Badge>
              {receives && (
                <span className="text-sm text-subtle sm:ml-auto">
                  {item.side === "PROFESSIONAL" ? "With a customer" : "You asked for it"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FindAProperty() {
  return (
    <Card className="bg-tint">
      <h2 className="text-xl">Find a property</h2>
      <form action="/listings" role="search" aria-label="Property search" className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="dash-q" className="sr-only">
          Place, property type or reference
        </label>
        <input
          id="dash-q"
          name="q"
          type="search"
          placeholder="Place, property type or reference"
          className="h-11 w-full rounded-md border border-control bg-surface px-3 text-base text-ink placeholder:text-subtle hover:border-ink focus-visible:border-focus"
        />
        <button type="submit" className={buttonClasses("primary", "md")}>
          <Search className="size-4" aria-hidden="true" />
          Search
        </button>
      </form>
      <p className="mt-3 text-sm">
        <Link href="/listings" className={listLink}>
          Browse every property
        </Link>
      </p>
    </Card>
  );
}

/**
 * What waits in a team the caller manages: people asking to join and
 * invitations not yet accepted. Read only for those teams; says nothing
 * when both are zero or cannot be read.
 */
function TeamWaiting({ organisationId }: { organisationId: string }) {
  const [counts, setCounts] = useState<{ joins: number; invitations: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listJoinRequests(organisationId), listTeamInvitations(organisationId)]).then(([joins, invitations]) => {
      if (cancelled) return;
      setCounts({
        joins: joins.ok ? joins.data.items.filter((item) => item.can_decide).length : 0,
        invitations: invitations.ok ? invitations.data.items.filter((item) => !item.expired).length : 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [organisationId]);
  if (!counts || (counts.joins === 0 && counts.invitations === 0)) return null;
  const parts = [
    counts.joins > 0 && `${counts.joins} asking to join`,
    counts.invitations > 0 && `${counts.invitations} ${counts.invitations === 1 ? "invitation" : "invitations"} waiting`,
  ].filter(Boolean);
  return (
    <Badge tone={counts.joins > 0 ? "primary" : "neutral"} className="ml-1">
      {parts.join(" · ")}
    </Badge>
  );
}

const managesTeam = (organisation: DashboardOrganisation) => Boolean(organisation.can_manage_team);

function Workspace({ data }: { data: Dashboard }) {
  const links = [
    data.capabilities.receives_requests && { href: "/agent/requests", label: "Request inbox" },
    data.capabilities.manages_appointments && { href: "/agent/appointments", label: "Appointments received" },
    data.capabilities.manages_listings && { href: "/agent/listings", label: "Your listings" },
    (data.capabilities.sees_team || data.organisations.some(managesTeam)) && { href: "/agent/team", label: "Your team" },
    { href: "/account", label: "Your account and roles" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  return (
    <section aria-labelledby="dash-workspace">
      <h2 id="dash-workspace" className="text-xl">
        Your workspace
      </h2>
      {data.organisations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.organisations.map((organisation) => (
            <li key={organisation.id} className="text-ink">
              <span className="font-medium">{organisation.role_label}</span> at {organisation.name}{" "}
              <Badge tone="accent">{organisation.market_code}</Badge>
              {managesTeam(organisation) && (
                <>
                  {" · "}
                  <Link
                    href={`/agent/team?org=${organisation.id}`}
                    className="font-medium text-primary-ink hover:underline"
                  >
                    Manage the team<span className="sr-only"> of {organisation.name}</span>
                  </Link>
                  <TeamWaiting organisationId={organisation.id} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.direct_owner && (
        <p className="mt-2 text-muted">You also advertise property of your own as a verified owner.</p>
      )}
      <ul className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <ButtonLink href={link.href} variant="secondary">
              {link.label}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Home({ firstName }: { firstName: string }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";
  const { state, reload } = useApi(getDashboard);

  const isAdminDashboard = isAdmin || (state.status === "ready" && state.data.kind === "ADMIN");
  useEffect(() => {
    if (isAdminDashboard) router.replace("/admin");
  }, [isAdminDashboard, router]);

  return (
    <>
      <p className="text-sm font-medium text-primary-ink">Dashboard</p>
      <h1 className="enter-rise mt-1 text-4xl">Hello, {firstName}</h1>
      {state.status === "ready" && intro[state.data.kind] && (
        <p className="mt-2 max-w-2xl text-muted">{intro[state.data.kind]}</p>
      )}
      {welcome && (
        <Alert tone="success" title="Your email address is confirmed. Welcome to RightProperty365." className="mt-4" />
      )}

      <p role="status" className="sr-only">
        {state.status === "ready" ? "Your dashboard has loaded." : ""}
      </p>
      <div className="mt-8">
        {state.status === "loading" && <LoadingBlock label="Loading your dashboard" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && isAdminDashboard && (
          <p>
            You are signed in as an administrator.{" "}
            <Link href="/admin" className={listLink}>
              Go to the administration overview
            </Link>
          </p>
        )}
        {state.status === "ready" && !isAdminDashboard && <Body data={state.data} />}
      </div>
    </>
  );
}

function Body({ data }: { data: Dashboard }) {
  const professional = data.kind === "PROFESSIONAL" || data.kind === "DIRECT_OWNER";
  // Applications still open, also for a professional applying for a second role.
  const openApplications = data.onboarding.filter((entry) => entry.status !== "APPROVED");

  return (
    <div className="space-y-12">
      {data.roles.length > 0 && (
        <ul className="-mt-4 flex flex-wrap gap-2" aria-label="Your roles">
          {data.roles.map((role) => (
            <li key={role.role}>
              <Badge tone={role.status === "ACTIVE" ? "success" : role.status === "REJECTED" ? "danger" : "neutral"}>
                {role.label}
                {role.status === "PENDING_VERIFICATION" && " (being checked)"}
                {role.status === "REJECTED" && " (not approved)"}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <NextActions
        actions={data.next_actions.filter((action) => action.code !== "FIND_A_PROPERTY" || data.kind !== "SEEKER")}
        quietText={
          data.kind === "SEEKER"
            ? "Nothing is waiting for you. Viewings to answer and replies will show here."
            : "Nothing needs your attention right now."
        }
      />

      {data.kind === "SEEKER" && <FindAProperty />}

      {openApplications.length > 0 && <Onboarding entries={openApplications} />}

      <Counters data={data} />

      {data.capabilities.receives_requests && <ReceivedRequests data={data} />}
      <MyRequests data={data} />
      {(data.kind !== "PROFESSIONAL_PENDING" || data.recent.appointments.length > 0) && <Appointments data={data} />}

      {professional && <Workspace data={data} />}

      {data.kind === "PROFESSIONAL_PENDING" && (
        <p className="text-muted">
          While we check your application you can still search, send requests and ask for viewings.{" "}
          <Link href="/listings" className={listLink}>
            Find a property
          </Link>
        </p>
      )}
    </div>
  );
}

/** `/dashboard`: the home page of every signed-in customer-scope account, drawn from GET /v1/me/dashboard. */
export function DashboardHome() {
  return (
    <RequireAuth>{(user) => <Home firstName={user.name.split(" ")[0] || user.name} />}</RequireAuth>
  );
}
