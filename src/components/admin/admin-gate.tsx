"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import type { User } from "@/lib/api/auth";

/**
 * Shows its children only to an administrator session. Signed-out visitors are
 * sent to the administrator sign-in; any other session gets the "no access"
 * state. This chooses what to display; the API only accepts administrator
 * sessions for platform-role actions.
 */
export function AdminGate({ children }: { children: (user: User) => ReactNode }) {
  const { status, user, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Back to this page after signing in; the sign-in only follows /admin addresses.
    if (status === "anonymous") {
      router.replace(pathname === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
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
