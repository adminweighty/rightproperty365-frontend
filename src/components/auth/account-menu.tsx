"use client";

import { ChevronDown, CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { NavItem } from "@/components/layout/nav-items";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { canUseInbox, hasOnboardingToDo } from "@/lib/api/auth";

const itemClass =
  "flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm text-ink hover:bg-sunken focus-visible:bg-sunken";

/**
 * Header control: "Sign in" when anonymous (with the link for professionals
 * beside it from `lg`), otherwise the account menu.
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
  if (status === "loading") return <div className="h-11 w-11 sm:w-20" aria-hidden="true" />;

  if (status === "anonymous") {
    return (
      <>
        {professionals && (
          <Link
            href={professionals.href}
            className="hidden rounded-md px-3 py-2 text-sm font-semibold text-primary-ink decoration-line-accent decoration-2 underline-offset-8 hover:underline lg:block"
          >
            {professionals.label}
          </Link>
        )}
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
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
              {isAdmin ? (
                <Link href="/admin" className={itemClass} onClick={() => setOpen(false)}>
                  Administration
                </Link>
              ) : (
                <Link href="/account" className={itemClass} onClick={() => setOpen(false)}>
                  Your account
                </Link>
              )}
            </li>
            {!isAdmin && hasOnboardingToDo(user) && (
              <li>
                <Link href="/onboarding" className={itemClass} onClick={() => setOpen(false)}>
                  Complete your profile
                </Link>
              </li>
            )}
            {!isAdmin && canUseInbox(user) && (
              <li>
                <Link href="/agent/requests" className={itemClass} onClick={() => setOpen(false)}>
                  Request inbox
                </Link>
              </li>
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
