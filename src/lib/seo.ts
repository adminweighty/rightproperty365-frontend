import type {
  DirectoryKindInfo,
  DirectoryProfile,
  Listing,
  ListingQuery,
  ListingSort,
  Market,
  ReferenceItem,
  ReferenceSets,
} from "@/lib/api/types";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { coverPhoto } from "@/lib/photos";

/**
 * SEO helpers for the public pages. The indexing policy they implement is
 * documented in docs/seo.md; change both together.
 *
 * Nothing here knows a deal, category, city or directory by name: labels and
 * valid codes are passed in from the API's reference data.
 */

export const SITE_NAME = "RightProperty365";

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---- Listing search (/listings) -------------------------------------------

/** What the reference data and the active market contribute to search pages. */
export type SearchContext = { sets: ReferenceSets; market: Market | null };

/** Listings per result page. */
export const LISTINGS_PAGE_SIZE = 12;

export const listingSorts: ListingSort[] = ["newest", "price_asc", "price_desc", "relevance"];

/** The filters a visitor can set, in the order they appear in a URL. */
export type ListingFilters = {
  deal?: string;
  category?: string;
  property_type?: string;
  city?: string;
  suburb?: string;
  min_price?: string;
  max_price?: string;
  bedrooms_min?: number;
  bathrooms_min?: number;
  features?: string[];
  q?: string;
  sort?: ListingSort;
};

const filterParams = [
  "deal",
  "category",
  "property_type",
  "city",
  "suburb",
  "min_price",
  "max_price",
  "bedrooms_min",
  "bathrooms_min",
  "features",
  "q",
  "sort",
] as const;
const knownParams = new Set<string>([...filterParams, "page"]);

