/**
 * Shapes returned by the public catalogue endpoints of the Go API
 * (api/openapi.yaml in the backend repository). Types only: every list and
 * label in the app comes from the API at run time, never from this file.
 */

/**
 * The category of places let by the night. The one category the app knows by
 * code, because behaviour hangs on it: stay dates, guests, the availability
 * calendar and the request to stay exist only there.
 */
export const SHORT_STAY = "short-stay";

/** A reference-data code with its current label. */
export type Coded = { code: string; label: string };

/**
 * A place on a listing or a profile. `code` is null when the lister typed the
 * place as free text (a country with no reference places): it can be shown but
 * not linked to or filtered by.
 */
export type Place = { code: string | null; label: string };

/** A country as named on a listing or a profile. */
export type CountryRef = { code: string; name: string };

/** An exact amount. `amount` is a decimal string; never do float arithmetic on it. */
export type Money = { amount: string; currency: string };

export type Photo = { url: string; alt: string; width: number; height: number };

/**
 * A logo or profile photo. `url` is a path relative to the API's origin
 * (`/v1/directory/agencies/sample-estates/logo?v=…`): see `logoUrl`.
 */
export type Logo = { url: string; width: number; height: number };

/** A public reference to a directory profile. Never contact details. */
export type ProfileRef = {
  kind: string;
  slug: string;
  name: string;
  verified: boolean;
  /** Optional: API builds before 0.17 do not send it. */
  logo?: Logo | null;
};

/**
 * Who to show for a listing, ready to render: the agency, company or owner
 * (`display`) and the assigned agent (`agent_display`).
 */
export type AdvertiserDisplay = {
  name: string;
  /** The agent's name beside an agency. */
  secondary_name?: string | null;
  /** A title: "Real Estate Agency", "Host", "Landlord", "Property Seller (Vendor)", "Estate Agent". */
  role_label: string;
  logo: Logo | null;
  /** Show the Verified badge only when this is true. */
  verified: boolean;
  /** The public profile under Professionals. Null for a direct owner. */
  profile: { kind: string; slug: string } | null;
};

export type ListingAdvertiser = {
  type: "agency" | "private_seller";
  name: string;
  verified: boolean;
  agency: ProfileRef | null;
  agent: ProfileRef | null;
  /** Optional: API builds before 0.17 send neither; see `advertiserDisplay`. */
  display?: AdvertiserDisplay;
  agent_display?: AdvertiserDisplay | null;
};

/** What RightProperty365 has checked about a listing and whoever advertises it. */
export type ListingVerification = {
  advertiser_verified: boolean;
  advertiser_verified_at: string | null;
  /** Recorded by staff. There is no review workflow yet: never claim it to visitors. */
  listing_reviewed: boolean;
  listing_reviewed_at: string | null;
};

/** The numbers behind the assurance on the landing page (`GET /v1/trust/summary`). */
export type TrustSummary = {
  verified_advertisers: { organisations: number; direct_owners: number };
  public_listings: number;
  listings_from_verified_advertisers: number;
  listings_reviewed: number;
  generated_at: string;
};

export type Listing = {
  /** Sent as `listing_id` in a property request. */
  id: string;
  slug: string;
  reference: string;
  title: string;
  deal: Coded;
  category: Coded;
  property_type: Coded;
  price: Money;
  /** A `price_periods` code. Null for a sale price. */
  price_period: PricePeriod | null;
  /** Null where the listing names no suburb. */
  suburb: Place | null;
  city: Place;
  /** The province or region. Null where the listing names none. */
  region?: Place | null;
  /** Optional: API builds before 0.13 do not send it. */
  country?: CountryRef;
  market_code: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  land_area: number | null;
  /** Short stays only: how many people it sleeps. Optional: API builds before 0.16 send neither. */
  max_guests?: number | null;
  /** Short stays only: the shortest stay, in nights. */
  min_nights?: number | null;
  summary: string;
  description: string;
  features: Coded[];
  featured: boolean;
  /** In display order; the first is the cover. May be empty. */
  photos: Photo[];
  advertiser: ListingAdvertiser;
  published_at: string;
  /** End of the current 90-day publication cycle. */
  expires_at: string;
  updated_at: string;
  /** Short stays only: what the listing says about its calendar. Null for everything else. */
  availability?: ListingAvailability | null;
  /** Optional: API builds before 0.17 do not send it. */
  verification?: ListingVerification;
};

export type ListingAvailability = {
  /** When the lister last changed the calendar. Null when they never have. */
  updated_at: string | null;
  /** The first available night from today on (`YYYY-MM-DD`, the listing's time zone). Null when none is free. */
  next_available: string | null;
};

/**
 * The calendar of a short stay as everyone sees it
 * (`GET /v1/listings/{slug}/availability`): available or not, per night, and
 * nothing about why.
 */
export type PublicAvailability = {
  listing: { slug: string };
  /** IANA zone of the listing's country: the zone the dates are in. */
  timezone: string;
  min_nights: number;
  max_guests: number | null;
  from: string;
  to: string;
  days: { date: string; available: boolean }[];
  availability_updated_at: string | null;
};

/** What a rental price is charged per: a code of the `price_periods` reference set. */
export type PricePeriod = "month" | "night";

export type FacetCount = { code: string; label: string; count: number; /** Suburb facets: the code of the suburb's city. */ city?: string };

