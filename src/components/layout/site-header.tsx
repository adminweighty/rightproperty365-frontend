import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { Logo } from "@/components/layout/logo";
import { navItems, professionalsLink } from "@/components/layout/nav-items";
import { SiteMenu } from "@/components/layout/site-menu";
import { ButtonLink } from "@/components/ui/button";

/**
 * White, sticky, 64px. Logo, inline navigation from `lg`, the session control
 * and, below `lg`, the menu button. The bar never wraps: the logo is the one
 * part that may shrink on the narrowest phones.
 */
export function SiteHeader() {
  return (
    <header data-site-header className="sticky top-0 z-40 border-b border-line bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[75rem] items-center gap-2 px-3 sm:gap-4 sm:px-4 md:px-8">
        <Link href="/" aria-label="RightProperty365 home" className="min-w-0 shrink rounded-md">
          <Logo className="h-6 max-w-full sm:h-8" />
        </Link>

        <nav aria-label="Main" className="ml-2 hidden lg:block">
          <ul className="flex items-center">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-ink decoration-line-accent decoration-2 underline-offset-8 transition-colors hover:text-primary-ink hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AccountMenu professionals={professionalsLink} />
          {/* The session control needs JavaScript; without it, sign-in and sign-up are still one tap away. */}
          <noscript>
            <span className="flex items-center gap-2">
              <ButtonLink href="/sign-in" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" className="max-sm:hidden">
                Sign up
              </ButtonLink>
            </span>
          </noscript>
          <SiteMenu items={navItems} secondary={[professionalsLink]} />
        </div>
      </div>
    </header>
  );
}
