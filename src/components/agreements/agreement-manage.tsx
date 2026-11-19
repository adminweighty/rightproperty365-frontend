"use client";

import { FilePlus2, FileSignature, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AgreementStatusBadge, failureNotice, NoticeArea, PdfActions, RecipientChips, type Notice } from "@/components/agreements/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, ChipNav, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { ScanBadge } from "@/components/ui/scan-status";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  cancelAgreement,
  createSigningLink,
  getAgreementPdf,
  listAgreements,
  remindRecipient,
  type Agreement,
  type AgreementStatus,
  type AgreementView,
} from "@/lib/api/agreements";
import { canUseInbox } from "@/lib/api/auth";
import type { ApiResult } from "@/lib/api/http";
import { isFileOpenable } from "@/lib/file-scan";
import { pageFrom } from "@/lib/request-filters";

const PATH = "/agent/agreements";

type Tab = { key: string; label: string; view?: AgreementView };

const TABS: Tab[] = [
  { key: "waiting-for-you", label: "Waiting for you", view: "WAITING_FOR_YOU" },
  { key: "waiting-for-others", label: "Waiting for others", view: "WAITING_FOR_OTHERS" },
  { key: "completed", label: "Completed", view: "COMPLETED" },
  { key: "drafts", label: "Drafts", view: "DRAFTS" },
  { key: "ended", label: "Cancelled, declined, expired" },
];