export type ListingFacets = {
  deal: FacetCount[];
  category: FacetCount[];
  property_type: FacetCount[];
  /** Optional: API builds before 0.13 do not send these two. */
  country?: FacetCount[];
  region?: FacetCount[];
  city: FacetCount[];
  suburb: FacetCount[];
  bedrooms: FacetCount[];
  features: FacetCount[];
  /**
   * The price range of the result in its one currency. Null when the results
   * are priced in several currencies and neither a currency nor a country was
   * chosen: `currencies` then lists them.
   */
  price: { currency: string; min: string | null; max: string | null } | null;
  /** The currencies the results are priced in. Optional: API builds before 0.15 do not send it. */
  currencies?: { code: string; count: number }[];
};

export type ListingPage = {
  items: Listing[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  facets: ListingFacets;
};

export type ListingSort = "newest" | "oldest" | "price_asc" | "price_desc" | "area_desc" | "relevance";

/** Who advertises a listing: an enum of the search endpoint. */
export type AdvertiserType = "agency" | "private";

/** Filters of GET /v1/listings. Codes come from the reference data. */
export type ListingQuery = {
  q?: string;
  deal?: string;
  category?: string;
  property_type?: string;
  /** Short stays free for every night of `check_in` .. `check_out - 1`. Both or neither. */
  check_in?: string;
  check_out?: string;
  /** Short stays that sleep at least this many. */
  guests_min?: number;
  /** An ISO 3166-1 alpha-2 country code. */
  country?: string;
  region?: string;
  city?: string;
  suburb?: string;
  min_price?: string;
  max_price?: string;
  /**
   * ISO 4217 code for the price filters and the price facet. Without it the
   * API uses the currency of `country`, else the only currency of the results;
   * a price filter with neither is refused (400 on `currency`).
   */
  currency?: string;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  bathrooms_max?: number;
  /** Square metres. */
  floor_area_min?: string;
  floor_area_max?: string;
  land_area_min?: string;
  land_area_max?: string;
  /** 1 to 365. */
  listed_within_days?: number;
  advertiser_type?: AdvertiserType;
  reference?: string;
  has_photos?: boolean;
  features?: string[];
  featured?: boolean;
  sort?: ListingSort;
  page?: number;
  page_size?: number;
};

export type ListingSuggestion = {
  type: "suburb" | "city" | "region" | "country" | "listing";
  label: string;
  value: string;
};

export type DirectoryKindInfo = {
  code: string;
  label: string;
  singular_label: string;
  description: string;
};

export type DirectoryKindCount = DirectoryKindInfo & { count: number };

export type DirectoryProfile = {
  kind: string;
  slug: string;
  name: string;
  /** Job title for a person, speciality for a business. */
  role: string;
  tagline: string;
  description: string;
  city: Place;
  areas: string[];
  services: string[];
  offerings: { name: string; description: string }[];
  /** Service providers only. */
  trade: Coded | null;
  /** Agent profiles only: "Sales Agent" or "Lettings Agent". Null for an agent with no specialism. */
  specialism?: Coded | null;
  verified: boolean;
  /** Paid placement. Always labelled "Sponsored" wherever it is shown. */
  sponsored: boolean;
  since: number | null;
  logo: Logo | null;
  region?: Place | null;
  country?: CountryRef;
  /** Agent profiles only: the agency they work for. */
  agency: ProfileRef | null;
  listing_count: number;
  updated_at: string;
};

export type DirectoryProfileDetail = DirectoryProfile & {
  agents: ProfileRef[];
  listings: Listing[];
};

export type DirectoryPage = {
  kind: DirectoryKindInfo;
  items: DirectoryProfile[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ReferenceGroup = { code: string; label: string; sort_order: number };

export type ReferenceItem = {
  code: string;
  label: string;
  singular_label: string | null;
  description: string | null;
  sort_order: number;
  market_code: string | null;
  parent_code: string | null;
  group: ReferenceGroup | null;
  requires_verification: boolean | null;
};

export type ReferenceSetCode =
  | "deal_types"
  | "property_categories"
  | "property_types"
  | "request_types"
  | "contact_methods"
  | "account_roles"
  | "directory_kinds"
  | "organisation_kinds"
  | "service_trades"
  | "regions"
  | "cities"
  | "suburbs"
  | "listing_features"
  | "price_periods";

export type ReferenceSets = Record<ReferenceSetCode, ReferenceItem[]>;

/** A country from `GET /v1/countries`. Every country is listed; few have listings. */
export type Country = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** The currency its listings are priced in (ISO 4217). */
  currency_code: string;
  /** IANA time zone. */
  timezone: string;
  /** Published listings. Optional: API builds before 0.15 do not send the two counts. */
  listing_count?: number;
  has_listings?: boolean;
};

export type SitemapEntries = {
  listings: { slug: string; updated_at: string }[];
  profiles: { kind: string; slug: string; updated_at: string }[];
};

/** A value and its label, as passed from Server Components to form controls. */
export type Option = { value: string; label: string };

export const toOptions = (items: Pick<ReferenceItem, "code" | "label">[]): Option[] =>
  items.map(({ code, label }) => ({ value: code, label }));

/** code -> label, for showing values the API returns (roles, request types). */
export const toLabels = (items: Pick<ReferenceItem, "code" | "label">[]): Record<string, string> =>
  Object.fromEntries(items.map(({ code, label }) => [code, label]));
