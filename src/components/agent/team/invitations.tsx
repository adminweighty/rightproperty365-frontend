"use client";

import { useRef, useState, type FormEvent } from "react";
import { countLabel, failureNotice, NoticeArea, type Notice } from "@/components/agent/team/shared";
import { useFieldErrors } from "@/components/auth/use-field-errors";
import { EmptyState, formatWhen } from "@/components/portal/portal-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cancelTeamInvitation, inviteTeamMember, type GivenRole, type TeamInvitation } from "@/lib/api/team";
import { EMAIL_MAX, emailProblem, hasProblems, type Problems } from "@/lib/auth-validation";
import { JOB_TITLE_MAX, jobTitleProblem, STALE_CODES } from "@/lib/team-messages";

const FIELDS = { email: "#invite-email", role: "#invite-role", job_title: "#invite-job-title" };

/** "Invite someone": email, role and an optional job title. */
export function InviteForm({
  organisationId,
  roles,
  titles,
  onInvited,
}: {
  organisationId: string;
  /** The roles the caller may invite with. */
  roles: GivenRole[];
  titles: Record<GivenRole, string>;
  onInvited: () => void;
}) {
  const { form, errors, show, onChange } = useFieldErrors(FIELDS);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // A new key empties the role picker after a successful invitation.
  const [round, setRound] = useState(0);
  const result = useRef<HTMLDivElement>(null);
  const roleOptions = roles.map((role) => ({ value: role, label: titles[role] }));
  const roleHint = roles.includes("MANAGER")
    ? "Administrators can manage the team. Agents hold requests. Staff help but hold no requests."
    : "Agents hold requests. Staff help but hold no requests.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const data = new FormData(target);
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "") as GivenRole | "";
    const jobTitle = String(data.get("job_title") ?? "").trim();

    const problems: Problems = {
      email: email ? emailProblem(email) : "Enter the email address of the person you are inviting.",
      role: !role ? "Choose their role." : roles.includes(role) ? undefined : "Choose one of the roles in the list.",
      job_title: jobTitleProblem(jobTitle),
    };
    setNotice(null);
    show(problems);
    if (hasProblems(problems) || !role) return;

    setBusy(true);
    const answer = await inviteTeamMember(organisationId, {
      email,
      role,
      ...(jobTitle ? { job_title: jobTitle } : {}),
    });
    setBusy(false);

    if (answer.ok) {
      target.reset();
      setRound((value) => value + 1);
      setNotice({
        tone: "success",
        text: `Invitation sent to ${answer.data.invitation.email} as ${answer.data.invitation.role_label}. The link works for 7 days.`,
      });
      onInvited();
      result.current?.focus();
      return;
    }
    const fields = answer.failure.fields ?? {};
    if (fields.email || fields.role || fields.job_title) {
      show({ email: fields.email, role: fields.role, job_title: fields.job_title });
      return;
    }
    if (answer.failure.code === "ALREADY_A_MEMBER") {
      show({ email: "That person is already in the team." });
      return;
    }
    setNotice(failureNotice(answer.failure));
    result.current?.focus();
  }

  return (
    <section aria-labelledby="team-invite">
      <h2 id="team-invite" className="text-2xl">
        Invite someone
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        We email them a link to join. They sign in, or create an account, with the same email address. Inviting an
        address again replaces its earlier link.
      </p>
      <Card className="mt-4">
        <form ref={form} onSubmit={handleSubmit} onChange={onChange} noValidate>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="invite-email" label="Email address" error={errors.email}>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="off"
                maxLength={EMAIL_MAX}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={fieldDescribedBy("invite-email", { error: errors.email })}
              />
            </Field>
            <Field id="invite-role" label="Role" error={errors.role}>
              <SearchableSelect
                key={round}
                id="invite-role"
                name="role"
                options={[{ value: "", label: "Choose a role…" }, ...roleOptions]}
                defaultValue=""
                aria-invalid={Boolean(errors.role)}
                aria-describedby={fieldDescribedBy("invite-role", { error: errors.role })}
              />
            </Field>
            <Field id="invite-job-title" label="Job title" optional error={errors.job_title}>
              <Input
                id="invite-job-title"
                name="job_title"
                maxLength={JOB_TITLE_MAX}
                placeholder="For example Lettings Negotiator"
                aria-invalid={Boolean(errors.job_title)}
                aria-describedby={fieldDescribedBy("invite-job-title", { error: errors.job_title })}
              />
            </Field>
          </div>
          <p className="mt-3 text-sm text-muted">{roleHint}</p>
          <Button type="submit" className="mt-4" disabled={busy} aria-busy={busy}>
            {busy ? "Sending…" : "Send the invitation"}
          </Button>
          <NoticeArea ref={result} notice={notice} />
        </form>
      </Card>
    </section>
  );
}

/** The pending invitations, with "Expired" on the old ones and cancel where allowed. */
export function Invitations({
  organisationId,
  invitations,
  onReload,
}: {
  organisationId: string;
  invitations: TeamInvitation[];
  onReload: () => void;
}) {
  const [pending, setPending] = useState<TeamInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const result = useRef<HTMLDivElement>(null);

  async function cancel(invitation: TeamInvitation) {
    setBusy(true);
    setDialogError(undefined);
    const answer = await cancelTeamInvitation(organisationId, invitation.id);
    setBusy(false);
    if (answer.ok || STALE_CODES.has(answer.failure.code)) {
      setPending(null);
      setNotice(
        answer.ok
          ? { tone: "success", text: `The invitation to ${invitation.email} was cancelled. Its link no longer works.` }
          : failureNotice(answer.failure, "warning"),
      );
      onReload();
      requestAnimationFrame(() => result.current?.focus());
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  return (
    <section aria-labelledby="team-invitations">
      <h2 id="team-invitations" className="text-2xl">
        Pending invitations
      </h2>
      <NoticeArea ref={result} notice={notice} />
      <div className="mt-4">
        {invitations.length === 0 ? (
          <EmptyState title="No invitations waiting">When you invite someone, the invitation waits here until they accept it.</EmptyState>
        ) : (
          <Card padded={false}>
            <p role="status" className="sr-only">
              {countLabel(invitations.length, "invitation", "invitations")}
            </p>
            <ul className="divide-y divide-line">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-medium text-ink">
                      {invitation.email}
                      {invitation.expired && (
                        <Badge tone="warning" className="ml-2">
                          Expired
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {invitation.role_label}
                      {invitation.job_title && <> · {invitation.job_title}</>}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Sent by {invitation.invited_by.name}, {formatWhen(invitation.created_at)} ·{" "}
                      {invitation.expired
                        ? "invite them again to send a new link"
                        : `link works until ${formatWhen(invitation.expires_at)}`}
                    </p>
                  </div>
                  {invitation.can_cancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        setDialogError(undefined);
                        setPending(invitation);
                      }}
                    >
                      Cancel invitation<span className="sr-only"> to {invitation.email}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Cancel this invitation?"
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
        busyLabel="Cancelling…"
        busy={busy}
        error={dialogError}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void cancel(pending)}
      >
        <p>
          The link sent to <span className="font-medium text-ink">{pending?.email}</span> stops working at once. You can
          invite them again later.
        </p>
      </ConfirmDialog>
    </section>
  );
}
