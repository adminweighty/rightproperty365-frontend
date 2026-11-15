"use client";

import { useRef, useState, type FormEvent } from "react";
import { countLabel, failureNotice, NoticeArea, type Notice } from "@/components/agent/team/shared";
import { EmptyState, formatWhen } from "@/components/portal/portal-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { changeTeamMember, removeTeamMember, type GivenRole, type TeamMember } from "@/lib/api/team";
import { JOB_TITLE_MAX, jobTitleProblem, STALE_CODES } from "@/lib/team-messages";

type Props = {
  organisationId: string;
  members: TeamMember[];
  titles: Record<GivenRole, string>;
  /** A member after a change. */
  onChanged: (member: TeamMember) => void;
  /** Read the list again (after a removal, or when it is out of date). */
  onReload: () => void;
};

type Pending = { kind: "suspend" | "remove"; member: TeamMember } | null;

const leadsText = (count: number) => countLabel(count, "open request", "open requests");

/** Role and job title of one member, for someone who may change them. */
function EditMember({
  organisationId,
  member,
  titles,
  onDone,
  onCancel,
  onStale,
}: {
  organisationId: string;
  member: TeamMember;
  titles: Record<GivenRole, string>;
  onDone: (member: TeamMember, notice: Notice) => void;
  onCancel: () => void;
  onStale: (notice: Notice) => void;
}) {
  const [errors, setErrors] = useState<{ role?: string; job_title?: string }>({});
  const [failure, setFailure] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const prefix = `member-${member.user_id}`;
  const roleOptions = member.allowed_roles.map((role) => ({ value: role, label: titles[role] }));
  const currentRole = member.role === "OWNER" ? "" : member.role;
  const roleHint =
    member.role === "AGENT" || member.role === "MANAGER"
      ? "Staff cannot hold requests: making them staff sends their open requests back to the team inbox."
      : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const role = String(data.get("role") ?? "") as GivenRole | "";
    const jobTitle = String(data.get("job_title") ?? "").trim();
    const next: { role?: string; job_title?: string } = {};
    if (role && !member.allowed_roles.includes(role)) next.role = "Choose one of the roles in the list.";
    next.job_title = jobTitleProblem(jobTitle);
    setFailure(null);
    if (next.role || next.job_title) {
      setErrors(next);
      document.getElementById(next.role ? `${prefix}-role` : `${prefix}-job-title`)?.focus();
      return;
    }
    const change: { role?: GivenRole; job_title?: string } = {};
    if (role && role !== member.role) change.role = role;
    if (jobTitle !== (member.job_title ?? "")) change.job_title = jobTitle;
    if (!change.role && change.job_title === undefined) {
      setErrors({});
      onCancel();
      return;
    }
    setErrors({});
    setBusy(true);
    const answer = await changeTeamMember(organisationId, member.user_id, change);
    setBusy(false);
    if (answer.ok) {
      onDone(answer.data.member, { tone: "success", text: `${answer.data.member.name}'s details were saved.` });
      return;
    }
    if (STALE_CODES.has(answer.failure.code)) {
      onStale(failureNotice(answer.failure, "warning"));
      return;
    }
    const fields = answer.failure.fields ?? {};
    if (fields.role || fields.job_title) {
      setErrors({ role: fields.role, job_title: fields.job_title });
      return;
    }
    setFailure(failureNotice(answer.failure));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-md border border-line bg-sunken p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {roleOptions.length > 0 && (
          <Field id={`${prefix}-role`} label="Role" error={errors.role} hint={roleHint}>
            <SearchableSelect
              id={`${prefix}-role`}
              name="role"
              options={roleOptions}
              defaultValue={currentRole}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={fieldDescribedBy(`${prefix}-role`, { error: errors.role, hint: roleHint })}
            />
          </Field>
        )}
        <Field id={`${prefix}-job-title`} label="Job title" optional error={errors.job_title}>
          <Input
            id={`${prefix}-job-title`}
            name="job_title"
            maxLength={JOB_TITLE_MAX}
            defaultValue={member.job_title ?? ""}
            placeholder="For example Sales Negotiator"
            aria-invalid={Boolean(errors.job_title)}
            aria-describedby={fieldDescribedBy(`${prefix}-job-title`, { error: errors.job_title })}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <NoticeArea notice={failure} />
    </form>
  );
}

