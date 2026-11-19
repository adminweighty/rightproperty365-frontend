import { BedDouble, Bath, CalendarClock, Check, ChevronRight, Info, MapPin, Ruler, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ApiBoundary } from "@/components/api-boundary";
import { ProfileAvatar } from "@/components/directory/profile-card";
import { ProfileEnquiryForm } from "@/components/directory/profile-enquiry-form";
import { VerifiedMark } from "@/components/listings/advertiser";
import { ListingGrid } from "@/components/listings/listing-card";
import { ListingMedia } from "@/components/listings/listing-media";
import { YouTubeTour } from "@/components/listings/youtube-tour";
import { ListingMap } from "@/components/map/maps";
import { Reveal } from "@/components/motion/reveal";
import { Stagger } from "@/components/motion/stagger";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDevelopment } from "@/lib/api/server/developments";
import { getSitemapEntries } from "@/lib/api/server/listings";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels, toOptions } from "@/lib/api/types";
import {
  availabilityText,
  bedroomsText,
  completionText,
  developmentJsonLd,
  developmentPath,
  developmentPlace,
  developmentsPath,
  developmentStatusLabel,
  developmentStatusTone,
  priceFromText,
  priceRangeText,
  sizeRangeText,
  type Development,
  type UnitType,
} from "@/lib/developments";
import { env } from "@/lib/env";
import { coverPhoto } from "@/lib/photos";
import { fullPlace } from "@/lib/places";
import { profilePath } from "@/lib/seo";

type Props = PageProps<"/developments/[market]/[slug]">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers and the content is in
// the HTML, visible without JavaScript.
export const instant = false;

const PRERENDER_LIMIT = 100;
/** Cache Components needs at least one param to build the route's shell. This is never a project. */
const SHELL_ONLY = [{ market: "not-prerendered", slug: "not-prerendered" }];

export async function generateStaticParams() {
  const entries = await readAtBuild(getSitemapEntries);
  const params = (entries?.developments ?? [])
    .slice(0, PRERENDER_LIMIT)
    .map(({ market, slug }) => ({ market: market.toLowerCase(), slug }));
  return params.length > 0 ? params : SHELL_ONLY;
}

