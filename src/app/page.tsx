import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  House,
  LandPlot,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { HeroSearch } from "@/components/listings/hero-search";
import { ListingGrid } from "@/components/listings/listing-card";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { listings } from "@/lib/data/listings";

const categories = [
  { href: "/listings?category=residential", label: "Residential", note: "Houses, apartments and townhouses", icon: House },
  { href: "/listings?category=commercial", label: "Commercial", note: "Offices, retail and showrooms", icon: Building2 },
  { href: "/listings?category=land", label: "Land", note: "Stands, plots and farms", icon: LandPlot },
];

const promises = [
  {
    icon: ShieldCheck,
    title: "Verified advertisers",
    body: "Agencies and private sellers are checked before their listings go live.",
  },
  {
    icon: RefreshCw,
    title: "Listings stay current",
    body: "Every listing comes down after 90 days unless the agent confirms it is still available.",
  },
  {
    icon: MessageSquare,
    title: "Enquiries you can track",
    body: "Each request gets a reference, so you can see when it was received and answered.",
  },
];

const agentTools = [
  { icon: MessageSquare, title: "One inbox for every lead", body: "Enquiries and viewing requests arrive in your dashboard and on your phone." },
  { icon: CalendarClock, title: "Viewings without the back-and-forth", body: "Customers ask for a time; you confirm, reschedule or decline." },
  { icon: TrendingUp, title: "See what each listing is doing", body: "Views, enquiries and conversion for every property you publish." },
];

/** Counts how many listings share each value, most common first. */
function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function SectionHeading({ title, note, href, linkLabel }: { title: string; note?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        <span aria-hidden="true" className="mt-3 block h-1 w-12 rounded-full bg-brand-accent" />
        {note && <p className="mt-3 text-muted">{note}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline sm:inline-flex"
        >
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const featured = listings.filter((listing) => listing.featured);
  const cities = countBy(listings.map((listing) => listing.city));
  const agencies = countBy(
    listings
      .filter((listing) => listing.advertiser.kind === "agency")
      .map((listing) => listing.advertiser.name),
  );

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand text-on-brand">
        {/* Roofline from the logo mark, as a quiet backdrop. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 246 160"
          preserveAspectRatio="xMaxYMax meet"
          className="pointer-events-none absolute -bottom-6 right-0 -z-10 h-[120%] w-auto opacity-[0.07] md:right-[4%]"
        >
          <path d="M0 104 93 12l91 66h62l-13 21h-59L93 42 0 134Z" fill="currentColor" />
          <path d="M92 111h18v18H92zm24 0h18v18h-18zM92 135h18v18H92zm24 0h18v18h-18z" fill="currentColor" />
        </svg>

        <Container className="pb-16 pt-14 text-center md:pb-24 md:pt-20">
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.1] md:text-6xl">
            Find the <span className="text-brand-accent">right property</span>, any day of the year
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed opacity-90">
            Homes, commercial space and land from verified agents and owners across Zimbabwe.
          </p>
          <HeroSearch className="mx-auto mt-10 max-w-3xl text-left" />
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm opacity-90">
            {["Verified advertisers", "Listings refreshed every 90 days", "Track every enquiry"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-brand-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:gap-8">
          <h2 className="shrink-0 font-sans text-sm font-semibold tracking-normal text-muted">
            Featured agencies
          </h2>
          <ul className="flex flex-wrap gap-3">
            {agencies.map(([name, count]) => (
              <li key={name}>
                {/* Becomes a link once agency profile pages exist. */}
                <div className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-sm bg-primary-soft text-sm font-bold text-primary-ink"
                  >
                    {name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{name}</span>
                    <span className="block text-xs text-muted">
                      {count === 1 ? "1 listing" : `${count} listings`}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-14 md:py-16">
        <SectionHeading
          title="Featured properties"
          note="A selection from agents this week."
          href="/listings"
          linkLabel="View all listings"
        />
        <div className="mt-8">
          <ListingGrid listings={featured} />
        </div>
        <ButtonLink href="/listings" variant="secondary" className="mt-6 w-full sm:hidden">
          View all listings
        </ButtonLink>
      </Container>

      <section className="border-y border-line bg-sunken">
        <Container className="py-14 md:py-16">
          <SectionHeading title="Explore by city" note="See what is on the market where you want to live or work." />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map(([city, count]) => (
              <li key={city}>
                <Link
                  href={`/listings?q=${encodeURIComponent(city)}`}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
                      <MapPin className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-semibold text-ink">{city}</span>
                      <span className="block text-sm text-muted">
                        {count === 1 ? "1 property" : `${count} properties`}
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    className="size-5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary-ink"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-14 md:py-16">
        <SectionHeading title="Browse by category" />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {categories.map(({ href, label, note, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-sunken"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block text-sm text-muted">{note}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <section className="border-y border-line bg-surface">
        <Container className="py-14 md:py-16">
          <SectionHeading title="Why search with RightProperty365" />
          <ul className="mt-10 grid gap-10 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="flex size-11 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-sans text-lg font-semibold tracking-normal">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="pt-14 md:pt-16">
        <section
          id="for-agents"
          className="scroll-mt-24 rounded-xl bg-brand px-6 py-12 text-on-brand md:px-12 md:py-16"
        >
          <p className="text-sm font-semibold text-brand-accent">For agents, landlords and developers</p>
          <h2 className="mt-3 max-w-2xl text-3xl md:text-4xl">
            More than an advert. The tools to run the deal.
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {agentTools.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-6 text-brand-accent" aria-hidden="true" />
                <h3 className="mt-4 font-sans text-lg font-semibold tracking-normal">{title}</h3>
                <p className="mt-2 leading-relaxed opacity-90">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm opacity-90">
            Agent registration opens with the first release. Packages are priced per market.
          </p>
        </section>
      </Container>
    </>
  );
}
