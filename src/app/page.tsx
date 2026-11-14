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
  Tag,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import agentsPhoto from "@/assets/images/agents.jpg";
import { initials } from "@/components/directory/profile-card";
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
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { listListings } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import type { FacetCount, Listing } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { cityArtwork, coverPhoto } from "@/lib/photos";
import { buildSearchOptions } from "@/lib/search-options";
import { listingsHeading, listingsPath, organizationJsonLd, profilePath, websiteJsonLd } from "@/lib/seo";

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

/** Artwork for the category tiles, by category code. Any other category gets the generic icon. */
const categoryIcons: Record<string, LucideIcon> = {
  residential: House,
  commercial: Building2,
  land: LandPlot,
};

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

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Most listings first, then by name. The API returns facets by name. */
const byCount = (facet: FacetCount[]) =>
  [...facet].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

/** "Commercial" and "Land" become "Commercial and land". */
function sentenceList(labels: string[]): string {
  const [first, ...rest] = labels;
  if (!first) return "";
  const others = rest.map((label) => label.toLowerCase());
  if (others.length === 0) return first;
  return `${[first, ...others.slice(0, -1)].join(", ")} and ${others[others.length - 1]}`;
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
        <span aria-hidden="true" className="rule-brand block w-16" />
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

const RAIL_SIZE = 12;

/**
 * Everything the landing page shows that comes from the API: reference data
 * for the search form and tiles, the newest and featured listings, one row of
 * listings per deal type, and the directories with their counts.
 */
async function readHome() {
  const catalogue = await getCatalogue();
  const { sets } = catalogue;
  // The first category in the API's order leads the page; the rest share a row.
  const [mainCategory, ...otherCategories] = sets.property_categories;

  const [newest, featured, dealRows, otherRows, kinds] = await Promise.all([
    listListings({ page_size: RAIL_SIZE }),
    listListings({ featured: true, page_size: 6 }),
    Promise.all(
      sets.deal_types.map(async (deal) => {
        const filters = { deal: deal.code, category: mainCategory?.code };
        return {
          title: listingsHeading(filters, { sets, market: null }),
          href: listingsPath(filters),
          page: await listListings({ ...filters, page_size: RAIL_SIZE }),
        };
      }),
    ),
    Promise.all(otherCategories.map(({ code }) => listListings({ category: code, page_size: RAIL_SIZE }))),
    getDirectoryKinds(),
  ]);
  if (!newest) throw new Error("The listing search refused an unfiltered request.");

  const directoryLists = await Promise.all(kinds.map(({ code }) => getDirectoryList(code)));
  // Businesses that advertise listings of their own, busiest first.
  const advertisers = directoryLists
    .flatMap((list) => list?.profiles ?? [])
    .filter((profile) => profile.listing_count > 0 && !profile.agency)
    .sort((a, b) => b.listing_count - a.listing_count || a.name.localeCompare(b.name))
    .slice(0, 6);

  const others = otherRows
    .flatMap((page) => page?.items ?? [])
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, RAIL_SIZE);

  return {
    catalogue,
    newest,
    featured: featured?.items ?? [],
    dealRows: dealRows.map(({ page, ...row }) => ({ ...row, listings: page?.items ?? [] })),
    otherRow: { title: sentenceList(otherCategories.map(({ label }) => label)), listings: others },
    kinds,
    advertisers,
  };
}

/** The hero's size and colour while the page loads, so nothing jumps when it arrives. */
function HomeFallback() {
  return (
    <section
      data-overlay-hero
      aria-busy="true"
      aria-label="Loading the home page"
      className="min-h-[44rem] bg-brand-deep lg:min-h-[100svh]"
    />
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <Suspense fallback={<HomeFallback />}>
        <HomeContent />
      </Suspense>
    </>
  );
}

