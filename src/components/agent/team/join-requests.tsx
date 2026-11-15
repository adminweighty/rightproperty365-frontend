"use client";

import { useRef, useState, type FormEvent } from "react";
import { countLabel, failureNotice, NoticeArea, type Notice } from "@/components/agent/team/shared";
import { EmptyState, formatWhen } from "@/components/portal/portal-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { approveJoinRequest, declineJoinRequest, type JoinRequest } from "@/lib/api/team";
import { DECLINE_MAX, declineReasonProblem, STALE_CODES } from "@/lib/team-messages";

function DeclineForm({
  organisationId,
  request,
  onDone,
  onCancel,
}: {
  organisationId: string;
  request: JoinRequest;
  onDone: (notice: Notice) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [length, setLength] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = `decline-${request.id}`;
  const hint = `They are emailed this reason. ${length} of ${DECLINE_MAX} characters.`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    const problem = declineReasonProblem(reason);
    setFailure(null);
    setError(problem);
    if (problem) {
      textarea.current?.focus();
      return;
    }
    setBusy(true);
    const answer = await declineJoinRequest(organisationId, request.id, reason);
    setBusy(false);
    if (answer.ok) {
      onDone({ tone: "success", text: `You declined ${request.applicant.name}'s request to join. They have been emailed your reason.` });
      return;
    }
    if (STALE_CODES.has(answer.failure.code)) {
      onDone(failureNotice(answer.failure, "warning"));
      return;
    }
    if (answer.failure.fields?.reason) {
      setError(answer.failure.fields.reason);
      textarea.current?.focus();
      return;
    }
    setFailure(failureNotice(answer.failure));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-md border border-line bg-sunken p-4">
      <Field id={id} label={`Why are you declining ${request.applicant.name}?`} hint={hint} error={error}>
        <Textarea
          ref={textarea}
          id={id}
          name="reason"
          rows={3}
          maxLength={DECLINE_MAX}
          onChange={(event) => {
            setLength(event.currentTarget.value.length);
            if (error) setError(undefined);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy(id, { hint, error })}
        />
      </Field>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="submit" variant="danger" disabled={busy} aria-busy={busy}>
          {busy ? "Declining…" : "Decline the request"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <NoticeArea notice={failure} />
    </form>
  );
}

/** "Asking to join": applications that name this agency, with approve and decline. */
export function JoinRequests({
  organisationId,
  requests,
  onDecided,
}: {
  organisationId: string;
  requests: JoinRequest[];
  /** Read the requests (and the members, after an approval) again. */
  onDecided: (approved: boolean) => void;
}) {
  const [declining, setDeclining] = useState<string | null>(null);
  const [approving, setApproving] = useState<JoinRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const result = useRef<HTMLDivElement>(null);

  function show(next: Notice) {
    setNotice(next);
    requestAnimationFrame(() => result.current?.focus());
  }

  async function approve(request: JoinRequest) {
    setBusy(true);
    setDialogError(undefined);
    const answer = await approveJoinRequest(organisationId, request.id);
    setBusy(false);
    if (answer.ok || STALE_CODES.has(answer.failure.code)) {
      setApproving(null);
      show(
        answer.ok
          ? {
              tone: "success",
              text: `${request.applicant.name} joined the team as ${answer.data.join_request.membership_role_label}. They have been emailed.`,
            }
          : failureNotice(answer.failure, "warning"),
      );
      onDecided(answer.ok);
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  return (
    <section aria-labelledby="team-join-requests">
      <h2 id="team-join-requests" className="text-2xl">
        Asking to join
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        People who applied for a role at your agency. Whoever decides first, you or our verification team, decides it.
      </p>
      <NoticeArea ref={result} notice={notice} />
      <div className="mt-4">
        {requests.length === 0 ? (
          <EmptyState title="Nobody is asking to join">
            When someone applies for a role and names your agency, their request appears here.
          </EmptyState>
        ) : (
          <Card padded={false}>
            <p role="status" className="sr-only">
              {countLabel(requests.length, "request to join", "requests to join")}
            </p>
            <ul className="divide-y divide-line">
              {requests.map((request) => (
                <li key={request.id} className="px-5 py-4">
                  <p className="font-medium text-ink">{request.applicant.name}</p>
                  <p className="text-sm text-muted">
                    <span className="break-all">{request.applicant.email_masked}</span> · applied as {request.role_label}
                    {request.job_title && <> ({request.job_title})</>}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Would join as {request.membership_role_label}
                    {request.submitted_at && <> · sent {formatWhen(request.submitted_at)}</>} ·{" "}
                    {countLabel(request.document_count, "document", "documents")} for our verification team
                  </p>
                  {!request.can_decide ? (
                    <p className="mt-2 text-sm text-muted">Only the Agency Principal can decide this one.</p>
                  ) : declining === request.id ? (
                    <DeclineForm
                      organisationId={organisationId}
                      request={request}
                      onCancel={() => setDeclining(null)}
                      onDone={(next) => {
                        setDeclining(null);
                        show(next);
                        onDecided(false);
                      }}
                    />
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setDialogError(undefined);
                          setApproving(request);
                        }}
                      >
                        Approve<span className="sr-only"> {request.applicant.name}</span>
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeclining(request.id)}>
                        Decline<span className="sr-only"> {request.applicant.name}</span>
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={approving !== null}
        title={`Approve ${approving?.applicant.name}?`}
        confirmLabel="Yes, approve"
        busyLabel="Approving…"
        tone="primary"
        busy={busy}
        error={dialogError}
        onCancel={() => setApproving(null)}
        onConfirm={() => approving && void approve(approving)}
      >
        <p>
          They join the team as {approving?.membership_role_label} straight away
          {approving?.membership_role === "AGENT" ? ", with a public agent profile linked to your agency" : ""}, and we
          email them.
        </p>
      </ConfirmDialog>
    </section>
  );
}
