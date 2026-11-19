"use client";

import Link from "next/link";
import { useCallback } from "react";
import { formatDay } from "@/components/agent/books/shared";
import { LaterSections, rentWords, TenancyStatusBadge } from "@/components/agent/property/shared";
import { PartiesCard, TermsCard, TimelineCard } from "@/components/agent/property/tenancy-view";
import { MyMaintenance } from "@/components/account/my-maintenance";
import { MyRent } from "@/components/account/my-rent";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyTenancy, listMyTenancies } from "@/lib/api/properties";
import { isTenancyStatus, myTenancyHref, TENANT_STATUS_EXPLAINED, type Tenancy } from "@/lib/tenancies";

/*
 * The tenant's own tenancies (API 0.36.0): `/account/tenancies`, a tab of the
 * activity hub when there is at least one, and `/account/tenancies/<id>`.
 * Read-only, except maintenance: the tenant reports a problem and comments
 * on it (`my-maintenance.tsx`). The API shows a tenancy only to a signed-in person whose
 * verified email is a tenant contact's email in that tenancy's book; never a
 * draft, the team's notes, contact ids, emails or phones.
 */

const PATH = "/account/tenancies";

const LATER = [{ key: "inspections", title: "Inspections", text: "Reports of completed inspections. Not available yet." }];

const placeName = (tenancy: Tenancy) => `${tenancy.property?.name ?? "Your tenancy"}${tenancy.unit ? `, ${tenancy.unit.label}` : ""}`;

export function MyTenancies() {
  return <RequireAuth>{() => <List />}</RequireAuth>;
}

function List() {
  // A module function is stable: read once per visit, and again on "Try again".
  const { state, reload } = useApi(listMyTenancies);

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-4xl">My tenancy</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Where you rent, as your landlord or agent recorded it. A tenancy appears here when the email they have for you is the
        email of your account, and your email is verified.
      </p>

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" && state.data.items.length > 0 && (state.data.items.length === 1 ? "1 tenancy" : `${state.data.items.length} tenancies, newest first`)}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading your tenancies" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          <EmptyState
            title="You have no tenancies here"
            action={
              <ButtonLink href="/account" variant="secondary">
                Check your email address
              </ButtonLink>
            }
          >
            If you rent through an agent or landlord who uses RightProperty365, ask them to record you with the email of your
            account, and make sure your email is verified.
          </EmptyState>
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <ul className="space-y-4">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <TenancyStatusBadge status={item.status} label={item.statusLabel} />
                    {item.managedBy && <span className="text-sm text-muted">Managed by {item.managedBy.name}</span>}
                  </div>
                  <h2 className="mt-3 font-sans text-lg font-semibold tracking-normal break-words">
                    <Link href={myTenancyHref(item.id)} className="text-primary-ink hover:underline">
                      {placeName(item)}
                    </Link>
                  </h2>
                  {item.property?.address && <p className="mt-1 text-sm break-words text-muted">{item.property.address}</p>}
                  <p className="mt-2 text-sm text-ink">
                    {rentWords(item.rent)}
                    {item.startDate && ` · from ${formatDay(item.startDate)}`}
                    {item.endDate && ` to ${formatDay(item.endDate)}`}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function MyTenancyDetail({ id }: { id: string }) {
  return <RequireAuth>{() => <Detail id={id} />}</RequireAuth>;
}

function Detail({ id }: { id: string }) {
  const load = useCallback(() => getMyTenancy(id), [id]);
  const { state, reload } = useApi(load);

  return (
    <>
      <BackLink href={PATH}>My tenancy</BackLink>
      {state.status === "loading" && (
        <div className="mt-4">
          <LoadingBlock label="Loading your tenancy" rows={3} />
        </div>
      )}
      {state.status === "error" && (
        <div className="mt-4">
          {state.failure.status === 404 ? (
            <EmptyState
              title="We could not find that tenancy"
              action={
                <ButtonLink href={PATH} variant="secondary">
                  See your tenancies
                </ButtonLink>
              }
            />
          ) : (
            <LoadError failure={state.failure} onRetry={reload} />
          )}
        </div>
      )}
      {state.status === "ready" && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TenancyStatusBadge status={state.data.status} label={state.data.statusLabel} />
            {state.data.managedBy && <span className="text-sm text-muted">Managed by {state.data.managedBy.name}</span>}
          </div>
          <h1 className="mt-2 text-3xl break-words md:text-4xl">{placeName(state.data)}</h1>
          {state.data.property?.address && <p className="mt-2 max-w-2xl break-words text-muted">{state.data.property.address}</p>}
          {isTenancyStatus(state.data.status) && <p className="mt-1 text-sm text-muted">{TENANT_STATUS_EXPLAINED[state.data.status]}</p>}
          <div className="mt-8 grid max-w-3xl gap-6">
            <TermsCard tenancy={state.data} lease={state.data.lease ? (state.data.lease.reference ?? "Linked") : undefined} />
            <PartiesCard tenancy={state.data} />
            <MyRent tenancy={state.data} />
            <MyMaintenance tenancy={state.data} />
            <TimelineCard tenancy={state.data} hideWhenEmpty />
            <LaterSections items={LATER} />
            <p className="text-sm text-muted">
              Something wrong here? Ask {state.data.managedBy?.name ?? "your landlord or agent"} to correct it. You can read this
              tenancy but not change it; report repairs under Maintenance.
            </p>
          </div>
        </>
      )}
    </>
  );
}