/** /listings with the given filters, always in the same parameter order, empty values left out. */
export function listingsPath(filters: ListingFilters = {}, page = 1): string {
  const query = new URLSearchParams();
  for (const key of filterParams) {
    const value = filters[key];
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else query.set(key, String(value));
  }
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/listings?${text}` : "/listings";
}

const labelOf = (items: ReferenceItem[], code: string | undefined) =>
  items.find((item) => item.code === code)?.label;

const lowerFirst = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** "For sale" and "To rent" become "for sale and to rent". */
const joinLabels = (labels: string[]) =>
  labels.length < 2
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

/**
 * The heading of a result page, built from reference labels:
 * "Residential property for sale in Harare", "Property to rent in Zimbabwe".
 */
export function listingsHeading(
  filters: Pick<ListingFilters, "deal" | "category" | "property_type" | "city" | "suburb">,
  { sets, market }: SearchContext,
): string {
  const type = labelOf(sets.property_types, filters.property_type);
  const category = labelOf(sets.property_categories, filters.category);
  const deal = labelOf(sets.deal_types, filters.deal);
  const suburb = sets.suburbs.find((item) => item.code === filters.suburb);
  const city = labelOf(sets.cities, filters.city) ?? labelOf(sets.cities, suburb?.parent_code ?? undefined);

  // A category whose label already ends in a noun ("Land") reads badly with
  // "property" after it; a one-word label that is not an adjective is rare
  // enough to special-case by code and fall back to "<label> property".
  const noun = type ?? (category ? (filters.category === "land" ? category : `${category} property`) : "Property");
  const place = [suburb?.label, city].filter(Boolean).join(", ") || market?.name;
  const where = place ? ` in ${place}` : "";

  if (deal) return `${noun} ${deal.toLowerCase()}${where}`;
  if (type || category) return `${noun}${where}`;
  const deals = joinLabels(sets.deal_types.map((item) => item.label.toLowerCase()));
  return `${noun}${deals ? ` ${deals}` : ""}${where}`;
}

export type ListingsSearch = {
  /** The valid filters, for the form defaults and for links to other pages of the result. */
  filters: ListingFilters;
  page: number;
  /** What to send to GET /v1/listings. */
  query: ListingQuery;
  /**
   * True for the result pages we allow into search engines (docs/seo.md): no
   * filter, deal, category, deal + category, city, deal + city. Still needs
   * results before it is indexed.
   */
  curated: boolean;
  /** The page's own URL in canonical parameter order (page 2 and later keep `page`). */
  canonicalPath: string;
  heading: string;
  title: string;
  description: string;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap((item) => item.split(",")).filter(Boolean);

const AMOUNT = /^[0-9]{1,12}(\.[0-9]{1,2})?$/;

/** Reads the search parameters, checks every code against the reference data and decides indexability. */
export function parseListingsSearch(params: RawParams, context: SearchContext): ListingsSearch {
  const { sets } = context;
  let invalid = Object.entries(params).some(([key, value]) => !knownParams.has(key) && first(value));

  const text = (key: string) => first(params[key])?.trim() || undefined;
  const code = (key: string, items: ReferenceItem[]) => {
    const value = text(key);
    if (value === undefined) return undefined;
    if (items.some((item) => item.code === value)) return value;
    invalid = true;
    return undefined;
  };
  const amount = (key: string) => {
    const value = text(key);
    if (value === undefined) return undefined;
    if (AMOUNT.test(value)) return value;
    invalid = true;
    return undefined;
  };
  const count = (key: string, min: number, max: number) => {
    const value = text(key);
    if (value === undefined) return undefined;
    if (/^[0-9]{1,4}$/.test(value) && Number(value) >= min && Number(value) <= max) return Number(value);
    invalid = true;
    return undefined;
  };

  const filters: ListingFilters = {
    deal: code("deal", sets.deal_types),
    category: code("category", sets.property_categories),
    property_type: code("property_type", sets.property_types),
    city: code("city", sets.cities),
    suburb: code("suburb", sets.suburbs),
    min_price: amount("min_price"),
    max_price: amount("max_price"),
    bedrooms_min: count("bedrooms_min", 0, 50),
    bathrooms_min: count("bathrooms_min", 0, 50),
    q: text("q")?.slice(0, 100),
  };

  if (filters.min_price && filters.max_price && Number(filters.max_price) < Number(filters.min_price)) {
    filters.max_price = undefined;
    invalid = true;
  }

  const features = [...new Set(all(params.features))];
  const knownFeatures = features.filter((value) => sets.listing_features.some((item) => item.code === value));
  if (knownFeatures.length !== features.length || features.length > 20) invalid = true;
  if (knownFeatures.length > 0) filters.features = knownFeatures.slice(0, 20);

  const sort = text("sort");
  if (sort !== undefined) {
    if (listingSorts.includes(sort as ListingSort)) filters.sort = sort as ListingSort;
    else invalid = true;
  }

  const page = text("page") === undefined ? 1 : (count("page", 1, 9999) ?? 1);

  const refined =
    filters.property_type !== undefined ||
    filters.suburb !== undefined ||
    filters.min_price !== undefined ||
    filters.max_price !== undefined ||
    filters.bedrooms_min !== undefined ||
    filters.bathrooms_min !== undefined ||
    filters.features !== undefined ||
    filters.sort !== undefined ||
    filters.q !== undefined;
  // City pages are indexed alone or with a deal, not with a category as well.
  const curated = !invalid && !refined && !(filters.city && filters.category);

  const base = listingsHeading(filters, context);
  const heading = filters.q ? `${base} matching "${filters.q}"` : base;

  return {
    filters,
    page,
    query: {
      ...filters,
      // Price filters apply in the active market's currency; nothing is converted.
      currency: context.market?.currency_code,
      page,
      page_size: LISTINGS_PAGE_SIZE,
    },
    curated,
    canonicalPath: listingsPath(
      { deal: filters.deal, category: filters.category, city: filters.city },
      page,
    ),
    heading,
    title: page > 1 ? `${heading}, page ${page}` : heading,
    description: `Browse ${lowerFirst(base)} from verified agents and owners. Send an enquiry and track it until you get a reply.`,
  };
}

// ---- Listing detail --------------------------------------------------------

export function listingPath(listing: Pick<Listing, "slug">): string {
  return `/listings/${listing.slug}`;
}

export function profilePath(profile: { kind: string; slug: string }): string {
  return `/directory/${profile.kind}/${profile.slug}`;
}

export function listingSeoTitle(listing: Listing): string {
  return `${listing.title} ${listing.deal.label.toLowerCase()} in ${listing.suburb.label}, ${listing.city.label}`;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function listingSeoDescription(listing: Listing): string {
  const price = `${formatMoney(listing.price)}${listing.price_period === "month" ? " per month" : ""}`;
  const facts = [
    listing.bedrooms !== null && plural(listing.bedrooms, "bedroom"),
    listing.bathrooms !== null && plural(listing.bathrooms, "bathroom"),
  ]
    .filter(Boolean)
    .join(", ");
  return `${listing.property_type.label} ${listing.deal.label.toLowerCase()} in ${listing.suburb.label}, ${listing.city.label} for ${price}${facts ? `. ${facts}` : ""}. ${listing.summary}`;
}

// ---- JSON-LD ---------------------------------------------------------------
// Google shows no rich result for real-estate listings; this markup is for
// machine understanding. Breadcrumb and Organization are supported features.

type JsonLd = Record<string, unknown>;
export type Crumb = { name: string; path: string };

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

/**
 * The property itself. schema.org accommodation types are used only for
 * listings with a bedroom count (homes); everything else is a Place, because
 * `floorSize` and room counts are not valid on other types.
 */
function propertyJsonLd(listing: Listing): JsonLd {
  const address = {
    "@type": "PostalAddress",
    addressLocality: `${listing.suburb.label}, ${listing.city.label}`,
    addressCountry: listing.market_code,
  };
  const base = { name: listing.title, description: listing.description, address };

  if (listing.bedrooms !== null) {
    return {
      // schema.org has a type for apartments; other homes are House.
      "@type": listing.property_type.code === "apartment" ? "Apartment" : "House",
      ...base,
      numberOfBedrooms: listing.bedrooms,
      ...(listing.bathrooms !== null && { numberOfBathroomsTotal: listing.bathrooms }),
      ...(listing.floor_area !== null && { floorSize: squareMetres(listing.floor_area) }),
      amenityFeature: listing.features.map((feature) => ({
        "@type": "LocationFeatureSpecification",
        name: feature.label,
        value: true,
      })),
    };
  }

  const sizes = [
    listing.floor_area !== null && { name: "Floor size", value: listing.floor_area },
    listing.land_area !== null && { name: "Land size", value: listing.land_area },
  ].filter((size): size is { name: string; value: number } => Boolean(size));

  return {
    "@type": "Place",
    ...base,
    additionalProperty: sizes.map((size) => ({ "@type": "PropertyValue", ...size, unitCode: "MTK" })),
  };
}

function offerJsonLd(listing: Listing): JsonLd {
  const price = Number(listing.price.amount);
  // A price per month is a lease; anything else is a sale.
  const isRental = listing.price_period === "month";
  const agency = listing.advertiser.agency;
  return {
    "@type": "Offer",
    url: absoluteUrl(listingPath(listing)),
    businessFunction: `http://purl.org/goodrelations/v1#${isRental ? "LeaseOut" : "Sell"}`,
    availability: "https://schema.org/InStock",
    validThrough: listing.expires_at,
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
    ...(listing.advertiser.type === "agency" && {
      offeredBy: {
        "@type": "RealEstateAgent",
        name: listing.advertiser.name,
        ...(agency && { url: absoluteUrl(profilePath(agency)) }),
      },
    }),
  };
}

