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
import heroPhoto from "@/assets/images/hero.jpg";
import { HeroSearch } from "@/components/listings/hero-search";
import { ListingGrid } from "@/components/listings/listing-card";
import { PageMotion } from "@/components/motion/page-motion";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";
import { listings } from "@/lib/data/listings";
import { formatMoney } from "@/lib/format";
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
  { href: "/listings?category=residential", label: "Residential", note: "Houses, apartments and townhouses", icon: House },
  { href: "/listings?category=commercial", label: "Commercial", note: "Offices, retail and showrooms", icon: Building2 },
  { href: "/listings?category=land", label: "Land", note: "Stands, plots and farms", icon: LandPlot },
];

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
  const spotlight = listings[0];
  const cities = countBy(listings.map((listing) => listing.city));
  const agencies = countBy(
    listings
      .filter((listing) => listing.advertiser.kind === "agency")
      .map((listing) => listing.advertiser.name),
  );

  return (
    <PageMotion>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      {/* Hero: indigo, white and turquoise, straight from the logo. */}
      <section className="relative isolate bg-brand text-on-brand">
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-brand-accent opacity-15 blur-3xl" />
          <div className="absolute -bottom-52 -left-40 size-[30rem] rounded-full bg-brand-deep opacity-70 blur-3xl" />
        </div>

        <Container className="grid items-center gap-12 pb-36 pt-12 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-40">
          <div>
            <p
              data-hero
              className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-3.5 py-1.5 text-sm font-semibold text-brand-deep"
            >
              <BadgeCheck className="size-4" aria-hidden="true" />
              Verified property across Zimbabwe
            </p>
            <h1 data-hero className="mt-6 text-4xl leading-[1.08] md:text-6xl">
              Find the <span className="text-brand-accent">right property</span>, any day of the year
            </h1>
            <p data-hero className="mt-6 max-w-lg text-lg leading-relaxed opacity-90">
              Homes, commercial space and land from agents and owners we have checked. Send one
              enquiry and follow it until you get an answer.
            </p>
            <div data-hero className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/listings?deal=sale"
                size="lg"
                variant="accent"
              >
                Browse homes for sale
              </ButtonLink>
              <ButtonLink
                href="/listings?deal=rent"
                size="lg"
                variant="on-brand"
              >
                Find a rental
              </ButtonLink>
            </div>
          </div>

          <div data-hero className="relative hidden lg:block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-lg ring-1 ring-white/20">
              <Image
                src={heroPhoto}
                alt="Modern white house with a swimming pool and garden"
                fill
                sizes="(min-width: 1024px) 560px, 0px"
                placeholder="blur"
                loading="eager"
                fetchPriority="high"
                data-parallax
                className="scale-110 object-cover"
              />
            </div>

            <Link
              href={`/listings/${spotlight.slug}`}
              data-float
              className="absolute -bottom-8 -left-8 flex w-72 items-center gap-3 rounded-lg bg-surface p-3 text-ink shadow-lg"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-md">
                <Image src={spotlight.image.src} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-accent-ink">Featured</span>
                <span className="block font-bold tabular-nums">{formatMoney(spotlight.price)}</span>
                <span className="block truncate text-sm text-muted">
                  {spotlight.suburb}, {spotlight.city}
                </span>
              </span>
            </Link>

            <p
              data-float
              className="absolute -right-4 top-8 flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-deep shadow-lg"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Verified agent
            </p>
          </div>
        </Container>
      </section>

      {/* Search card straddles the hero's bottom edge. */}
      <Container className="relative z-10 -mt-24">
        <div data-hero>
          <HeroSearch className="mx-auto max-w-4xl ring-1 ring-line" />
        </div>
      </Container>

      <Container className="pt-10">
        <div data-reveal className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
          <h2 className="shrink-0 font-sans text-sm font-semibold tracking-normal text-muted">
            Featured agencies
          </h2>
          <ul className="flex flex-wrap gap-3">
            {agencies.map(([name, count]) => (
              <li key={name}>
                {/* Becomes a link once agency profile pages exist. */}
                <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
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
                    <span className="block text-xs text-muted">
                      {count === 1 ? "1 listing" : `${count} listings`}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container className="py-16 md:py-20">
        <SectionHeading
          title="Featured properties"
          note="A selection from agents this week."
          href="/listings"
          linkLabel="View all listings"
        />
        <div data-reveal className="mt-10">
          <ListingGrid listings={featured} />
        </div>
        <ButtonLink href="/listings" variant="secondary" className="mt-6 w-full sm:hidden">
          View all listings
        </ButtonLink>
      </Container>

      <section className="border-y border-line bg-surface">
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
        </Container>
      </section>

      <Container className="py-16 md:py-20">
        <SectionHeading title="Explore by city" note="See what is on the market where you want to live or work." />
        <ul data-reveal-group className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map(([city, count]) => {
            const photo = cityPhotos[city];
            return (
              <li key={city}>
                <Link
                  href={`/listings?q=${encodeURIComponent(city)}`}
                  className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-brand text-on-brand shadow-xs transition-shadow hover:shadow-lg"
                >
                  {photo && (
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                      placeholder="blur"
                      className="object-cover transition-transform duration-500 ease-standard group-hover:scale-105"
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
                        {count === 1 ? "1 property" : `${count} properties`}
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
      </Container>

      <section className="border-y border-line bg-sunken">
        <Container className="py-16 md:py-20">
          <SectionHeading title="Browse by category" />
          <ul data-reveal-group className="mt-10 grid gap-4 md:grid-cols-3">
            {categories.map(({ href, label, note, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand transition-colors group-hover:bg-brand-accent group-hover:text-brand-deep">
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
      </section>

      <Container className="py-16 md:py-20">
        <SectionHeading title="Why search with RightProperty365" />
        <ul data-reveal-group className="mt-10 grid gap-8 md:grid-cols-3">
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

      <Container>
        <section
          id="for-agents"
          data-reveal
          className="grid scroll-mt-24 overflow-hidden rounded-xl bg-brand text-on-brand lg:grid-cols-[1.2fr_1fr]"
        >
          <div className="px-6 py-12 md:px-12 md:py-16">
            <p className="text-sm font-semibold text-brand-accent">For agents, landlords and developers</p>
            <h2 className="mt-3 max-w-xl text-3xl md:text-4xl">
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
            <ButtonLink
              href="/register"
              size="lg"
              variant="accent"
              className="mt-10"
            >
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
