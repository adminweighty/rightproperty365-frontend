"use client";

import { ChevronLeft, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/ui/pagination";
import type { OnboardingStatus } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import {
  listApplications,
  onboardingStatusLabel,
  onboardingStatusLabels,
  onboardingStatusTones,
  type OnboardingAdminPage,
} from "@/lib/api/onboarding";
import type { Option } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Props = {
  /** The roles that have onboarding, from the API, for the role filter. */
  roles: Option[];
};

/** The order of the tabs: what needs a decision first. */
const statuses: OnboardingStatus[] = ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "DRAFT"];

type State =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; page: OnboardingAdminPage };

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const emptyText: Record<OnboardingStatus, string> = {
  SUBMITTED: "No applications are waiting for review.",
  CHANGES_REQUESTED: "No applications are waiting for the applicant to make changes.",
  APPROVED: "No applications have been approved.",
  REJECTED: "No applications have been rejected.",
  DRAFT: "No applications are still being filled in.",
};

function Queue({ roles }: Props) {
  const params = useSearchParams();
  const requested = params.get("status") ?? "";
  const status = statuses.find((value) => value === requested) ?? "SUBMITTED";
  const role = params.get("role") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listApplications({ status, role, q, page }).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", page: result.data } : { status: "error", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [status, role, q, page, attempt]);

  /** The queue's address with these filters; defaults are left out. */
  const hrefFor = (next: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== "SUBMITTED") query.set("status", nextStatus);
    if (role) query.set("role", role);
    if (q) query.set("q", q);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const text = query.toString();
    return text ? `/admin/verifications?${text}` : "/admin/verifications";
  };

  const counts = state.status === "ready" ? state.page.counts : undefined;

  return (
    <>
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-ink hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Administration
      </Link>
      <h1 className="mt-2 text-4xl">Verifications</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Applications for listing, managing and agency roles. Oldest submission first.
      </p>

      <nav aria-label="Application status" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {statuses.map((value) => (
            <li key={value}>
              <Link
                href={hrefFor({ status: value })}
                aria-current={value === status ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                  value === status
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line bg-surface text-ink hover:bg-sunken",
                )}
              >
                {onboardingStatusLabels[value]}
                {/* The count is text inside the link, so it is read with the tab's name. */}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    value === status ? "bg-surface text-ink" : "bg-sunken text-muted",
                  )}
                >
                  {counts ? counts[value] : "–"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* A plain GET form: the filters live in the address, so a view can be bookmarked. */}
      <form
        action="/admin/verifications"
        role="search"
        aria-label="Filter applications"
        className="mt-5 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[14rem_1fr_auto]"
      >
        {status !== "SUBMITTED" && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="queue-role" className="sr-only">
            Role
          </label>
          <SearchableSelect
            id="queue-role"
            name="role"
            defaultValue={role}
            options={[{ value: "", label: "Any role" }, ...roles.map(({ value, label }) => ({ value, label }))]}
          />
        </div>
        <div>
          <label htmlFor="queue-q" className="sr-only">
            Search by applicant, email or business
          </label>
          <Input
            id="queue-q"
            name="q"
            type="search"
            defaultValue={q}
            key={q}
            maxLength={100}
            placeholder="Applicant, email or business"
            autoComplete="off"
          />
        </div>
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" />
          Filter
        </Button>
      </form>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading applications" className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-sunken" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-6">
          <Alert title={state.failure.message} traceId={state.failure.traceId} />
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <p className="mt-6 text-sm text-muted" role="status">
            {state.page.total === 1 ? "1 application" : `${state.page.total} applications`}
            {state.page.total_pages > 1 && ` · page ${state.page.page} of ${state.page.total_pages}`}
          </p>

          {state.page.items.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-line-strong p-10 text-center">
              <h2 className="text-2xl">{role || q ? "No applications match those filters" : emptyText[status]}</h2>
              {(role || q) && (
                <ButtonLink href={hrefFor({}).split("?")[0]} variant="secondary" className="mt-6">
                  Clear filters
                </ButtonLink>
              )}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {state.page.items.map((item) => (
                <li key={item.id}>
                  <article className="group frame-brand relative rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{item.role_label}</Badge>
                      <Badge tone={onboardingStatusTones[item.status]}>{onboardingStatusLabel(item)}</Badge>
                      <span className="ml-auto text-sm text-muted">
                        {item.submitted_at
                          ? `Submitted ${formatWhen(item.submitted_at)}`
                          : `Updated ${formatWhen(item.updated_at)}`}
                      </span>
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-semibold tracking-normal">
                      {/* The stretched link makes the whole row one target. */}
                      <Link
                        href={`/admin/verifications/${item.id}`}
                        className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                      >
                        {item.applicant.name}
                      </Link>
                    </h2>
                    <p className="mt-1 break-all text-sm text-muted">{item.applicant.email}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink">
                      <span>
                        {item.business_name
                          ? item.business_name
                          : item.agency
                            ? `Joining ${item.agency.name}`
                            : "No business or agency"}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted">
                        <FileText className="size-4" aria-hidden="true" />
                        {item.document_count === 1 ? "1 document" : `${item.document_count} documents`}
                      </span>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={state.page.page}
            totalPages={state.page.total_pages}
            hrefFor={(value) => hrefFor({ page: value })}
            label="Applications"
            className="mt-8"
          />
        </>
      )}
    </>
  );
}

/** The queue of onboarding applications for platform administrators. */
export function ReviewQueue(props: Props) {
  return <AdminGate>{() => <Queue {...props} />}</AdminGate>;
}
