"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { NavItem } from "@/components/layout/nav-items";
import { ButtonLink } from "@/components/ui/button";

type Props = {
  items: NavItem[];
  /** Links shown under the main list, e.g. the route for professionals. */
  secondary?: NavItem[];
};

const linkClass =
  "flex min-h-12 items-center rounded-md px-3 text-base font-semibold text-ink hover:bg-sunken hover:text-primary-ink";

/**
 * The navigation below `lg`: a menu button that opens a panel under the
 * header. It is a native `<details>`, so it opens and closes without
 * JavaScript. With JavaScript, focus moves to the first link when it opens,
 * Escape closes it and returns focus to the button, and it closes when a link
 * is followed, on a click outside, and when focus leaves it.
 *
 * For a signed-out visitor it ends with "Sign in" and "Sign up", because the
 * bar has no room for "Sign up" on phones.
 */
export function SiteMenu({ items, secondary = [] }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const button = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { status } = useAuth();

  useEffect(() => {
    if (!open) return;
    const close = () => {
      if (details.current) details.current.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!details.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <details
      ref={details}
      className="group lg:hidden"
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setOpen(isOpen);
        if (isOpen) panel.current?.querySelector("a")?.focus();
      }}
      onBlur={(event) => {
        // Tabbing past the last link leaves the menu, so close it.
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) event.currentTarget.open = false;
      }}
    >
      <summary
        ref={button}
        aria-expanded={open}
        aria-controls="site-menu"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-line-strong bg-surface text-ink transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden"
      >
        <span className="sr-only">Menu</span>
        <Menu className="size-5 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-5 group-open:block" aria-hidden="true" />
      </summary>

      <div
        id="site-menu"
        ref={panel}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-y border-line bg-surface shadow-lg"
        onClick={(event) => {
          // Following a link is a client-side navigation: the header stays, so close the panel.
          if ((event.target as Element).closest("a") && details.current) details.current.open = false;
        }}
      >
        <nav aria-label="Main menu" className="mx-auto w-full max-w-[75rem] px-3 py-3 sm:px-4 md:px-8">
          <ul className="grid gap-x-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {secondary.length > 0 && (
            <ul className="mt-2 grid gap-x-4 border-t border-line pt-2 sm:grid-cols-2">
              {secondary.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {status === "anonymous" && (
            <ul className="mt-2 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              <li>
                <ButtonLink href="/sign-in" variant="secondary" size="lg" className="w-full">
                  Sign in
                </ButtonLink>
              </li>
              <li>
                <ButtonLink href="/register" size="lg" className="w-full">
                  Sign up
                </ButtonLink>
              </li>
            </ul>
          )}
        </nav>
      </div>
    </details>
  );
}
