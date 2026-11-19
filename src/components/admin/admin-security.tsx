"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { MfaQr } from "@/components/admin/mfa-qr";
import { RecoveryCodesPanel } from "@/components/admin/recovery-codes-panel";
import { useAuth } from "@/components/auth/auth-provider";
import { BackLink, formatWhen, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { formatSecret, normaliseCode, totpCodeProblem } from "@/lib/admin-mfa";
import {
  confirmTotp,
  getMfaStatus,
  regenerateRecoveryCodes,
  removeTotp,
  setupTotp,
  type MfaStatus,
  type TotpSetup,
} from "@/lib/api/admin-mfa";
import type { User } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";

/** What the page shows below the status. */
type View =
  | { kind: "status" }
  | { kind: "setup"; setup: TotpSetup }
  | { kind: "codes"; codes: string[]; fresh: "enrolled" | "regenerated" };

type Notice = { tone: "success" | "warning" | "danger"; title: string; traceId?: string };

/** The message for a failure of the management endpoints. */
function failureMessage(failure: ApiFailure): string {
  switch (failure.code) {
    case "MFA_UNAVAILABLE":
      return "Two-step sign-in is not available on the server right now. Please contact the platform team.";
    case "MFA_SETUP_REQUIRED":
      return "The setup expired after 15 minutes. Start again to get a new QR code.";
    case "MFA_ALREADY_ENROLLED":
      return "An authenticator app is already set up for your account.";
    case "MFA_NOT_ENROLLED":
      return "No authenticator app is set up for your account.";
    case "MFA_REMOVAL_NOT_ALLOWED":
      return "Two-step sign-in is required for administrators, so it cannot be removed. Ask a Super Administrator to reset it if you have lost your phone.";
    default:
      return failure.message;
  }
}

/** A 6-digit code field with its own label, hint and error. */
function CodeField({
  id,
  label,
  error,
  hint = "The 6-digit code your authenticator app shows now.",
  inputRef,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className="text-left">
      <Input
        ref={inputRef}
        id={id}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        maxLength={12}
        className="max-w-48 font-mono text-lg tracking-widest"
        aria-invalid={Boolean(error)}
        aria-required="true"
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      />
    </Field>
  );
}

function StatusCard({ status }: { status: MfaStatus }) {
  return (
    <section aria-labelledby="mfa-status">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mfa-status" className="text-2xl">
            Status
          </h2>
          <Badge tone={status.enrolled ? "success" : "warning"}>{status.enrolled ? "Set up" : "Not set up"}</Badge>
        </div>
        <dl className="mt-4 divide-y divide-line">
          <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">Authenticator app</dt>
            <dd className="text-ink">
              {status.enrolled
                ? status.created_at
                  ? `Set up on ${formatWhen(status.created_at)}`
                  : "Set up"
                : status.pending_setup
                  ? "Setup started, not confirmed"
                  : "Not set up"}
            </dd>
          </div>
          {status.enrolled && (
            <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-sm text-muted">Recovery codes left</dt>
              <dd className={status.recovery_codes_remaining <= 3 ? "font-medium text-warning" : "text-ink"}>
                {status.recovery_codes_remaining} of 10
                {status.recovery_codes_remaining <= 3 && " · make new codes soon"}
              </dd>
            </div>
          )}
          <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-sm text-muted">Required for administrators</dt>
            <dd className="text-ink">{status.required ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}

function SetupPanel({
  setup,
  onConfirmed,
  onRestart,
}: {
  setup: TotpSetup;
  onConfirmed: (codes: string[], status: MfaStatus) => void;
  onRestart: (message: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const raw = String(new FormData(event.currentTarget).get("code") ?? "");
    setFailure(null);
    const problem = totpCodeProblem(raw);
    if (problem) {
      setError(problem);
      input.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await confirmTotp(normaliseCode(raw));
    setPending(false);
    if (result.ok) {
      onConfirmed(result.data.recovery_codes, result.data.mfa);
      return;
    }
    if (result.failure.code === "MFA_SETUP_REQUIRED") {
      onRestart(failureMessage(result.failure));
      return;
    }
    if (result.failure.fields?.code) {
      setError(result.failure.fields.code);
      input.current?.select();
      input.current?.focus();
      return;
    }
    setFailure(result.failure);
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(setup.secret_base32);
      setCopied("The key is copied.");
    } catch {
      setCopied("We could not copy the key. Select it and copy it yourself.");
    }
  }

  const until = formatWhen(setup.expires_at);

  return (
    <section aria-labelledby="mfa-setup">
      <Card>
        <h2 id="mfa-setup" ref={heading} tabIndex={-1} className="text-2xl outline-none">
          Set up your authenticator app
        </h2>
        <p className="mt-1 text-sm text-muted">Finish by {until}, or start again.</p>

        <ol className="mt-4 space-y-6">
          <li>
            <h3 className="font-sans text-lg font-semibold tracking-normal">1. Add RightProperty365 to the app</h3>
            <p className="mt-1 leading-relaxed text-muted">
              In an authenticator app on your phone (such as Google Authenticator, Microsoft Authenticator or 1Password), add an
              account and scan this code.
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <MfaQr uri={setup.otpauth_uri} svg={setup.qr_svg} describedBy="mfa-secret-label" />
              <div className="min-w-0">
                <p id="mfa-secret-label" className="text-sm font-medium text-ink">
                  Cannot scan it? Enter this key instead
                </p>
                <p className="mt-1 break-all font-mono text-lg tracking-wider text-ink" aria-describedby="mfa-secret-label">
                  {formatSecret(setup.secret_base32)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Account {setup.account_name} · issuer {setup.issuer} · time-based, {setup.digits} digits, every {setup.period}{" "}
                  seconds. Spaces do not matter.
                </p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => void copySecret()}>
                  Copy the key
                </Button>
                <p role="status" aria-live="polite" className="mt-1 text-sm text-muted empty:hidden">
                  {copied}
                </p>
              </div>
            </div>
          </li>
          <li>
            <h3 className="font-sans text-lg font-semibold tracking-normal">2. Enter the code it shows</h3>
            <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
              <CodeField id="mfa-confirm-code" label="6-digit code" error={error} inputRef={input} />
              {failure && <Alert title={failureMessage(failure)} traceId={failure.traceId} />}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={pending} aria-busy={pending}>
                  {pending ? "Checking…" : "Turn on two-step sign-in"}
                </Button>
              </div>
            </form>
          </li>
        </ol>
      </Card>
    </section>
  );
}

type Dialog = "regenerate" | "remove" | null;

function Security({ me }: { me: User }) {
  const router = useRouter();
  const required = useSearchParams().get("required") === "1";
  const { mfaEnrolmentRequired, refresh } = useAuth();
  const { state, reload, replace } = useApi(getMfaStatus);
  const [view, setView] = useState<View>({ kind: "status" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [starting, setStarting] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [dialogBusy, setDialogBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();
  const noticeRef = useRef<HTMLDivElement>(null);

  const show = useCallback((next: Notice) => {
    setNotice(next);
    requestAnimationFrame(() => noticeRef.current?.focus());
  }, []);

  if (state.status === "loading" && view.kind === "status") return <LoadingBlock label="Loading your two-step sign-in" rows={2} />;
  if (state.status === "error") {
    return (
      <div>
        <h1 className="text-3xl md:text-4xl">Two-step sign-in</h1>
        <Alert title={failureMessage(state.failure)} traceId={state.failure.traceId} className="mt-6" />
        <Button variant="secondary" className="mt-4" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  const status = state.status === "ready" ? state.data : null;
  const restricted = required || mfaEnrolmentRequired;

  async function start() {
    setStarting(true);
    setNotice(null);
    const result = await setupTotp();
    setStarting(false);
    if (result.ok) {
      setView({ kind: "setup", setup: result.data });
      return;
    }
    if (result.failure.code === "MFA_ALREADY_ENROLLED") reload();
    show({ tone: "danger", title: failureMessage(result.failure), traceId: result.failure.traceId });
  }

  function openDialog(next: Dialog) {
    setDialog(next);
    setDialogError(undefined);
    setCodeError(undefined);
  }

  async function confirmDialog() {
    const field = document.getElementById("mfa-dialog-code") as HTMLInputElement | null;
    const raw = field?.value ?? "";
    const problem = totpCodeProblem(raw);
    setDialogError(undefined);
    if (problem) {
      setCodeError(problem);
      field?.focus();
      return;
    }
    setCodeError(undefined);
    setDialogBusy(true);
    const code = normaliseCode(raw);
    if (dialog === "regenerate") {
      const result = await regenerateRecoveryCodes(code);
      setDialogBusy(false);
      if (result.ok) {
        setDialog(null);
        replace(result.data.mfa);
        setNotice(null);
        setView({ kind: "codes", codes: result.data.recovery_codes, fresh: "regenerated" });
        return;
      }
      if (result.failure.fields?.code) {
        setCodeError(result.failure.fields.code);
        field?.select();
        field?.focus();
        return;
      }
      setDialogError(failureMessage(result.failure));
      return;
    }
    const result = await removeTotp(code);
    setDialogBusy(false);
    if (result.ok) {
      setDialog(null);
      show({ tone: "success", title: "Two-step sign-in is turned off. Your recovery codes no longer work." });
      reload();
      return;
    }
    if (result.failure.fields?.code) {
      setCodeError(result.failure.fields.code);
      field?.select();
      field?.focus();
      return;
    }
    setDialogError(failureMessage(result.failure));
  }

  if (view.kind === "codes") {
    return (
      <>
        <h1 className="text-3xl md:text-4xl">Two-step sign-in</h1>
        {view.fresh === "enrolled" && (
          <Alert tone="success" title="Two-step sign-in is on." className="mt-6">
            <p>From now on you enter a code from your authenticator app each time you sign in.</p>
          </Alert>
        )}
        <div className="mt-6">
          <RecoveryCodesPanel
            codes={view.codes}
            account={me.email}
            title={view.fresh === "enrolled" ? "Save your recovery codes" : "Save your new recovery codes"}
            doneLabel={restricted && view.fresh === "enrolled" ? "Continue to the admin area" : "Done"}
            onDone={() => {
              setView({ kind: "status" });
              if (restricted && view.fresh === "enrolled") {
                router.push("/admin");
                return;
              }
              show({
                tone: "success",
                title: view.fresh === "enrolled" ? "Two-step sign-in is on." : "Your new recovery codes are ready. The old ones no longer work.",
              });
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {!restricted && <BackLink href="/admin">Overview</BackLink>}
      <h1 className="mt-2 text-3xl md:text-4xl">Two-step sign-in</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        After your password and the emailed code, you also enter a code from an authenticator app on your phone. Someone who
        learns your password still cannot sign in as you.
      </p>

      {restricted && !status?.enrolled && (
        <Alert tone="warning" title="Set up two-step sign-in to continue" className="mt-6">
          <p>
            Administrators must use an authenticator app. Until you set one up, this is the only admin page you can use. It takes
            about two minutes.
          </p>
        </Alert>
      )}

      <div ref={noticeRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {notice && <Alert tone={notice.tone} title={notice.title} traceId={notice.traceId} className="mt-6" />}
      </div>

      <div className="mt-8 space-y-6">
        {status && <StatusCard status={status} />}

        {view.kind === "setup" ? (
          <SetupPanel
            setup={view.setup}
            onConfirmed={(codes, next) => {
              replace(next);
              setView({ kind: "codes", codes, fresh: "enrolled" });
              // The same session is now a full administrator session.
              void refresh();
            }}
            onRestart={(message) => {
              setView({ kind: "status" });
              show({ tone: "warning", title: message });
              reload();
            }}
          />
        ) : status && !status.enrolled ? (
          <section aria-labelledby="mfa-start">
            <Card>
              <h2 id="mfa-start" className="text-2xl">
                Set up an authenticator app
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                You need your phone with an authenticator app installed. You will scan a QR code, enter a code to check it works,
                and save 10 recovery codes.
              </p>
              <Button className="mt-4" onClick={() => void start()} disabled={starting} aria-busy={starting}>
                {starting ? "Starting…" : status.pending_setup ? "Start the setup again" : "Set up an authenticator app"}
              </Button>
            </Card>
          </section>
        ) : status ? (
          <section aria-labelledby="mfa-manage">
            <Card>
              <h2 id="mfa-manage" className="text-2xl">
                Manage
              </h2>
              <div className="mt-4 space-y-6">
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-normal">Recovery codes</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Make 10 new codes if you have used most of yours or think someone else has seen them. The old codes stop
                    working.
                  </p>
                  <Button variant="secondary" className="mt-3" onClick={() => openDialog("regenerate")}>
                    Make new recovery codes
                  </Button>
                </div>
                <div className="border-t border-line pt-6">
                  <h3 className="font-sans text-lg font-semibold tracking-normal">Turn off two-step sign-in</h3>
                  {status.required ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      Two-step sign-in is required for administrators, so you cannot turn it off. If you change phones, ask a
                      Super Administrator to reset it, then set it up again.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        Removes the authenticator app and every recovery code. You can set it up again at any time.
                      </p>
                      <Button variant="danger" className="mt-3" onClick={() => openDialog("remove")}>
                        Turn off two-step sign-in
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === "remove" ? "Turn off two-step sign-in?" : "Make new recovery codes?"}
        confirmLabel={dialog === "remove" ? "Turn it off" : "Make new codes"}
        busyLabel={dialog === "remove" ? "Turning off…" : "Making codes…"}
        tone={dialog === "remove" ? "danger" : "primary"}
        busy={dialogBusy}
        error={dialogError}
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmDialog()}
      >
        <p>
          {dialog === "remove"
            ? "Your authenticator app and recovery codes stop working, and you sign in with your password and the emailed code only."
            : "Your current recovery codes stop working, and the new ones are shown once."}
        </p>
        <div className="mt-4">
          {dialog && <CodeField key={dialog} id="mfa-dialog-code" label="Code from your authenticator app" error={codeError} />}
        </div>
      </ConfirmDialog>
    </>
  );
}

/** `/admin/security`: the signed-in administrator's own two-step sign-in. Open to an enrolment-only session. */
export function AdminSecurity() {
  return <AdminGate enrolment>{(me) => <Security me={me} />}</AdminGate>;
}
