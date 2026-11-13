"use client";

import { ChevronDown, CircleUserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { isProfessional } from "@/lib/api/auth";

const itemClass =
  "block w-full rounded-sm px-3 py-2.5 text-left text-sm text-ink hover:bg-sunken focus-visible:bg-sunken";

/** Header control: "Sign in" when anonymous, otherwise a small account menu. */
export function AccountMenu() {
  const { status, user, signOut } = useAuth();
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
  if (status === "loading") return <div className="h-9 w-20" aria-hidden="true" />;

  if (status === "anonymous") {
    return (
      <ButtonLink href="/sign-in" size="sm">
        Sign in
      </ButtonLink>
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
        className={buttonClasses("secondary", "sm")}
      >
        <CircleUserRound className="size-4" aria-hidden="true" />
        <span className="max-w-24 truncate">{firstName}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-line bg-surface p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <ul>
            <li>
              <Link href="/account" className={itemClass} onClick={() => setOpen(false)}>
                Your account
              </Link>
            </li>
            {isProfessional(user) && (
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
                  router.push("/");
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