const ENDED: { value: AgreementStatus; label: string }[] = [
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

const emptyText: Record<string, { title: string; body: string }> = {
  "waiting-for-you": { title: "Nothing is waiting for your signature", body: "Documents you are asked to sign or approve appear here." },
  "waiting-for-others": { title: "Nothing is out for signature", body: "When you send a document, you can follow each recipient here." },
  completed: { title: "No completed documents yet", body: "Once everyone has signed, the final PDF is here." },
  drafts: { title: "No drafts", body: "A document you start preparing is saved here until you send it." },
  ended: { title: "Nothing here", body: "Documents that were declined, cancelled or that expired are listed here." },
};

function href(tab: string, status?: string, page = 1) {
  const params = new URLSearchParams();
  if (tab !== "waiting-for-others") params.set("view", tab);
  if (tab === "ended" && status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** How many are in each list, for the tabs. A list that cannot be read shows no number. */
async function loadCounts(): Promise<ApiResult<Record<string, number | undefined>>> {
  const views = TABS.filter((tab) => tab.view);
  const answers = await Promise.all(views.map((tab) => listAgreements({ view: tab.view, page: 1 })));
  const counts: Record<string, number | undefined> = {};
  views.forEach((tab, index) => {
    const answer = answers[index];
    counts[tab.key] = answer.ok ? answer.data.total : undefined;
  });
  return { ok: true, status: 200, data: counts };
}

function Row({
  agreement,
  email,
  onRemind,
  onCancel,
  onNotice,
}: {
  agreement: Agreement;
  email: string;
  onRemind: (agreement: Agreement) => void;
  onCancel: (agreement: Agreement) => void;
  onNotice: (notice: Notice) => void;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const mine = agreement.recipients.find((recipient) => recipient.status === "ACTIVE" && recipient.email.toLowerCase() === email.toLowerCase());
  const active = agreement.recipients.filter((recipient) => recipient.status === "ACTIVE");
  const out = agreement.status === "OUT_FOR_SIGNATURE";

  async function sign() {
    if (!mine) return;
    setOpening(true);
    const result = await createSigningLink(mine.id);
    if (result.ok) {
      router.push(`/sign/${result.data.token}`);
      return;
    }
    setOpening(false);
    onNotice(failureNotice(result.failure));
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link href={`${PATH}/${agreement.id}`} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
            {agreement.name}
          </Link>
          <AgreementStatusBadge status={agreement.status} />
        </p>
        <p className="text-sm text-muted">
          <span className="font-mono">{agreement.reference}</span>
          {agreement.source === "LEASE" && " · a lease"} · last activity {formatWhen(agreement.updated_at)}
          {out && ` · can be signed until ${formatWhen(agreement.expires_at)}`}
        </p>
        <div className="mt-2">
          {agreement.recipients.length > 0 ? (
            <RecipientChips recipients={agreement.recipients} />
          ) : (
            <p className="text-sm text-subtle">No recipients yet</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {mine && agreement.waiting_for_you && (
          <Button size="sm" onClick={() => void sign()} disabled={opening} aria-busy={opening || undefined}>
            <FileSignature className="size-4" aria-hidden="true" />
            {opening ? "Opening…" : mine.role === "APPROVER" ? "Approve" : "Sign"}
            <span className="sr-only"> {agreement.name}</span>
          </Button>
        )}
        <ButtonLink href={`${PATH}/${agreement.id}`} size="sm" variant="secondary">
          {agreement.status === "DRAFT" ? "Continue" : "Open"}
          <span className="sr-only"> {agreement.name}</span>
        </ButtonLink>
        {out && active.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onRemind(agreement)}>
            Remind<span className="sr-only"> the recipients of {agreement.name}</span>
          </Button>
        )}
        {agreement.document && !isFileOpenable(agreement.document.scan_status) && <ScanBadge status={agreement.document.scan_status} />}
        {agreement.document && isFileOpenable(agreement.document.scan_status) && (
          <PdfActions read={() => getAgreementPdf(agreement.id)} name={agreement.name} reference={agreement.reference} label="PDF" variant="ghost" />
        )}
        {agreement.can_cancel && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => onCancel(agreement)}>
            Cancel<span className="sr-only"> {agreement.name}</span>
          </Button>
        )}
      </div>
    </li>
  );
}

function Manage({ email }: { email: string }) {
  const params = useSearchParams();
  const tabKey = TABS.some((tab) => tab.key === params.get("view")) ? params.get("view")! : "waiting-for-others";
  const tab = TABS.find((item) => item.key === tabKey)!;
  const wantedStatus = params.get("status") as AgreementStatus | null;
  const status = tab.view ? undefined : (ENDED.find((item) => item.value === wantedStatus)?.value ?? "DECLINED");
  const page = pageFrom(params.get("page"));
  const router = useRouter();

  const load = useCallback(() => listAgreements({ view: tab.view, status, page }), [tab.view, status, page]);
  const { state, reload } = useApi(load);
  const counts = useApi(loadCounts);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [reminding, setReminding] = useState<Agreement | null>(null);
  const [cancelling, setCancelling] = useState<Agreement | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const result = useRef<HTMLDivElement>(null);

  const show = (next: Notice) => {
    setNotice(next);
    requestAnimationFrame(() => result.current?.focus());
  };

  async function remind(agreement: Agreement) {
    setBusy(true);
    setDialogError(undefined);
    const active = agreement.recipients.filter((recipient) => recipient.status === "ACTIVE");
    const answers = await Promise.all(active.map((recipient) => remindRecipient(agreement.id, recipient.id)));
    setBusy(false);
    const failed = answers.find((answer) => !answer.ok);
    if (failed && !failed.ok) {
      setDialogError(failureNotice(failed.failure).text);
      return;
    }
    setReminding(null);
    show({ tone: "success", text: `Reminder sent to ${active.map((recipient) => recipient.name).join(", ")}, with a new link.` });
    reload();
  }

  async function cancel(agreement: Agreement) {
    setBusy(true);
    setDialogError(undefined);
    const answer = await cancelAgreement(agreement.id, reason.trim() || undefined);
    setBusy(false);
    if (!answer.ok) {
      setDialogError(failureNotice(answer.failure).text);
      return;
    }
    setCancelling(null);
    show({ tone: "success", text: `“${agreement.name}” was cancelled. Its signing links no longer work.` });
    reload();
    counts.reload();
  }

  const countOf = (key: string) => (counts.state.status === "ready" ? counts.state.data[key] : undefined);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Agreements</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Documents sent for signature: follow each recipient, remind them, and download the signed copy.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/agent/agreements/new">
            <Send className="size-4" aria-hidden="true" />
            Send for signature
          </ButtonLink>
          <ButtonLink href="/agent/leases/new" variant="secondary">
            <FilePlus2 className="size-4" aria-hidden="true" />
            New lease
          </ButtonLink>
        </div>
      </div>

      <div className="mt-8">
        <ChipNav
          label="Agreement lists"
          items={TABS.map((item) => ({
            key: item.key,
            href: href(item.key),
            label: item.label,
            count: countOf(item.key),
            current: item.key === tab.key,
          }))}
        />
      </div>

      {!tab.view && (
        <Field id="agreements-status" label="Show" className="mt-4 max-w-xs">
          <SearchableSelect
            id="agreements-status"
            options={ENDED}
            value={status}
            onValueChange={(value) => router.push(href("ended", value), { scroll: false })}
          />
        </Field>
      )}

      <NoticeArea ref={result} notice={notice} />

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the agreements" rows={3} />}
        {data && data.items.length === 0 && (
          <EmptyState
            title={emptyText[tab.key].title}
            action={
              tab.key === "drafts" || tab.key === "waiting-for-others" ? (
                <ButtonLink href="/agent/agreements/new" variant="secondary">
                  Send a document for signature
                </ButtonLink>
              ) : undefined
            }
          >
            {emptyText[tab.key].body}
          </EmptyState>
        )}
        {data && data.items.length > 0 && (
          <>
            <Card padded={false} aria-busy={state.status === "loading" || undefined}>
              <p role="status" className="sr-only">
                {`${data.total} ${data.total === 1 ? "agreement" : "agreements"}`}
              </p>
              <ul className="divide-y divide-line">
                {data.items.map((agreement) => (
                  <Row
                    key={agreement.id}
                    agreement={agreement}
                    email={email}
                    onNotice={show}
                    onRemind={(target) => {
                      setDialogError(undefined);
                      setReminding(target);
                    }}
                    onCancel={(target) => {
                      setDialogError(undefined);
                      setReason("");
                      setCancelling(target);
                    }}
                  />
                ))}
              </ul>
            </Card>
            {data.total_pages > 1 && (
              <Pagination
                className="mt-6"
                page={data.page}
                totalPages={data.total_pages}
                hrefFor={(value) => href(tab.key, status, value)}
                label="Agreement pages"
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={reminding !== null}
        title="Send a reminder?"
        tone="primary"
        confirmLabel="Send the reminder"
        busyLabel="Sending…"
        busy={busy}
        error={dialogError}
        onCancel={() => setReminding(null)}
        onConfirm={() => reminding && void remind(reminding)}
      >
        <p>
          We email{" "}
          <span className="font-medium text-ink">
            {reminding?.recipients
              .filter((recipient) => recipient.status === "ACTIVE")
              .map((recipient) => recipient.name)
              .join(", ")}
          </span>{" "}
          a reminder with a new link. Their earlier links keep working.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this document?"
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
        busyLabel="Cancelling…"
        busy={busy}
        error={dialogError}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && void cancel(cancelling)}
      >
        <p>Every signing link of “{cancelling?.name}” stops working at once. This cannot be undone.</p>
        <Field id="cancel-reason" label="Reason" optional hint="Kept in the document's history." className="mt-4">
          <Textarea id="cancel-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} aria-describedby="cancel-reason-hint" />
        </Field>
      </ConfirmDialog>
    </>
  );
}

/** `/agent/agreements`: Adobe's "Manage" page for documents sent for signature. */
export function AgreementManage() {
  return <RequireAuth allow={canUseInbox}>{(user) => <Manage email={user.email} />}</RequireAuth>;
}
