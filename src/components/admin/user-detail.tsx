"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { AuditEntry } from "@/components/admin/audit-log";
import { UserMfaReset } from "@/components/admin/user-mfa-reset";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import {
  ACCOUNT_STATUS,
  adminDeleteUser,
  adminGetUser,
  adminReactivateUser,
  adminSuspendUser,
} from "@/lib/api/admin-users";
import {
  hasPlatformRole,
  platformRoleLabels,
  PACKAGE_ROLES,
  SUBSCRIPTION_READ_ROLES,
  titleFromCode,
  USER_MANAGE_ROLES,
  USER_READ_ROLES,
  type AccountDeleted,
  type OnboardingStatus,
  type PlatformRole,
  type User,
} from "@/lib/api/auth";
import { onboardingStatusLabels, onboardingStatusTones } from "@/lib/api/onboarding";
import { actionMessage, formatAmount, formatDay, periodLabel, subscriptionStatus } from "@/lib/subscriptions";
import { currentMarketZone } from "@/lib/display-zone";

type Props = {
  userId: string;
  /** code -> label of the API's `account_roles` reference set. */
  roleLabels: Record<string, string>;
  /** code -> label of the API's `organisation_kinds` reference set. */
  organisationKindLabels: Record<string, string>;
};

type Action = "suspend" | "reactivate" | "delete";
type Notice = { tone: "success" | "danger" | "warning"; title: string; detail?: ReactNode; traceId?: string };

const REASON_MIN = 3;
const REASON_MAX = 1000;

