import {
  ArrowRight,
  Building2,
  CalendarClock,
  House,
  LandPlot,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/listing-card";
import { SearchBar } from "@/components/listings/search-bar";
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

export default function HomePage() {
  const featured = listings.filter((listing) => listing.featured);

  return (
    <>
      <section className="border-b border-line bg-sunken">
        <Container className="py-16 md:py-24">
          <p className="text-sm font-medium text-primary-ink">Zimbabwe · Property marketplace</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.1] md:text-6xl">
            Find the right property, and know your enquiry arrived.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Search homes, commercial space and land from verified agents and owners across
            Zimbabwe.
          </p>
          <SearchBar className="mt-10 max-w-4xl" />
        </Container>
      </section>

      <Container className="py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl">Featured properties</h2>
            <p className="mt-2 text-muted">A selection from agents this week.</p>
          </div>
          <Link
            href="/listings"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline sm:inline-flex"
          >
            View all listings
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-8">
          <ListingGrid listings={featured} />
        </div>
        <ButtonLink href="/listings" variant="secondary" className="mt-6 w-full sm:hidden">
          View all listings
        </ButtonLink>
      </Container>

      <Container className="pb-16">
        <h2 className="text-3xl">Browse by category</h2>
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
                  <span className="block font-medium text-ink">{label}</span>
                  <span className="block text-sm text-muted">{note}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <section className="border-y border-line bg-surface">
        <Container className="py-16">
          <h2 className="max-w-xl text-3xl">Why search with RightProperty365</h2>
          <ul className="mt-10 grid gap-10 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-6 text-primary-ink" aria-hidden="true" />
                <h3 className="mt-4 font-sans text-lg font-medium tracking-normal">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="pt-16">
        <section
          id="for-agents"
          className="scroll-mt-24 rounded-xl bg-inverse px-6 py-12 text-on-inverse md:px-12 md:py-16"
        >
          <p className="text-sm font-medium opacity-80">For agents, landlords and developers</p>
          <h2 className="mt-3 max-w-2xl text-3xl md:text-4xl">
            More than an advert. The tools to run the deal.
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {agentTools.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-6 opacity-80" aria-hidden="true" />
                <h3 className="mt-4 font-sans text-lg font-medium tracking-normal">{title}</h3>
                <p className="mt-2 leading-relaxed opacity-80">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm opacity-80">
            Agent registration opens with the first release. Packages are priced per market.
          </p>
        </section>
      </Container>
    </>
  );
}
