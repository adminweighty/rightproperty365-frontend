import Link from "next/link";
import { Fragment } from "react";
import { AppLinks } from "@/components/layout/app-links";
import { Logo } from "@/components/layout/logo";
import { MarketList } from "@/components/layout/market-info";
import { professionalsLink, type NavItem } from "@/components/layout/nav-items";
import { Container } from "@/components/ui/container";
import { getDirectoryKinds } from "@/lib/api/server/directory";
import { load } from "@/lib/api/server/load";
import { legalDocuments } from "@/lib/legal";
import { ApiBoundary } from "@/components/api-boundary";

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
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/register", label: "Create an account" },
      professionalsLink,
    ],
  },
];

const directoryHome: NavItem = { href: "/directory", label: "Property directory" };

const headingClass = "font-sans text-sm font-semibold tracking-normal text-ink";
const linkClass = "flex min-h-11 items-center text-sm text-muted hover:text-primary-ink hover:underline md:min-h-9";

function LinkList({ links }: { links: NavItem[] }) {
  return (
    <ul className="mt-2">
      {links.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={linkClass}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every directory the API lists (Real Estate Agencies, Estate Agents,
 * Solicitors, ...), so a new directory appears here without a change to the
 * app. If they cannot be loaded, the link to the directory hub is enough.
 */
async function DirectoryLinks() {
  const loaded = await load(getDirectoryKinds);
  const kinds = loaded.ok ? loaded.data : [];
  return (
    <LinkList
      links={[...kinds.map((kind) => ({ href: `/directory/${kind.code}`, label: kind.label })), directoryHome]}
    />
  );
}

/** Light, multi-column footer: brand line, three link columns (the directories from the API), the markets, the app-store links, and a row with the FAQ and the legal links. */
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
          <h2 className={`mt-6 ${headingClass}`}>Get the app</h2>
          <AppLinks className="mt-3" />
        </div>

        {columns.map((column, index) => (
          <Fragment key={column.title}>
            <nav aria-label={column.title}>
              <h2 className={headingClass}>{column.title}</h2>
              <LinkList links={column.links} />
            </nav>
            {/* The directory column sits between "Property" and "Account". */}
            {index === 0 && (
              <nav aria-label="Directory">
                <h2 className={headingClass}>Directory</h2>
                <ApiBoundary fallback={<LinkList links={[directoryHome]} />}>
                  <DirectoryLinks />
                </ApiBoundary>
              </nav>
            )}
          </Fragment>
        ))}

        <div>
          <h2 className={headingClass}>Markets</h2>
          <ApiBoundary fallback={<div aria-busy="true" className="mt-3 h-24 rounded-md bg-sunken" />}>
            <MarketList />
          </ApiBoundary>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="py-3">
          <nav aria-label="Help and legal">
            <ul className="flex flex-col gap-x-6 sm:flex-row sm:flex-wrap">
              <li>
                <Link href="/faq" className={linkClass}>
                  Frequently asked questions
                </Link>
              </li>
              {legalDocuments.map((document) => (
                <li key={document.key}>
                  <Link href={document.path} className={linkClass}>
                    {document.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-5 text-sm text-subtle sm:flex-row sm:justify-between">
          <p>© 2026 RightProperty365. All rights reserved.</p>
          <p>Development build. Listings shown are sample data.</p>
        </Container>
      </div>
    </footer>
  );
}
