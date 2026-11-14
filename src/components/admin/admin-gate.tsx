"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import type { User } from "@/lib/api/auth";

/**
 * Shows its children only to an administrator session. Signed-out visitors are
 * sent to the administrator sign-in; a customer session gets the "no access"
 * state. This chooses what to display; the API only accepts administrator
 * sessions for platform-role actions.
 */
export function AdminGate({ children }: { children: (user: User) => ReactNode }) {
  const { status, user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/sign-in");
  }, [status, router]);

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
          This area is for RightProperty365 administrators. Your account is signed in as a
          customer account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/account" variant="secondary">
            Go to your account
          </ButtonLink>
          <ButtonLink href="/sign-in" variant="ghost">
            Customer sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return <>{children(user)}</>;
}
