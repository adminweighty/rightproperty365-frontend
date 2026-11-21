"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "@/components/motion/count-up";
import { NoAccess } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import type { ApiFailure } from "@/lib/api/http";
import { cn } from "@/lib/cn";

/*
 * Small pieces shared by the signed-in pages: the dashboard, the request
 * lists, the team page and the admin overview.
 */

/** "15 Nov 2026, 14:05" in the viewer's time zone. */
export const formatWhen = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(at);
};

export function LoadingBlock({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-28 rounded-lg bg-sunken" />
      ))}
    </div>
  );
}

/** The API's message with "Try again". A 403 is the "no access" state. */
export function LoadError({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  if (failure.code === "BRANCH_FORBIDDEN") return <OtherBranch />;
  if (failure.status === 403) return <NoAccess />;
  return (
    <div>
      <Alert title={failure.message} traceId={failure.traceId} />
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * A listing, lead or ledger entry of another branch of the caller's
 * organisation (API 0.57.0: 403 BRANCH_FORBIDDEN).
 */
function OtherBranch() {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">This belongs to another branch</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        You work in one branch of your organisation, and this is another branch&apos;s work. If you need it, ask the
        Agency Principal or an Agency Administrator.
      </p>
      <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
        Back to your dashboard
      </ButtonLink>
    </div>
  );
}

/** A dashed panel that says what is not there and what to do next. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-primary-ink hover:underline"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

const tile = "flex h-full flex-col justify-between gap-2 rounded-lg border border-line bg-surface p-4 shadow-xs";

/**
 * One number with its label. A link when the number has a page behind it,
 * plain text otherwise: never a link that leads nowhere.
 */
export function StatTile({
  label,
  value,
  href,
  emphasis,
}: {
  label: string;
  value: number;
  href?: string | null;
  /** Highlights a number that needs action (above zero). */
  emphasis?: boolean;
}) {
  const body = (
    <>
      <span className="text-sm leading-snug text-muted">{label}</span>
      <span className={cn("text-3xl font-bold tabular-nums", emphasis && value > 0 ? "text-primary-ink" : "text-ink")}>
        <CountUp value={value} />
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={cn(tile, "transition-colors hover:border-primary hover:bg-tint")}>
      {body}
    </Link>
  ) : (
    <div className={tile}>{body}</div>
  );
}

const chip = "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors";

/** A row of filters that are links (one is current), each with its count. */
export function ChipNav({
  label,
  items,
}: {
  label: string;
  items: { key: string; href: string; label: string; count?: number; current: boolean }[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                chip,
                item.current ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-sunken",
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2 text-xs tabular-nums",
                    item.current ? "bg-primary-hover text-on-primary" : "bg-sunken text-muted",
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
