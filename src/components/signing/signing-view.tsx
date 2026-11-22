"use client";

import { Check, CircleCheck, Download, FileSignature, MailWarning, Stamp as StampIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PdfPages, type RenderedPage } from "@/components/pdf/pdf-pages";
import { formatWhen, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { AdoptSignatureDialog, SignaturePreview } from "@/components/signing/adopt-signature";
import { pdfName, savePdf } from "@/components/signing/pdf-file";
import { AdoptStampDialog, StampImage, useStampPreview } from "@/components/signing/stamp-designer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import {
  declineSigning,
  fromSaved,
  getMySignature,
  getSigning,
  getSigningPdf,
  putMySignature,
  sendSigningCode,
  submitSigning,
  type AdoptedSignature,
  type AgreementField,
  type SavedSignature,
  type SigningView,
} from "@/lib/api/agreements";
import type { ApiFailure } from "@/lib/api/http";
import type { Stamp } from "@/lib/api/stamps";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { cleanCode, formatCountdown, RESEND_WAIT_SECONDS, secondsLeft } from "@/lib/sign-in-code";
import { isSelfFilled, ROLE_LABELS, signingMessage, stampFieldErrors } from "@/lib/signing";
import { formatMarketDay } from "@/lib/time-zone";
import { currentMarketZone } from "@/lib/display-zone";

/** 43 URL-safe characters from the API; a little room either way, nothing else is sent to it. */
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

const linkClass = "font-medium text-primary-ink underline underline-offset-2";

function Ending({ title, icon, children, actions }: { title: string; icon?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <Card className="text-center">
      {icon ?? <MailWarning className="mx-auto size-8 text-muted" aria-hidden="true" />}
      <h1 className="mt-4 text-3xl">{title}</h1>
      {children && <div className="mx-auto mt-3 max-w-lg leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </Card>
  );
}

function LinkProblem({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  if (failure.code === "SIGNING_LINK_EXPIRED") {
    return (
      <Ending title="This signing link has expired">
        The document can no longer be signed with it. Ask the sender to send it again if it still needs your signature.
      </Ending>
    );
  }
  if (failure.code === "SIGNING_LINK_NO_LONGER_VALID") {
    return (
      <Ending title="This link no longer works">
        A newer link may have been emailed to you (use the newest email), your address may have been changed, or the
        sender cancelled the document. If you have an account with this email address, your documents are also under{" "}
        <a href="/account/signing" className={linkClass}>
          Documents to sign
        </a>
        .
      </Ending>
    );
  }
  if (failure.status === 404) {
    return (
      <Ending title="We could not find this document">
        Check that you opened the whole link from the email. If it still does not work, ask the sender for a new link.
      </Ending>
    );
  }
  return (
    <Card>
      <Alert title={signingMessage(failure)} traceId={failure.traceId} />
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

/** The date a DATE field shows: today in the market (API 0.61.1), never shifted by the viewer's zone. */
const today = () => formatMarketDay(new Date(), currentMarketZone());

/** The order fields are visited in: page by page, top to bottom, left to right. */
const reading = (a: AgreementField, b: AgreementField) => a.page - b.page || a.y - b.y || a.x - b.x;

type Values = Record<string, string>;

function DownloadButton({ token, name, reference, variant = "secondary", label = "Download PDF" }: {
  token: string;
  name: string;
  reference: string;
  variant?: "secondary" | "ghost" | "primary";
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <Button
        variant={variant}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          const failure = await savePdf(() => getSigningPdf(token), pdfName(name, reference));
          setBusy(false);
          if (failure) setProblem(signingMessage(failure));
        }}
      >
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing…" : label}
      </Button>
      {problem && (
        <span role="alert" className="text-sm text-danger">
          {problem}
        </span>
      )}
    </span>
  );
}

/** The document read-only, under a state that ends the signing. */
function ReadOnlyDocument({ token, view, bytes }: { token: string; view: SigningView; bytes: ArrayBuffer | null }) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">The document</h2>
        <DownloadButton token={token} name={view.agreement.name} reference={view.agreement.reference} variant="ghost" />
      </div>
      {bytes ? <PdfPages data={bytes} label={view.agreement.name} /> : <LoadingBlock label="Loading the document" rows={2} />}
    </div>
  );
}