export function listingJsonLd(listing: Listing): JsonLd {
  const url = absoluteUrl(listingPath(listing));
  const cover = coverPhoto(listing.photos);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: listingSeoTitle(listing),
    description: listing.summary,
    datePosted: listing.published_at,
    ...(cover && { image: [absoluteUrl(cover.url)] }),
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Listings", path: "/listings" },
      { name: listing.deal.label, path: listingsPath({ deal: listing.deal.code }) },
      { name: listing.title, path: listingPath(listing) },
    ]),
    mainEntity: propertyJsonLd(listing),
    offers: offerJsonLd(listing),
  };
}

export function listingsCollectionJsonLd(
  search: ListingsSearch,
  results: Listing[],
  total: number,
  { sets }: SearchContext,
): JsonLd {
  const { deal, category, city } = search.filters;
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Listings", path: "/listings" },
  ];
  const dealLabel = labelOf(sets.deal_types, deal);
  const categoryLabel = labelOf(sets.property_categories, category);
  const cityLabel = labelOf(sets.cities, city);
  if (dealLabel) crumbs.push({ name: dealLabel, path: listingsPath({ deal }) });
  if (categoryLabel) crumbs.push({ name: categoryLabel, path: listingsPath({ deal, category }) });
  if (cityLabel) crumbs.push({ name: cityLabel, path: listingsPath({ deal, city }) });

  const offset = (search.page - 1) * LISTINGS_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl(search.canonicalPath),
    name: search.title,
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd(crumbs),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: results.map((listing, index) => ({
        "@type": "ListItem",
        position: offset + index + 1,
        url: absoluteUrl(listingPath(listing)),
        name: listing.title,
      })),
    },
  };
}

