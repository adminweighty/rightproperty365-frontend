import { countryInSentence } from "@/lib/countries";
import { faqAnswerText, type FaqCategory } from "@/lib/faq";
import type {
  AdvertiserType,
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
export type SearchContext = { sets: ReferenceSets; market: Market | null; markets?: Market[] };

/** Listings per result page. */
export const LISTINGS_PAGE_SIZE = 12;

export const listingSorts: ListingSort[] = ["newest", "oldest", "price_asc", "price_desc", "area_desc", "relevance"];
export const advertiserTypes: AdvertiserType[] = ["agency", "private"];
/** The choices of "listed in the last N days". Any value from 1 to 365 is accepted in an address. */
export const listedWithinChoices = [1, 7, 14, 30, 90];
/** The kinds of place the single "Location" select of the hero search can name: `location=region:harare`. */
export const locationKinds = ["country", "region", "city", "suburb"] as const;
export type LocationKind = (typeof locationKinds)[number];

/** The filters a visitor can set, in the order they appear in a URL. */
export type ListingFilters = {
  deal?: string;
  category?: string;
  property_type?: string;
  /** A market code. */
  country?: string;
  region?: string;
  city?: string;
  suburb?: string;
  min_price?: string;
  max_price?: string;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  bathrooms_max?: number;
  floor_area_min?: string;
  floor_area_max?: string;
  land_area_min?: string;
  land_area_max?: string;
  features?: string[];
  listed_within_days?: number;
  advertiser_type?: AdvertiserType;
  has_photos?: boolean;
  reference?: string;
  q?: string;
  sort?: ListingSort;
};

export const filterParams = [
  "deal",
  "category",
  "property_type",
  "country",
  "region",
  "city",
  "suburb",
  "min_price",
  "max_price",
  "bedrooms_min",
  "bedrooms_max",
  "bathrooms_min",
  "bathrooms_max",
  "floor_area_min",
  "floor_area_max",
  "land_area_min",
  "land_area_max",
  "features",
  "listed_within_days",
  "advertiser_type",
  "has_photos",
  "reference",
  "q",
  "sort",
] as const;
/**
 * `location` is the hero search's single select (`location=city:harare`) and
 * `advanced` opens the advanced search panel. Neither is a filter of its own:
 * the canonical address never carries them.
 */
const knownParams = new Set<string>([...filterParams, "page", "location", "advanced"]);

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

/** Categories whose label is an adjective and so needs "property" after it: "Residential property". */
const ADJECTIVE_CATEGORIES = new Set(["residential", "commercial", "industrial", "agricultural"]);

/**
 * The heading of a result page, built from reference labels:
 * "Property for sale", "Residential property for sale in Harare", "Short
 * stays", "Property in the United Kingdom".
 *
 * A place is named only when the visitor chose one. The site lists property
 * from any country, so with no place chosen the heading names none; there is
 * no default country. With a place, it is the narrowest one chosen (suburb
 * and city, else region, else country), followed by the country when that
 * was chosen as well.
 */
export function listingsHeading(
  filters: Pick<ListingFilters, "deal" | "category" | "property_type" | "country" | "region" | "city" | "suburb">,
  { sets, markets = [] }: SearchContext,
): string {
  const type = labelOf(sets.property_types, filters.property_type);
  const category = labelOf(sets.property_categories, filters.category);
  const deal = labelOf(sets.deal_types, filters.deal);
  const suburb = sets.suburbs.find((item) => item.code === filters.suburb);
  const city = labelOf(sets.cities, filters.city) ?? labelOf(sets.cities, suburb?.parent_code ?? undefined);

  // An adjective needs its noun ("Residential property"); a label that is
  // already a noun phrase stands alone ("Land", "Short stays").
  const noun =
    type ??
    (category
      ? ADJECTIVE_CATEGORIES.has(filters.category ?? "")
        ? `${category} property`
        : category
      : "Property");
  // The narrowest place chosen: suburb and city, else the region, else the country.
  const region = labelOf(sets.regions ?? [], filters.region);
  const market = markets.find((item) => item.code === filters.country);
  const narrower = [suburb?.label, city].filter(Boolean).join(", ") || region;
  const place = narrower
    ? [narrower, market?.name].filter(Boolean).join(", ")
    : market && countryInSentence(market.code, market.name);
  const where = place ? ` in ${place}` : "";

  if (deal) return `${noun} ${deal.toLowerCase()}${where}`;
  if (type || category || where) return `${noun}${where}`;
  const deals = joinLabels(sets.deal_types.map((item) => item.label.toLowerCase()));
  return `${noun}${deals ? ` ${deals}` : ""}`;
}

export type ListingsSearch = {
  /** The valid filters, for the form defaults and for links to other pages of the result. */
  filters: ListingFilters;
  page: number;
  /** What to send to GET /v1/listings. */
  query: ListingQuery;
  /**
   * True for the result pages we allow into search engines (docs/seo.md): no
   * filter, deal, category, deal + category, and one place (country, region
   * or city) alone or with a deal. Still needs results before it is indexed.
   */
  curated: boolean;
  /** True when `advanced=1` asked for the advanced search panel to be open. */
  advanced: boolean;
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

  const markets = context.markets ?? [];
  const countries = markets.map((market) => ({ code: market.code }) as ReferenceItem);
  const oneOf = <T extends string>(key: string, values: readonly T[]) => {
    const value = text(key);
    if (value === undefined) return undefined;
    if ((values as readonly string[]).includes(value)) return value as T;
    invalid = true;
    return undefined;
  };

  const filters: ListingFilters = {
    deal: code("deal", sets.deal_types),
    category: code("category", sets.property_categories),
    property_type: code("property_type", sets.property_types),
    country: code("country", countries),
    region: code("region", sets.regions ?? []),
    city: code("city", sets.cities),
    suburb: code("suburb", sets.suburbs),
    min_price: amount("min_price"),
    max_price: amount("max_price"),
    bedrooms_min: count("bedrooms_min", 0, 50),
    bedrooms_max: count("bedrooms_max", 0, 50),
    bathrooms_min: count("bathrooms_min", 0, 50),
    bathrooms_max: count("bathrooms_max", 0, 50),
    floor_area_min: amount("floor_area_min"),
    floor_area_max: amount("floor_area_max"),
    land_area_min: amount("land_area_min"),
    land_area_max: amount("land_area_max"),
    listed_within_days: count("listed_within_days", 1, 365),
    advertiser_type: oneOf("advertiser_type", advertiserTypes),
    has_photos: oneOf("has_photos", ["true"]) ? true : undefined,
    reference: text("reference")?.slice(0, 40),
    q: text("q")?.slice(0, 100),
  };

  // The hero search's single "Location" select: `location=region:harare`
  // stands for `region=harare`. A place given by its own parameter wins.
  const location = text("location");
  if (location !== undefined) {
    const [kind, value] = location.split(":");
    const known: Record<LocationKind, ReferenceItem[]> = {
      country: countries,
      region: sets.regions ?? [],
      city: sets.cities,
      suburb: sets.suburbs,
    };
    const items = known[kind as LocationKind];
    if (items?.some((item) => item.code === value)) filters[kind as LocationKind] ??= value;
    else invalid = true;
  }

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

  // Everything except deal, category, country, region and city is a refinement.
  const curatedKeys: (keyof ListingFilters)[] = ["deal", "category", "country", "region", "city"];
  const refined = filterParams.some((key) => !curatedKeys.includes(key) && filters[key] !== undefined);
  // One place at a time (a country, a region or a city), alone or with a deal,
  // and never with a category as well.
  const places = [filters.country, filters.region, filters.city].filter((value) => value !== undefined).length;
  const curated = !invalid && !refined && places <= 1 && !(places === 1 && filters.category);

  const base = listingsHeading(filters, context);
  const heading = filters.q ? `${base} matching "${filters.q}"` : base;

  return {
    filters,
    page,
    query: {
      ...filters,
      // Price filters apply in the currency of the chosen country, else of the
      // active market; nothing is converted.
      currency: (markets.find((market) => market.code === filters.country) ?? context.market)?.currency_code,
      page,
      page_size: LISTINGS_PAGE_SIZE,
    },
    advanced: text("advanced") === "1",
    curated,
    canonicalPath: listingsPath(
      {
        deal: filters.deal,
        category: filters.category,
        country: filters.country,
        region: filters.region,
        city: filters.city,
      },
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

/** The FAQ page: one `Question` per entry, with its answer as plain text. */
export function faqJsonLd(categories: FaqCategory[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": absoluteUrl("/faq#faq"),
    url: absoluteUrl("/faq"),
    name: "Frequently asked questions",
    isPartOf: { "@id": absoluteUrl("/#website") },
    mainEntity: categories.flatMap((category) =>
      category.questions.map((faq) => ({
        "@type": "Question",
        "@id": absoluteUrl(`/faq#${faq.id}`),
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faqAnswerText(faq.answer) },
      })),
    ),
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
    ...(listing.region && { addressRegion: listing.region.label }),
    addressCountry: listing.country?.code ?? listing.market_code,
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
  { sets, markets = [] }: SearchContext,
): JsonLd {
  const { deal, category, country, region, city } = search.filters;
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Listings", path: "/listings" },
  ];
  const dealLabel = labelOf(sets.deal_types, deal);
  const categoryLabel = labelOf(sets.property_categories, category);
  const countryName = markets.find((item) => item.code === country)?.name;
  const regionLabel = labelOf(sets.regions ?? [], region);
  const cityLabel = labelOf(sets.cities, city);
  if (dealLabel) crumbs.push({ name: dealLabel, path: listingsPath({ deal }) });
  if (categoryLabel) crumbs.push({ name: categoryLabel, path: listingsPath({ deal, category }) });
  if (countryName) crumbs.push({ name: countryName, path: listingsPath({ deal, country }) });
  if (regionLabel) crumbs.push({ name: regionLabel, path: listingsPath({ deal, region }) });
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
    { name: "Professionals", path: "/directory" },
    { name: kind.label, path: `/directory/${kind.code}` },
  ];
  if (profile) crumbs.push({ name: profile.name, path: profilePath(profile) });
  return crumbs;
}

/**
 * The schema.org type of a profile's main entity, by directory kind code.
 * These kinds are baseline directory kinds in the API contract, and the choice
 * of type is the only thing keyed on them. A kind that is not listed (and any
 * kind added later) is an Organization.
 */
const profileEntityTypes: Record<string, string> = {
  agencies: "RealEstateAgent",
  agents: "Person",
  // A law practice. LegalService is a LocalBusiness, so it takes an address.
  solicitors: "LegalService",
};
const DEFAULT_ENTITY_TYPE = "Organization";

export const profileEntityType = (kindCode: string) => profileEntityTypes[kindCode] ?? DEFAULT_ENTITY_TYPE;

export function profileJsonLd(profile: DirectoryProfile, kind: DirectoryKindInfo): JsonLd {
  const url = absoluteUrl(profilePath(profile));
  const common = {
    "@id": url,
    url,
    name: profile.name,
    description: profile.description,
    areaServed: profile.areas.map((name) => ({ "@type": "Place", name })),
  };

  const type = profileEntityType(profile.kind);
  const entity =
    type === "Person"
      ? {
          "@type": type,
          ...common,
          jobTitle: profile.specialism?.label || profile.role,
          ...(profile.agency && {
            worksFor: {
              "@type": "RealEstateAgent",
              name: profile.agency.name,
              url: absoluteUrl(profilePath(profile.agency)),
            },
          }),
        }
      : {
        "@type": type,
        ...common,
        address: {
          "@type": "PostalAddress",
          addressLocality: profile.city.label,
          // The profile's own country, when the API gives one. None is assumed.
          ...(profile.country && { addressCountry: profile.country.code }),
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

export function directoryJsonLd(kind: DirectoryKindInfo, entries: DirectoryProfile[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl(`/directory/${kind.code}`),
    name: kind.label,
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