// One component renders the whole page, inside PageMotion, so the entrance
// and scroll animations start once all of the content they act on is there.
async function HomeContent() {
  const loaded = await load(readHome);
  if (!loaded.ok) {
    return (
      <Container className="py-16 md:py-24">
        <h1 className="max-w-3xl text-4xl md:text-5xl">Find the right property any day of the year</h1>
        <ErrorState title="We could not load the listings." retryHref="/" className="mt-8 max-w-2xl" />
      </Container>
    );
  }

  const { catalogue, newest, featured, dealRows, otherRow, kinds, advertisers } = loaded.data;
  const { sets, market } = catalogue;
  const { facets } = newest;
  const newIds = newest.items.slice(0, 6).map((listing) => listing.id);
  const searchOptions = buildSearchOptions(sets, facets);
  const cities = byCount(facets.city);
  const suburbs = byCount(facets.suburb);
  // Featured listings lead the hero; without any, the newest do.
  const heroListings = (featured.length > 0 ? featured : newest.items).slice(0, 5);
  // Every listing loaded for this page, to lend a photo to a city without artwork.
  const pool: Listing[] = [...newest.items, ...featured, ...dealRows.flatMap((row) => row.listings), ...otherRow.listings];

  const stats = [
    { value: newest.total, label: "properties listed" },
    { value: cities.length, label: "cities and towns" },
    { value: kinds.reduce((sum, kind) => sum + kind.count, 0), label: "professionals and businesses" },
  ];

  return (
    <PageMotion>
      {/* Full-bleed hero. It sits under the transparent header (data-overlay-hero). */}
      <section
        data-overlay-hero
        className="relative isolate flex min-h-[44rem] flex-col justify-end overflow-hidden bg-brand-deep text-on-brand lg:min-h-[100svh]"
      >
        {heroListings.length > 0 && <HeroBackdrop listings={heroListings} />}

        <Container className="pb-40 pt-[calc(var(--header-h)+3rem)] lg:pb-44">
          <p
            data-hero
            className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-3.5 py-1.5 text-sm font-semibold text-brand-deep"
          >
            <BadgeCheck className="size-4" aria-hidden="true" />
            Verified property{market && ` across ${market.name}`}
          </p>
          <h1 data-split className="mt-6 max-w-4xl text-5xl leading-[1.02] md:text-7xl">
            Find the <span className="text-brand-accent">right property</span> any day of the year
          </h1>
          <p data-hero className="mt-6 max-w-xl text-lg leading-relaxed opacity-90 md:text-xl">
            Homes, commercial space and land from agents and owners we have checked. Send one
            enquiry and follow it until you get an answer.
          </p>
          <div data-hero className="mt-8 flex flex-wrap gap-3">
            {sets.deal_types.map((deal, index) => (
              <ButtonLink
                key={deal.code}
                href={listingsPath({ deal: deal.code })}
                size="lg"
                variant={index === 0 ? "accent" : "on-brand"}
                data-magnetic
              >
                Browse property {deal.label.toLowerCase()}
              </ButtonLink>
            ))}
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
          <HeroSearch options={searchOptions} className="mx-auto max-w-4xl" />
        </div>
      </Container>

      {newest.items.length > 0 && (
        <div data-reveal className="mt-10">
          <ListingTicker listings={newest.items.slice(0, 10)} />
        </div>
      )}

      {advertisers.length > 0 && (
        <Container className="pt-8">
          <div data-reveal className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
            <h2 className="shrink-0 font-sans text-sm font-semibold tracking-normal text-muted">
              Featured agencies
            </h2>
            <ul className="flex flex-wrap gap-3">
              {advertisers.map((profile) => (
                <li key={`${profile.kind}/${profile.slug}`}>
                  <Link
                    href={profilePath(profile)}
                    className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 transition-shadow hover:shadow-md"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 items-center justify-center rounded-sm bg-brand text-sm font-bold text-on-brand"
                    >
                      {initials(profile.name)}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{profile.name}</span>
                      <span className="block text-xs text-muted">
                        {plural(profile.listing_count, "listing", "listings")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      )}

      {newest.items.length > 0 ? (
        <Container className="pt-16 md:pt-20">
          <SectionHeading
            title="Just listed"
            note="The newest properties on the market."
            href="/listings"
            linkLabel="View all"
          />
          <div data-reveal className="mt-8">
            <ListingRail label="Just listed" listings={newest.items.slice(0, 8)} newIds={newIds} />
          </div>
        </Container>
      ) : (
        <Container className="pt-16 md:pt-20">
          <p className="rounded-lg border border-dashed border-line-strong p-10 text-center text-muted">
            No properties are listed yet. New listings appear here as soon as they are published.
          </p>
        </Container>
      )}

      {featured.length > 0 && (
        <div className="mt-16 md:mt-20">
          <ShowcaseScroll
            listings={featured}
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
      )}

      {dealRows.slice(0, 1).map(
        (row) =>
          row.listings.length > 0 && (
            <Container key={row.href} className="pt-16 md:pt-20">
              <SectionHeading title={row.title} href={row.href} linkLabel="View all" />
              <div data-reveal className="mt-8">
                <ListingRail label={row.title} listings={row.listings} newIds={newIds} />
              </div>
            </Container>
          ),
      )}

      {cities.length > 0 && (
        <section className="mt-16 border-y border-line bg-surface md:mt-20">
          <Container className="py-16 md:py-20">
            <SectionHeading title="Explore by city" note="See what is on the market where you want to live or work." />
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cities.map((city) => {
                // Cities without their own artwork borrow a photo from a listing there.
                const artwork = cityArtwork(city.code);
                const borrowed = coverPhoto(pool.find((listing) => listing.city.code === city.code)?.photos ?? []);
                return (
                  <li key={city.code}>
                    <Link
                      href={listingsPath({ city: city.code })}
                      data-reveal-clip
                      className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-lg bg-brand text-on-brand shadow-xs transition-shadow hover:shadow-lg"
                    >
                      {/* Decorative: the city is named in the link text. */}
                      {artwork ? (
                        <Image
                          src={artwork}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                          placeholder="blur"
                          className="object-cover transition-transform duration-700 ease-standard group-hover:scale-105"
                        />
                      ) : (
                        borrowed && (
                          <Image
                            src={borrowed.src}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                            placeholder={borrowed.bundled ? "blur" : "empty"}
                            unoptimized={!borrowed.bundled}
                            className="object-cover transition-transform duration-700 ease-standard group-hover:scale-105"
                          />
                        )
                      )}
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-linear-to-t from-brand-deep via-brand-deep/40 to-transparent"
                      />
                      <span className="relative flex w-full items-end justify-between gap-3 p-5">
                        <span>
                          <span className="flex items-center gap-1.5 text-xl font-bold">
                            <MapPin className="size-5 text-brand-accent" aria-hidden="true" />
                            {city.label}
                          </span>
                          <span className="mt-1 block text-sm opacity-90">
                            {plural(city.count, "property", "properties")}
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

            {suburbs.length > 0 && (
              <>
                <h3 data-reveal className="mt-12 text-lg">
                  Popular suburbs
                </h3>
                <ul data-reveal-group className="mt-4 flex flex-wrap gap-2">
                  {suburbs.map((suburb) => (
                    <li key={suburb.code}>
                      <Link
                        href={listingsPath({ suburb: suburb.code })}
                        className="frame-brand flex min-h-11 items-center gap-2 rounded-full border border-line bg-page px-4 text-sm font-medium text-ink transition-colors hover:bg-primary-soft"
                      >
                        {suburb.label}
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
                          {suburb.count}
                          <span className="sr-only"> {suburb.count === 1 ? "property" : "properties"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Container>
        </section>
      )}

      {dealRows.slice(1).map(
        (row) =>
          row.listings.length > 0 && (
            <Container key={row.href} className="pt-16 md:pt-20">
              <SectionHeading title={row.title} href={row.href} linkLabel="View all" />
              <div data-reveal className="mt-8">
                <ListingRail label={row.title} listings={row.listings} newIds={newIds} />
              </div>
            </Container>
          ),
      )}

      {otherRow.listings.length > 0 && (
        <Container className="pt-16 md:pt-20">
          <SectionHeading title={otherRow.title} />
          <div data-reveal className="mt-8">
            <ListingRail label={otherRow.title} listings={otherRow.listings} newIds={newIds} />
          </div>
        </Container>
      )}

      <section className="mt-16 border-y border-line bg-sunken md:mt-20">
        <Container className="py-16 md:py-20">
          <SectionHeading title="Browse by category" />
          <ul data-reveal-group className="mt-10 grid gap-4 md:grid-cols-3">
            {sets.property_categories.map((category) => {
              const Icon = categoryIcons[category.code] ?? Tag;
              // What the category covers: its property types, from the API.
              const types = sets.property_types
                .filter((type) => type.parent_code === category.code)
                .map((type) => type.label);
              return (
                <li key={category.code}>
                  <Link
                    href={listingsPath({ category: category.code })}
                    className="group frame-brand flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand transition-colors group-hover:bg-brand-accent group-hover:text-brand-deep">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{category.label}</span>
                      {types.length > 0 && (
                        <span className="block text-sm text-muted">{sentenceList(types)}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold tabular-nums text-primary-ink">
                      {facets.category.find((item) => item.code === category.code)?.count ?? 0}
                      <span className="sr-only"> properties</span>
                    </span>
                  </Link>
                </li>
              );
            })}
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
          {kinds.map((kind) => (
            <li key={kind.code}>
              <Link
                href={`/directory/${kind.code}`}
                className="group frame-brand flex h-full items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xl font-bold tabular-nums text-accent-ink">
                  {kind.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink group-hover:underline">{kind.label}</span>
                  <span className="block text-sm text-muted">{kind.description}</span>
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
              <li key={step.title} className="frame-brand rounded-lg border border-line bg-page p-6">
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
          className="frame-brand-light grid scroll-mt-24 overflow-hidden rounded-xl bg-brand text-on-brand lg:grid-cols-[1.2fr_1fr]"
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
