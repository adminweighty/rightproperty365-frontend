import { Check, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StayCalendar, StayProvider } from "@/components/availability/stay-calendar";
import { AdvertiserBlock, AdvertiserCompact } from "@/components/listings/advertiser";
import { ListingFacts, ListingGrid, ListingPrice } from "@/components/listings/listing-card";
import { ListingMedia } from "@/components/listings/listing-media";
import { SaveListingButton } from "@/components/listings/save-listing-button";
import { ListingViewBeacon } from "@/components/analytics/analytics-root";
import { YouTubeTour } from "@/components/listings/youtube-tour";
import { Reveal } from "@/components/motion/reveal";
import { Stagger } from "@/components/motion/stagger";
import { PropertyRequestForm } from "@/components/requests/property-request-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { JsonLd } from "@/components/seo/json-ld";
import { getListing, getListingAvailability, getSitemapEntries, listListings } from "@/lib/api/server/listings";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels, toOptions, type Listing } from "@/lib/api/types";
import { toStayCalendarData, type StayCalendarData } from "@/lib/stay-calendar";
import { coverPhoto } from "@/lib/photos";
import { fullPlace, narrowestPlace } from "@/lib/places";
import {
  listingJsonLd,
  listingPath,
  listingSeoDescription,
  listingSeoTitle,
  listingsPath,
  SHORT_STAY,
} from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";
import { ListingMap } from "@/components/map/maps";
import { env } from "@/lib/env";

type Props = PageProps<"/listings/[slug]">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers. That keeps the content
// in the HTML, visible without JavaScript.
export const instant = false;

/** Newest listings prerendered at build; the rest are rendered on first visit and then cached. */
const PRERENDER_LIMIT = 100;
/** Cache Components needs at least one param to build the route's shell. This slug is never a listing. */
const SHELL_ONLY = [{ slug: "not-prerendered" }];

// When the API is not reachable during the build (CI), nothing is prerendered
// and every listing is rendered on its first request instead.
export async function generateStaticParams() {
  const entries = await readAtBuild(getSitemapEntries);
  const params = (entries?.listings ?? []).slice(0, PRERENDER_LIMIT).map(({ slug }) => ({ slug }));
  return params.length > 0 ? params : SHELL_ONLY;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await load(() => getListing(slug));
  if (!loaded.ok) return { title: "Listing", robots: { index: false, follow: true } };
  if (loaded.data.status === "gone") {
    return { title: "This listing is no longer available", robots: { index: false, follow: true } };
  }
  if (loaded.data.status === "missing") {
    return { title: "Listing not found", robots: { index: false, follow: true } };
  }

  const { listing } = loaded.data;
  const title = listingSeoTitle(listing);
  const description = listingSeoDescription(listing);
  const cover = coverPhoto(listing.photos);

  return {
    title,
    description,
    alternates: { canonical: listingPath(listing) },
    // Tells search engines to drop the page when the 90-day publication ends.
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      unavailable_after: listing.expires_at,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: listingPath(listing),
      images: cover
        ? [{ url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }]
        : ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [cover?.url ?? "/opengraph-image"],
    },
  };
}

// `params` is awaited inside an ApiBoundary, not a <Suspense>: see `instant`
// above. A slug that was not prerendered is rendered on its first request.
export default function ListingPage({ params }: Props) {
  return (
    <Container className="py-8 md:py-12">
      <ApiBoundary fallback={<ListingFallback />}>
        <ListingContent params={params} />
      </ApiBoundary>
    </Container>
  );
}

function ListingFallback() {
  return (
    <div aria-busy="true" aria-label="Loading listing">
      <div className="h-5 w-56 rounded-sm bg-sunken" />
      <div className="mt-6 aspect-[16/9] rounded-xl bg-sunken md:aspect-[21/9]" />
      <div className="mt-8 h-10 max-w-md rounded-md bg-sunken" />
    </div>
  );
}

