"use client";

import { CircleCheck, FileSignature, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AgreementStatusBadge, ColourDot, failureNotice, NoticeArea, PdfActions, type Notice } from "@/components/agreements/shared";
import { useAuth } from "@/components/auth/auth-provider";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import {
  cancelAgreement,
  createSigningLink,
  getAgreementPdf,
  listAgreementEvents,
  remindRecipient,
  replaceRecipient,
  type Agreement,
  type AgreementEvent,
  type AgreementRecipient,
} from "@/lib/api/agreements";
import { EMAIL_MAX, emailProblem } from "@/lib/auth-validation";
import { eventLabel, RECIPIENT_STATUS, REMINDER_OPTIONS, ROLE_LABELS, signingMessage, statusOf } from "@/lib/signing";

const STALE = new Set(["AGREEMENT_STATE_CONFLICT", "RECIPIENT_NOT_FOUND", "NOT_OPEN_FOR_SIGNING"]);

function ReplaceDialog({
  agreement,
  recipient,
  onCancel,
  onReplaced,
}: {
  agreement: Agreement;
  recipient: AgreementRecipient | null;
  onCancel: () => void;
  onReplaced: (agreement: Agreement, email: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<{ email?: string; name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (recipient && !element.open) element.showModal();
    if (!recipient && element.open) element.close();
  }, [recipient]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipient) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const emailError = email ? emailProblem(email) : "Enter the new email address.";
    const nameError = name && Array.from(name).length > 120 ? "Use 120 characters or fewer." : undefined;
    setErrors({ email: emailError, name: nameError });
    if (emailError || nameError) return;
    setBusy(true);
    const result = await replaceRecipient(agreement.id, recipient.id, { email, ...(name && name !== recipient.name ? { name } : {}) });
    setBusy(false);
    if (result.ok) {
      onReplaced(result.data.agreement, email);
      return;
    }
    setErrors({ email: result.failure.fields?.email, name: result.failure.fields?.name, form: result.failure.fields ? undefined : signingMessage(result.failure) });
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="replace-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-overlay"
    >
      {recipient && (
        <form onSubmit={submit} noValidate>
          <h2 id="replace-title" className="font-sans text-xl font-semibold tracking-normal">
            Change {recipient.name}&rsquo;s email address
          </h2>
          <p className="mt-2 text-muted">
            Links sent to {recipient.email} stop working.{" "}
            {recipient.status === "ACTIVE" ? "We email a new link to the new address." : "The new address is emailed when it is their turn."}
          </p>
          <Field id="replace-email" label="New email address" error={errors.email} className="mt-4">
            <Input
              id="replace-email"
              name="email"
              type="email"
              maxLength={EMAIL_MAX}
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy("replace-email", { error: errors.email })}
            />
          </Field>
          <Field id="replace-name" label="Name" optional error={errors.name} className="mt-4">
            <Input
              id="replace-name"
              name="name"
              defaultValue={recipient.name}
              maxLength={140}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy("replace-name", { error: errors.name })}
            />
          </Field>
          {errors.form && <Alert title={errors.form} className="mt-4" />}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Changing…" : "Change and send a new link"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function detailText(event: AgreementEvent): string | null {
  const detail = event.detail ?? {};
  const parts: string[] = [];
  if (typeof detail.reason === "string" && detail.reason) parts.push(`Reason: ${detail.reason}`);
  if (typeof detail.method === "string") parts.push(detail.method === "DEMO_CODE" ? "With the test site's demo code (not a real check)" : "With a code sent by email");
  if (typeof detail.email === "string") parts.push(String(detail.email));
  if (typeof detail.to === "string") parts.push(`To ${detail.to}`);
  if (typeof detail.final_sha256 === "string") parts.push(`Final SHA-256 ${detail.final_sha256}`);
  if (typeof detail.fields === "number") parts.push(detail.fields === 1 ? "1 field" : `${detail.fields} fields`);
  if (typeof detail.file_name === "string") parts.push(detail.file_name);
  return parts.length ? parts.join(" · ") : null;
}

function Activity({ agreementId, version }: { agreementId: string; version: string }) {
  const load = useCallback(() => listAgreementEvents(agreementId), [agreementId]);
  const { state, reload } = useApi(load);
  const items = state.status === "ready" ? state.data.items : state.status === "loading" ? state.previous?.items : undefined;
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current !== version) {
      seen.current = version;
      reload();
    }
  }, [version, reload]);

  return (
    <section aria-labelledby="agreement-activity">
      <h2 id="agreement-activity" className="text-2xl">
        Activity
      </h2>
      <div className="mt-4">
        {state.status === "loading" && !items && <LoadingBlock label="Loading the activity" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {items && (
          <ol className="relative space-y-4 border-l-2 border-line pl-6">
            {items.map((event) => {
              const detail = detailText(event);
              return (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.95rem] top-1.5 size-3 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
                  <p className="font-medium text-ink">
                    {eventLabel(event.action)}
                    <span className="font-normal text-muted"> · {event.actor_name}</span>
                  </p>
                  <p className="text-sm text-muted">{formatWhen(event.at)}</p>
                  {detail && <p className="break-all text-sm text-muted">{detail}</p>}
                  {(event.ip || event.user_agent) && (
                    <p className="break-all text-xs text-subtle">
                      {event.ip && `IP ${event.ip}`}
                      {event.ip && event.user_agent && " · "}
                      {event.user_agent}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export function AgreementDetail({ initial, onReload }: { initial: Agreement; onReload: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [agreement, setAgreement] = useState(initial);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [replacing, setReplacing] = useState<AgreementRecipient | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const noticeRef = useRef<HTMLDivElement>(null);
  const recipients = [...agreement.recipients].sort((a, b) => a.order - b.order);
  const out = agreement.status === "OUT_FOR_SIGNATURE";
  const completed = agreement.status === "COMPLETED";
  const mine = recipients.find((recipient) => recipient.status === "ACTIVE" && recipient.email.toLowerCase() === (user?.email ?? "").toLowerCase());

  const show = (next: Notice) => {
    setNotice(next);
    requestAnimationFrame(() => noticeRef.current?.focus());
  };

  function onFailure(failure: Parameters<typeof failureNotice>[0]) {
    show(failureNotice(failure, STALE.has(failure.code) ? "warning" : "danger"));
    if (STALE.has(failure.code)) onReload();
  }

  async function remind(recipient: AgreementRecipient) {
    setBusy(recipient.id);
    const result = await remindRecipient(agreement.id, recipient.id);
    setBusy(null);
    if (result.ok) {
      setAgreement(result.data.agreement);
      show({ tone: "success", text: `Reminder sent to ${recipient.name}, with a new link. Their earlier links keep working.` });
      return;
    }
    if (result.failure.status === 429) {
      show({ tone: "warning", text: "You sent a reminder a moment ago. Please wait a little before sending another." });
      return;
    }
    onFailure(result.failure);
  }

  async function cancel() {
    setBusy("cancel");
    setDialogError(undefined);
    const result = await cancelAgreement(agreement.id, reason.trim() || undefined);
    setBusy(null);
    if (!result.ok) {
      setDialogError(signingMessage(result.failure));
      return;
    }
    setCancelling(false);
    setAgreement(result.data.agreement);
    show({ tone: "success", text: "The document was cancelled. Its signing links no longer work." });
  }

  async function signNow() {
    if (!mine) return;
    setBusy("sign");
    const result = await createSigningLink(mine.id);
    if (result.ok) {
      router.push(`/sign/${result.data.token}`);
      return;
    }
    setBusy(null);
    onFailure(result.failure);
  }

  return (
    <>
      <BackLink href="/agent/agreements">Agreements</BackLink>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl">{agreement.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-mono">{agreement.reference}</span>
            <AgreementStatusBadge status={agreement.status} />
            {agreement.source === "LEASE" && agreement.lease_id && (
              <Link href={`/agent/leases/${agreement.lease_id}`} className="font-medium text-primary-ink hover:underline">
                Open the lease
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mine && (
            <Button onClick={() => void signNow()} disabled={busy === "sign"} aria-busy={busy === "sign" || undefined}>
              <FileSignature className="size-4" aria-hidden="true" />
              {busy === "sign" ? "Opening…" : mine.role === "APPROVER" ? "Approve now" : "Sign now"}
            </Button>
          )}
          {agreement.document && (
            <PdfActions
              read={() => getAgreementPdf(agreement.id)}
              name={agreement.name}
              reference={agreement.reference}
              label={completed ? "Download the final PDF" : "Download PDF"}
              open="Open"
              size="md"
            />
          )}
          {agreement.can_cancel && (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() => {
                setDialogError(undefined);
                setReason("");
                setCancelling(true);
              }}
            >
              Cancel the document
            </Button>
          )}
        </div>
      </div>
      <NoticeArea ref={noticeRef} notice={notice} />

      <div className="mt-8 space-y-10">
        {completed && agreement.final_document && (
          <Card className="border-success">
            <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-normal">
              <CircleCheck className="size-6 text-success" aria-hidden="true" />
              Completed{agreement.completed_at && ` on ${formatWhen(agreement.completed_at)}`}
            </h2>
            <p className="mt-2 text-muted">
              The final PDF has every signature and an audit report on its last page. Everyone, you included, was emailed
              a copy.
            </p>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">SHA-256 of the final PDF</dt>
              <dd className="break-all font-mono text-ink">{agreement.final_document.sha256}</dd>
              {agreement.document && (
                <>
                  <dt className="text-muted">SHA-256 of the original</dt>
                  <dd className="break-all font-mono text-ink">{agreement.document.sha256}</dd>
                </>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              <PdfActions read={() => getAgreementPdf(agreement.id)} name={agreement.name} reference={agreement.reference} label="Download the final PDF" size="md" variant="primary" />
              <Link
                href={`/verify?reference=${encodeURIComponent(agreement.reference)}`}
                className="inline-flex min-h-11 items-center gap-2 font-medium text-primary-ink hover:underline"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Check it on the verify page
              </Link>
            </div>
          </Card>
        )}
        {agreement.status === "CANCELLED" && (
          <Alert tone="warning" title={`Cancelled${agreement.cancelled_at ? ` on ${formatWhen(agreement.cancelled_at)}` : ""}`}>
            {agreement.cancel_reason ? `Reason: ${agreement.cancel_reason}` : "No reason was given."}
          </Alert>
        )}
        {agreement.status === "EXPIRED" && (
          <Alert tone="warning" title={`Expired${agreement.expired_at ? ` on ${formatWhen(agreement.expired_at)}` : ""}`}>
            It was not finished in time. Send it again as a new document if it is still needed.
          </Alert>
        )}
        {agreement.status === "DECLINED" && (
          <Alert tone="danger" title={`Declined${agreement.declined_at ? ` on ${formatWhen(agreement.declined_at)}` : ""}`}>
            {recipients
              .filter((recipient) => recipient.status === "DECLINED")
              .map((recipient) => `${recipient.name}: ${recipient.decline_reason ?? "no reason given"}`)
              .join(" ")}
          </Alert>
        )}

        <section aria-labelledby="agreement-recipients">
          <h2 id="agreement-recipients" className="text-2xl">
            Recipients
          </h2>
          <Card padded={false} className="mt-4">
            <ul className="divide-y divide-line">
              {recipients.map((recipient, index) => {
                const { label, tone } = statusOf(RECIPIENT_STATUS, recipient.status);
                const pending = out && (recipient.status === "WAITING" || recipient.status === "ACTIVE");
                return (
                  <li key={recipient.id} className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <ColourDot index={index} className="mt-1.5" />
                      <span className="w-5 pt-0.5 text-sm font-semibold tabular-nums text-ink">{recipient.order}</span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {recipient.name}
                          {recipient.label && <span className="text-sm font-normal text-muted">({recipient.label})</span>}
                          <Badge>{ROLE_LABELS[recipient.role] ?? recipient.role}</Badge>
                          <Badge tone={tone}>{label}</Badge>
                        </p>
                        <p className="break-all text-sm text-muted">{recipient.email}</p>
                        <p className="text-xs text-subtle">
                          {[
                            recipient.activated_at && `emailed ${formatWhen(recipient.activated_at)}`,
                            recipient.first_viewed_at && `opened ${formatWhen(recipient.first_viewed_at)}`,
                            recipient.completed_at && `${recipient.status === "APPROVED" ? "approved" : "signed"} ${formatWhen(recipient.completed_at)}`,
                            recipient.declined_at && `declined ${formatWhen(recipient.declined_at)}`,
                            recipient.verification === "DEMO_CODE" && "verified with the test site's demo code",
                            recipient.verification === "EMAIL_CODE" && "email verified with a code",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    {pending && (
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {recipient.status === "ACTIVE" && (
                          <Button size="sm" variant="secondary" onClick={() => void remind(recipient)} disabled={busy === recipient.id} aria-busy={busy === recipient.id || undefined}>
                            {busy === recipient.id ? "Sending…" : "Remind"}
                            <span className="sr-only"> {recipient.name}</span>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setReplacing(recipient)}>
                          Change email<span className="sr-only"> of {recipient.name}</span>
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="agreement-details">
          <h2 id="agreement-details" className="text-2xl">
            Details
          </h2>
          <Card className="mt-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Sent by</dt>
              <dd className="text-ink">
                {agreement.sender.name}
                {agreement.organisation && `, ${agreement.organisation.name}`}
              </dd>
              {agreement.sent_at && (
                <>
                  <dt className="text-muted">Sent</dt>
                  <dd className="text-ink">{formatWhen(agreement.sent_at)}</dd>
                </>
              )}
              <dt className="text-muted">Can be signed until</dt>
              <dd className="text-ink">{formatWhen(agreement.expires_at)}</dd>
              <dt className="text-muted">Reminders</dt>
              <dd className="text-ink">{REMINDER_OPTIONS.find((option) => option.value === agreement.reminder_frequency)?.label ?? agreement.reminder_frequency}</dd>
              {agreement.document && (
                <>
                  <dt className="text-muted">Original document</dt>
                  <dd className="break-all text-ink">
                    {agreement.document.file_name} · SHA-256 <span className="font-mono">{agreement.document.sha256}</span>
                  </dd>
                </>
              )}
              {agreement.message && (
                <>
                  <dt className="text-muted">Message</dt>
                  <dd className="whitespace-pre-line text-ink">{agreement.message}</dd>
                </>
              )}
            </dl>
          </Card>
        </section>

        <Activity agreementId={agreement.id} version={agreement.updated_at} />
      </div>

      <ReplaceDialog
        agreement={agreement}
        recipient={replacing}
        onCancel={() => setReplacing(null)}
        onReplaced={(next, email) => {
          setReplacing(null);
          setAgreement(next);
          show({ tone: "success", text: `The address was changed to ${email}. The old links no longer work.` });
        }}
      />

      <ConfirmDialog
        open={cancelling}
        title="Cancel this document?"
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
        busyLabel="Cancelling…"
        busy={busy === "cancel"}
        error={dialogError}
        onCancel={() => setCancelling(false)}
        onConfirm={() => void cancel()}
      >
        <p>Every signing link stops working at once{agreement.source === "LEASE" ? " and the lease is cancelled too" : ""}. This cannot be undone.</p>
        <Field id="detail-cancel-reason" label="Reason" optional hint="Kept in the document's history." className="mt-4">
          <Textarea
            id="detail-cancel-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            aria-describedby="detail-cancel-reason-hint"
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}
