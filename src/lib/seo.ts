import {
  categoryLabels,
  dealLabels,
  listingExpiresAt,
  type Category,
  type DealType,
  type Listing,
} from "@/lib/data/listings";
import { activeMarket } from "@/lib/data/markets";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";

/**
 * SEO helpers for the public pages. The indexing policy they implement is
 * documented in docs/seo.md; change both together.
 */

export const SITE_NAME = "RightProperty365";

export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---- Listing search (/listings) -------------------------------------------

const deals: DealType[] = ["sale", "rent"];
const categories: Category[] = ["residential", "commercial", "land"];
const facetParams = new Set(["deal", "category", "q"]);

export type ListingsFacet = {
  deal?: DealType;
  category?: Category;
  q?: string;
  /** /listings with deal then category, the only parameter order we canonicalise to. */
  canonicalPath: string;
  /** False for free-text search and unknown or invalid parameters. */
  curated: boolean;
  heading: string;
  description: string;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function listingsPath(deal?: DealType, category?: Category): string {
  const query = new URLSearchParams();
  if (deal) query.set("deal", deal);
  if (category) query.set("category", category);
  const text = query.toString();
  return text ? `/listings?${text}` : "/listings";
}

export function facetHeading(deal?: DealType, category?: Category): string {
  const noun = category === "land" ? "Land" : category ? `${categoryLabels[category]} property` : "Property";
  const place = `in ${activeMarket.name}`;
  if (deal) return `${noun} ${dealLabels[deal].toLowerCase()} ${place}`;
  return category ? `${noun} ${place}` : `${noun} for sale and to rent ${place}`;
}

/** Reads the search parameters into a facet and decides whether it may be indexed. */
export function parseListingsFacet(params: RawParams): ListingsFacet {
  const rawDeal = first(params.deal) || undefined;
  const rawCategory = first(params.category) || undefined;
  const q = first(params.q)?.trim() || undefined;

  const deal = deals.find((value) => value === rawDeal);
  const category = categories.find((value) => value === rawCategory);

  const hasUnknownParam = Object.entries(params).some(
    ([key, value]) => !facetParams.has(key) && first(value),
  );
  const hasInvalidValue = (rawDeal && !deal) || (rawCategory && !category);
  const heading = facetHeading(deal, category);

  return {
    deal,
    category,
    q,
    canonicalPath: listingsPath(deal, category),
    curated: !q && !hasUnknownParam && !hasInvalidValue,
    heading: q ? `${heading} matching "${q}"` : heading,
    description: `Browse ${heading.charAt(0).toLowerCase()}${heading.slice(1)} from verified agents and owners. Send an enquiry and track it until you get a reply.`,
  };
}

/** Every deal and category combination, for the sitemap and internal links. */
export function curatedFacets(): { deal?: DealType; category?: Category }[] {
  return [
    {},
    ...deals.map((deal) => ({ deal })),
    ...categories.map((category) => ({ category })),
    ...deals.flatMap((deal) => categories.map((category) => ({ deal, category }))),
  ];
}

// ---- Listing detail --------------------------------------------------------

export function listingPath(listing: Listing): string {
  return `/listings/${listing.slug}`;
}

export function listingSeoTitle(listing: Listing): string {
  return `${listing.title} ${dealLabels[listing.deal].toLowerCase()} in ${listing.suburb}, ${listing.city}`;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function listingSeoDescription(listing: Listing): string {
  const price = `${formatMoney(listing.price)}${listing.pricePeriod ? " per month" : ""}`;
  const facts = [
    listing.bedrooms !== undefined && plural(listing.bedrooms, "bedroom"),
    listing.bathrooms !== undefined && plural(listing.bathrooms, "bathroom"),
  ]
    .filter(Boolean)
    .join(", ");
  return `${listing.propertyType} ${dealLabels[listing.deal].toLowerCase()} in ${listing.suburb}, ${listing.city} for ${price}${facts ? `. ${facts}` : ""}. ${listing.summary}`;
}

// ---- JSON-LD ---------------------------------------------------------------
// Google shows no rich result for real-estate listings; this markup is for
// machine understanding. Breadcrumb and Organization are supported features.

type JsonLd = Record<string, unknown>;
type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/app-icon-512x512.png"),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    alternateName: "rightproperty365.com",
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

const squareMetres = (value: number) => ({ "@type": "QuantitativeValue", value, unitCode: "MTK" });

/** The property itself. Accommodation types only for homes; Place otherwise. */
function propertyJsonLd(listing: Listing): JsonLd {
  const address = {
    "@type": "PostalAddress",
    addressLocality: `${listing.suburb}, ${listing.city}`,
    addressCountry: listing.marketCode,
  };
  const base = { name: listing.title, description: listing.description, address };

  if (listing.category === "residential") {
    return {
      "@type": listing.propertyType === "Apartment" ? "Apartment" : "House",
      ...base,
      ...(listing.bedrooms !== undefined && { numberOfBedrooms: listing.bedrooms }),
      ...(listing.bathrooms !== undefined && { numberOfBathroomsTotal: listing.bathrooms }),
      ...(listing.floorArea !== undefined && { floorSize: squareMetres(listing.floorArea) }),
      amenityFeature: listing.features.map((name) => ({
        "@type": "LocationFeatureSpecification",
        name,
        value: true,
      })),
    };
  }

  const sizes = [
    listing.floorArea !== undefined && { name: "Floor size", value: listing.floorArea },
    listing.landArea !== undefined && { name: "Land size", value: listing.landArea },
  ].filter((size): size is { name: string; value: number } => Boolean(size));

  return {
    "@type": "Place",
    ...base,
    additionalProperty: sizes.map((size) => ({ "@type": "PropertyValue", ...size, unitCode: "MTK" })),
  };
}

function offerJsonLd(listing: Listing): JsonLd {
  const price = Number(listing.price.amount);
  const isRental = listing.deal === "rent";
  return {
    "@type": "Offer",
    url: absoluteUrl(listingPath(listing)),
    businessFunction: `http://purl.org/goodrelations/v1#${isRental ? "LeaseOut" : "Sell"}`,
    availability: "https://schema.org/InStock",
    validThrough: listingExpiresAt(listing),
    ...(isRental
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price,
            priceCurrency: listing.price.currency,
            unitCode: "MON",
            unitText: "month",
          },
        }
      : { price, priceCurrency: listing.price.currency }),
    ...(listing.advertiser.kind === "agency" && {
      offeredBy: { "@type": "RealEstateAgent", name: listing.advertiser.name },
    }),
  };
}

export function listingJsonLd(listing: Listing): JsonLd {
  const url = absoluteUrl(listingPath(listing));
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: listingSeoTitle(listing),
    description: listing.summary,
    datePosted: listing.publishedAt,
    image: [absoluteUrl(listing.image.src.src)],
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Listings", path: "/listings" },
      { name: dealLabels[listing.deal], path: listingsPath(listing.deal) },
      { name: listing.title, path: listingPath(listing) },
    ]),
    mainEntity: propertyJsonLd(listing),
    offers: offerJsonLd(listing),
  };
}

export function listingsCollectionJsonLd(facet: ListingsFacet, results: Listing[]): JsonLd {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Listings", path: "/listings" },
  ];
  if (facet.deal) crumbs.push({ name: dealLabels[facet.deal], path: listingsPath(facet.deal) });
  if (facet.category) {
    crumbs.push({ name: categoryLabels[facet.category], path: facet.canonicalPath });
  }

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl(facet.canonicalPath),
    name: facet.heading,
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd(crumbs),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: results.length,
      itemListElement: results.map((listing, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(listingPath(listing)),
        name: listing.title,
      })),
    },
  };
}
