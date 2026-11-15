"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { authLinkClass } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/portal";

function WithNext({ href, children }: { href: string; children: ReactNode }) {
  const next = safeNextPath(useSearchParams().get("next"));
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className={authLinkClass}>
      {children}
    </Link>
  );
}

/**
 * "Sign in" on the sign-up page and "Create an account" on the sign-in page.
 * Keeps the page's `?next=` (only a path on this site), so someone who came
 * from an invitation returns to it whichever way they go.
 */
export function AuthSwitchLink({ href, children }: { href: "/sign-in" | "/register"; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={authLinkClass}>
          {children}
        </Link>
      }
    >
      <WithNext href={href}>{children}</WithNext>
    </Suspense>
  );
}