/** The organisation's members, with what the caller may do to each. */
export function Members({ organisationId, members, titles, onChanged, onReload }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const result = useRef<HTMLDivElement>(null);

  function show(next: Notice) {
    setNotice(next);
    // After the dialog has closed and returned focus, the result takes it.
    requestAnimationFrame(() => result.current?.focus());
  }

  async function setStatus(member: TeamMember, status: "ACTIVE" | "SUSPENDED") {
    setBusy(member.user_id);
    setDialogError(undefined);
    const answer = await changeTeamMember(organisationId, member.user_id, { status });
    setBusy(null);
    if (answer.ok) {
      setPending(null);
      onChanged(answer.data.member);
      show({
        tone: "success",
        text:
          status === "SUSPENDED"
            ? `${member.name} is suspended. Their open requests are back in the team inbox.`
            : `${member.name} is active again.`,
      });
      return;
    }
    if (STALE_CODES.has(answer.failure.code) || status === "ACTIVE") {
      setPending(null);
      show(failureNotice(answer.failure, STALE_CODES.has(answer.failure.code) ? "warning" : "danger"));
      if (STALE_CODES.has(answer.failure.code)) onReload();
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  async function remove(member: TeamMember) {
    setBusy(member.user_id);
    setDialogError(undefined);
    const answer = await removeTeamMember(organisationId, member.user_id);
    setBusy(null);
    if (answer.ok) {
      setPending(null);
      show({ tone: "success", text: `${member.name} was removed from the team. Their open requests are back in the team inbox.` });
      onReload();
      return;
    }
    if (STALE_CODES.has(answer.failure.code)) {
      setPending(null);
      show(failureNotice(answer.failure, "warning"));
      onReload();
      return;
    }
    setDialogError(failureNotice(answer.failure).text);
  }

  const dialogMember = pending?.member;
  const leads = dialogMember?.open_leads ?? 0;

  return (
    <section aria-labelledby="team-members">
      <h2 id="team-members" className="text-2xl">
        Members
      </h2>
      <p role="status" className="mt-1 text-sm text-muted">
        {countLabel(members.length, "member", "members")}
      </p>
      <NoticeArea ref={result} notice={notice} />

      <div className="mt-4">
        {members.length === 0 ? (
          <EmptyState title="No members listed">Invite someone below to start your team.</EmptyState>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {members.map((member) => (
                <li key={member.user_id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {member.name}
                        {member.is_you && <Badge tone="primary" className="ml-2">You</Badge>}
                      </p>
                      <p className="text-sm text-muted">
                        {member.role_label}
                        {member.job_title && <> · {member.job_title}</>}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {member.role === "STAFF" ? "Staff do not hold requests" : leadsText(member.open_leads)}
                        {member.joined_at && <> · joined {formatWhen(member.joined_at)}</>}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <Badge tone="accent">{member.market_code}</Badge>
                      <Badge tone={member.status === "ACTIVE" ? "success" : "warning"}>{member.status_label}</Badge>
                    </span>
                  </div>

                  {member.can_change && editing !== member.user_id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(member.user_id)}>
                        Change role or job title<span className="sr-only"> of {member.name}</span>
                      </Button>
                      {member.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDialogError(undefined);
                            setPending({ kind: "suspend", member });
                          }}
                        >
                          Suspend<span className="sr-only"> {member.name}</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === member.user_id}
                          aria-busy={busy === member.user_id}
                          onClick={() => void setStatus(member, "ACTIVE")}
                        >
                          {busy === member.user_id ? "Reactivating…" : "Reactivate"}
                          <span className="sr-only"> {member.name}</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => {
                          setDialogError(undefined);
                          setPending({ kind: "remove", member });
                        }}
                      >
                        Remove<span className="sr-only"> {member.name}</span>
                      </Button>
                    </div>
                  )}

                  {member.can_change && editing === member.user_id && (
                    <EditMember
                      organisationId={organisationId}
                      member={member}
                      titles={titles}
                      onCancel={() => setEditing(null)}
                      onDone={(changed, next) => {
                        setEditing(null);
                        onChanged(changed);
                        show(next);
                      }}
                      onStale={(next) => {
                        setEditing(null);
                        show(next);
                        onReload();
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "remove" ? `Remove ${dialogMember?.name} from the team?` : `Suspend ${dialogMember?.name}?`
        }
        confirmLabel={pending?.kind === "remove" ? "Yes, remove them" : "Yes, suspend them"}
        busyLabel={pending?.kind === "remove" ? "Removing…" : "Suspending…"}
        busy={busy !== null && busy === dialogMember?.user_id}
        error={dialogError}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === "remove") void remove(pending.member);
          else void setStatus(pending.member, "SUSPENDED");
        }}
      >
        {pending?.kind === "remove" ? (
          <p>
            They lose access to the organisation at once.{" "}
            {leads > 0 ? `Their ${leadsText(leads)} go back to the team inbox` : "Any open requests they hold go back to the team inbox"}
            , and so do their open appointments. You can invite them again later.
          </p>
        ) : (
          <p>
            They cannot use the organisation&apos;s workspace until you reactivate them.{" "}
            {leads > 0 ? `Their ${leadsText(leads)} go back to the team inbox` : "Any open requests they hold go back to the team inbox"}
            , and so do their open appointments.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