const seoTitle = (development: Development) => {
  const place = developmentPlace(development.location);
  return `${development.name}: new development${place ? ` in ${place}` : ""}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, slug } = await params;
  const loaded = await load(() => getDevelopment(market, slug));
  if (!loaded.ok) return { title: "Development", robots: { index: false, follow: true } };
  if (!loaded.data) return { title: "Development not found", robots: { index: false, follow: true } };
  const development = loaded.data;
  const title = seoTitle(development);
  const price = priceFromText(development);
  const description = [development.summary, price, completionText(development.completion, development.status.code)]
    .filter(Boolean)
    .join(". ")
    .slice(0, 300);
  const path = developmentPath(development);
  const cover = coverPhoto(development.photos);
  // An upper-case address redirects to the lower-case one: only that one is indexed.
  if (market !== market.toLowerCase()) return { title, description, robots: { index: false, follow: true } };
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      type: "website",
      title,
      description,
      url: path,
      images: cover ? [{ url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }] : ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title, description, images: [cover?.url ?? "/opengraph-image"] },
  };
}

export default function DevelopmentPage({ params }: Props) {
  return (
    <Container className="py-8 md:py-12">
      <ApiBoundary fallback={<DevelopmentFallback />}>
        <DevelopmentContent params={params} />
      </ApiBoundary>
    </Container>
  );
}

function DevelopmentFallback() {
  return (
    <div aria-busy="true" aria-label="Loading development">
      <div className="h-5 w-56 rounded-sm bg-sunken" />
      <div className="mt-6 aspect-[16/9] rounded-xl bg-sunken md:aspect-[21/9]" />
      <div className="mt-8 h-10 max-w-md rounded-md bg-sunken" />
    </div>
  );
}

const factIcon = "size-4 shrink-0 text-primary-ink";

function UnitTypeCard({ unit, enquire }: { unit: UnitType; enquire: boolean }) {
  const bedrooms = bedroomsText(unit.bedrooms);
  const size = sizeRangeText(unit.size_m2);
  const availability = availabilityText(unit);
  return (
    <article className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 shadow-xs">
      <h4 className="font-sans text-base font-semibold tracking-normal text-ink">{unit.name}</h4>
      <p className="mt-1 font-display text-lg font-bold tabular-nums text-ink">{priceRangeText(unit.price)}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {bedrooms && (
          <li className="flex items-center gap-1.5">
            <BedDouble className={factIcon} aria-hidden="true" />
            {bedrooms}
          </li>
        )}
        {unit.bathrooms !== null && (
          <li className="flex items-center gap-1.5">
            <Bath className={factIcon} aria-hidden="true" />
            {unit.bathrooms === 1 ? "1 bathroom" : `${unit.bathrooms} bathrooms`}
          </li>
        )}
        {size && (
          <li className="flex items-center gap-1.5">
            <Ruler className={factIcon} aria-hidden="true" />
            {size}
          </li>
        )}
      </ul>
      {(availability || unit.available_listing_count > 0) && (
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-sm">
          {availability && <span className="text-ink">{availability}</span>}
          {unit.available_listing_count > 0 && enquire && (
            <Link href="#available-units" className="font-medium text-primary-ink hover:underline">
              {unit.available_listing_count === 1 ? "1 unit listed" : `${unit.available_listing_count} units listed`}
            </Link>
          )}
        </p>
      )}
    </article>
  );
}

async function DevelopmentContent({ params }: Pick<Props, "params">) {
  const { market, slug } = await params;
  if (!/^[a-z]{2}$/i.test(market)) notFound();
  if (market !== market.toLowerCase()) permanentRedirect(`/developments/${market.toLowerCase()}/${slug}`);
  const loaded = await load(async () => {
    const development = await getDevelopment(market, slug);
    return { development, catalogue: development ? await getCatalogue() : null };
  });
  if (!loaded.ok) {
    return <ErrorState title="We could not load this development." retryHref={`/developments/${market}/${slug}`} />;
  }
  const { development, catalogue } = loaded.data;
  if (!development || !catalogue) notFound();

  const [cover, ...morePhotos] = development.photos;
  const wholePlace = fullPlace(development.location);
  const completion = completionText(development.completion, development.status.code);
  const price = priceFromText(development);
  const coordinates = development.location.coordinates;
  const { developer, investment_highlights: highlights } = development;
  const listings = development.available_units.map((unit) => unit.listing);
  const unitTypeOptions = development.phases.flatMap((phase) =>
    phase.unit_types.map((unit) => ({
      value: unit.id,
      label: development.phases.length > 1 ? `${phase.name}: ${unit.name}` : unit.name,
    })),
  );
  const developerPath = profilePath(developer);

  return (
    <>
      <JsonLd data={developmentJsonLd(development, { site: env.siteUrl, api: env.apiUrl })} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/developments" className="hover:text-ink hover:underline">
              New developments
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href={developmentsPath({ market: development.market.code })} className="hover:text-ink hover:underline">
              {development.market.name}
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="min-w-0 break-words text-ink">
            {development.name}
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
              <ListingMedia photo={photo} sizes="(min-width: 768px) 280px, 50vw" className="aspect-[4/3] rounded-lg" />
            </li>
          ))}
        </Stagger>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone={developmentStatusTone(development.status.code)}>{developmentStatusLabel(development.status)}</Badge>
            <Badge>New development</Badge>
          </div>
          <h1 className="mt-4 break-words text-3xl md:text-4xl">{development.name}</h1>
          {wholePlace && (
            <p className="mt-3 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {wholePlace}
            </p>
          )}
          {completion && (
            <p className="mt-2 flex items-center gap-1.5 text-muted">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              {completion}
            </p>
          )}
          {price && <p className="mt-5 font-display text-3xl font-bold tabular-nums text-ink md:text-4xl">{price}</p>}
          {development.summary && <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink">{development.summary}</p>}

          {env.map && coordinates && (
            <section aria-labelledby="map-heading" className="mt-8 max-w-2xl">
              <h2 id="map-heading" className="sr-only">
                Location on the map
              </h2>
              <ListingMap location={coordinates} title={development.name} />
              {coordinates.precision === "APPROXIMATE" && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-ink">Approximate location.</span> The circle shows the area; the
                  developer has not published the exact position.
                </p>
              )}
            </section>
          )}

          {development.video && (
            <Reveal as="section" aria-labelledby="video-heading">
              <h2 id="video-heading" className="mt-10 text-2xl">
                Video tour
              </h2>
              <YouTubeTour video={development.video} title={development.name} className="mt-4" />
            </Reveal>
          )}

          {development.description && (
            <Reveal as="section" aria-labelledby="about-heading">
              <h2 id="about-heading" className="mt-10 text-2xl">
                About this development
              </h2>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-muted">{development.description}</p>
            </Reveal>
          )}

          {development.amenities.length > 0 && (
            <section aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="mt-10 text-2xl">
                Amenities
              </h2>
              <Stagger as="ul" stagger={0.03} className="mt-4 grid gap-3 sm:grid-cols-2">
                {development.amenities.map((amenity) => (
                  <li key={amenity.code} className="flex items-center gap-2.5 text-ink">
                    <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                    {amenity.label}
                  </li>
                ))}
              </Stagger>
            </section>
          )}

          {highlights.items.length > 0 && (
            <section aria-labelledby="highlights-heading" className="mt-10">
              <h2 id="highlights-heading" className="text-2xl">
                Investment highlights
              </h2>
              <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-ink" id="highlights-disclaimer">
                <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <span className="font-semibold">Stated by the developer — not financial advice.</span> {highlights.disclaimer}
                </span>
              </p>
              <dl aria-describedby="highlights-disclaimer" className="mt-4 grid gap-3 sm:grid-cols-2">
                {highlights.items.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-lg border border-line bg-surface p-4">
                    <dt className="text-sm text-muted">{item.label}</dt>
                    <dd className="mt-1 break-words font-semibold text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {development.phases.length > 0 && (
            <section aria-labelledby="phases-heading" className="mt-10">
              <h2 id="phases-heading" className="text-2xl">
                {development.phases.length === 1 ? "Unit types" : "Phases and unit types"}
              </h2>
              <ol className="mt-4 space-y-8">
                {development.phases.map((phase) => {
                  const phaseCompletion = completionText(phase.completion, phase.status.code);
                  return (
                    <li key={phase.id}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-sans text-lg font-semibold tracking-normal">{phase.name}</h3>
                        <Badge tone={developmentStatusTone(phase.status.code)}>{developmentStatusLabel(phase.status)}</Badge>
                        {phaseCompletion && <span className="text-sm text-muted">{phaseCompletion}</span>}
                      </div>
                      {phase.unit_types.length > 0 ? (
                        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                          {phase.unit_types.map((unit) => (
                            <li key={unit.id}>
                              <UnitTypeCard unit={unit} enquire={listings.length > 0} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted">The developer has not described the homes of this phase yet.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-sm text-muted">
                Prices and availability are the developer&rsquo;s and can change at any time. Ask them to confirm before
                you decide.
              </p>
            </section>
          )}
        </div>

        <Reveal as="aside" aria-labelledby="enquiry-heading">
          <Card className="lg:sticky lg:top-24">
            {/* The developer by name and profile only. No phone number, email address or street address anywhere. */}
            <section aria-labelledby="developer-heading" className="mb-6 border-b border-line pb-6">
              <h2 id="developer-heading" className="text-sm font-medium text-muted">
                Developer
              </h2>
              <div className="mt-3 flex items-center gap-4">
                <ProfileAvatar name={developer.name} logo={developer.logo} className="size-14 text-lg" />
                <div className="min-w-0">
                  <p className="break-words font-semibold text-ink">{developer.name}</p>
                  <VerifiedMark verified={developer.verified} />
                </div>
              </div>
              <ButtonLink href={developerPath} variant="secondary" className="mt-4 w-full">
                View the developer&rsquo;s profile
              </ButtonLink>
            </section>
            <h2 id="enquiry-heading" className="scroll-mt-24 text-2xl">
              Enquire about this development
            </h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
              <span>
                Developers&rsquo; phone numbers and email addresses are not shown on RightProperty365. Your enquiry goes
                to {developer.name} in the app and they reply to you.
              </span>
            </p>
            <div className="mt-6">
              <ProfileEnquiryForm
                kind={developer.kind}
                slug={developer.slug}
                name={developer.name}
                services={[]}
                contactMethods={toOptions(catalogue.sets.contact_methods)}
                development={{ market: development.market.code, slug: development.slug }}
                unitTypes={unitTypeOptions}
              />
            </div>
          </Card>
        </Reveal>
      </div>

      {listings.length > 0 && (
        <section id="available-units" aria-labelledby="units-heading" className="mt-16 scroll-mt-24 border-t border-line pt-12">
          <Reveal>
            <h2 id="units-heading" className="text-2xl md:text-3xl">
              Available units
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              Homes in {development.name} listed for sale or to rent, each with its own page and enquiry.
            </p>
          </Reveal>
          <div className="mt-8">
            <ListingGrid listings={listings} periods={toLabels(catalogue.sets.price_periods)} />
          </div>
        </section>
      )}
    </>
  );
}
