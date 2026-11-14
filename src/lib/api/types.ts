/**
 * Shapes returned by the public catalogue endpoints of the Go API
 * (api/openapi.yaml in the backend repository). Types only: every list and
 * label in the app comes from the API at run time, never from this file.
 */

/** A reference-data code with its current label. */
export type Coded = { code: string; label: string };

/** An exact amount. `amount` is a decimal string; never do float arithmetic on it. */
export type Money = { amount: string; currency: string };

export type Photo = { url: string; alt: string; width: number; height: number };

/** A public reference to a directory profile. Never contact details. */
export type ProfileRef = { kind: string; slug: string; name: string; verified: boolean };

export type ListingAdvertiser = {
  type: "agency" | "private_seller";
  name: string;
  verified: boolean;
  agency: ProfileRef | null;
  agent: ProfileRef | null;
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
  price_period: "month" | null;
  suburb: Coded;
  city: Coded;
  /** The province or region of the city. Null where the market has none. */
  region?: Coded | null;
  /** The market the listing is in, as a country. */
  country?: { code: string; name: string };
  market_code: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  land_area: number | null;
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
};

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
  price: { currency: string; min: string | null; max: string | null };
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
  /** A market code. */
  country?: string;
  region?: string;
  city?: string;
  suburb?: string;
  min_price?: string;
  max_price?: string;
  /** ISO 4217 code for the price filters. The API defaults to USD. */
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
  city: Coded;
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
  logo: Photo | null;
  region?: Coded | null;
  country?: { code: string; name: string };
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
  | "listing_features";

export type ReferenceSets = Record<ReferenceSetCode, ReferenceItem[]>;

export type Market = {
  id: string;
  code: string;
  name: string;
  currency_code: string;
  timezone: string;
  status: "ACTIVE" | "PLANNED" | "SUSPENDED";
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
