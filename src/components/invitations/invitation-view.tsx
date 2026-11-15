"use client";

import { CircleCheck, MailWarning, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { formatWhen, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ApiFailure } from "@/lib/api/http";
import { acceptInvitation, getInvitation, type AcceptedInvitation, type PublicInvitation } from "@/lib/api/team";
import { legal } from "@/lib/legal";

/** 43 URL-safe characters from the API; a little room either way, nothing else is sent to it. */
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

const linkClass = "font-medium text-primary-ink underline underline-offset-2";

/** A state that ends the page: expired, used, not found, and the like. */
function Ending({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <Card className="text-center">
      <MailWarning className="mx-auto size-8 text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-3xl">{title}</h1>
      {children && <div className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{children}</div>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {actions ?? (
          <ButtonLink href="/" variant="secondary">
            Go to the home page
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

/** The invitation could not be read, or can no longer be used. */
function LinkProblem({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  if (failure.code === "INVITATION_EXPIRED") {
    return (
      <Ending title="This invitation has expired">
        Invitations work for 7 days. Ask the person who invited you to send a new one.
      </Ending>
    );
  }
  if (failure.code === "INVITATION_NO_LONGER_VALID") {
    return (
      <Ending
        title="This invitation can no longer be used"
        actions={
          <ButtonLink href="/dashboard" variant="secondary">
            Go to your dashboard
          </ButtonLink>
        }
      >
        It was already accepted, cancelled, or replaced by a newer invitation. If you accepted it, the team is on your
        dashboard. Otherwise, ask for a new invitation and use the newest email.
      </Ending>
    );
  }
  if (failure.status === 404) {
    return (
      <Ending title="We could not find this invitation">
        Check that you opened the whole link from the email. If it still does not work, ask for a new invitation.
      </Ending>
    );
  }
  return (
    <Card>
      <Alert title={failure.message} traceId={failure.traceId} />
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

function Accepted({ accepted }: { accepted: AcceptedInvitation }) {
  return (
    <Card className="text-center" role="status">
      <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
      <h1 className="mt-4 text-3xl">Welcome to {accepted.organisation.name}</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
        You are now a member as {accepted.role_label}.
        {accepted.profile && " Your public agent profile is linked to the agency."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/dashboard">Go to your workspace</ButtonLink>
        {accepted.role !== "STAFF" && (
          <ButtonLink href="/agent/requests" variant="secondary">
            Open the request inbox
          </ButtonLink>
        )}
        {accepted.profile && (
          <ButtonLink href={`/directory/${accepted.profile.kind}/${accepted.profile.slug}`} variant="ghost">
            See your profile
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

/** What the signed-in person can do: accept, or what stands in the way. */
function AcceptPanel({ token, invitation, path }: { token: string; invitation: PublicInvitation; path: string }) {
  const { user, isAdmin, refresh, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [accepted, setAccepted] = useState<AcceptedInvitation | null>(null);
  const signInHere = `/sign-in?next=${encodeURIComponent(path)}`;

  async function switchAccount() {
    await signOut();
    router.push(signInHere);
  }

  async function accept() {
    setBusy(true);
    setFailure(null);
    const answer = await acceptInvitation(token);
    if (answer.ok) {
      // The session now has the new membership: the header and the workspace pages read it.
      await refresh();
      setBusy(false);
      setAccepted(answer.data);
      return;
    }
    setBusy(false);
    setFailure(answer.failure);
  }

  if (accepted) return <Accepted accepted={accepted} />;

  const code = failure?.code;
  if (code === "INVITATION_EXPIRED" || code === "INVITATION_NO_LONGER_VALID" || failure?.status === 404) {
    return <LinkProblem failure={failure!} onRetry={() => setFailure(null)} />;
  }
  if (code === "ALREADY_A_MEMBER") {
    return (
      <Ending
        title={`You are already in ${invitation.organisation.name}`}
        actions={<ButtonLink href="/dashboard">Go to your workspace</ButtonLink>}
      >
        There is nothing more to do: this account is already a member of the team.
      </Ending>
    );
  }
  if (code === "SEEKER_ACCOUNT_CANNOT_JOIN") {
    return (
      <Ending
        title="This account cannot join a team"
        actions={
          <ButtonLink href="/dashboard" variant="secondary">
            Go to your dashboard
          </ButtonLink>
        }
      >
        <p>
          {user?.email} is set up for finding property, and an account like that cannot hold a role in a team. Ask{" "}
          {invitation.invited_by_name} to invite a different address, or email{" "}
          <a href={`mailto:${legal.emails.support}`} className={linkClass}>
            {legal.emails.support}
          </a>{" "}
          for help.
        </p>
      </Ending>
    );
  }

  const mismatch = code === "INVITATION_EMAIL_MISMATCH";

  return (
    <div className="mt-6 border-t border-line pt-6">
      <p className="text-sm text-muted">
        Signed in as <span className="break-all font-medium text-ink">{user?.email}</span>
      </p>
      {isAdmin ? (
        <Alert tone="warning" title="You are signed in as an administrator" className="mt-4">
          <p>
            An administrator session cannot join a team. Sign out, then sign in with the account for{" "}
            <span className="font-medium">{invitation.email_masked}</span>.
          </p>
        </Alert>
      ) : mismatch ? (
        <Alert tone="warning" title="This invitation is for a different email address" className="mt-4">
          <p>
            It was sent to <span className="font-medium">{invitation.email_masked}</span>. Sign out, then sign in, or
            create an account, with that address.
          </p>
        </Alert>
      ) : (
        <>
          {failure && (
            <Alert
              title={failure.status === 401 ? "Your session has ended. Sign in again to accept." : failure.message}
              traceId={failure.status === 401 ? undefined : failure.traceId}
              className="mt-4"
            />
          )}
          <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => void accept()} disabled={busy} aria-busy={busy}>
            {busy ? "Accepting…" : "Accept invitation"}
          </Button>
        </>
      )}
      {(isAdmin || mismatch || failure?.status === 401) && (
        <Button variant="secondary" className="mt-4" onClick={() => void switchAccount()}>
          Sign out and use another account
        </Button>
      )}
    </div>
  );
}

function Invitation({ token }: { token: string }) {
  const load = useCallback(() => getInvitation(token), [token]);
  const { state, reload } = useApi(load);
  const { status } = useAuth();
  const path = `/invitations/${token}`;

  if (state.status === "loading") return <LoadingBlock label="Loading the invitation" rows={2} />;
  if (state.status === "error") return <LinkProblem failure={state.failure} onRetry={reload} />;

  const { invitation } = state.data;
  const next = encodeURIComponent(path);

  return (
    <Card>
      <UsersRound className="size-8 text-primary-ink" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-primary-ink">Invitation to join a team</p>
      <h1 className="mt-1 text-3xl">{invitation.organisation.name}</h1>
      <p className="mt-3 leading-relaxed text-ink">
        {invitation.invited_by_name} invited you to join as{" "}
        <span className="font-medium">{invitation.role_label}</span>
        {invitation.job_title && <> ({invitation.job_title})</>}.
      </p>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Sent to</dt>
        <dd className="break-all font-medium text-ink">{invitation.email_masked}</dd>
        <dt className="text-muted">Works until</dt>
        <dd className="font-medium text-ink">{formatWhen(invitation.expires_at)}</dd>
      </dl>

      {status === "loading" && <div aria-busy="true" className="mt-6 h-12 rounded-md bg-sunken" />}
      {status === "authenticated" && <AcceptPanel token={token} invitation={invitation} path={path} />}
      {status === "anonymous" && (
        <div className="mt-6 border-t border-line pt-6">
          <p className="text-muted">
            Sign in with the address the invitation was sent to. New to RightProperty365? Create an account with that
            address and choose a professional role; you come back here once your email is confirmed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href={`/sign-in?next=${next}`}>Sign in to accept</ButtonLink>
            <ButtonLink href={`/register?next=${next}`} variant="secondary">
              Create an account
            </ButtonLink>
          </div>
        </div>
      )}
    </Card>
  );
}

/** `/invitations/<token>`: what the invitation is for, then sign in, sign up or accept. */
export function InvitationView({ token }: { token: string }) {
  if (!TOKEN.test(token)) {
    return (
      <Ending title="We could not find this invitation">
        Check that you opened the whole link from the email. If it still does not work, ask for a new invitation.
      </Ending>
    );
  }
  return <Invitation token={token} />;
}
