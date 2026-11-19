"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AnswersView } from "@/components/applications/answers-view";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScanPolling } from "@/components/ui/scan-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  getOwnApplication,
  listOwnApplications,
  ownFileUrl,
  withdrawApplication,
  type Application,
  type ApplicationEvent,
} from "@/lib/api/applications";
import {
  APPLICANT_STATUS_EXPLAINED,
  applicantCanEdit,
  applicantCanWithdraw,
  applicationStatusLabel,
  applicationStatusTone,
  isApplicationStatus,
} from "@/lib/questionnaires";

/*
 * The customer's own applications (API 0.32.0): `/account/applications`, a
 * tab of the activity hub, and `/account/applications/<id>`. Only the
 * applicant's own; never another applicant, a note or who reviews it.
 */

const PATH = "/account/applications";

const explained = (status: string) => (isApplicationStatus(status) ? APPLICANT_STATUS_EXPLAINED[status] : "");

/** The page address for a status and a page. */
const listHref = (status: string | undefined, page: number) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
};

/** "Continue your application" or "Answer the request", to the apply page, when the listing still has one. */
function NextStep({ application, size = "md" }: { application: Application; size?: "sm" | "md" }) {
  const slug = application.listing?.slug;
  if (!slug || !applicantCanEdit(application.status)) return null;
  return (
    <ButtonLink href={`/apply/${slug}`} size={size}>
      {application.status === "MORE_INFO" ? "Answer the request" : "Continue your application"}
      <span className="sr-only">: {application.listing?.title}</span>
    </ButtonLink>
  );
}

function List() {
  const params = useSearchParams();
  const search = params.toString();
  const filter = useMemo(() => {
    const query = new URLSearchParams(search);
    const status = query.get("status") ?? undefined;
    const page = Math.max(1, Number.parseInt(query.get("page") ?? "1", 10) || 1);
    return { status: status && isApplicationStatus(status) ? status : undefined, page };
  }, [search]);
  const load = useCallback(() => listOwnApplications(filter), [filter]);
  const { state, reload } = useApi(load);
  const page = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const counts = page?.status_counts ?? [];
  const all = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <h1 className="mt-1 text-4xl">Your applications</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Applications you started or sent for a property, and where each one stands. Only you and the team that advertises the
        property see them.
      </p>

      {counts.length > 0 && all > 0 && (
        <div className="mt-6">
          <ChipNav
            label="Applications by status"
            items={[
              { key: "all", href: PATH, label: "All", count: all, current: !filter.status },
              ...counts.map((item) => ({
                key: item.status,
                href: listHref(item.status, 1),
                label: applicationStatusLabel(item.status, item.label),
                count: item.count,
                current: filter.status === item.status,
              })),
            ]}
          />
        </div>
      )}

      <p role="status" className="mt-4 text-sm text-muted">
        {state.status === "ready" &&
          state.data.items.length > 0 &&
          `${(state.data.total ?? state.data.items.length) === 1 ? "1 application" : `${state.data.total ?? state.data.items.length} applications`}${
            state.data.total_pages > 1 ? `, page ${state.data.page} of ${state.data.total_pages}` : ""
          }, newest first`}
      </p>

      <div className="mt-4">
        {state.status === "loading" && <LoadingBlock label="Loading your applications" />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 &&
          (filter.page > 1 ? (
            <EmptyState title={`There is no page ${filter.page} of your applications`} action={<ButtonLink href={listHref(filter.status, 1)} variant="secondary">Go to page 1</ButtonLink>} />
          ) : filter.status ? (
            <EmptyState title="No applications with this status" action={<ButtonLink href={PATH} variant="secondary">Show all your applications</ButtonLink>} />
          ) : (
            <EmptyState title="You have not applied for a property yet" action={<ButtonLink href="/listings?deal=rent" variant="secondary">Find a property to rent</ButtonLink>}>
              Listings that take applications have an &ldquo;Apply for this property&rdquo; button. Your applications appear here.
            </EmptyState>
          ))}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <ul className="space-y-4">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={applicationStatusTone(item.status)}>{applicationStatusLabel(item.status, item.status_label)}</Badge>
                      <span className="ml-auto text-sm text-muted">
                        {item.submitted_at ? `Sent ${formatWhen(item.submitted_at)}` : item.created_at ? `Started ${formatWhen(item.created_at)}` : ""}
                      </span>
                    </div>
                    <h2 className="mt-3 font-sans text-lg font-medium tracking-normal">
                      <Link href={`${PATH}/${item.id}`} className="text-primary-ink hover:underline">
                        {item.listing?.title || "A listing that is no longer shown"}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">{explained(item.status)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <NextStep application={item} size="sm" />
                      {item.reference && <span className="font-mono text-xs text-subtle">{item.reference}</span>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination className="mt-8" page={state.data.page} totalPages={state.data.total_pages} hrefFor={(value) => listHref(filter.status, value)} label="Your applications" />
          </>
        )}
      </div>
    </>
  );
}

