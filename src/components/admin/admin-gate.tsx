"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import { ENROLMENT_REQUIRED_PATH } from "@/lib/admin-mfa";
import { hasPlatformRole, type PlatformRole, type User } from "@/lib/api/auth";

/**
 * Shows its children only to an administrator session. Signed-out visitors are
 * sent to the administrator sign-in; any other session gets the "no access"
 * state. A session that may only set up two-step verification is sent to
 * /admin/security, unless `enrolment` says this page is where it is set up.
 * This chooses what to display; the API only accepts administrator sessions
 * for platform-role actions.
 */
export function AdminGate({ children, enrolment = false }: { children: (user: User) => ReactNode; enrolment?: boolean }) {
  const { status, user, isAdmin, mfaEnrolmentRequired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Back to this page after signing in; the sign-in only follows /admin addresses.
    if (status === "anonymous") {
      router.replace(pathname === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  const mustEnrol = status === "authenticated" && isAdmin && mfaEnrolmentRequired && !enrolment;
  useEffect(() => {
    if (mustEnrol) router.replace(ENROLMENT_REQUIRED_PATH);
  }, [mustEnrol, router]);

  if (status !== "authenticated" || mustEnrol) {
    return (
      <div aria-busy="true" aria-label="Loading" className="space-y-4">
        <div className="h-10 max-w-xs rounded-md bg-sunken" />
        <div className="h-40 rounded-lg bg-sunken" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You do not have access to this page</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          This area is for Platform Administrators. You are signed in with an account that is
          not an administrator account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/dashboard" variant="secondary">
            Go to your dashboard
          </ButtonLink>
          <ButtonLink href="/sign-in" variant="ghost">
            Sign in to the main site
          </ButtonLink>
        </div>
      </div>
    );
  }

  return <>{children(user)}</>;
}

/** Plural titles for "It is for …". */
const roleGroupNames: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super Administrators",
  PLATFORM_ADMIN: "Platform Administrators",
  MARKET_ADMIN: "Market Administrators",
  FINANCE_ADMIN: "Finance Administrators",
  CONTENT_ADMIN: "Content Administrators",
  MODERATOR: "Moderators",
  SUPPORT: "Support",
};

/** "A, B and C". */
const listText = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** The "no access" state of an admin page for roles that do not work on it. */
export function RoleNoAccess({ roles, what }: { roles: readonly PlatformRole[]; what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">You do not have access to {what}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">It is for {listText(roles.map((role) => roleGroupNames[role] ?? role))}.</p>
      <ButtonLink href="/admin" variant="secondary" className="mt-6">
        Back to the overview
      </ButtonLink>
    </div>
  );
}

/** An admin page for some platform roles only. The API enforces the same rule. */
export function RoleGate({ roles, what, children }: { roles: readonly PlatformRole[]; what: string; children: (user: User) => ReactNode }) {
  return <AdminGate>{(user) => (hasPlatformRole(user, roles) ? children(user) : <RoleNoAccess roles={roles} what={what} />)}</AdminGate>;
}
