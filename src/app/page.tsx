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
import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import agentsPhoto from "@/assets/images/agents.jpg";
import bulawayoPhoto from "@/assets/images/city-bulawayo.jpg";
import hararePhoto from "@/assets/images/city-harare.jpg";
import victoriaFallsPhoto from "@/assets/images/city-victoria-falls.jpg";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { ListingTicker } from "@/components/landing/listing-ticker";
import { ShowcaseScroll } from "@/components/landing/showcase-scroll";
import { StatCounter } from "@/components/landing/stat-counter";
import { HeroSearch } from "@/components/listings/hero-search";
import { ListingRail } from "@/components/listings/listing-rail";
import { PageMotion } from "@/components/motion/page-motion";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";
import { directories, directoryKinds, profilesOfKind } from "@/lib/data/directory";
import { listings } from "@/lib/data/listings";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

const homeTitle = "RightProperty365 | Property for sale and to rent in Zimbabwe";
const homeDescription =
  "Search verified property for sale and to rent in Zimbabwe. Send an enquiry and track it until the agent replies.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "RightProperty365",
    locale: "en_ZW",
    title: homeTitle,
    description: homeDescription,
    url: "/",
  },
};

const cityPhotos: Record<string, { src: StaticImageData; alt: string }> = {
  Harare: { src: hararePhoto, alt: "Harare city skyline" },
  Bulawayo: { src: bulawayoPhoto, alt: "Street in central Bulawayo" },
  "Victoria Falls": { src: victoriaFallsPhoto, alt: "The Victoria Falls" },
};

const categories = [
  { key: "residential", label: "Residential", note: "Houses, apartments and townhouses", icon: House },
  { key: "commercial", label: "Commercial", note: "Offices, retail and showrooms", icon: Building2 },
  { key: "land", label: "Land", note: "Stands, plots and farms", icon: LandPlot },
] as const;