function Summary({ view }: { view: SigningView }) {
  const { agreement } = view;
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-1 text-left text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-muted">Document</dt>
      <dd className="font-medium text-ink">{agreement.name}</dd>
      <dt className="text-muted">Reference</dt>
      <dd className="font-mono text-ink">{agreement.reference}</dd>
      <dt className="text-muted">From</dt>
      <dd className="text-ink">
        {agreement.sender_name}
        {agreement.organisation_name && `, ${agreement.organisation_name}`}
      </dd>
    </dl>
  );
}

/** Every state in which this person has nothing (more) to do. */
function Finished({ token, view, bytes, justDone }: { token: string; view: SigningView; bytes: ArrayBuffer | null; justDone: boolean }) {
  const { agreement, recipient } = view;
  const approver = recipient.role === "APPROVER";
  const download = <DownloadButton token={token} name={agreement.name} reference={agreement.reference} variant="primary" />;
  const done = recipient.status === "SIGNED" || recipient.status === "APPROVED";
  let body: ReactNode;

  if (agreement.status === "COMPLETED") {
    body = (
      <Ending
        title={justDone ? "Done. Everyone has signed" : "This document is complete"}
        icon={<CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />}
        actions={
          <>
            {download}
            <ButtonLink href={`/verify?reference=${encodeURIComponent(agreement.reference)}`} variant="secondary">
              Check it on the verify page
            </ButtonLink>
          </>
        }
      >
        <p>
          Everyone has finished{agreement.completed_at && ` (${formatWhen(agreement.completed_at)})`}. The final PDF has
          every signature and an audit report on its last page. We have emailed a copy to everyone.
        </p>
        {agreement.final_sha256 && (
          <p className="mt-2 break-all text-xs">
            SHA-256 of the final PDF: <span className="font-mono">{agreement.final_sha256}</span>
          </p>
        )}
        <Summary view={view} />
      </Ending>
    );
  } else if (done) {
    body = (
      <Ending
        title={justDone ? (approver ? "You approved it" : "You signed it") : approver ? "You have approved this document" : "You have signed this document"}
        icon={<CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />}
        actions={download}
      >
        <p>
          {approver ? "You approved" : "You signed"}
          {recipient.completed_at ? ` on ${formatWhen(recipient.completed_at)}` : ""}. We will email everyone the
          completed copy once the others have finished.
        </p>
        <Summary view={view} />
      </Ending>
    );
  } else if (recipient.status === "DECLINED" || agreement.status === "DECLINED") {
    body = (
      <Ending title={recipient.status === "DECLINED" ? "You declined this document" : "This document was declined"} actions={download}>
        {recipient.status === "DECLINED"
          ? `${agreement.sender_name} has been told. Nothing else is needed from you.`
          : "Someone declined to sign it, so it will not be completed. The sender has been told."}
        <Summary view={view} />
      </Ending>
    );
  } else if (agreement.status === "CANCELLED") {
    body = (
      <Ending title="The sender cancelled this document">
        It can no longer be signed. Nothing else is needed from you.
        <Summary view={view} />
      </Ending>
    );
  } else if (agreement.status === "EXPIRED") {
    body = (
      <Ending title="This document has expired">
        It could be signed until {formatWhen(agreement.expires_at)}. Ask the sender to send it again if it still needs
        your signature.
        <Summary view={view} />
      </Ending>
    );
  } else {
    // Out for signature, but not this person's turn yet.
    const first = view.other_recipients.filter((other) => other.status === "ACTIVE" && other.role !== "CC");
    const names = first.map((other) => other.name);
    const who =
      names.length === 0 ? "Someone else" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    body = (
      <Ending title="It is not your turn yet" actions={download}>
        <p>
          {who} must {first.every((other) => other.role === "APPROVER") && first.length > 0 ? "approve" : "sign"} first.
          We will email you when it is your turn. You can read the document now.
        </p>
        <Summary view={view} />
      </Ending>
    );
  }

  return (
    <>
      {body}
      <ReadOnlyDocument token={token} view={view} bytes={bytes} />
    </>
  );
}

