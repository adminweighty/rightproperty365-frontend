import { BadgeCheck, Check, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingFacts, ListingGrid, ListingPrice } from "@/components/listings/listing-card";
import { ListingMedia } from "@/components/listings/listing-media";
import { PropertyRequestForm } from "@/components/requests/property-request-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/seo/json-ld";
import {
  categoryLabels,
  dealLabels,
  getListingBySlug,
  listingExpiresAt,
  listings,
} from "@/lib/data/listings";
import { listingJsonLd, listingPath, listingSeoDescription, listingSeoTitle } from "@/lib/seo";

type Props = PageProps<"/listings/[slug]">;

// Known listings are prerendered. Once listings come from the API this list
// becomes the published set and unknown slugs resolve at request time.
export function generateStaticParams() {
  return listings.map((listing) => ({ slug: listing.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) return { title: "Listing not found", robots: { index: false, follow: true } };

  const title = listingSeoTitle(listing);
  const description = listingSeoDescription(listing);
  const { src, width, height } = listing.image.src;

  return {
    title,
    description,
    alternates: { canonical: listingPath(listing) },
    // Tells search engines to drop the page when the 90-day publication ends.
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      unavailable_after: listingExpiresAt(listing),
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: listingPath(listing),
      images: [{ url: src, width, height, alt: listing.image.alt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [src] },
  };
}

// `params` is awaited inside Suspense so the route keeps an instant app shell
// for slugs that were not prerendered.
export default function ListingPage({ params }: Props) {
  return (
    <Container className="py-8 md:py-12">
      <Suspense fallback={<ListingFallback />}>
        <ListingContent params={params} />
      </Suspense>
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

async function ListingContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const listing = getListingBySlug(slug);
  if (!listing) notFound();

  // Related listings: same city first, then same category. Internal links
  // like these are how crawlers and people move between listings.
  const similar = listings
    .filter((other) => other.id !== listing.id)
    .filter((other) => other.city === listing.city || other.category === listing.category)
    .sort((a, b) => Number(b.city === listing.city) - Number(a.city === listing.city))
    .slice(0, 3);

  return (
    <>
      <JsonLd data={listingJsonLd(listing)} />
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
            <Link href={`/listings?deal=${listing.deal}`} className="hover:text-ink hover:underline">
              {dealLabels[listing.deal]}
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {listing.suburb}
          </li>
        </ol>
      </nav>

      <ListingMedia
        image={listing.image}
        sizes="(min-width: 1280px) 1136px, 100vw"
        priority
        className="mt-6 aspect-[16/9] rounded-xl md:aspect-[21/9]"
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{dealLabels[listing.deal]}</Badge>
            <Badge>{categoryLabels[listing.category]}</Badge>
            <Badge>{listing.propertyType}</Badge>
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl">{listing.title}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {listing.suburb}, {listing.city}
          </p>
          <ListingPrice listing={listing} className="mt-6 text-4xl" />
          <div className="mt-6 border-y border-line py-4">
            <ListingFacts listing={listing} />
          </div>

          <h2 className="mt-10 text-2xl">About this property</h2>
          <p className="mt-3 max-w-prose leading-relaxed text-muted">{listing.description}</p>

          <h2 className="mt-10 text-2xl">Features</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {listing.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-ink">
                <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-sm text-subtle">Listing reference {listing.reference}</p>
        </div>

        <aside aria-labelledby="contact-heading">
          <Card className="lg:sticky lg:top-24">
            <h2 id="contact-heading" className="text-2xl">
              Contact the {listing.advertiser.kind === "agency" ? "agent" : "seller"}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <span className="font-semibold text-ink">{listing.listedBy}</span>
              <span aria-hidden="true">·</span>
              {listing.advertiser.name}
              {listing.advertiser.verified && (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  Verified
                </Badge>
              )}
            </p>
            <div className="mt-6">
              <PropertyRequestForm
                listingId={listing.id}
                listingReference={listing.reference}
                advertiserName={listing.advertiser.name}
              />
            </div>
          </Card>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-16 border-t border-line pt-12">
          <h2 id="similar-heading" className="text-2xl md:text-3xl">
            Similar properties
          </h2>
          <div className="mt-8">
            <ListingGrid listings={similar} />
          </div>
        </section>
      )}
    </>
  );
}