const steps = [
  { title: "Search", body: "Filter by city, suburb, property type and whether you want to buy or rent." },
  { title: "Enquire", body: "Send one request from the listing. It goes to the agent or owner through us, not around us." },
  { title: "Track", body: "You get a reference straight away and can see when your request is answered." },
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

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function SectionHeading({
  title,
  note,
  href,
  linkLabel,
  className,
}: {
  title: string;
  note?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div data-reveal className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <span aria-hidden="true" className="block h-1 w-12 rounded-full bg-brand-accent" />
        <h2 className="mt-4 text-2xl md:text-4xl">{title}</h2>
        {note && <p className="mt-3 max-w-xl text-muted">{note}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline sm:inline-flex"
        >
          {linkLabel}
          <ArrowRight className="hidden size-4 sm:block" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const newest = [...listings].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const newIds = newest.slice(0, 6).map((listing) => listing.id);
  const featured = listings.filter((listing) => listing.featured);
  const homesForSale = newest.filter((l) => l.deal === "sale" && l.category === "residential");
  const homesToRent = newest.filter((l) => l.deal === "rent" && l.category === "residential");
  const commercialAndLand = newest.filter((l) => l.category !== "residential");

  const cities = countBy(listings.map((listing) => listing.city));
  const suburbs = countBy(listings.map((listing) => listing.suburb));
  const agencies = countBy(
    listings
      .filter((listing) => listing.advertiser.kind === "agency")
      .map((listing) => listing.advertiser.name),
  );
  const advertisers = new Set(listings.map((listing) => listing.advertiser.name)).size;

  const stats = [
    { value: listings.length, label: "properties listed" },
    { value: cities.length, label: "cities and towns" },
    { value: advertisers, label: "verified advertisers" },
  ];

  return (
    <PageMotion>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />

      {/* Full-bleed hero. It sits under the transparent header (data-overlay-hero). */}
      <section
        data-overlay-hero
        className="relative isolate flex min-h-[44rem] flex-col justify-end overflow-hidden bg-brand-deep text-on-brand lg:min-h-[100svh]"
      >
        <HeroBackdrop listings={featured.slice(0, 5)} />

        <Container className="pb-40 pt-[calc(var(--header-h)+3rem)] lg:pb-44">
          <p
            data-hero
            className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-3.5 py-1.5 text-sm font-semibold text-brand-deep"
          >
            <BadgeCheck className="size-4" aria-hidden="true" />
            Verified property across Zimbabwe
          </p>
          <h1 data-split className="mt-6 max-w-4xl text-5xl leading-[1.02] md:text-7xl">
            Find the <span className="text-brand-accent">right property</span> any day of the year
          </h1>
          <p data-hero className="mt-6 max-w-xl text-lg leading-relaxed opacity-90 md:text-xl">
            Homes, commercial space and land from agents and owners we have checked. Send one
            enquiry and follow it until you get an answer.
          </p>
          <div data-hero className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/listings?deal=sale" size="lg" variant="accent" data-magnetic>
              Browse homes for sale
            </ButtonLink>
            <ButtonLink href="/listings?deal=rent" size="lg" variant="on-brand" data-magnetic>
              Find a rental
            </ButtonLink>
          </div>
          <dl data-hero className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/20 pt-6 lg:max-w-xl">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse">
                <dt className="text-sm opacity-80">{stat.label}</dt>
                <dd className="text-3xl font-bold tabular-nums text-brand-accent md:text-4xl">
                  <StatCounter value={stat.value} />
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Search card straddles the hero's bottom edge. */}
      <Container className="relative z-10 -mt-24">
        <div data-hero>
          <HeroSearch className="mx-auto max-w-4xl ring-1 ring-line" />
        </div>
      </Container>

      <div data-reveal className="mt-10">
        <ListingTicker listings={newest.slice(0, 10)} />
      </div>

      <Container className="pt-8">
        <div data-reveal className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
          <h2 className="shrink-0 font-sans text-sm font-semibold tracking-normal text-muted">
            Featured agencies
          </h2>
          <ul className="flex flex-wrap gap-3">
            {agencies.map(([name, count]) => (
              <li key={name}>
                <Link
                  href={`/directory/agencies/${name.toLowerCase().replaceAll(" ", "-")}`}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 transition-shadow hover:shadow-md"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-sm bg-brand text-sm font-bold text-on-brand"
                  >
                    {name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{name}</span>
                    <span className="block text-xs text-muted">{plural(count, "listing", "listings")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container className="pt-16 md:pt-20">
        <SectionHeading
          title="Just listed"
          note="The newest properties on the market."
          href="/listings"
          linkLabel="View all"
        />
        <div data-reveal className="mt-8">
          <ListingRail label="Just listed" listings={newest.slice(0, 8)} newIds={newIds} />
        </div>
      </Container>

      <div className="mt-16 md:mt-20">
        <ShowcaseScroll
          listings={featured.slice(0, 6)}
          heading={
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-brand-accent">Signature collection</p>
                <h2 data-split className="mt-3 max-w-2xl text-3xl md:text-5xl">
                  Featured properties worth a closer look
                </h2>
              </div>
              <p className="hidden max-w-xs text-sm opacity-80 lg:block">
                Hand-picked by our agencies this week. Keep scrolling to move through the collection.
              </p>
            </div>
          }
        />
      </div>

      <Container className="pt-16 md:pt-20">
        <SectionHeading
          title="Homes for sale"
          href="/listings?deal=sale&category=residential"
          linkLabel="View all"
        />
        <div data-reveal className="mt-8">
          <ListingRail label="Homes for sale" listings={homesForSale} newIds={newIds} />
        </div>
      </Container>

      <section className="mt-16 border-y border-line bg-surface md:mt-20">
        <Container className="py-16 md:py-20">
          <SectionHeading title="Explore by city" note="See what is on the market where you want to live or work." />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cities.map(([city, count]) => {
              // Cities without their own photo borrow one from a listing there.
              const fallback = listings.find((listing) => listing.city === city)?.image;
              const photo = cityPhotos[city] ?? fallback;
              return (
                <li key={city}>
                  <Link
                    href={`/listings?q=${encodeURIComponent(city)}`}
                    data-reveal-clip
                    className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-lg bg-brand text-on-brand shadow-xs transition-shadow hover:shadow-lg"
                  >
                    {photo && (
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                        placeholder="blur"
                        className="object-cover transition-transform duration-700 ease-standard group-hover:scale-105"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-linear-to-t from-brand-deep via-brand-deep/40 to-transparent"
                    />
                    <span className="relative flex w-full items-end justify-between gap-3 p-5">
                      <span>
                        <span className="flex items-center gap-1.5 text-xl font-bold">
                          <MapPin className="size-5 text-brand-accent" aria-hidden="true" />
                          {city}
                        </span>
                        <span className="mt-1 block text-sm opacity-90">
                          {plural(count, "property", "properties")}
                        </span>
                      </span>
                      <span className="flex size-10 items-center justify-center rounded-full bg-brand-accent text-brand-deep transition-transform group-hover:translate-x-1">
                        <ArrowRight className="size-5" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <h3 data-reveal className="mt-12 text-lg">
            Popular suburbs
          </h3>
          <ul data-reveal-group className="mt-4 flex flex-wrap gap-2">
            {suburbs.map(([suburb, count]) => (
              <li key={suburb}>
                <Link
                  href={`/listings?q=${encodeURIComponent(suburb)}`}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-page px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand hover:text-on-brand"
                >
                  {suburb}
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="pt-16 md:pt-20">
        <SectionHeading
          title="Homes to rent"
          href="/listings?deal=rent&category=residential"
          linkLabel="View all"
        />
        <div data-reveal className="mt-8">
          <ListingRail label="Homes to rent" listings={homesToRent} newIds={newIds} />
        </div>
      </Container>

      <Container className="pt-16 md:pt-20">
        <SectionHeading title="Commercial and land" note="Offices, stands and plots." />
        <div data-reveal className="mt-8">
          <ListingRail label="Commercial and land" listings={commercialAndLand} newIds={newIds} />
        </div>
      </Container>

      <section className="mt-16 border-y border-line bg-sunken md:mt-20">
        <Container className="py-16 md:py-20">
          <SectionHeading title="Browse by category" />
          <ul data-reveal-group className="mt-10 grid gap-4 md:grid-cols-3">
            {categories.map(({ key, label, note, icon: Icon }) => (
              <li key={key}>
                <Link
                  href={`/listings?category=${key}`}
                  className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand transition-colors group-hover:bg-brand-accent group-hover:text-brand-deep">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{label}</span>
                    <span className="block text-sm text-muted">{note}</span>
                  </span>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold tabular-nums text-primary-ink">
                    {listings.filter((listing) => listing.category === key).length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-16 md:py-20">
        <SectionHeading
          title="Find a professional"
          note="Agents, developers, property managers, hosts and the services around a move."
          href="/directory"
          linkLabel="Open the directory"
        />
        <ul data-reveal-group className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {directoryKinds.map((kind) => (
            <li key={kind}>
              <Link
                href={`/directory/${kind}`}
                className="group flex h-full items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xl font-bold tabular-nums text-accent-ink">
                  {profilesOfKind(kind).length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink group-hover:underline">
                    {directories[kind].title}
                  </span>
                  <span className="block text-sm text-muted">{directories[kind].description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <section className="border-t border-line bg-surface">
        <Container className="py-16 md:py-20">
          <SectionHeading title="How it works" note="Three steps, and you always know where your enquiry stands." />
          <ol data-reveal-group className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-line bg-page p-6">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full bg-brand-accent text-lg font-bold text-brand-deep"
                >
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>

          <ul data-reveal-group className="mt-14 grid gap-8 border-t border-line pt-12 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="flex size-11 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="pt-16 md:pt-20">
        <section
          id="for-agents"
          data-reveal
          className="grid scroll-mt-24 overflow-hidden rounded-xl bg-brand text-on-brand lg:grid-cols-[1.2fr_1fr]"
        >
          <div className="px-6 py-12 md:px-12 md:py-16">
            <p className="text-sm font-semibold text-brand-accent">For agents, landlords and developers</p>
            <h2 data-split className="mt-3 max-w-xl text-3xl md:text-5xl">
              More than an advert. The tools to run the deal.
            </h2>
            <ul className="mt-8 space-y-6">
              {agentTools.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-accent">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="mt-1 block leading-relaxed opacity-90">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/register" size="lg" variant="accent" className="mt-10" data-magnetic>
              Create an account
            </ButtonLink>
            <p className="mt-4 text-sm opacity-90">
              Agency onboarding opens with the first release. Packages are priced per market.
            </p>
          </div>
          <div className="relative hidden min-h-80 lg:block">
            <Image
              src={agentsPhoto}
              alt="Glass-walled corridor in a modern office"
              fill
              sizes="(min-width: 1024px) 480px, 0px"
              placeholder="blur"
              className="object-cover"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-brand to-transparent" />
          </div>
        </section>
      </Container>
    </PageMotion>
  );
}
