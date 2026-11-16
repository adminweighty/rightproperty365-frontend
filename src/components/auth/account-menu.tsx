"use client";

import { ChevronDown, CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { NavItem } from "@/components/layout/nav-items";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import {
  canManageTeam,
  canUseInbox,
  hasOnboardingToDo,
  hasPlatformRole,
  LEASE_TEMPLATE_ROLES,
  SIGNING_OVERSIGHT_ROLES,
} from "@/lib/api/auth";

const itemClass =
  "flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm text-ink hover:bg-sunken focus-visible:bg-sunken";

/**
 * Header control: when anonymous, "Sign in" (quiet) and, from `sm`, the
 * primary "Sign up", with the link for professionals beside them from `xl`;
 * otherwise the account menu. On phones "Sign up" is in the menu panel.
 */
export function AccountMenu({ professionals }: { professionals?: NavItem }) {
  const { status, user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Reserve the space while the session loads so the header does not shift.
  if (status === "loading") return <div className="h-11 w-11 sm:w-40" aria-hidden="true" />;

  if (status === "anonymous") {
    return (
      <>
        {professionals && (
          <Link
            href={professionals.href}
            className="hidden rounded-md px-3 py-2 text-sm font-semibold text-primary-ink decoration-line-accent decoration-2 underline-offset-8 hover:underline xl:block"
          >
            {professionals.label}
          </Link>
        )}
        <ButtonLink href="/sign-in" variant="ghost">
          Sign in
        </ButtonLink>
        {/* Hidden on phones, where the bar has no room; the menu panel has it. */}
        <ButtonLink href="/register" className="max-sm:hidden">
          Sign up
        </ButtonLink>
      </>
    );
  }

  const firstName = user.name.split(" ")[0] || "Account";

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
        className={buttonClasses("secondary", "md")}
      >
        <CircleUserRound className="size-5 text-primary-ink" aria-hidden="true" />
        {/* The name is hidden on phones so the header never overflows. */}
        <span className="sr-only">Account menu for </span>
        <span className="max-w-24 truncate max-sm:sr-only">{firstName}</span>
        <ChevronDown className="size-4 max-sm:hidden" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-line bg-surface p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <ul>
            <li>
              <Link href={isAdmin ? "/admin" : "/dashboard"} className={itemClass} onClick={() => setOpen(false)}>
                Dashboard
              </Link>
            </li>
            {isAdmin ? (
              <>
                <li>
                  <Link href="/admin/verifications" className={itemClass} onClick={() => setOpen(false)}>
                    Verifications
                  </Link>
                </li>
                <li>
                  <Link href="/admin/listings" className={itemClass} onClick={() => setOpen(false)}>
                    Listing reviews
                  </Link>
                </li>
                {hasPlatformRole(user, LEASE_TEMPLATE_ROLES) && (
                  <li>
                    <Link href="/admin/lease-templates" className={itemClass} onClick={() => setOpen(false)}>
                      Lease templates
                    </Link>
                  </li>
                )}
                {hasPlatformRole(user, SIGNING_OVERSIGHT_ROLES) && (
                  <>
                    <li>
                      <Link href="/admin/leases" className={itemClass} onClick={() => setOpen(false)}>
                        All leases
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/agreements" className={itemClass} onClick={() => setOpen(false)}>
                        All agreements
                      </Link>
                    </li>
                  </>
                )}
              </>
            ) : (
              <li>
                <Link href="/account" className={itemClass} onClick={() => setOpen(false)}>
                  Your account
                </Link>
              </li>
            )}
            {!isAdmin && hasOnboardingToDo(user) && (
              <li>
                <Link href="/onboarding" className={itemClass} onClick={() => setOpen(false)}>
                  Complete your profile
                </Link>
              </li>
            )}
            {!isAdmin && (
              <>
                <li>
                  <Link href="/account/requests" className={itemClass} onClick={() => setOpen(false)}>
                    Your requests
                  </Link>
                </li>
                <li>
                  <Link href="/account/appointments" className={itemClass} onClick={() => setOpen(false)}>
                    Your appointments
                  </Link>
                </li>
                <li>
                  <Link href="/account/signing" className={itemClass} onClick={() => setOpen(false)}>
                    Documents to sign
                  </Link>
                </li>
              </>
            )}
            {!isAdmin && canUseInbox(user) && (
              <>
                <li>
                  <Link href="/agent/requests" className={itemClass} onClick={() => setOpen(false)}>
                    Request inbox
                  </Link>
                </li>
                <li>
                  <Link href="/agent/appointments" className={itemClass} onClick={() => setOpen(false)}>
                    Appointments received
                  </Link>
                </li>
                <li>
                  <Link href="/agent/listings" className={itemClass} onClick={() => setOpen(false)}>
                    Your listings
                  </Link>
                </li>
                <li>
                  <Link href="/agent/leases" className={itemClass} onClick={() => setOpen(false)}>
                    Leases
                  </Link>
                </li>
                <li>
                  <Link href="/agent/lease-templates" className={itemClass} onClick={() => setOpen(false)}>
                    Lease templates
                  </Link>
                </li>
                <li>
                  <Link href="/agent/agreements" className={itemClass} onClick={() => setOpen(false)}>
                    Agreements
                  </Link>
                </li>
                {canManageTeam(user) && (
                  <li>
                    <Link href="/agent/team" className={itemClass} onClick={() => setOpen(false)}>
                      Your team
                    </Link>
                  </li>
                )}
              </>
            )}
            <li className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                className={itemClass}
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  router.push(isAdmin ? "/admin/sign-in" : "/");
                }}
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