/** One field over the page, at its place, in this person's hands. */
function FieldBox({
  field,
  page,
  mine,
  value,
  applied,
  signature,
  initials,
  stamp,
  name,
  missing,
  onSign,
  onValue,
}: {
  field: AgreementField;
  page: RenderedPage;
  mine: boolean;
  value: string;
  applied: boolean;
  signature: AdoptedSignature | null;
  initials: AdoptedSignature | null;
  /** Whether a stamp is adopted, and its preview image (an object URL). */
  stamp: { adopted: boolean; url: string | null; loading: boolean };
  name: string;
  missing: boolean;
  onSign: (field: AgreementField) => void;
  onValue: (field: AgreementField, value: string) => void;
}) {
  const style = {
    left: field.x * page.scale,
    top: field.y * page.scale,
    width: field.w * page.scale,
    height: field.h * page.scale,
  };
  const fontSize = Math.max(9, Math.min(field.h * page.scale * 0.6, 22));
  const domId = `field-${field.id}`;
  const box = "absolute flex items-center rounded-sm";

  if (!mine) {
    return (
      <div className={cn(box, "border border-dashed border-line-strong bg-sunken/40 px-1 text-ink")} style={{ ...style, fontSize }} aria-hidden={!field.value}>
        {field.value && <span className="truncate">{field.type === "CHECKBOX" ? (field.value === "true" ? "✓" : "") : field.value}</span>}
      </div>
    );
  }

  const label = field.label ?? undefined;

  if (field.type === "STAMP") {
    const done = applied && stamp.adopted;
    return (
      <button
        id={domId}
        type="button"
        onClick={() => onSign(field)}
        className={cn(
          box,
          "justify-center overflow-hidden border-2 p-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
          done ? "border-primary/40 bg-white/60" : "border-warning bg-warning-soft/90 font-semibold text-warning",
          missing && "ring-2 ring-danger",
        )}
        style={style}
        aria-label={done ? "Stamp added. Change it" : `Stamp here${field.required ? " (required)" : ""}`}
      >
        {done ? (
          <StampImage url={stamp.url} loading={stamp.loading} alt="" className="size-full" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs" style={{ fontSize: Math.min(fontSize, 14) }}>
            <StampIcon className="size-4" aria-hidden="true" />
            Stamp
          </span>
        )}
      </button>
    );
  }

  if (field.type === "SIGNATURE" || field.type === "INITIALS") {
    const adopted = field.type === "SIGNATURE" ? signature : initials;
    const word = field.type === "SIGNATURE" ? "Sign" : "Initial";
    return (
      <button
        id={domId}
        type="button"
        onClick={() => onSign(field)}
        className={cn(
          box,
          "justify-center overflow-hidden border-2 px-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
          applied && adopted ? "border-primary/40 bg-white/60" : "border-warning bg-warning-soft/90 font-semibold text-warning",
          missing && "ring-2 ring-danger",
        )}
        style={style}
        aria-label={applied && adopted ? `${word === "Sign" ? "Signature" : "Initials"} added. Change it` : `${word} here${field.required ? " (required)" : ""}`}
      >
        {applied && adopted ? (
          <SignaturePreview value={adopted} className="h-full" />
        ) : (
          <span className="flex items-center gap-1 text-xs" style={{ fontSize: Math.min(fontSize, 14) }}>
            <FileSignature className="size-3.5" aria-hidden="true" />
            {word}
          </span>
        )}
      </button>
    );
  }

  if (field.type === "NAME" || field.type === "DATE_SIGNED") {
    return (
      <div className={cn(box, "border border-primary/30 bg-primary-soft/50 px-1 text-ink")} style={{ ...style, fontSize }} title="Filled in for you">
        <span className="truncate">{field.type === "NAME" ? name : today()}</span>
      </div>
    );
  }

  if (field.type === "CHECKBOX") {
    return (
      <label className={cn(box, "justify-center", missing && "ring-2 ring-danger")} style={style}>
        <input
          id={domId}
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onValue(field, event.currentTarget.checked ? "true" : "false")}
          className="size-full max-h-6 max-w-6 accent-primary"
          aria-label={`${label ?? "Checkbox"}${field.required ? " (required)" : ""}`}
        />
      </label>
    );
  }

  return (
    <input
      id={domId}
      type="text"
      value={value}
      maxLength={500}
      placeholder={label}
      onChange={(event) => onValue(field, event.currentTarget.value)}
      className={cn(
        box,
        "border-2 bg-white/90 px-1 text-ink placeholder:text-subtle focus-visible:border-focus",
        value.trim() || !field.required ? "border-primary/40" : "border-warning",
        missing && "ring-2 ring-danger",
      )}
      style={{ ...style, fontSize }}
      aria-label={`${label ?? "Text"}${field.required ? " (required)" : ""}`}
    />
  );
}

