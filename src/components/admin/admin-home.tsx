"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { Stagger } from "@/components/motion/stagger";
import { formatWhen, LoadError, LoadingBlock, StatTile } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminOverview, type AdminOverview } from "@/lib/api/admin";
import {
  AUDIT_ROLES,
  DEVELOPMENT_REVIEW_ROLES,
  EMAIL_DELIVERY_ROLES,
  FILE_SCAN_ROLES,
  hasPlatformRole,
  LEASE_TEMPLATE_ROLES,
  LEGAL_ADMIN_ROLES,
  platformRoleLabels,
  PACKAGE_ROLES,
  PLACEMENT_ROLES,
  MARKET_ROLES,
  LISTING_REVIEW_ROLES,
  REFERENCE_ROLES,
  REPORT_ROLES,
  REVIEW_MODERATION_ROLES,
  ANALYTICS_ROLES,
  SIGNING_OVERSIGHT_ROLES,
  SUBSCRIPTION_READ_ROLES,
  TAX_RULE_ROLES,
  titleFromCode,
  USER_READ_ROLES,
  type PlatformRole,
  type User,
} from "@/lib/api/auth";
import { adminListSubscriptions } from "@/lib/api/subscriptions";
import { listDevelopmentQueue } from "@/lib/api/developments";
import { REVIEW_QUEUE_STATUSES } from "@/lib/listing-manage";

