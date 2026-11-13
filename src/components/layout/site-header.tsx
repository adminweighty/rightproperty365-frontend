import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/ui/container";
import { activeMarket } from "@/lib/data/markets";

const navItems = [
  { href: "/listings?deal=sale", label: "Buy" },
  { href: "/listings?deal=rent", label: "Rent" },
  { href: "/listings?category=commercial", label: "Commercial" },
  { href: "/listings?category=land", label: "Land" },
  { href: "/directory/agencies", label: "Agents" },
  { href: "/directory", label: "Directory" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center gap-6">
        <Link href="/" aria-label="RightProperty365 home" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted lg:inline" title="Current market">
            {activeMarket.name} · {activeMarket.currency}
          </span>
          <Link
            href="/#for-agents"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink sm:block"
          >
            For agents
          </Link>
          <AccountMenu />
        </div>
      </Container>

      <nav aria-label="Main" className="border-t border-line md:hidden">
        <Container>
          <ul className="-mx-2 flex gap-1 overflow-x-auto py-1.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </nav>
    </header>
  );
}
