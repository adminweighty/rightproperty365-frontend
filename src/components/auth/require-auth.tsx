"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";
import type { User } from "@/lib/api/auth";

type Props = {
  /** Return false to show the "no access" state. The API still enforces access. */
  allow?: (user: User) => boolean;
  children: (user: User) => ReactNode;
};

/**
 * The "no access" state of the screens for people who list or manage
 * property. Also shown when the API itself answers 403 for such a screen.
 */
export function NoAccess() {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
      <h1 className="text-2xl">You do not have access to this page</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        It is for members of a Real Estate Agency or another verified business, Landlords and
        Property Sellers (Vendors). If you work for an agency, ask the Agency Principal to add
        you.
      </p>
      <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
        Back to your dashboard
      </ButtonLink>
    </div>
  );
}

/**
 * Shows its children only to a signed-in user. This decides what to display;
 * it is not a security boundary. Every API call is authorised on the server.
 */
export function RequireAuth({ allow, children }: Props) {
  const { status, user } = useAuth();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading" className="space-y-4">
        <div className="h-10 max-w-xs rounded-md bg-sunken" />
        <div className="h-40 rounded-lg bg-sunken" />
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">Sign in to continue</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">This page is for signed-in users.</p>
        <ButtonLink href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="mt-6">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  if (allow && !allow(user)) return <NoAccess />;

  return <>{children(user)}</>;
}
