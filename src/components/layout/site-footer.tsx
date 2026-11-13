import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { markets } from "@/lib/data/markets";

const browse = [
  { href: "/listings?deal=sale", label: "Property for sale" },
  { href: "/listings?deal=rent", label: "Property to rent" },
  { href: "/listings?category=commercial", label: "Commercial property" },
  { href: "/listings?category=land", label: "Land and stands" },
  { href: "/directory/agencies", label: "Estate agencies" },
  { href: "/directory/developers", label: "Property developers" },
  { href: "/directory", label: "Property directory" },
];

export function SiteFooter() {
  return (
    <footer data-site-footer className="mt-24 bg-sunken">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Verified property listings, with every enquiry tracked from the moment you send it to
            the moment the agent replies.
          </p>
        </div>

        <nav aria-label="Browse">
          <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">Browse</h2>
          <ul className="mt-3 space-y-2">
            {browse.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-muted hover:text-ink hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">Markets</h2>
          <ul className="mt-3 space-y-2">
            {markets.map((market) => (
              <li key={market.code} className="flex items-center gap-2 text-sm text-muted">
                {market.name}
                {market.status === "ACTIVE" ? (
                  <Badge tone="success">Live</Badge>
                ) : (
                  <Badge>Planned</Badge>
                )}
              </li>
            ))}
          </ul>
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