function reasonProblem(reason: string, what: string): string | undefined {
  const length = Array.from(reason.trim()).length;
  if (length === 0) return `Write the reason for ${what}.`;
  if (length < REASON_MIN) return `Use at least ${REASON_MIN} characters.`;
  if (length > REASON_MAX) return `Use ${REASON_MAX} characters or fewer.`;
  return undefined;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function deletedSummary(result: AccountDeleted) {
  return [
    plural(result.sessions_revoked, "session ended", "sessions ended"),
    plural(result.organisations_left, "organisation left", "organisations left"),
    plural(result.listings_withdrawn, "listing withdrawn", "listings withdrawn"),
    plural(result.listings_unassigned, "listing unassigned", "listings unassigned"),
    plural(result.subscriptions_cancelled, "subscription cancelled", "subscriptions cancelled"),
  ].join(" · ");
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Section({ id, title, children, action }: { id: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={id} className="text-2xl">
            {title}
          </h2>
          {action}
        </div>
        <div className="mt-4">{children}</div>
      </Card>
    </section>
  );
}

const dialogWords: Record<Action, { title: string; confirm: string; busy: string }> = {
  suspend: { title: "Suspend this account?", confirm: "Suspend the account", busy: "Suspending…" },
  reactivate: { title: "Reactivate this account?", confirm: "Reactivate the account", busy: "Reactivating…" },
  delete: { title: "Delete this account?", confirm: "Delete the account", busy: "Deleting…" },
};

function Detail({ me, userId, roleLabels, organisationKindLabels }: Props & { me: User }) {
  const load = useCallback(() => adminGetUser(userId), [userId]);
  const { state, reload, replace } = useApi(load);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; note?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  if (state.status === "loading") return <LoadingBlock label="Loading the account" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that account</h1>
          <ButtonLink href="/admin/users" variant="secondary" className="mt-6">
            Back to accounts
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const { user: account, subscriptions, audit } = state.data;
  const status = ACCOUNT_STATUS[account.status] ?? { label: titleFromCode(account.status), tone: "neutral" as const };
  const roleName = (code: string) => platformRoleLabels[code as PlatformRole] ?? roleLabels[code] ?? titleFromCode(code);
  const canManage = hasPlatformRole(me, USER_MANAGE_ROLES);
  const isSelf = me.id === account.id;
  const protectedAdmin = account.platform_roles.length > 0 && !hasPlatformRole(me, ["SUPER_ADMIN"]);
  const blocked = isSelf
    ? "You cannot suspend, reactivate or delete your own account."
    : protectedAdmin
      ? "This account holds an administrator role. Only a Super Administrator can suspend, reactivate or delete it."
      : null;
  const showSubscriptionLinks = hasPlatformRole(me, SUBSCRIPTION_READ_ROLES);
  const listingCounts = Object.entries(account.listing_counts).filter(([, count]) => count > 0);

  function show(next: Notice) {
    setNotice(next);
    // After the dialog has closed and returned focus, the result takes it.
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  function open(next: Action) {
    setAction(next);
    setReason("");
    setNote("");
    setConfirmEmail("");
    setErrors({});
    setDialogError(undefined);
  }

  async function confirm() {
    if (!action) return;
    const next: typeof errors = {};
    if (action !== "reactivate") next.reason = reasonProblem(reason, action === "suspend" ? "the suspension" : "the deletion");
    if (action === "reactivate" && Array.from(note.trim()).length > REASON_MAX) next.note = `Use ${REASON_MAX} characters or fewer.`;
    if (action === "delete" && confirmEmail.trim().toLowerCase() !== account.email.toLowerCase()) {
      next.email = "Type the account's email address exactly as shown.";
    }
    setErrors(next);
    setDialogError(undefined);
    if (next.email || next.reason || next.note) {
      document.getElementById(next.email ? "delete-email" : next.reason ? "action-reason" : "action-note")?.focus();
      return;
    }

    setBusy(true);
    const text = reason.trim();
    if (action === "delete") {
      const result = await adminDeleteUser(account.id, text);
      setBusy(false);
      if (result.ok) {
        setAction(null);
        show({ tone: "success", title: "The account was deleted and anonymised.", detail: deletedSummary(result.data) });
        reload();
        return;
      }
      if (result.failure.code === "SOLE_OWNER") {
        setAction(null);
        show({
          tone: "danger",
          title: "This account cannot be deleted yet",
          detail: (
            <>
              <p>{result.failure.message}</p>
              <p className="mt-1">
                Make another member an owner of each organisation, or remove its other members, then try again. Nothing was
                changed.
              </p>
            </>
          ),
        });
        return;
      }
      handleFailure(result.failure);
      return;
    }

    const result = action === "suspend" ? await adminSuspendUser(account.id, text) : await adminReactivateUser(account.id, note.trim());
    setBusy(false);
    if (result.ok) {
      setAction(null);
      replace(result.data);
      show({
        tone: "success",
        title:
          action === "suspend"
            ? "The account is suspended. Its sessions have ended and the person has been emailed the reason."
            : "The account is active again. The person can sign in and has been emailed.",
      });
      return;
    }
    handleFailure(result.failure);
  }

  function handleFailure(failure: { code: string; message: string; status: number; fields?: Record<string, string>; traceId?: string }) {
    if (failure.code === "USER_STATE_CONFLICT" || failure.code === "USER_NOT_FOUND") {
      setAction(null);
      show({ tone: "warning", title: actionMessage(failure) });
      reload();
      return;
    }
    if (failure.fields?.reason || failure.fields?.note) {
      setErrors({ reason: failure.fields.reason && `Reason ${failure.fields.reason}.`, note: failure.fields.note && `Note ${failure.fields.note}.` });
      return;
    }
    setDialogError(actionMessage(failure));
  }

  const words = action ? dialogWords[action] : null;

  return (
    <>
      <BackLink href="/admin/users">Accounts</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {account.status !== "DELETED" && (
          <Badge tone={account.email_verified ? "success" : "warning"}>
            {account.email_verified ? "Email confirmed" : "Email not confirmed"}
          </Badge>
        )}
        {isSelf && <Badge tone="info">Your account</Badge>}
      </div>
      <h1 className="mt-2 break-words text-3xl md:text-4xl">{account.name}</h1>
      <p className="mt-1 break-all text-muted">{account.email}</p>

      <div ref={noticeRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {notice && (
          <Alert tone={notice.tone} title={notice.title} traceId={notice.traceId} className="mt-6">
            {notice.detail}
          </Alert>
        )}
      </div>

      <div className="mt-8 space-y-6">
        <Section id="user-details" title="Details">
          <dl className="divide-y divide-line">
            <Row label="Joined">{formatWhen(account.created_at)}</Row>
            <Row label="Last signed in">{account.last_sign_in_at ? formatWhen(account.last_sign_in_at) : "Never"}</Row>
            {account.suspended_at && <Row label="Suspended">{formatWhen(account.suspended_at)}</Row>}
            {account.suspension_reason && (
              <Row label="Reason for suspension">
                <span className="whitespace-pre-line">{account.suspension_reason}</span>
              </Row>
            )}
            {account.deleted_at && <Row label="Deleted">{formatWhen(account.deleted_at)}</Row>}
          </dl>
        </Section>

        {canManage && account.status !== "DELETED" && (
          <Section id="user-actions" title="Actions">
            {blocked ? (
              <p className="text-muted">{blocked}</p>
            ) : (
              <>
                <p className="text-sm text-muted">The person is emailed after each of these. Every action is kept in the audit log.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {account.status === "ACTIVE" && (
                    <Button variant="secondary" onClick={() => open("suspend")}>
                      Suspend the account
                    </Button>
                  )}
                  {account.status === "SUSPENDED" && <Button onClick={() => open("reactivate")}>Reactivate the account</Button>}
                  <Button variant="danger" onClick={() => open("delete")}>
                    Delete the account
                  </Button>
                </div>
              </>
            )}
          </Section>
        )}

        {/* Super Administrators reset another administrator's two-step sign-in (API 0.40.0). */}
        {hasPlatformRole(me, ["SUPER_ADMIN"]) && !isSelf && account.platform_roles.length > 0 && account.status !== "DELETED" && (
          <UserMfaReset userId={account.id} name={account.name} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Section id="user-roles" title="Roles">
            <h3 className="text-sm font-medium tracking-normal text-muted">Account roles</h3>
            {account.account_roles.length === 0 ? (
              <p className="mt-2 text-muted">No roles chosen.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {account.account_roles.map((item) => {
                  const onboarding = item.onboarding_status as OnboardingStatus | null;
                  return (
                    <li key={item.role} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ink">{roleName(item.role)}</span>
                      <span className="flex flex-wrap gap-2">
                        <Badge tone={item.status === "ACTIVE" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}>
                          {titleFromCode(item.status)}
                        </Badge>
                        {onboarding && (
                          <Badge tone={onboardingStatusTones[onboarding] ?? "neutral"}>
                            Application: {onboardingStatusLabels[onboarding] ?? titleFromCode(onboarding)}
                          </Badge>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {account.platform_roles.length > 0 && (
              <>
                <h3 className="mt-6 border-t border-line pt-4 text-sm font-medium tracking-normal text-muted">Administrator roles</h3>
                <ul className="mt-2 space-y-2">
                  {account.platform_roles.map((item) => (
                    <li key={`${item.role}-${item.market_code ?? "all"}`} className="flex items-center justify-between gap-2">
                      <span className="text-ink">{roleName(item.role)}</span>
                      <Badge tone="accent">{item.market_code ?? "All markets"}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section id="user-listings" title="Listings">
            <p className="text-ink">
              <span className="text-3xl font-bold tabular-nums">{account.listings_total}</span>{" "}
              <span className="text-muted">owned directly or assigned as agent</span>
            </p>
            {listingCounts.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {listingCounts.map(([key, count]) => (
                  <li key={key} className="rounded-md border border-line p-3">
                    <span className="block text-sm text-muted">{titleFromCode(key)}</span>
                    <span className="text-xl font-bold tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section id="user-organisations" title="Organisations">
          {account.memberships.length === 0 ? (
            <p className="text-muted">Not a member of any organisation.</p>
          ) : (
            <ul className="divide-y divide-line">
              {account.memberships.map((membership) => (
                <li key={`${membership.organisation_id}-${membership.role}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{membership.organisation_name}</span>
                    <span className="block text-sm text-muted">
                      {organisationKindLabels[membership.organisation_kind] ?? titleFromCode(membership.organisation_kind)} ·{" "}
                      {membership.market_code}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone="primary">{membership.role_label || titleFromCode(membership.role)}</Badge>
                    <Badge tone={membership.status === "ACTIVE" ? "success" : "neutral"}>{titleFromCode(membership.status)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {hasPlatformRole(me, PACKAGE_ROLES) && (
          <Section id="user-packages" title="Listing packages">
            <p className="text-sm text-muted">
              A package limits how many listings an account has live at once in a country. Open an account to see its usage, its
              history and to assign a package.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {account.account_roles.some(({ role }) => role === "PRIVATE_SELLER" || role === "LANDLORD") && (
                <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="font-medium text-ink">Their own listings (direct owner)</span>
                  <ButtonLink href={`/admin/packages/users/${account.id}`} size="sm" variant="secondary">
                    Package<span className="sr-only"> of {account.name}&apos;s own listings</span>
                  </ButtonLink>
                </li>
              )}
              {[...new Map(account.memberships.map((membership) => [membership.organisation_id, membership])).values()].map((membership) => (
                <li key={membership.organisation_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{membership.organisation_name}</span>
                    <span className="block text-sm text-muted">{membership.market_code}</span>
                  </span>
                  <ButtonLink href={`/admin/packages/organisations/${membership.organisation_id}`} size="sm" variant="secondary">
                    Package<span className="sr-only"> of {membership.organisation_name}</span>
                  </ButtonLink>
                </li>
              ))}
            </ul>
            {account.memberships.length === 0 && !account.account_roles.some(({ role }) => role === "PRIVATE_SELLER" || role === "LANDLORD") && (
              <p className="mt-2 text-muted">This account does not list property, so no package applies to it.</p>
            )}
          </Section>
        )}

        <Section id="user-subscriptions" title="Subscriptions">
          {subscriptions.length === 0 ? (
            <p className="text-muted">No subscriptions for this person or the organisations they own.</p>
          ) : (
            <ul className="divide-y divide-line">
              {subscriptions.map((sub) => {
                const shown = subscriptionStatus(sub);
                return (
                  <li key={sub.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">
                        {showSubscriptionLinks ? (
                          <Link href={`/admin/subscriptions/${sub.id}`} className="inline-flex min-h-11 items-center text-primary-ink hover:underline">
                            {sub.plan_name} · {sub.invoice_number}
                          </Link>
                        ) : (
                          <>
                            {sub.plan_name} · {sub.invoice_number}
                          </>
                        )}
                      </span>
                      <span className="block text-sm text-muted">
                        {sub.subscriber_kind === "ORGANISATION" ? (sub.organisation_name ?? sub.subscriber_name) : "For themselves"} ·{" "}
                        {periodLabel(sub.period)} · {formatAmount(sub.amount, sub.currency_code)}
                        {sub.starts_at && sub.ends_at && ` · ${formatDay(sub.starts_at, currentMarketZone())} to ${formatDay(sub.ends_at, currentMarketZone())}`}
                      </span>
                    </span>
                    <Badge tone={shown.tone}>{shown.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          id="user-audit"
          title="Recent administrator actions"
          action={
            <Link
              href={`/admin/audit?target_type=USER&target_id=${account.id}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary-ink hover:underline"
            >
              Open in the audit log
            </Link>
          }
        >
          {audit.length === 0 ? (
            <p className="text-muted">No administrator has acted on this account.</p>
          ) : (
            <ol className="divide-y divide-line">
              {audit.map((event) => (
                <li key={event.id} className="py-3">
                  <AuditEntry event={event} />
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={words?.title ?? ""}
        confirmLabel={words?.confirm ?? ""}
        busyLabel={words?.busy}
        tone={action === "reactivate" ? "primary" : "danger"}
        busy={busy}
        error={dialogError}
        onCancel={() => setAction(null)}
        onConfirm={() => void confirm()}
      >
        {action === "suspend" && (
          <p>
            Every session of {account.name} ends at once and they cannot sign in. Nothing is unpublished: listings they own
            directly leave public search while the account is suspended, and come back when it is reactivated. Listings of an
            organisation stay public. The reason is emailed to them.
          </p>
        )}
        {action === "reactivate" && <p>{account.name} can sign in again, and their own published listings are public again.</p>}
        {action === "delete" && (
          <>
            <p>This cannot be undone. The account is anonymised and can never sign in again:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>the name and email address are replaced, and the phone number and password are removed;</li>
              <li>every session ends;</li>
              <li>they leave every organisation, and their open requests and appointments go back to it;</li>
              <li>listings they own directly are withdrawn, and they stop being the agent of others;</li>
              <li>their agent profile is hidden and their saved signature is deleted;</li>
              <li>their own subscriptions are cancelled, with no refund recorded.</li>
            </ul>
            <p className="mt-2 text-sm">
              Kept as they are: audit records, signed agreements, leases, and the requests and enquiries they sent. A last
              email goes to the address the account had.
            </p>
          </>
        )}
        {action === "delete" && (
          <Field
            id="delete-email"
            label={`Type ${account.email} to confirm`}
            error={errors.email}
            className="mt-4 text-left"
          >
            <Input
              id="delete-email"
              value={confirmEmail}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setConfirmEmail(event.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              aria-invalid={Boolean(errors.email)}
              aria-required="true"
              aria-describedby={fieldDescribedBy("delete-email", { error: errors.email })}
            />
          </Field>
        )}
        {(action === "suspend" || action === "delete") && (
          <Field
            id="action-reason"
            label="Reason"
            hint={action === "suspend" ? "Emailed to the person and kept in the audit log." : "Kept in the audit log."}
            error={errors.reason}
            className="mt-4 text-left"
          >
            <Textarea
              id="action-reason"
              rows={4}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (errors.reason) setErrors({ ...errors, reason: undefined });
              }}
              aria-invalid={Boolean(errors.reason)}
              aria-required="true"
              aria-describedby={fieldDescribedBy("action-reason", {
                hint: "x",
                error: errors.reason,
              })}
            />
          </Field>
        )}
        {action === "reactivate" && (
          <Field id="action-note" label="Note" optional hint="Kept in the audit log." error={errors.note} className="mt-4 text-left">
            <Textarea
              id="action-note"
              rows={3}
              maxLength={REASON_MAX}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (errors.note) setErrors({ ...errors, note: undefined });
              }}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={fieldDescribedBy("action-note", { hint: "x", error: errors.note })}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/admin/users/<id>` (read: SUPER_ADMIN, PLATFORM_ADMIN, SUPPORT; actions: SUPER_ADMIN, PLATFORM_ADMIN). */
export function UserDetail(props: Props) {
  return (
    <RoleGate roles={USER_READ_ROLES} what="the accounts">
      {(me) => <Detail me={me} {...props} />}
    </RoleGate>
  );
}