/** The email code, the consent and "Click to sign". */
function FinishPanel({
  token,
  view,
  remaining,
  onJump,
  build,
  onSigned,
}: {
  token: string;
  view: SigningView;
  remaining: number;
  onJump: () => void;
  build: () => Omit<Parameters<typeof submitSigning>[1], "code" | "consent">;
  onSigned: () => void;
}) {
  const approver = view.recipient.role === "APPROVER";
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const length = view.code_length || 6;

  useEffect(() => {
    if (resendAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const wait = resendAt !== null && now !== null ? secondsLeft(resendAt, now) : resendAt !== null ? RESEND_WAIT_SECONDS : 0;

  async function sendCode() {
    if (sending || wait > 0) return;
    setSending(true);
    setFailure(null);
    const result = await sendSigningCode(token);
    setSending(false);
    const start = Date.now();
    setNow(start);
    if (result.ok) {
      setSentTo(result.data.sent_to);
      setResendAt(start + RESEND_WAIT_SECONDS * 1000);
      setCodeError(undefined);
      requestAnimationFrame(() => codeInput.current?.focus());
      return;
    }
    if (result.failure.status === 429) {
      setResendAt(start + (result.failure.retryAfter ?? RESEND_WAIT_SECONDS) * 1000);
      setFailure({ text: "You asked for a code a moment ago. Please wait a little before asking again." });
      return;
    }
    setFailure({ text: signingMessage(result.failure), traceId: result.failure.traceId });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (remaining > 0) {
      setFailure({ text: `Fill in the ${remaining === 1 ? "last required field" : `${remaining} required fields`} first.` });
      onJump();
      return;
    }
    const clean = cleanCode(code);
    const codeProblem = !sentTo && !env.testSite
      ? "Send yourself the code first."
      : !clean
        ? "Enter the code from the email."
        : !/^\d{4,8}$/.test(clean)
          ? `The code is ${length} numbers.`
          : undefined;
    setCodeError(codeProblem);
    setConsentError(consent ? undefined : "Tick the box to agree to sign electronically.");
    if (codeProblem) {
      codeInput.current?.focus();
      return;
    }
    if (!consent) return;
    setBusy(true);
    const result = await submitSigning(token, { ...build(), code: clean, consent: true });
    setBusy(false);
    if (result.ok) {
      onSigned();
      return;
    }
    const { code: errorCode, fields } = result.failure;
    if (errorCode === "CODE_EXPIRED") {
      setCodeError("That code has expired or was used up. Send a new code.");
      setResendAt(null);
      return;
    }
    if (fields?.code) {
      setCodeError("That code is not right. Check the email and try again.");
      codeInput.current?.select();
      codeInput.current?.focus();
      return;
    }
    if (errorCode === "ALREADY_SIGNED" || errorCode === "NOT_OPEN_FOR_SIGNING") {
      onSigned();
      return;
    }
    const detail = fields ? Object.values(fields).join(" ") : "";
    setFailure({ text: `${signingMessage(result.failure)}${detail ? ` ${detail}` : ""}`, traceId: result.failure.traceId });
  }

  const codeId = "signing-code";
  const describedBy = [fieldDescribedBy(codeId, { error: codeError, hint: sentTo ? "hint" : undefined }), env.testSite ? `${codeId}-demo` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Card id="finish" className="scroll-mt-40">
      <h2 className="font-sans text-xl font-semibold tracking-normal">{approver ? "Approve the document" : "Finish signing"}</h2>
      {remaining > 0 ? (
        <p className="mt-1 text-muted">
          {remaining === 1 ? "1 required field is" : `${remaining} required fields are`} still empty.{" "}
          <button type="button" onClick={onJump} className={linkClass}>
            Go to the next one
          </button>
        </p>
      ) : (
        <p className="mt-1 text-muted">Every required field is filled in. Confirm it is you, then {approver ? "approve" : "sign"}.</p>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">1. Confirm your email address</h3>
          <p className="mt-1 text-sm text-muted">
            {sentTo ? (
              <>
                We sent a {length}-digit code to <span className="font-medium text-ink">{sentTo}</span>.
              </>
            ) : (
              <>We will email a {length}-digit code to {view.recipient.email_masked}.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field id={codeId} label="Code from the email" error={codeError} hint={sentTo ? "The code works for 10 minutes." : undefined}>
              <Input
                ref={codeInput}
                id={codeId}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={12}
                value={code}
                onChange={(event) => {
                  setCode(event.currentTarget.value);
                  setCodeError(undefined);
                }}
                className="max-w-48 font-mono text-lg tracking-widest"
                aria-invalid={Boolean(codeError)}
                aria-describedby={describedBy || undefined}
              />
            </Field>
            <Button variant="secondary" onClick={() => void sendCode()} aria-disabled={sending || wait > 0} aria-busy={sending || undefined}>
              {sending ? "Sending…" : sentTo ? "Send a new code" : "Email me a code"}
            </Button>
            {wait > 0 && <span className="pb-3 text-sm tabular-nums text-muted">Again in {formatCountdown(wait)}</span>}
          </div>
          {env.testSite && (
            <p id={`${codeId}-demo`} className="mt-2 text-sm text-warning">
              Test site: you can use the demo code 1234.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">2. Agree to sign electronically</h3>
          <label className="mt-2 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.currentTarget.checked);
                setConsentError(undefined);
              }}
              className="mt-0.5 size-5 shrink-0 accent-primary"
              aria-invalid={Boolean(consentError)}
              aria-describedby={consentError ? "signing-consent-error" : undefined}
            />
            <span>{view.consent_text || "I agree to use electronic records and signatures."}</span>
          </label>
          {consentError && (
            <p id="signing-consent-error" className="mt-1 text-sm text-danger">
              {consentError}
            </p>
          )}
        </div>

        {failure && <Alert title={failure.text} traceId={failure.traceId} />}

        <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined} className="w-full sm:w-auto">
          <Check className="size-5" aria-hidden="true" />
          {busy ? (approver ? "Approving…" : "Signing…") : approver ? "Approve" : "Click to sign"}
        </Button>
        {view.statement && <p className="text-xs leading-relaxed text-muted">{view.statement}</p>}
      </form>
    </Card>
  );
}

function DeclineDialog({ open, token, onCancel, onDeclined }: { open: boolean; token: string; onCancel: () => void; onDeclined: (view: SigningView) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  async function decline() {
    const text = reason.trim();
    if (!text) return setError("Write why you are declining. The sender is emailed this reason.");
    if (Array.from(text).length > 1000) return setError("Use 1000 characters or fewer.");
    setBusy(true);
    setError(undefined);
    const result = await declineSigning(token, text);
    setBusy(false);
    if (result.ok) onDeclined(result.data.signing);
    else setError(result.failure.fields?.reason ?? signingMessage(result.failure));
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="decline-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-ink shadow-lg backdrop:bg-overlay"
    >
      <h2 id="decline-title" className="font-sans text-xl font-semibold tracking-normal">
        Decline to sign?
      </h2>
      <p className="mt-2 text-muted">The document will not be completed by anyone. The sender is emailed your reason.</p>
      <Field id="decline-reason" label="Reason" error={error} className="mt-4">
        <Textarea
          id="decline-reason"
          value={reason}
          maxLength={1100}
          onChange={(event) => {
            setReason(event.currentTarget.value);
            setError(undefined);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy("decline-reason", { error })}
        />
      </Field>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Keep it
        </Button>
        <Button variant="danger" onClick={() => void decline()} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Declining…" : "Decline"}
        </Button>
      </div>
    </dialog>
  );
}

/** Adobe-style guided signing: Start, Next through the required fields, then the code, the consent and sign. */
function Guided({ token, view, bytes, onDone, onDeclined }: {
  token: string;
  view: SigningView;
  bytes: ArrayBuffer | null;
  onDone: () => void;
  onDeclined: (view: SigningView) => void;
}) {
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const { recipient, agreement } = view;
  const approver = recipient.role === "APPROVER";
  const mine = useMemo(() => view.fields.filter((field) => field.recipient_id === recipient.id).sort(reading), [view.fields, recipient.id]);
  const others = useMemo(() => view.fields.filter((field) => field.recipient_id !== recipient.id), [view.fields, recipient.id]);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(mine.filter((field) => field.type === "TEXT" || field.type === "CHECKBOX").map((field) => [field.id, field.value ?? (field.type === "CHECKBOX" ? "false" : "")])),
  );
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [signature, setSignature] = useState<AdoptedSignature | null>(null);
  const [initials, setInitials] = useState<AdoptedSignature | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(view.saved_stamp ?? null);
  const [stampAdopting, setStampAdopting] = useState<{ field: AgreementField; round: number } | null>(null);
  const [stampErrors, setStampErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedSignature | null>(null);
  const [adopting, setAdopting] = useState<{ field: AgreementField; round: number } | null>(null);
  const [adoptError, setAdoptError] = useState<string | undefined>();
  const [adoptBusy, setAdoptBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const round = useRef(0);

  // A signed-in recipient's saved signature and initials are used until they adopt others.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getMySignature().then((result) => {
      if (cancelled || !result.ok) return;
      setSaved(result.data);
      const savedSignature = fromSaved(result.data.signature);
      const savedInitials = fromSaved(result.data.initials);
      setSignature((current) => current ?? savedSignature);
      setInitials((current) => current ?? savedInitials);
      const savedStamp = result.data.stamp ?? null;
      setStamp((current) => current ?? savedStamp);
      if (savedSignature || savedInitials || savedStamp) setNotice("Your saved signature is ready. Click each signature field to add it; click it again to change it.");
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const fonts = view.signature_fonts.length > 0 ? view.signature_fonts : (saved?.signature_fonts ?? []);

  const isFilled = useCallback(
    (field: AgreementField) => {
      if (field.type === "SIGNATURE") return applied.has(field.id) && signature !== null;
      if (field.type === "INITIALS") return applied.has(field.id) && initials !== null;
      if (field.type === "STAMP") return applied.has(field.id) && stamp !== null;
      if (field.type === "TEXT") return (values[field.id] ?? "").trim() !== "";
      if (field.type === "CHECKBOX") return values[field.id] === "true";
      return true;
    },
    [applied, signature, initials, stamp, values],
  );

  // One preview of the adopted stamp for every stamp field (the preview is rate-limited).
  const hasStampFields = mine.some((field) => field.type === "STAMP");
  const stampPreview = useStampPreview(hasStampFields ? stamp : null, 0);

  const required = mine.filter((field) => isSelfFilled(field.type) && field.required);
  const done = required.filter(isFilled).length;
  const remaining = required.length - done;
  const started = done > 0 || mine.some((field) => applied.has(field.id) || (values[field.id] ?? "") !== (field.value ?? ""));

  function focusField(field: AgreementField) {
    const element = document.getElementById(`field-${field.id}`);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.focus({ preventScroll: true });
  }

  function next() {
    const target = required.find((field) => !isFilled(field));
    if (target) {
      focusField(target);
      return;
    }
    const finish = document.getElementById("finish");
    finish?.scrollIntoView({ block: "start", behavior: "smooth" });
    finish?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
  }

  function onSign(field: AgreementField) {
    if (field.type === "STAMP") {
      if (stamp && !applied.has(field.id)) {
        setApplied((current) => new Set(current).add(field.id));
        return;
      }
      round.current += 1;
      setAdoptError(undefined);
      setStampErrors({});
      setStampAdopting({ field, round: round.current });
      return;
    }
    const adopted = field.type === "SIGNATURE" ? signature : initials;
    if (adopted && !applied.has(field.id)) {
      setApplied((current) => new Set(current).add(field.id));
      return;
    }
    round.current += 1;
    setAdoptError(undefined);
    setAdopting({ field, round: round.current });
  }

  async function adopt(value: AdoptedSignature, save: boolean) {
    if (!adopting) return;
    const field = adopting.field;
    const isInitials = field.type === "INITIALS";
    if (save) {
      setAdoptBusy(true);
      const keepOther = fromSaved(isInitials ? (saved?.signature ?? null) : (saved?.initials ?? null));
      const body = isInitials
        ? { initials: value, ...(keepOther ? { signature: keepOther } : {}) }
        : { signature: value, ...(keepOther ? { initials: keepOther } : {}) };
      const result = await putMySignature(body);
      setAdoptBusy(false);
      if (!result.ok) {
        setAdoptError(`${signingMessage(result.failure)} Untick "Save to my account" to use it only here.`);
        return;
      }
      setSaved(result.data);
    }
    if (isInitials) setInitials(value);
    else setSignature(value);
    setApplied((current) => new Set(current).add(field.id));
    setAdopting(null);
    requestAnimationFrame(() => document.getElementById(`field-${field.id}`)?.focus());
  }

  /** The stamp goes in every stamp field of this document; saving it keeps the saved signature and initials. */
  async function adoptStamp(value: Stamp, save: boolean) {
    if (!stampAdopting) return;
    const field = stampAdopting.field;
    if (save) {
      setAdoptBusy(true);
      const keepSignature = fromSaved(saved?.signature ?? null);
      const keepInitials = fromSaved(saved?.initials ?? null);
      const result = await putMySignature({ stamp: value, ...(keepSignature ? { signature: keepSignature } : {}), ...(keepInitials ? { initials: keepInitials } : {}) });
      setAdoptBusy(false);
      if (!result.ok) {
        const fields = stampFieldErrors(result.failure.fields);
        setStampErrors(fields);
        setAdoptError(Object.keys(fields).length > 0 ? undefined : `${signingMessage(result.failure)} Untick "Save to my account" to use it only here.`);
        return;
      }
      setSaved(result.data);
    }
    setStamp(value);
    setApplied((current) => {
      const next = new Set(current);
      for (const item of mine) if (item.type === "STAMP") next.add(item.id);
      return next;
    });
    setStampAdopting(null);
    requestAnimationFrame(() => document.getElementById(`field-${field.id}`)?.focus());
  }

  function build() {
    const fieldValues = mine
      .filter((field) => field.type === "TEXT" || field.type === "CHECKBOX")
      .map((field) => ({ field_id: field.id, value: field.type === "CHECKBOX" ? (values[field.id] === "true" ? "true" : "false") : (values[field.id] ?? "").trim() }))
      .filter((entry) => entry.value !== "");
    const hasInitials = mine.some((field) => field.type === "INITIALS");
    const hasStamp = mine.some((field) => field.type === "STAMP");
    return {
      field_values: fieldValues,
      ...(!approver && signature ? { signature } : {}),
      ...(!approver && hasInitials && initials ? { initials } : {}),
      ...(!approver && hasStamp && stamp ? { stamp } : {}),
    };
  }

  const stampView = { adopted: stamp !== null, url: stampPreview.url, loading: stampPreview.loading };

  const overlay = (page: RenderedPage) => {
    const onPage = [...others, ...mine].filter((field) => field.page === page.number);
    if (onPage.length === 0) return null;
    return onPage.map((field) => (
      <FieldBox
        key={field.id}
        field={field}
        page={page}
        mine={field.recipient_id === recipient.id}
        value={values[field.id] ?? ""}
        applied={applied.has(field.id)}
        signature={signature}
        initials={initials}
        stamp={stampView}
        name={recipient.name}
        missing={showMissing && field.recipient_id === recipient.id && isSelfFilled(field.type) && field.required && !isFilled(field)}
        onSign={onSign}
        onValue={(target, value) => setValues((current) => ({ ...current, [target.id]: value }))}
      />
    ));
  };

  const nextLabel = remaining === 0 ? (approver ? "Approve" : "Finish") : started ? "Next" : "Start";
  const progress = required.length === 0 ? "No fields to fill in" : `${done} of ${required.length} required fields`;

  return (
    <div className="pb-24 sm:pb-0">
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-lg sm:border-x">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-sans text-lg font-semibold tracking-normal">{agreement.name}</h1>
            <p className="truncate text-sm text-muted">
              From {agreement.sender_name}
              {agreement.organisation_name && `, ${agreement.organisation_name}`} · {agreement.reference}
            </p>
          </div>
          <p className="text-sm tabular-nums text-ink" role="status" aria-live="polite">
            {progress}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="max-sm:hidden"
              onClick={() => {
                setShowMissing(true);
                next();
              }}
            >
              {nextLabel}
            </Button>
            <DownloadButton token={token} name={agreement.name} reference={agreement.reference} variant="ghost" label="PDF" />
            <Button variant="ghost" className="text-danger" onClick={() => setDeclining(true)}>
              <X className="size-4" aria-hidden="true" />
              Decline
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Card>
          <p className="text-ink">
            <span className="font-medium">{recipient.name}</span>, {agreement.sender_name} asks you to{" "}
            {approver ? "approve" : "sign"} this document as <Badge tone="primary">{recipient.label ?? ROLE_LABELS[recipient.role] ?? recipient.role}</Badge>.
          </p>
          {agreement.message && (
            <blockquote className="mt-3 whitespace-pre-line border-l-4 border-line-accent pl-3 text-muted">{agreement.message}</blockquote>
          )}
          <p className="mt-3 text-sm text-muted">
            {approver
              ? "Read it, then approve it at the end. You do not sign it."
              : "Press Start to go to each field you need to fill in. Yellow boxes are yours. Your name and the date are filled in for you."}{" "}
            It can be signed until {formatWhen(agreement.expires_at)}.
          </p>
          {notice && <Alert tone="info" title={notice} className="mt-3" />}
        </Card>

        {bytes ? (
          <PdfPages data={bytes} label={agreement.name} renderOverlay={overlay} />
        ) : (
          <LoadingBlock label="Loading the document" rows={2} />
        )}

        <FinishPanel
          token={token}
          view={view}
          remaining={remaining}
          onJump={() => {
            setShowMissing(true);
            next();
          }}
          build={build}
          onSigned={onDone}
        />
      </div>

      {/* Phones: Next stays under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 sm:hidden">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            setShowMissing(true);
            next();
          }}
        >
          {nextLabel} · {progress}
        </Button>
      </div>

      {adopting && (
        <AdoptSignatureDialog
          key={adopting.round}
          open
          kind={adopting.field.type === "INITIALS" ? "initials" : "signature"}
          name={recipient.name}
          fonts={fonts}
          current={adopting.field.type === "INITIALS" ? initials : signature}
          canSave={signedIn}
          onAdopt={adopt}
          onCancel={() => setAdopting(null)}
          error={adoptError}
          busy={adoptBusy}
        />
      )}
      {stampAdopting && (
        <AdoptStampDialog
          key={stampAdopting.round}
          open
          name={recipient.name}
          current={stamp}
          canSave={signedIn}
          onAdopt={adoptStamp}
          onCancel={() => setStampAdopting(null)}
          error={adoptError}
          fieldErrors={stampErrors}
          busy={adoptBusy}
        />
      )}
      <DeclineDialog
        open={declining}
        token={token}
        onCancel={() => setDeclining(false)}
        onDeclined={(next) => {
          setDeclining(false);
          onDeclined(next);
        }}
      />
    </div>
  );
}

function Signing({ token }: { token: string }) {
  const load = useCallback(() => getSigning(token), [token]);
  const { state, reload, replace } = useApi(load);
  const [bytes, setBytes] = useState<{ token: string; data: ArrayBuffer; at: number } | null>(null);
  const [pdfRound, setPdfRound] = useState(0);
  const [justDone, setJustDone] = useState(false);
  const ready = state.status === "ready";

  // The PDF behind the link: the original while signing, the completed one at the end.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getSigningPdf(token).then((result) => {
      if (!cancelled && result.ok) setBytes({ token, data: result.data.bytes, at: pdfRound });
    });
    return () => {
      cancelled = true;
    };
  }, [token, ready, pdfRound]);

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the document" rows={3} />;
  if (state.status === "error") return <LinkProblem failure={state.failure} onRetry={reload} />;

  const view = state.status === "ready" ? state.data.signing : state.previous!.signing;
  const pdf = bytes?.token === token ? bytes.data : null;

  if (view.can_act && !view.read_only) {
    return (
      <Guided
        token={token}
        view={view}
        bytes={pdf}
        onDone={() => {
          setJustDone(true);
          reload();
          setPdfRound((value) => value + 1);
        }}
        onDeclined={(next) => {
          replace({ signing: next });
          setPdfRound((value) => value + 1);
        }}
      />
    );
  }
  return (
    <div role="status" aria-live="polite">
      <Finished token={token} view={view} bytes={pdf} justDone={justDone} />
    </div>
  );
}

/** `/sign/<token>`: the document behind a signing link, signed (or approved) the way Adobe Acrobat Sign does it. */
export function SigningPage({ token }: { token: string }) {
  if (!TOKEN.test(token)) {
    return (
      <Ending title="We could not find this document">
        Check that you opened the whole link from the email. If it still does not work, ask the sender for a new link.
      </Ending>
    );
  }
  return <Signing token={token} />;
}