// ---- Directory profiles ----------------------------------------------------

export function directoryCrumbs(kind: DirectoryKindInfo, profile?: DirectoryProfile): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Directory", path: "/directory" },
    { name: kind.label, path: `/directory/${kind.code}` },
  ];
  if (profile) crumbs.push({ name: profile.name, path: profilePath(profile) });
  return crumbs;
}

/**
 * Agencies are RealEstateAgent, agents are Person, everything else Organization.
 * The kinds `agencies` and `agents` are baseline directory kinds in the API
 * contract; the choice of schema.org type is the only thing keyed on them,
 * and an unknown kind falls back to Organization.
 */
export function profileJsonLd(
  profile: DirectoryProfile,
  kind: DirectoryKindInfo,
  market: Market | null,
): JsonLd {
  const url = absoluteUrl(profilePath(profile));
  const common = {
    "@id": url,
    url,
    name: profile.name,
    description: profile.description,
    areaServed: profile.areas.map((name) => ({ "@type": "Place", name })),
  };

  const entity =
    profile.kind === "agents"
      ? {
          "@type": "Person",
          ...common,
          jobTitle: profile.role,
          ...(profile.agency && {
            worksFor: {
              "@type": "RealEstateAgent",
              name: profile.agency.name,
              url: absoluteUrl(profilePath(profile.agency)),
            },
          }),
        }
      : {
        "@type": profile.kind === "agencies" ? "RealEstateAgent" : "Organization",
        ...common,
        address: {
          "@type": "PostalAddress",
          addressLocality: profile.city.label,
          ...(market && { addressCountry: market.code }),
        },
        ...(profile.since && { foundingDate: String(profile.since) }),
      };

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    name: profile.name,
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd(directoryCrumbs(kind, profile)),
    mainEntity: entity,
  };
}

export function directoryJsonLd(
  kind: DirectoryKindInfo,
  entries: DirectoryProfile[],
  market: Market | null,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl(`/directory/${kind.code}`),
    name: market ? `${kind.label} in ${market.name}` : kind.label,
    isPartOf: { "@id": absoluteUrl("/#website") },
    breadcrumb: breadcrumbJsonLd(directoryCrumbs(kind)),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.map((profile, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(profilePath(profile)),
        name: profile.name,
      })),
    },
  };
}
