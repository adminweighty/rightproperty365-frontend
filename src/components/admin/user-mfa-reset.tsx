"use client";

import { useCallback, useRef, useState } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { adminGetUserMfa, adminResetUserMfa } from "@/lib/api/admin-mfa";

const REASON_MIN = 3;
const REASON_MAX = 1000;

type Props = { userId: string; name: string };

/**
 * A Super Administrator's view of another administrator's two-step sign-in,
 * with "Reset MFA" for someone who lost their phone and recovery codes. Shown
 * only to a SUPER_ADMIN, for an administrator account that is not their own;
 * the API enforces the same rule.
 */
export function UserMfaReset({ userId, name }: Props) {
  const load = useCallback(() => adminGetUserMfa(userId), [userId]);
  const { state, reload, replace } = useApi(load);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; title: string } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  function show(next: { tone: "success" | "warning"; title: string }) {
    setNotice(next);
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  async function confirm() {
    const length = Array.from(reason.trim()).length;
    const problem =
      length === 0
        ? "Write the reason for the reset."
        : length < REASON_MIN
          ? `Use at least ${REASON_MIN} characters.`
          : length > REASON_MAX
            ? `Use ${REASON_MAX} characters or fewer.`
            : undefined;
    setReasonError(problem);
    setDialogError(undefined);
    if (problem) {
      document.getElementById("mfa-reset-reason")?.focus();
      return;
    }
    setBusy(true);
    const result = await adminResetUserMfa(userId, reason.trim());
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      replace(result.data);
      show({
        tone: "success",
        title: `Two-step sign-in was reset. Every session of ${name} has ended and they have been emailed. They set it up again at their next sign-in.`,
      });
      return;
    }
    if (result.failure.code === "MFA_NOT_ENROLLED") {
      setOpen(false);
      show({ tone: "warning", title: "There was nothing to reset: no authenticator app is set up for this account." });
      reload();
      return;
    }
    if (result.failure.fields?.reason) {
      setReasonError(result.failure.fields.reason);
      document.getElementById("mfa-reset-reason")?.focus();
      return;
    }
    setDialogError(result.failure.message);
  }

  return (
    <section aria-labelledby="user-mfa">
      <Card>
        <h2 id="user-mfa" className="text-2xl">
          Two-step sign-in
        </h2>
        <div ref={noticeRef} tabIndex={-1} aria-live="polite" className="outline-none">
          {notice && <Alert tone={notice.tone} title={notice.title} className="mt-4" />}
        </div>
        <div className="mt-4">
          {state.status === "loading" ? (
            <div aria-busy="true" aria-label="Loading two-step sign-in" className="h-16 rounded-md bg-sunken" />
          ) : state.status === "error" ? (
            <div>
              <Alert title={state.failure.message} traceId={state.failure.traceId} />
              <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <Badge tone={state.data.enrolled ? "success" : "warning"}>
                  {state.data.enrolled ? "Authenticator app set up" : "Not set up"}
                </Badge>
                {state.data.enrolled && (
                  <span className="text-sm text-muted">
                    {state.data.created_at && `Since ${formatWhen(state.data.created_at)} · `}
                    {state.data.recovery_codes_remaining} recovery codes left
                  </span>
                )}
              </p>
              {state.data.enrolled ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    Reset it only after checking who is asking, for example by a call to a number you already know. Their
                    authenticator app and recovery codes stop working, every session of theirs ends, and they are emailed.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-4"
                    onClick={() => {
                      setOpen(true);
                      setReason("");
                      setReasonError(undefined);
                      setDialogError(undefined);
                    }}
                  >
                    Reset MFA
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">There is nothing to reset.</p>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={open}
        title={`Reset two-step sign-in for ${name}?`}
        confirmLabel="Reset MFA"
        busyLabel="Resetting…"
        busy={busy}
        error={dialogError}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      >
        <p>
          Their authenticator app and recovery codes stop working and every session of theirs ends now. At their next sign-in
          they set up an authenticator app again. This cannot be undone.
        </p>
        <Field
          id="mfa-reset-reason"
          label="Reason"
          hint="How you checked who asked. Kept in the audit log."
          error={reasonError}
          className="mt-4 text-left"
        >
          <Textarea
            id="mfa-reset-reason"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError(undefined);
            }}
            aria-invalid={Boolean(reasonError)}
            aria-required="true"
            aria-describedby={fieldDescribedBy("mfa-reset-reason", { hint: "x", error: reasonError })}
          />
        </Field>
      </ConfirmDialog>
    </section>
  );
}
