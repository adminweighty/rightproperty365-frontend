"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import {
  BackLink,
  ChipNav,
  EmptyState,
  formatWhen,
  LoadError,
  LoadingBlock,
} from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { LISTING_REVIEW_ROLES } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";

/** The listing report queue (API 0.54.0). */

type ReportStatus = "OPEN" | "DISMISSED" | "ACTIONED";
type Report = {
  id: string;
  listing: {
    id: string;
    slug: string;
    title: string;
    reference: string;
    status: string;
    market_code: string;
    open_reports: number;
  };
  reason: string;
  note: string | null;
  reporter: string;
  status: ReportStatus;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
};
type Decision = "dismiss" | "warn" | "unpublish";

const REASON_LABELS: Record<string, string> = {
  FRAUD: "Looks like a scam",
  MISLEADING: "Misleading details or photos",
  ALREADY_SOLD_OR_LET: "Already sold or let",
  WRONG_PRICE: "Wrong price",
  DUPLICATE: "Listed more than once",
  OFFENSIVE: "Offensive",
  OTHER: "Something else",
};

const DECISIONS: Record<
  Decision,
  {
    label: string;
    title: string;
    field: "note" | "message" | "reason";
    fieldLabel: string;
    body: string;
    confirm: string;
  }
> = {
  dismiss: {
    label: "Dismiss",
    title: "Dismiss this report?",
    field: "note",
    fieldLabel: "Why (kept with the report)",
    body: "Nothing happens to the listing.",
    confirm: "Dismiss the report",
  },
  warn: {
    label: "Warn the advertiser",
    title: "Warn the advertiser?",
    field: "message",
    fieldLabel: "Message to the advertiser",
    body: "The advertiser is emailed your message. The listing stays online. Every open report on it is closed.",
    confirm: "Send the warning",
  },
  unpublish: {
    label: "Take the listing down",
    title: "Take the listing down?",
    field: "reason",
    fieldLabel: "Reason, shown to the advertiser",
    body: "The listing leaves the public site at once. The advertiser is emailed your reason and can correct it and send it for review again. Every open report on it is closed.",
    confirm: "Take it down",
  },
};

const STATUSES: { key: ReportStatus | ""; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ACTIONED", label: "Acted on" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "", label: "All" },
];

function List() {
  const params = useSearchParams();
  const raw = params.get("status") ?? "OPEN";
  const status = (raw === "ALL" ? "" : raw) as ReportStatus | "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (status) q.set("status", status);
    return apiFetch<{
      items: Report[];
      total: number;
      page: number;
      page_size: number;
    }>(`/v1/admin/listing-reports?${q}`, { cache: "no-store" });
  }, [status, page]);
  const { state, reload } = useApi(load);
  const [acting, setActing] = useState<{
    report: Report;
    decision: Decision;
  } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<string | null>(null);
  const href = (s: string, p = 1) =>
    `/admin/listing-reports?${new URLSearchParams({ status: s || "ALL", ...(p > 1 ? { page: String(p) } : {}) })}`;

  async function confirm() {
    if (!acting) return;
    const d = DECISIONS[acting.decision];
    setBusy(true);
    const answer = await apiFetch<{ report: Report }>(
      `/v1/admin/listing-reports/${acting.report.id}/${acting.decision}`,
      {
        method: "POST",
        body: { [d.field]: text },
      },
    );
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.fields?.[d.field] ?? answer.failure.message);
      return;
    }
    setOutcome(
      acting.decision === "dismiss"
        ? "Report dismissed."
        : acting.decision === "warn"
          ? `The advertiser of ${acting.report.listing.reference} was warned.`
          : `${acting.report.listing.reference} is taken down. The advertiser was told why.`,
    );
    setActing(null);
    reload();
  }

  const d = acting ? DECISIONS[acting.decision] : null;
  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Reported listings</h1>
      <p className="mt-2 max-w-2xl text-muted">
        What visitors reported. Dismiss a report, warn the advertiser, or take
        the listing down. Every decision is in the audit log.
      </p>
      <div className="mt-6">
        <ChipNav
          label="Report status"
          items={STATUSES.map((s) => ({
            key: s.key || "all",
            href: href(s.key),
            label: s.label,
            current: s.key === status,
          }))}
        />
      </div>
      <div aria-live="polite" className="mt-4">
        {outcome && <Alert tone="success" title={outcome} />}
      </div>
      {state.status === "loading" && (
        <LoadingBlock label="Loading reports" rows={3} />
      )}
      {state.status === "error" && (
        <LoadError failure={state.failure} onRetry={reload} />
      )}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No reports here" />
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-4">
              {state.data.items.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.reason === "FRAUD" ? "danger" : "warning"}>
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </Badge>
                    {r.listing.open_reports > 1 && (
                      <Badge tone="danger">
                        {r.listing.open_reports} open reports
                      </Badge>
                    )}
                    <span className="ml-auto text-sm text-muted">
                      {formatWhen(r.created_at)} · by a {r.reporter}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-ink">
                    <a
                      href={`/admin/listings/${r.listing.id}`}
                      className="text-primary-ink hover:underline"
                    >
                      {r.listing.title}
                    </a>{" "}
                    <span className="font-normal text-muted">
                      ({r.listing.reference}, {r.listing.market_code},{" "}
                      {r.listing.status.toLowerCase().replace(/_/g, " ")})
                    </span>
                  </p>
                  {r.note && (
                    <p className="mt-1 whitespace-pre-line text-ink">
                      “{r.note}”
                    </p>
                  )}
                  {r.status === "OPEN" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(DECISIONS) as Decision[]).map((k) => (
                        <Button
                          key={k}
                          size="sm"
                          variant={k === "unpublish" ? "danger" : "secondary"}
                          onClick={() => {
                            setText("");
                            setError(undefined);
                            setActing({ report: r, decision: k });
                          }}
                        >
                          {DECISIONS[k].label}
                          <span className="sr-only">
                            {" "}
                            for {r.listing.reference}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      {r.status === "DISMISSED" ? "Dismissed" : "Acted on"} by{" "}
                      {r.decided_by ?? "a moderator"}
                      {r.decided_at && <> on {formatWhen(r.decided_at)}</>}
                      {r.decision_note && <>: {r.decision_note}</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={Math.ceil(state.data.total / state.data.page_size)}
              hrefFor={(p) => href(status, p)}
              label="Reports"
            />
          </>
        ))}
      <ConfirmDialog
        open={acting !== null}
        title={d?.title ?? ""}
        confirmLabel={d?.confirm ?? ""}
        busyLabel="Saving…"
        tone={acting?.decision === "unpublish" ? "danger" : "primary"}
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onCancel={() => setActing(null)}
      >
        <p>{d?.body}</p>
        <Field
          id="report-decision-text"
          label={d?.fieldLabel ?? ""}
          className="mt-4 text-ink"
        >
          <Textarea
            id="report-decision-text"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}

/** `/admin/listing-reports` (API 0.54.0). */
export function ListingReports() {
  return (
    <RoleGate roles={LISTING_REVIEW_ROLES} what="the reported listings">
      {() => <List />}
    </RoleGate>
  );
}