/** `/account/applications`: the applications the signed-in person made, by status. */
export function MyApplications() {
  return <RequireAuth>{() => <List />}</RequireAuth>;
}

function eventText(entry: ApplicationEvent): string {
  if (entry.status_label) return entry.status_label;
  if (entry.status) return applicationStatusLabel(entry.status);
  const words: Record<string, string> = {
    CREATED: "Started",
    SUBMITTED: "Sent",
    RESUBMITTED: "Sent again",
    INFO_REQUESTED: "More information asked for",
    WITHDRAWN: "Withdrawn",
    STATUS_CHANGED: "Status changed",
  };
  return words[entry.event] ?? applicationStatusLabel(entry.event);
}

export function Timeline({ entries, empty }: { entries: ApplicationEvent[]; empty: string }) {
  if (entries.length === 0) return <p className="mt-3 text-muted">{empty}</p>;
  return (
    <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <p className="font-medium text-ink">{eventText(entry)}</p>
          <p className="text-sm text-muted">
            {entry.actor ? `${entry.actor} · ` : ""}
            <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
          </p>
          {entry.message && <p className="mt-1 whitespace-pre-line text-sm text-ink">{entry.message}</p>}
        </li>
      ))}
    </ol>
  );
}

function Detail({ id }: { id: string }) {
  const load = useCallback(() => getOwnApplication(id), [id]);
  const { state, reload, replace } = useApi(load);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // While a file is checked for viruses, read the application again quietly.
  const poll = useCallback(async () => {
    const result = await getOwnApplication(id);
    if (result.ok) replace(result.data);
  }, [id, replace]);
  useScanPolling(state.status === "ready" ? state.data.files.map((file) => file.scan_status) : [], poll);

  if (state.status === "loading") return <LoadingBlock label="Loading your application" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState title="We could not find that application" action={<ButtonLink href={PATH} variant="secondary">Back to your applications</ButtonLink>}>
          Only applications made with this account can be opened here.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const application = state.data;
  const title = application.listing?.title || "A listing that is no longer shown";

  async function withdraw() {
    setBusy(true);
    setError(undefined);
    const result = await withdrawApplication(application.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.failure.message);
      if (result.failure.status === 409) reload();
      return;
    }
    setConfirming(false);
    setDone(true);
    // The answer may be a summary: read the whole application again.
    const full = await getOwnApplication(application.id);
    replace(full.ok ? full.data : result.data);
    heading.current?.focus();
  }

  return (
    <>
      <BackLink href={PATH}>Your applications</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={applicationStatusTone(application.status)}>{applicationStatusLabel(application.status, application.status_label)}</Badge>
        {application.reference && <span className="font-mono text-xs text-subtle">{application.reference}</span>}
      </div>
      <h1 ref={heading} tabIndex={-1} className="mt-2 break-words text-3xl outline-none md:text-4xl">
        {application.listing?.slug ? (
          <Link href={`/listings/${application.listing.slug}`} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h1>
      <p className="mt-2 text-muted">{explained(application.status)}</p>
      {done && <Alert tone="success" title="You withdrew this application. The advertiser has been told." className="mt-4" />}
      {application.status === "MORE_INFO" && application.info_request && (
        <Alert tone="warning" title="The advertiser asked for more information" className="mt-4">
          <p className="whitespace-pre-line">{application.info_request.message}</p>
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <NextStep application={application} />
        {applicantCanWithdraw(application.status) && (
          <Button variant="danger" onClick={() => { setError(undefined); setConfirming(true); }}>
            Withdraw the application
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <h2 className="text-2xl">{application.status === "DRAFT" ? "Your answers so far" : "What you sent"}</h2>
          {application.form && (
            <p className="mt-1 text-sm text-muted">
              {application.form.name}, version {application.form.version}
              {application.submitted_at && <> · sent {formatWhen(application.submitted_at)}</>}
            </p>
          )}
          <div className="mt-4">
            {application.form && application.form.sections.length > 0 && !application.erased ? (
              <AnswersView
                sections={application.form.sections}
                answers={application.answers}
                files={application.files}
                fileHref={(fileId) => ownFileUrl(application.id, fileId)}
                idPrefix="mine"
                headingLevel={3}
              />
            ) : (
              <p className="text-muted">The answers are no longer kept. Applications are deleted when the advertiser&rsquo;s retention period ends; this record stays.</p>
            )}
          </div>
        </div>
        <Card className="self-start">
          <h2 className="text-xl">History</h2>
          <Timeline entries={application.timeline} empty="Nothing has happened yet." />
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Withdraw this application?"
        confirmLabel="Yes, withdraw it"
        busyLabel="Withdrawing…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void withdraw()}
      >
        The advertiser is told and stops considering it. This cannot be undone; to apply again, start a new application.
      </ConfirmDialog>
    </>
  );
}

/** `/account/applications/<id>`: one application, its answers as sent, its history and what can be done next. */
export function MyApplicationDetail({ id }: { id: string }) {
  return <RequireAuth>{() => <Detail id={id} />}</RequireAuth>;
}