const VERIFICATION_STATUSES = new Set(["SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "DRAFT"]);
/** Listing statuses the listing review queue filters by. */
const REVIEW_STATUSES = new Set<string>(REVIEW_QUEUE_STATUSES);

const marketsText = (codes: string[] | null) => (codes ? `Counted for ${codes.join(", ")}.` : "Counted for every country.");

function TileGrid({ children }: { children: ReactNode }) {
  return <Stagger as="ul" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</Stagger>;
}

function SectionCard({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
        {children}
      </Card>
    </section>
  );
}

function Attention({ data, awaitingPayment, developmentsWaiting }: { data: AdminOverview; awaitingPayment: number | null; developmentsWaiting: number | null }) {
  const listingsWaiting = data.listings?.by_status.find((item) => item.status === "PENDING_REVIEW")?.count ?? 0;
  const items = [
    data.verifications && data.verifications.waiting > 0
      ? {
          key: "verifications",
          count: data.verifications.waiting,
          text: data.verifications.waiting === 1 ? "application is waiting for review" : "applications are waiting for review",
          href: "/admin/verifications",
        }
      : null,
    listingsWaiting > 0
      ? {
          key: "listings",
          count: listingsWaiting,
          text: listingsWaiting === 1 ? "listing is waiting for review" : "listings are waiting for review",
          href: "/admin/listings",
        }
      : null,
    developmentsWaiting
      ? {
          key: "developments",
          count: developmentsWaiting,
          text: developmentsWaiting === 1 ? "development project is waiting for review" : "development projects are waiting for review",
          href: "/admin/developments",
        }
      : null,
    data.requests && data.requests.routing_exceptions.open > 0
      ? {
          key: "exceptions",
          count: data.requests.routing_exceptions.open,
          text:
            data.requests.routing_exceptions.open === 1
              ? "request could not be sent to anyone"
              : "requests could not be sent to anyone",
          href: "/admin/routing-exceptions",
        }
      : null,
    awaitingPayment
      ? {
          key: "subscriptions",
          count: awaitingPayment,
          text: awaitingPayment === 1 ? "subscription is waiting for its payment to be recorded" : "subscriptions are waiting for their payment to be recorded",
          href: "/admin/subscriptions",
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <section aria-labelledby="admin-attention">
      <h2 id="admin-attention" className="text-2xl">
        What needs your attention
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-muted">Nothing is waiting for you right now.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex h-full flex-col gap-2 rounded-lg border-2 border-primary bg-tint p-5 transition-colors hover:bg-primary-soft"
              >
                <span className="text-4xl font-bold tabular-nums text-primary-ink">{item.count}</span>
                <span className="font-medium text-ink">{item.text}</span>
                <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary-ink" aria-hidden="true">
                  Open <ArrowRight className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Sections({ data }: { data: AdminOverview }) {
  return (
    <div className="space-y-8">
      {data.sections.map((section) => {
        if (section === "verifications" && data.verifications) {
          return (
            <SectionCard
              key={section}
              id="admin-verifications"
              title="Verifications"
              intro="Applications from people who want to list or manage property, or work at an agency."
            >
              <TileGrid>
                {data.verifications.by_status.map((item) => (
                  <li key={item.status}>
                    <StatTile
                      label={item.label}
                      value={item.count}
                      emphasis={item.status === "SUBMITTED"}
                      href={VERIFICATION_STATUSES.has(item.status) ? `/admin/verifications?status=${item.status}` : null}
                    />
                  </li>
                ))}
              </TileGrid>
              <ButtonLink href="/admin/verifications" className="mt-5">
                Open the review queue
              </ButtonLink>
            </SectionCard>
          );
        }
        if (section === "accounts" && data.accounts) {
          const accounts = data.accounts;
          return (
            <SectionCard key={section} id="admin-accounts" title="Accounts" intro="People who use the site. Administrators are counted on their own.">
              <TileGrid>
                <li><StatTile label="Accounts" value={accounts.total} /></li>
                <li><StatTile label="New in the last 7 days" value={accounts.last_7_days} /></li>
                <li><StatTile label="New in the last 30 days" value={accounts.last_30_days} /></li>
                <li><StatTile label="Email not confirmed yet" value={accounts.unverified} /></li>
                <li><StatTile label="Administrators" value={accounts.administrators} /></li>
                {accounts.by_status.map((item) => (
                  <li key={item.status}>
                    <StatTile label={item.label} value={item.count} />
                  </li>
                ))}
              </TileGrid>
              {accounts.by_role.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-96 text-left text-sm">
                    <caption className="mb-2 text-left font-medium text-ink">Roles people chose</caption>
                    <thead className="border-b border-line text-muted">
                      <tr>
                        <th scope="col" className="py-2 pr-4 font-medium">Role</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                        <th scope="col" className="py-2 text-right font-medium">Accounts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {accounts.by_role.map((row) => (
                        <tr key={`${row.role}-${row.status}`}>
                          <td className="py-2 pr-4 text-ink">{row.label}</td>
                          <td className="py-2 pr-4 text-muted">{titleFromCode(row.status)}</td>
                          <td className="py-2 text-right tabular-nums text-ink">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {accounts.recent.length > 0 && (
                <>
                  <h3 className="mt-6 font-sans text-base font-semibold tracking-normal">Newest sign-ups</h3>
                  <ul className="mt-2 divide-y divide-line">
                    {accounts.recent.map((account) => (
                      <li key={account.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                        <span className="font-medium text-ink">{account.name}</span>
                        <span className="break-all text-muted">{account.email}</span>
                        {!account.email_verified && <Badge tone="warning">Email not confirmed</Badge>}
                        <span className="text-subtle sm:ml-auto">{formatWhen(account.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>
          );
        }
        if (section === "listings" && data.listings) {
          return (
            <SectionCard key={section} id="admin-listings" title="Listings" intro={marketsText(data.listings.market_codes)}>
              <TileGrid>
                <li><StatTile label="All listings" value={data.listings.total} /></li>
                {data.listings.by_status.map((item) => (
                  <li key={item.status}>
                    <StatTile
                      label={item.label}
                      value={item.count}
                      emphasis={item.status === "PENDING_REVIEW"}
                      href={REVIEW_STATUSES.has(item.status) ? `/admin/listings?status=${item.status}` : null}
                    />
                  </li>
                ))}
              </TileGrid>
              <ButtonLink href="/admin/listings" className="mt-5">
                Open the listing reviews
              </ButtonLink>
            </SectionCard>
          );
        }
        if (section === "requests" && data.requests) {
          const requests = data.requests;
          return (
            <SectionCard key={section} id="admin-requests" title="Property requests" intro={marketsText(requests.market_codes)}>
              <TileGrid>
                <li><StatTile label="All requests" value={requests.total} /></li>
                <li><StatTile label="In the last 7 days" value={requests.last_7_days} /></li>
                <li><StatTile label="In the last 30 days" value={requests.last_30_days} /></li>
                <li>
                  <StatTile
                    label="Could not be sent, still open"
                    value={requests.routing_exceptions.open}
                    emphasis
                    href="/admin/routing-exceptions"
                  />
                </li>
                <li>
                  <StatTile
                    label="Could not be sent, dealt with"
                    value={requests.routing_exceptions.resolved}
                    href="/admin/routing-exceptions?state=RESOLVED"
                  />
                </li>
              </TileGrid>
              <h3 className="mt-6 font-sans text-base font-semibold tracking-normal">By stage</h3>
              <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                {requests.by_stage.map((item) => (
                  <li key={item.stage} className="rounded-md border border-line p-3">
                    <span className="block text-sm text-ink">{item.label}</span>
                    <span className="text-2xl font-bold tabular-nums">{item.count}</span>
                  </li>
                ))}
              </ol>
              <ButtonLink href="/admin/routing-exceptions" variant="secondary" className="mt-5">
                Requests nobody could receive
              </ButtonLink>
            </SectionCard>
          );
        }
        return null;
      })}
    </div>
  );
}

/** The pages of the console, each shown only to the roles the API lets in. */
const TOOLS: { href: string; label: string; text: string; roles: readonly PlatformRole[] }[] = [
  { href: "/admin/users", label: "Accounts", text: "Find an account; suspend, reactivate or delete it.", roles: USER_READ_ROLES },
  { href: "/admin/subscriptions", label: "Subscriptions", text: "Record payments, and reject or cancel subscriptions.", roles: SUBSCRIPTION_READ_ROLES },
  { href: "/admin/invoices", label: "Invoices", text: "Renewal invoices: draft, issue, record payments, credit notes, void and disputes.", roles: SUBSCRIPTION_READ_ROLES },
  { href: "/admin/payments", label: "Online payments", text: "Payments made online, the ones to review, refunds and the spreadsheet.", roles: SUBSCRIPTION_READ_ROLES },
  { href: "/admin/subscription-plans", label: "Subscription plans", text: "What professionals can subscribe to, and the prices.", roles: SUBSCRIPTION_READ_ROLES },
  { href: "/admin/markets", label: "Countries", text: "Prepare a country before it goes live, its currencies and notice.", roles: MARKET_ROLES },
  { href: "/admin/listing-reports", label: "Reported listings", text: "What visitors reported: dismiss, warn the advertiser, or take a listing down.", roles: LISTING_REVIEW_ROLES },
  { href: "/admin/placements", label: "Featured and sponsored", text: "Give a listing a paid placement for a period, or end one.", roles: PLACEMENT_ROLES },
  { href: "/admin/packages", label: "Listing packages", text: "How many listings each account may have live, and the prices, per country.", roles: PACKAGE_ROLES },
  { href: "/admin/tax-rules", label: "Tax rules", text: "Tax rates per country and the dates they apply. Not charged anywhere yet.", roles: TAX_RULE_ROLES },
  { href: "/admin/legal", label: "Legal documents", text: "Versions of the Terms, Privacy Policy and the others, per market: drafts, publishing and retiring.", roles: LEGAL_ADMIN_ROLES },
  { href: "/admin/reference", label: "Reference data", text: "Property types, features, places and the other lists.", roles: REFERENCE_ROLES },
  { href: "/admin/reports", label: "Reports", text: "Figures over a range of days, and spreadsheet downloads.", roles: REPORT_ROLES },
  { href: "/admin/analytics", label: "Analytics", text: "Listing views, enquiries and top listings, by country.", roles: ANALYTICS_ROLES },
  { href: "/admin/developments", label: "Development reviews", text: "Development projects developers submit: approve or reject them.", roles: DEVELOPMENT_REVIEW_ROLES },
  { href: "/admin/reviews", label: "Reviews", text: "Check reviews of service providers, and the reported ones.", roles: REVIEW_MODERATION_ROLES },
  { href: "/admin/email-deliveries", label: "Email delivery", text: "Bounces, spam complaints and spikes, and the addresses we stopped emailing.", roles: EMAIL_DELIVERY_ROLES },
  { href: "/admin/file-scans", label: "Upload scanning", text: "Whether uploads are checked for viruses, and the files waiting or removed.", roles: FILE_SCAN_ROLES },
  { href: "/admin/audit", label: "Audit log", text: "Every change administrators made here.", roles: AUDIT_ROLES },
];

function Tools({ user }: { user: User }) {
  const tools = TOOLS.filter((tool) => hasPlatformRole(user, tool.roles));
  if (tools.length === 0) return null;
  return (
    <nav aria-labelledby="admin-tools">
      <h2 id="admin-tools" className="text-2xl">
        Accounts, money and data
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="flex h-full min-h-11 flex-col gap-1 rounded-lg border border-line bg-surface p-4 shadow-xs transition-colors hover:border-primary hover:bg-tint"
            >
              <span className="flex items-center gap-1 font-semibold text-primary-ink">
                {tool.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm text-muted">{tool.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** How many subscriptions wait for a payment to be recorded (the overview does not count them). Null when unknown. */
function useAwaitingPayment(user: User) {
  const [count, setCount] = useState<number | null>(null);
  const allowed = hasPlatformRole(user, SUBSCRIPTION_READ_ROLES);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    adminListSubscriptions({ status: "PENDING_PAYMENT", page_size: 1 }).then((result) => {
      if (!cancelled && result.ok) setCount(result.data.total);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);
  return count;
}

/** How many development projects wait for review (API 0.44.0), for the reviewer roles. Null when unknown. */
function useDevelopmentsWaiting(user: User) {
  const [count, setCount] = useState<number | null>(null);
  const allowed = hasPlatformRole(user, DEVELOPMENT_REVIEW_ROLES);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    listDevelopmentQueue({ status: "PENDING_REVIEW" }).then((result) => {
      if (!cancelled && result.ok) setCount(result.data.total);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);
  return count;
}

function Home({ user }: { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const { state, reload } = useApi(getAdminOverview);
  const awaitingPayment = useAwaitingPayment(user);
  const developmentsWaiting = useDevelopmentsWaiting(user);

  return (
    <>
      <p className="text-sm font-medium text-primary-ink">Administration</p>
      <h1 className="enter-rise mt-1 text-4xl">Welcome, {user.name}</h1>

      <p role="status" className="sr-only">
        {state.status === "ready" ? "The overview has loaded." : ""}
      </p>

      <div className="mt-8 space-y-12">
        {state.status === "loading" && <LoadingBlock label="Loading the overview" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <>
            <Attention data={state.data} awaitingPayment={awaitingPayment} developmentsWaiting={developmentsWaiting} />
            {state.data.sections.length === 0 ? (
              <Card>
                <h2 className="text-2xl">No figures for your role here</h2>
                <p className="mt-2 text-muted">
                  The overview counts accounts, applications, listings and requests. Open the pages your role works on
                  below.
                </p>
              </Card>
            ) : (
              <Sections data={state.data} />
            )}
          </>
        )}

        <Tools user={user} />

        {(hasPlatformRole(user, LEASE_TEMPLATE_ROLES) || hasPlatformRole(user, SIGNING_OVERSIGHT_ROLES)) && (
          <SectionCard
            id="admin-signing"
            title="Leases and signing"
            intro="The sample lease templates anyone can copy, and every lease and document sent for signature (read-only)."
          >
            <div className="mt-5 flex flex-wrap gap-3">
              {hasPlatformRole(user, LEASE_TEMPLATE_ROLES) && <ButtonLink href="/admin/lease-templates">Sample templates</ButtonLink>}
              {hasPlatformRole(user, SIGNING_OVERSIGHT_ROLES) && (
                <>
                  <ButtonLink href="/admin/leases" variant="secondary">
                    All leases
                  </ButtonLink>
                  <ButtonLink href="/admin/agreements" variant="secondary">
                    All agreements
                  </ButtonLink>
                </>
              )}
            </div>
          </SectionCard>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-2xl">Your administrator roles</h2>
            <ul className="mt-4 space-y-3">
              {user.platform_roles.map((assignment) => (
                <li
                  key={`${assignment.role}-${assignment.market_code ?? "all"}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-ink">
                    {platformRoleLabels[assignment.role as PlatformRole] ?? titleFromCode(assignment.role)}
                  </span>
                  <Badge tone="accent">{assignment.market_code ?? "All markets"}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 break-all text-sm text-muted">{user.email}</p>
          </Card>

          <Card>
            <h2 className="text-2xl">Your session</h2>
            <p className="mt-2 leading-relaxed text-muted">
              Administrator sessions end after 30 minutes without activity. Every change you make to accounts,
              subscriptions, plans and reference data is kept in the audit log.
            </p>
            <ButtonLink href="/admin/security" variant="secondary" className="mt-4">
              Two-step sign-in
            </ButtonLink>
          </Card>
        </div>
      </div>

      <Button
        variant="secondary"
        className="mt-8"
        onClick={async () => {
          await signOut();
          router.push("/admin/sign-in");
        }}
      >
        Sign out
      </Button>
    </>
  );
}

/** `/admin`: the overview every administrator starts from, with the sections their role covers. */
export function AdminHome() {
  return <AdminGate>{(user) => <Home user={user} />}</AdminGate>;
}