/** The listing was public once and is not any more (expired, sold, let or paused). */
function ListingGone() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-3xl md:text-4xl">This listing is no longer available</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        It has been sold or let, or its 90-day publication has ended. Enquiries can no longer be
        sent for it. Current listings are a search away.
      </p>
      <ButtonLink href="/listings" className="mt-8">
        Browse current listings
      </ButtonLink>
    </div>
  );
}

/**
 * Related listings: same city first, then same category. Internal links like
 * these are how crawlers and people move between listings.
 */
async function similarListings(listing: Listing): Promise<Listing[]> {
  // A city written as free text has no code to search by: its country stands in.
  const nearby = listing.city?.code ? { city: listing.city.code } : { country: listing.country?.code };
  const [sameCity, sameCategory] = await Promise.all([
    listListings({ ...nearby, page_size: 4 }),
    listListings({ category: listing.category.code, page_size: 4 }),
  ]);
  const seen = new Set([listing.id]);
  return [...(sameCity?.items ?? []), ...(sameCategory?.items ?? [])]
    .filter((other) => !seen.has(other.id) && seen.add(other.id))
    .slice(0, 3);
}

/**
 * On a short stay, the calendar and the request form share the dates being
 * chosen. Any other listing has no stay to choose.
 */
function StayScope({ calendar, children }: { calendar: StayCalendarData | null; children: ReactNode }) {
  return calendar ? <StayProvider calendar={calendar}>{children}</StayProvider> : children;
}

