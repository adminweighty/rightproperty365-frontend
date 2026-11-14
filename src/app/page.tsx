import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  House,
  LandPlot,
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
import { Suspense, type ReactNode } from "react";
import agentsPhoto from "@/assets/images/agents.jpg";
import { ProfileGrid } from "@/components/directory/profile-card";
import { PhotoTile, PhotoTileRow } from "@/components/landing/photo-tile";
import { SectionHeading } from "@/components/landing/section-heading";
import { HeroSearch } from "@/components/listings/hero-search";
import { ListingGrid } from "@/components/listings/listing-card";
import { ListingRail } from "@/components/listings/listing-rail";
import { JsonLd } from "@/components/seo/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { listListings } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import type { FacetCount, Listing } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { cityArtwork, coverPhoto } from "@/lib/photos";
import { buildSearchOptions } from "@/lib/search-options";
import { listingsHeading, listingsPath, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

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

const professionalTools = [
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
    .slice(0, 3);

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

/**
 * The hero frame: a wide photograph with a white panel centred on it. The
 * panel holds the page's `h1` and the search, so the text is always on white.
 * Used for the loaded page and for its loading state, so nothing moves when
 * the content arrives.
 */
function Hero({
  photo,
  eyebrow,
  caption,
  children,
  busy,
}: {
  /** The backdrop. Decorative: the property is named in `caption`. */
  photo?: ReactNode;
  eyebrow: string;
  caption?: ReactNode;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      aria-busy={busy}
      aria-label={busy ? "Loading the home page" : undefined}
      className="relative isolate overflow-hidden border-b border-line bg-sunken"
    >
      {photo}
      <Container className="flex justify-center pb-8 pt-40 sm:pt-48 md:items-center md:py-16 lg:min-h-[40rem]">
        <div className="w-full max-w-3xl rounded-xl bg-surface p-5 text-center shadow-lg sm:p-8 md:p-10">
          <span aria-hidden="true" className="rule-brand mx-auto block w-12" />
          <p className="mt-4 text-sm font-semibold text-primary-ink">
            <BadgeCheck className="mr-1.5 inline size-4 align-[-0.2em]" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Find the <span className="mark-brand">right property</span> any day of the year
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted md:text-lg">
            Homes, commercial space and land from agents and owners we have checked. Send one
            enquiry and follow it until you get an answer.
          </p>
          {children}
        </div>
      </Container>
      {caption}
    </section>
  );
}

/** The hero while the page loads: same frame, same heading, an empty search of the same height. */
function HomeFallback() {
  return (
    <Hero eyebrow="Verified property" busy>
      <div className="mt-6 h-[24.25rem] rounded-lg bg-sunken sm:h-[13.75rem] lg:h-[10.25rem]" />
    </Hero>
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
  // A featured listing lends the hero its photograph; without one, the newest does.
  const heroListing = [...featured, ...newest.items].find((listing) => listing.photos.length > 0);
  const heroPhoto = heroListing && coverPhoto(heroListing.photos);
  // Every listing loaded for this page, to lend a photo to a city without artwork.
  const pool: Listing[] = [...newest.items, ...featured, ...dealRows.flatMap((row) => row.listings), ...otherRow.listings];

  const stats = [
    { value: newest.total, label: "properties listed" },
    { value: cities.length, label: "cities and towns" },
    { value: kinds.reduce((sum, kind) => sum + kind.count, 0), label: "professionals and businesses" },
  ];

  return (
    <>
      <Hero
        eyebrow={`Verified property${market ? ` across ${market.name}` : ""}`}
        photo={
          heroPhoto && (
            <Image
              src={heroPhoto.src}
              alt=""
              fill
              sizes="100vw"
              placeholder={heroPhoto.bundled ? "blur" : "empty"}
              unoptimized={!heroPhoto.bundled}
              loading="eager"
              fetchPriority="high"
              className="-z-10 object-cover"
            />
          )
        }
        caption={
          heroListing && (
            <Link
              href={`/listings/${heroListing.slug}`}
              className="absolute bottom-4 right-4 hidden max-w-xs rounded-md bg-surface px-3 py-2 text-sm shadow-md hover:underline xl:block"
            >
              <span className="block font-semibold text-ink">
                {formatMoney(heroListing.price)}
                {heroListing.price_period === "month" && <span className="font-normal text-muted"> per month</span>}
              </span>
              <span className="block truncate text-muted">
                {heroListing.title}, {heroListing.suburb.label}
              </span>
            </Link>
          )
        }
      >
        <HeroSearch options={searchOptions} className="mt-6" />
      </Hero>

      {/* Trust strip: three counts from the API. */}
      <section aria-label="RightProperty365 in numbers" className="border-b border-line">
        <Container>
          <dl className="grid grid-cols-3 divide-x divide-line py-6 text-center md:py-8">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse px-2">
                <dt className="mt-1 text-sm text-muted">{stat.label}</dt>
                <dd className="text-2xl font-bold tabular-nums text-ink md:text-4xl">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {newest.items.length > 0 ? (
        <Container className="pt-14 md:pt-20">
          <SectionHeading
            title="New listings"
            note="The newest properties on the market."
            href="/listings"
            linkLabel="View all"
          />
          <ListingRail label="New listings" listings={newest.items.slice(0, 8)} newIds={newIds} className="mt-8" />
        </Container>
      ) : (
        <Container className="pt-14 md:pt-20">
          <p className="rounded-lg border border-dashed border-line-strong p-10 text-center text-muted">
            No properties are listed yet. New listings appear here as soon as they are published.
          </p>
        </Container>
      )}

      {featured.length > 0 && (
        <section className="mt-14 border-y border-line bg-soft md:mt-20">
          <Container className="py-14 md:py-20">
            <SectionHeading
              title="Featured homes"
              note="Properties our agencies have chosen to put forward this week."
            />
            <div className="mt-8">
              <ListingGrid listings={featured.slice(0, 6)} />
            </div>
          </Container>
        </section>
      )}

      {cities.length > 0 && (
        <Container className="pt-14 md:pt-20">
          <SectionHeading title="Explore by city" note="See what is on the market where you want to live or work." />
          <PhotoTileRow className="mt-8">
            {cities.map((city) => {
              // Cities without their own artwork borrow a photo from a listing there.
              const artwork = cityArtwork(city.code);
              const borrowed = coverPhoto(pool.find((listing) => listing.city.code === city.code)?.photos ?? []);
              return (
                <PhotoTile
                  key={city.code}
                  href={listingsPath({ city: city.code })}
                  title={city.label}
                  count={plural(city.count, "property", "properties")}
                  photo={artwork ? { src: artwork, bundled: true } : borrowed}
                />
              );
            })}
          </PhotoTileRow>

          {suburbs.length > 0 && (
            <>
              <h3 className="mt-10 text-lg">Popular suburbs</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {suburbs.map((suburb) => (
                  <li key={suburb.code}>
                    <Link
                      href={listingsPath({ suburb: suburb.code })}
                      className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
                    >
                      {suburb.label}
                      <span className="tabular-nums text-muted">
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
      )}

      {dealRows.map(
        (row) =>
          row.listings.length > 0 && (
            <Container key={row.href} className="pt-14 md:pt-20">
              <SectionHeading title={row.title} href={row.href} linkLabel="View all" />
              <ListingRail label={row.title} listings={row.listings} newIds={newIds} className="mt-8" />
            </Container>
          ),
      )}

      {otherRow.listings.length > 0 && (
        <Container className="pt-14 md:pt-20">
          <SectionHeading title={otherRow.title} />
          <ListingRail label={otherRow.title} listings={otherRow.listings} newIds={newIds} className="mt-8" />
        </Container>
      )}

      <section className="mt-14 border-y border-line bg-soft md:mt-20">
        <Container className="py-14 md:py-20">
          <SectionHeading title="Browse by category" />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
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
                    className="group frame-brand flex h-full items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink group-hover:underline">{category.label}</span>
                      {types.length > 0 && <span className="block text-sm text-muted">{sentenceList(types)}</span>}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-ink">
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

      <Container className="pt-14 md:pt-20">
        {advertisers.length > 0 && (
          <>
            <SectionHeading
              title="Agencies with the most listings"
              note="The businesses marketing the most property on RightProperty365 today."
              href="/directory/agencies"
              linkLabel="All agencies"
            />
            <div className="mt-8">
              <ProfileGrid profiles={advertisers} />
            </div>
          </>
        )}

        <SectionHeading
          title="Find a professional"
          note="Agents, developers, property managers, hosts and the services around a move."
          href="/directory"
          linkLabel="Open the directory"
          className={advertisers.length > 0 ? "mt-14 md:mt-20" : undefined}
        />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kinds.map((kind) => (
            <li key={kind.code}>
              <Link
                href={`/directory/${kind.code}`}
                className="group frame-brand flex h-full items-start gap-4 rounded-lg border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <span className="min-w-10 text-3xl font-bold tabular-nums text-primary-ink">{kind.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink group-hover:underline">{kind.label}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{kind.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <section className="mt-14 border-y border-line bg-tint md:mt-20">
        <Container className="py-14 md:py-20">
          <SectionHeading title="How it works" note="Three steps, and you always know where your enquiry stands." />
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-line bg-surface p-6 shadow-xs">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full border-2 border-line-accent text-lg font-bold text-primary-ink"
                >
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>

          <ul className="mt-12 grid gap-8 md:grid-cols-3">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-1 size-6 shrink-0 text-primary-ink" aria-hidden="true" />
                <div>
                  <h3 className="text-lg">{title}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="pt-14 md:pt-20">
        <section
          id="for-professionals"
          aria-labelledby="for-professionals-heading"
          className="grid overflow-hidden rounded-xl border border-line bg-surface shadow-sm lg:grid-cols-[1.15fr_1fr]"
        >
          <div className="p-6 md:p-12">
            <span aria-hidden="true" className="rule-brand block w-12" />
            <p className="mt-4 text-sm font-semibold text-primary-ink">
              For agents, landlords, developers and service providers
            </p>
            <h2 id="for-professionals-heading" className="mt-2 max-w-xl text-3xl md:text-4xl">
              More than an advert. The tools to run the deal.
            </h2>
            <ul className="mt-8 space-y-6">
              {professionalTools.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="mt-1 block leading-relaxed text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/register" size="lg" className="mt-10">
              Register as a professional
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Choose how you work with property when you create the account. Listing and agency
              roles are switched on after we have checked who you are.
            </p>
          </div>
          <div className="relative aspect-[16/9] lg:aspect-auto">
            <Image
              src={agentsPhoto}
              alt="Glass-walled corridor in a modern office"
              fill
              sizes="(min-width: 1024px) 520px, 100vw"
              placeholder="blur"
              className="object-cover"
            />
          </div>
        </section>
      </Container>
    </>
  );
}
