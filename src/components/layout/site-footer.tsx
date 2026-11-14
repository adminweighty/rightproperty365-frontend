import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { MarketList } from "@/components/layout/market-info";
import { professionalsLink, type NavItem } from "@/components/layout/nav-items";
import { Container } from "@/components/ui/container";

const columns: { title: string; links: NavItem[] }[] = [
  {
    title: "Property",
    links: [
      { href: "/listings?deal=sale", label: "Property for sale" },
      { href: "/listings?deal=rent", label: "Property to rent" },
      { href: "/listings?category=commercial", label: "Commercial property" },
      { href: "/listings?category=land", label: "Land and stands" },
      { href: "/listings", label: "All listings" },
    ],
  },
  {
    title: "Directory",
    links: [
      { href: "/directory/agencies", label: "Estate agencies" },
      { href: "/directory/developers", label: "Property developers" },
      { href: "/directory", label: "Property directory" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/register", label: "Create an account" },
      professionalsLink,
    ],
  },
];

const headingClass = "font-sans text-sm font-semibold tracking-normal text-ink";

/** Light, multi-column footer: brand line, three link columns and the markets. */
export function SiteFooter() {
  return (
    <footer data-site-footer className="mt-20 border-t border-line bg-soft md:mt-24">
      <Container className="grid gap-x-8 gap-y-10 py-12 sm:grid-cols-2 md:py-16 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div className="max-w-sm sm:col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Verified property listings, with every enquiry tracked from the moment you send it to
            the moment the agent replies.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className={headingClass}>{column.title}</h2>
            <ul className="mt-2">
              {column.links.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center text-sm text-muted hover:text-primary-ink hover:underline md:min-h-9"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className={headingClass}>Markets</h2>
          <Suspense fallback={<div aria-busy="true" className="mt-3 h-24 rounded-md bg-sunken" />}>
            <MarketList />
          </Suspense>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-5 text-sm text-subtle sm:flex-row sm:justify-between">
          <p>© 2026 RightProperty365. All rights reserved.</p>
          <p>Development build. Listings shown are sample data.</p>
        </Container>
      </div>
    </footer>
  );
}