async function ListingContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const loaded = await load(async () => {
    const lookup = await getListing(slug);
    if (lookup.status !== "found") return { lookup, catalogue: undefined, similar: [], availability: null };
    const [catalogue, similar, availability] = await Promise.all([
      getCatalogue(),
      similarListings(lookup.listing),
      // Only a short stay has a calendar.
      lookup.listing.category.code === SHORT_STAY ? getListingAvailability(slug) : null,
    ]);
    return { lookup, catalogue, similar, availability };
  });

  if (!loaded.ok) {
    return <ErrorState title="We could not load this listing." retryHref={`/listings/${slug}`} />;
  }
  const { lookup, catalogue, similar, availability } = loaded.data;
  if (lookup.status === "gone") return <ListingGone />;
  if (lookup.status === "missing" || !catalogue) notFound();

  const { listing } = lookup;
  const { advertiser } = listing;
  const [cover, ...morePhotos] = listing.photos;
  const place = fullPlace(listing);
  const periods = toLabels(catalogue.sets.price_periods);
  const calendar = availability ? toStayCalendarData(availability) : null;

  return (
    <>
      <JsonLd data={listingJsonLd(listing)} />
      {/* Counts one view per page view in the browser; renders nothing, so the page stays cached. */}
      <ListingViewBeacon listingId={listing.id} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/listings" className="hover:text-ink hover:underline">
              Listings
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link
              href={listingsPath({ deal: listing.deal.code })}
              className="hover:text-ink hover:underline"
            >
              {listing.deal.label}
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {narrowestPlace(listing) || listing.title}
          </li>
        </ol>
      </nav>

      <ListingMedia
        photo={cover}
        sizes="(min-width: 1280px) 1136px, 100vw"
        priority
        settle
        className="mt-6 aspect-[16/9] rounded-xl md:aspect-[21/9]"
      />
      {morePhotos.length > 0 && (
        <Stagger as="ul" from="scale" aria-label="More photos" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {morePhotos.map((photo) => (
            <li key={photo.url}>
              <ListingMedia
                photo={photo}
                sizes="(min-width: 768px) 280px, 50vw"
                className="aspect-[4/3] rounded-lg"
              />
            </li>
          ))}
        </Stagger>
      )}

      <StayScope calendar={calendar}>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{listing.deal.label}</Badge>
            <Badge>{listing.category.label}</Badge>
            <Badge>{listing.property_type.label}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <h1 className="min-w-0 text-3xl md:text-4xl">{listing.title}</h1>
            {/* Filled in by the browser for the signed-in person; the page itself stays the same for everyone. */}
            <SaveListingButton listingId={listing.id} title={listing.title} variant="inline" />
          </div>
          {/* Suburb, city, region (unless it has the city's name) and country: whichever the listing names. */}
          {place && (
            <p className="mt-3 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {place}
            </p>
          )}
          {/* A client island that loads when it nears the screen; the page itself stays the same for everyone. */}
          {env.map && listing.location && (
            <section aria-labelledby="map-heading" className="mt-4 max-w-2xl">
              <h2 id="map-heading" className="sr-only">
                Location on the map
              </h2>
              <ListingMap location={listing.location} title={listing.title} />
              {listing.location.precision === "APPROXIMATE" && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-ink">Approximate location.</span> The circle shows the area; the
                  advertiser has not published the exact position.
                </p>
              )}
            </section>
          )}
          {/* On a phone the side panel is far below: say who advertises it here as well. */}
          <AdvertiserCompact advertiser={advertiser} className="mt-4 lg:hidden" />
          <ListingPrice listing={listing} periods={periods} className="mt-6 text-4xl" />
          <Reveal className="mt-6 border-y border-line py-4">
            <ListingFacts listing={listing} />
          </Reveal>

          {listing.video && (
            // A client island that renders the same poster for everyone: the page stays cached.
            <Reveal as="section" aria-labelledby="video-heading">
              <h2 id="video-heading" className="mt-10 text-2xl">
                Video tour
              </h2>
              <YouTubeTour video={listing.video} title={listing.title} listingId={listing.id} className="mt-4" />
            </Reveal>
          )}

          <Reveal>
            <h2 className="mt-10 text-2xl">About this property</h2>
            <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-muted">
              {listing.description}
            </p>
          </Reveal>

          {listing.features.length > 0 && (
            <>
              <h2 className="mt-10 text-2xl">Features</h2>
              <Stagger as="ul" stagger={0.03} className="mt-4 grid gap-3 sm:grid-cols-2">
                {listing.features.map((feature) => (
                  <li key={feature.code} className="flex items-center gap-2.5 text-ink">
                    <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                    {feature.label}
                  </li>
                ))}
              </Stagger>
            </>
          )}

          {calendar && (
            <Reveal>
              <StayCalendar
                listingTitle={listing.title}
                nextAvailable={listing.availability?.next_available ?? null}
                formId="contact-heading"
              />
            </Reveal>
          )}

          <p className="mt-10 text-sm text-subtle">Listing reference {listing.reference}</p>
        </div>

        <Reveal as="aside" aria-labelledby="contact-heading">
          <Card className="lg:sticky lg:top-24">
            {/* Names and profile links only. Phone numbers and email addresses are never shown. */}
            <section aria-labelledby="advertiser-heading" className="mb-6 border-b border-line pb-6">
              <AdvertiserBlock advertiser={advertiser} verification={listing.verification} headingId="advertiser-heading" />
            </section>
            <h2 id="contact-heading" className="scroll-mt-24 text-2xl">
              {calendar ? "Ask the host" : `Contact the ${advertiser.type === "agency" ? "agent" : "seller"}`}
            </h2>
            <div className="mt-6">
              <PropertyRequestForm
                listingId={listing.id}
                listingReference={listing.reference}
                advertiserName={advertiser.name}
                requestTypes={toOptions(catalogue.sets.request_types)}
                contactMethods={toOptions(catalogue.sets.contact_methods)}
                nightlyPrice={calendar && listing.price_period === "night" ? listing.price : undefined}
              />
            </div>
          </Card>
        </Reveal>
      </div>
      </StayScope>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-16 border-t border-line pt-12">
          <Reveal>
            <h2 id="similar-heading" className="text-2xl md:text-3xl">
              Similar properties
            </h2>
          </Reveal>
          <div className="mt-8">
            <ListingGrid listings={similar} periods={periods} placement="similar" />
          </div>
        </section>
      )}
    </>
  );
}
