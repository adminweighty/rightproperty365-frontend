/**
 * Development and investment showcase (API 0.44.0, BR-019 / FR-048): the
 * shapes the API returns for projects, and the rules the pages share for
 * prices, completion estimates, status labels, the public list's address and
 * the structured data.
 *
 * Pure functions with type imports only, so `npm test`
 * (scripts/developments.test.mjs) runs them directly. Money stays a decimal
 * string end to end: amounts are grouped as text, never turned into floats.
 */

import type { Coded, CountryRef, ListingVideo, Logo, Photo, Listing } from "@/lib/api/types";

// ---- Shapes -------------------------------------------------------------------

/** A project's or a phase's construction status. */
export type DevelopmentStatusCode = "PLANNED" | "UNDER_CONSTRUCTION" | "SELLING" | "COMPLETED" | "SOLD_OUT";

/** Where a project is in moderation (developer and admin views only). */
export type ModerationStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";

export type Completion = { kind: "QUARTER" | "DATE"; value: string; label: string };

export type DevelopmentPlace = { code: string | null; label: string };

/** Approximate coordinates are rounded to 2 decimals in public answers: an area, never a pin. */
export type DevelopmentCoordinates = { latitude: number; longitude: number; precision: "EXACT" | "APPROXIMATE" };

export type DevelopmentLocation = {
  country: CountryRef;
  region: DevelopmentPlace | null;
  city: DevelopmentPlace | null;
  suburb: DevelopmentPlace | null;
  coordinates: DevelopmentCoordinates | null;
};

/** A unit type's price. `to` may be null when there is only a "from" price. */
export type UnitPrice = { on_request: boolean; from: string | null; to: string | null; currency: string | null };

export type SizeRange = { min: number | null; max: number | null };

export type UnitType = {
  id: string;
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_m2: SizeRange | null;
  price: UnitPrice;
  units_total: number | null;
  units_available: number | null;
  /** Published linked listings of this unit type. */
  available_listing_count: number;
};

export type Phase = {
  id: string;
  name: string;
  status: Coded;
  completion: Completion | null;
  unit_types: UnitType[];
};

/** The developer's own statements, never advice: the page shows `disclaimer` next to them. */
export type Highlights = {
  stated_by: "DEVELOPER";
  disclaimer: string;
  items: { label: string; value: string }[];
};

/** The developer card: never any contact detail. */
export type DeveloperCard = { kind: string; slug: string; name: string; verified: boolean; logo: Logo | null };

export type DevelopmentListItem = {
  id: string;
  market: CountryRef;
  slug: string;
  name: string;
  summary: string;
  status: Coded;
  completion: Completion | null;
  location: DevelopmentLocation;
  cover_photo: Photo | null;
  price_from: { amount: string; currency: string } | null;
  price_on_request: boolean;
  unit_type_count: number;
  developer: DeveloperCard;
  published_at: string;
  updated_at: string;
};

export type Development = DevelopmentListItem & {
  description: string;
  amenities: Coded[];
  investment_highlights: Highlights;
  photos: Photo[];
  video: ListingVideo | null;
  phases: Phase[];
  available_units: { unit_type_id: string | null; listing: Listing }[];
};

export type DevelopmentPage = {
  items: DevelopmentListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ManagedPhotoOfDevelopment = Photo & { id: string; approved: boolean; position: number };

export type ManagedUnitType = UnitType & { phase_id: string; position: number };

export type ManagedPhase = {
  id: string;
  name: string;
  status: Coded;
  completion: Completion | null;
  position: number;
  unit_types: ManagedUnitType[];
};

export type LinkedListing = {
  listing_id: string;
  unit_type_id: string | null;
  title: string;
  slug: string;
  reference: string;
  status: string;
  public: boolean;
};

export type DevelopmentAction = "edit" | "submit" | "withdraw" | "delete";

export type ManagedDevelopment = {
  id: string;
  organisation_id: string;
  developer: DeveloperCard;
  market: CountryRef;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: Coded;
  completion: Completion | null;
  moderation_status: ModerationStatus;
  review_reason: string | null;
  public_url_path: string | null;
  location: DevelopmentLocation;
  city_name: string | null;
  amenities: Coded[];
  investment_highlights: Highlights;
  youtube_url: string | null;
  video: ListingVideo | null;
  photos: ManagedPhotoOfDevelopment[];
  phases: ManagedPhase[];
  linked_listings: LinkedListing[];
  actions: DevelopmentAction[];
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Status labels --------------------------------------------------------------

export const DEVELOPMENT_STATUSES: readonly DevelopmentStatusCode[] = [
  "PLANNED",
  "UNDER_CONSTRUCTION",
  "SELLING",
  "COMPLETED",
  "SOLD_OUT",
];

/** The API sends `{code, label}`; these are the words for a code on its own (filters, editors). */
export const developmentStatusLabels: Record<DevelopmentStatusCode, string> = {
  PLANNED: "Planned",
  UNDER_CONSTRUCTION: "Under construction",
  SELLING: "Selling",
  COMPLETED: "Completed",
  SOLD_OUT: "Sold out",
};

export const isDevelopmentStatus = (value: unknown): value is DevelopmentStatusCode =>
  typeof value === "string" && (DEVELOPMENT_STATUSES as readonly string[]).includes(value);

/** The label of a status: the API's when it sends one, else ours, else the code in words. */
export function developmentStatusLabel(status: Coded | string | null | undefined): string {
  if (!status) return "";
  if (typeof status !== "string") return status.label || developmentStatusLabel(status.code);
  if (isDevelopmentStatus(status)) return developmentStatusLabels[status];
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export function developmentStatusTone(code: string): Tone {
  switch (code) {
    case "SELLING":
      return "success";
    case "UNDER_CONSTRUCTION":
      return "info";
    case "COMPLETED":
      return "primary";
    case "SOLD_OUT":
      return "neutral";
    default:
      return "accent";
  }
}

export const moderationStatusLabels: Record<ModerationStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Waiting for review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
};

export const moderationStatusLabel = (status: string) =>
  moderationStatusLabels[status as ModerationStatus] ?? developmentStatusLabel(status);

export function moderationStatusTone(status: string): Tone {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "PENDING_REVIEW":
      return "info";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

/** The project's own fields and photos are locked while it waits for review or is public. */
export const isLocked = (status: string) => status === "PENDING_REVIEW" || status === "PUBLISHED";

/** The plain-words rule shown on the editor, per moderation status. */
export function lockText(status: string): string | null {
  if (status === "PENDING_REVIEW") {
    return "This project is waiting for review, so its details and photos are locked. Phases, unit types, prices, availability and linked listings can still change, and those changes apply at once. To change anything else, withdraw it to a draft, edit it and submit it again.";
  }
  if (status === "PUBLISHED") {
    return "This project is public, so its details and photos are locked. Phases, unit types, prices, availability and linked listings can still change, and those changes apply at once. To change anything else, withdraw it: it leaves the public site until it is approved again.";
  }
  return null;
}

// ---- Money ------------------------------------------------------------------------

const AMOUNT = /^-?\d+(\.\d+)?$/;

/**
 * "85000.00" as "85,000"; "85000.50" as "85,000.50". The digits are grouped as
 * text, so nothing is rounded. Something that is not a decimal is shown as sent.
 */
export function groupAmount(amount: string): string {
  const text = amount.trim();
  if (!AMOUNT.test(text)) return text;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = /^0*$/.test(fraction) ? "" : `.${fraction.padEnd(2, "0")}`;
  return `${negative ? "-" : ""}${grouped}${decimals}`;
}

/** "USD 85,000": the currency by its code, always, as everywhere on the site. */
export const formatPrice = (amount: string, currency: string | null | undefined) =>
  `${currency ? `${currency} ` : ""}${groupAmount(amount)}`;

export const PRICE_ON_REQUEST = "Price on request";

/**
 * A unit type's price: "USD 85,000 – 120,000", "From USD 85,000" (no upper
 * price), "USD 85,000" (the same both ends) or "Price on request".
 */
export function priceRangeText(price: UnitPrice | null | undefined): string {
  if (!price || price.on_request || !price.from) return PRICE_ON_REQUEST;
  const { from, to, currency } = price;
  if (!to || to === from) return to === from ? formatPrice(from, currency) : `From ${formatPrice(from, currency)}`;
  return `${formatPrice(from, currency)} – ${groupAmount(to)}`;
}

/** A project card's price: "From USD 95,000", "Price on request", or null when nothing is priced yet. */
export function priceFromText(item: Pick<DevelopmentListItem, "price_from" | "price_on_request">): string | null {
  if (item.price_from) return `From ${formatPrice(item.price_from.amount, item.price_from.currency)}`;
  return item.price_on_request ? PRICE_ON_REQUEST : null;
}

// ---- Completion ---------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const QUARTER = /^(\d{4})-Q([1-4])$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a calendar date that exists ("2027-02-30" does not). */
function realDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

/** "2027-Q3" as "Q3 2027", "2027-06-30" as "30 June 2027"; null for anything else. */
export function completionLabelFor(value: string): string | null {
  const quarter = QUARTER.exec(value);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
  const date = DATE.exec(value);
  if (date) {
    const [year, month, day] = [Number(date[1]), Number(date[2]), Number(date[3])];
    return realDate(year, month, day) ? `${day} ${MONTHS[month - 1]} ${year}` : null;
  }
  return null;
}

/** The estimate's label: the API's, or ours from its value. */
export const completionLabel = (completion: Completion | null | undefined): string | null =>
  completion ? completion.label || completionLabelFor(completion.value) || completion.value : null;

/**
 * The completion line: "Completion expected Q3 2027", "Completed 30 June 2027"
 * (a completed project), "Completed" (completed with no date) or null.
 */
export function completionText(completion: Completion | null | undefined, statusCode?: string | null): string | null {
  const label = completionLabel(completion);
  if (statusCode === "COMPLETED") return label ? `Completed ${label}` : "Completed";
  return label ? `Completion expected ${label}` : null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * What the developer typed for a completion estimate, as the API takes it:
 * "2027-Q3" (a quarter, also "Q3 2027") or "2027-06-30" (a date), or null for
 * an empty box.
 */
export function parseCompletionInput(text: string): Parsed<string | null> {
  const value = text.trim().toUpperCase().replace(/\s+/g, " ");
  if (value === "") return { ok: true, value: null };
  const spoken = /^Q([1-4]) (\d{4})$/.exec(value);
  const normal = spoken ? `${spoken[2]}-Q${spoken[1]}` : value;
  if (completionLabelFor(normal)) return { ok: true, value: normal };
  return {
    ok: false,
    message: "Enter a quarter such as 2027-Q3, or a date such as 2027-06-30.",
  };
}

// ---- Sizes and units -------------------------------------------------------------------

const groupNumber = (value: number) => groupAmount(String(value));

/** "180–210 m²", "From 180 m²", "Up to 210 m²", "180 m²", or null. */
export function sizeRangeText(size: SizeRange | null | undefined): string | null {
  if (!size) return null;
  const { min, max } = size;
  if (min !== null && max !== null) return min === max ? `${groupNumber(min)} m²` : `${groupNumber(min)}–${groupNumber(max)} m²`;
  if (min !== null) return `From ${groupNumber(min)} m²`;
  if (max !== null) return `Up to ${groupNumber(max)} m²`;
  return null;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "3 bedrooms", "Studio" for none, or null when not given. */
export function bedroomsText(bedrooms: number | null | undefined): string | null {
  if (bedrooms === null || bedrooms === undefined) return null;
  return bedrooms === 0 ? "Studio" : plural(bedrooms, "bedroom");
}

/** "9 of 24 available", "24 units", "9 available", or null. */
export function availabilityText(unit: Pick<UnitType, "units_total" | "units_available">): string | null {
  const { units_total: total, units_available: available } = unit;
  if (total !== null && available !== null) return available === 0 ? `All ${plural(total, "unit")} sold` : `${available} of ${total} available`;
  if (available !== null) return `${available} available`;
  if (total !== null) return plural(total, "unit");
  return null;
}

// ---- The public list's address -----------------------------------------------------------

export const DEVELOPMENTS_PAGE_SIZE = 12;

export type DevelopmentFilters = {
  /** ISO 3166-1 alpha-2, upper case. */
  market?: string;
  /** A `cities` reference code. */
  city?: string;
  status?: DevelopmentStatusCode;
  q?: string;
};

export type DevelopmentsSearch = {
  filters: DevelopmentFilters;
  page: number;
  /** A parameter was unknown, repeated or invalid: the page is never indexed. */
  invalid: boolean;
  /** The address in canonical form: parameters in the order market, city, status, q, page. */
  path: string;
  /** Whether this address may be indexed when it has results (docs/seo.md). */
  indexable: boolean;
};

type RawParams = Record<string, string | string[] | undefined>;

const KNOWN = new Set(["market", "city", "status", "q", "page"]);
const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type DevelopmentSearchContext = {
  /** ISO codes the site knows (every country). Without it any two letters pass. */
  markets?: readonly string[];
  /** The reference cities, with the country each is in. Without it any code passes. */
  cities?: readonly { code: string; market_code: string | null }[];
};

/** The address of a list of projects. Empty filters are left out; page 1 has no `page`. */
export function developmentsPath(filters: DevelopmentFilters = {}, page = 1): string {
  const query = new URLSearchParams();
  if (filters.market) query.set("market", filters.market.toUpperCase());
  if (filters.city) query.set("city", filters.city);
  if (filters.status) query.set("status", filters.status);
  const q = filters.q?.trim();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/developments?${text}` : "/developments";
}

/**
 * Reads `/developments?…` into filters the API accepts. A value it would
 * refuse is dropped (and makes the address `invalid`), so the API is never
 * sent a code it does not know. Indexed: the plain list, one country alone or
 * one city alone, and their later pages. Anything else is `noindex, follow`.
 */
export function parseDevelopmentsSearch(params: RawParams, context: DevelopmentSearchContext = {}): DevelopmentsSearch {
  let invalid = false;
  const one = (key: string): string | undefined => {
    const value = params[key];
    if (Array.isArray(value)) {
      invalid = true;
      return value[0]?.trim() || undefined;
    }
    return value?.trim() || undefined;
  };
  for (const key of Object.keys(params)) if (!KNOWN.has(key)) invalid = true;

  const filters: DevelopmentFilters = {};

  const market = one("market");
  if (market) {
    const code = market.toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && (!context.markets || context.markets.includes(code))) filters.market = code;
    else invalid = true;
    if (market !== code) invalid = true;
  }

  const city = one("city");
  if (city) {
    const known = context.cities?.find((item) => item.code === city);
    const fits = CODE.test(city) && (!context.cities || (known && (!filters.market || known.market_code === filters.market)));
    if (fits) filters.city = city;
    else invalid = true;
  }

  const status = one("status");
  if (status) {
    if (isDevelopmentStatus(status)) filters.status = status;
    else invalid = true;
  }

  const q = one("q");
  if (q) filters.q = q.slice(0, 100);

  let page = 1;
  const pageText = one("page");
  if (pageText) {
    if (/^\d{1,4}$/.test(pageText) && Number(pageText) >= 1) page = Number(pageText);
    else invalid = true;
  }

  const filterCount = [filters.market, filters.city, filters.status, filters.q].filter(Boolean).length;
  const curated =
    filterCount === 0 || (filterCount === 1 && (filters.market !== undefined || filters.city !== undefined));
  return { filters, page, invalid, path: developmentsPath(filters, page), indexable: curated && !invalid };
}

/** The API query of a search (`GET /v1/developments`). */
export const developmentsQuery = (search: Pick<DevelopmentsSearch, "filters" | "page">) => ({
  market: search.filters.market,
  city: search.filters.city,
  status: search.filters.status,
  q: search.filters.q,
  page: search.page > 1 ? search.page : undefined,
  page_size: DEVELOPMENTS_PAGE_SIZE,
});

/** `/developments/zw/borrowdale-heights`: the market in lower case. */
export const developmentPath = (item: { market: { code: string } | string; slug: string }) =>
  `/developments/${(typeof item.market === "string" ? item.market : item.market.code).toLowerCase()}/${item.slug}`;

/** "Borrowdale, Harare" or "Harare, Zimbabwe": the narrow place with the country when there is no suburb. */
export function developmentPlace(location: DevelopmentLocation | null | undefined): string {
  if (!location) return "";
  const parts = location.suburb
    ? [location.suburb.label, location.city?.label]
    : [location.city?.label, location.country?.name];
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(", ");
}

/** The heading of a list: "New developments", "New developments in Zimbabwe", "Selling developments in Harare". */
export function developmentsHeading(
  filters: DevelopmentFilters,
  names: { market?: string; city?: string } = {},
): string {
  const what = filters.status ? `${developmentStatusLabels[filters.status]} developments` : "New developments";
  const where = names.city ?? names.market;
  return where ? `${what} in ${where}` : what;
}

// ---- Structured data ---------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

/** An address relative to `base` made absolute; an absolute one is left alone. */
export function absoluteFrom(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type JsonLdOrigins = {
  /** The public site (NEXT_PUBLIC_SITE_URL). */
  site: string;
  /** The public API, which serves uploaded photos and logos. */
  api: string;
};

const photoAddress = (photo: Photo, origins: JsonLdOrigins) =>
  photo.url.startsWith("/assets/") ? absoluteFrom(origins.site, photo.url) : absoluteFrom(origins.api, photo.url);

export const developmentCrumbs = (development?: Pick<DevelopmentListItem, "name" | "market" | "slug">) => [
  { name: "Home", path: "/" },
  { name: "New developments", path: "/developments" },
  ...(development
    ? [
        { name: development.market.name, path: developmentsPath({ market: development.market.code }) },
        { name: development.name, path: developmentPath(development) },
      ]
    : []),
];

function breadcrumb(crumbs: { name: string; path: string }[], origins: JsonLdOrigins): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteFrom(origins.site, crumb.path),
    })),
  };
}

/**
 * A project page: a `WebPage` about the project as a `Place` (schema.org has
 * no type for a development under way), with its breadcrumb. The address is
 * the city, suburb, region and country only; `geo` only for an exact
 * position. No `Offer`: the prices are the developer's statements and the
 * units are sold by the developer, not on this page (docs/seo.md). The
 * developer is named by its public profile, never with contact details.
 */
export function developmentJsonLd(development: Development, origins: JsonLdOrigins): JsonLd {
  const url = absoluteFrom(origins.site, developmentPath(development));
  const { location } = development;
  const locality = [location.suburb?.label, location.city?.label].filter(Boolean).join(", ");
  const coordinates = location.coordinates;
  const developer = development.developer;
  const place: JsonLd = {
    "@type": "Place",
    "@id": `${url}#place`,
    name: development.name,
    description: development.description || development.summary,
    address: {
      "@type": "PostalAddress",
      ...(locality && { addressLocality: locality }),
      ...(location.region?.label && { addressRegion: location.region.label }),
      addressCountry: location.country?.code ?? development.market.code,
    },
    ...(coordinates?.precision === "EXACT" && {
      geo: { "@type": "GeoCoordinates", latitude: coordinates.latitude, longitude: coordinates.longitude },
    }),
    ...(development.photos.length > 0 && { photo: development.photos.map((photo) => photoAddress(photo, origins)) }),
    ...(development.amenities.length > 0 && {
      amenityFeature: development.amenities.map((amenity) => ({
        "@type": "LocationFeatureSpecification",
        name: amenity.label,
        value: true,
      })),
    }),
  };
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: development.name,
    description: development.summary,
    ...(development.published_at && { datePublished: development.published_at }),
    ...(development.updated_at && { dateModified: development.updated_at }),
    ...(development.cover_photo && { primaryImageOfPage: photoAddress(development.cover_photo, origins) }),
    isPartOf: { "@id": absoluteFrom(origins.site, "/#website") },
    breadcrumb: breadcrumb(developmentCrumbs(development), origins),
    about: place,
    mainEntity: { "@id": `${url}#place` },
    mentions: {
      "@type": "Organization",
      name: developer.name,
      url: absoluteFrom(origins.site, `/directory/${developer.kind}/${developer.slug}`),
      ...(developer.logo && { logo: absoluteFrom(origins.api, developer.logo.url) }),
    },
  };
}

/** The list of projects: a `CollectionPage` with its breadcrumb and an `ItemList` of this page's projects. */
export function developmentsCollectionJsonLd(
  search: Pick<DevelopmentsSearch, "path" | "page">,
  title: string,
  page: Pick<DevelopmentPage, "items" | "total">,
  origins: JsonLdOrigins,
): JsonLd {
  const offset = (search.page - 1) * DEVELOPMENTS_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteFrom(origins.site, search.path),
    name: title,
    isPartOf: { "@id": absoluteFrom(origins.site, "/#website") },
    breadcrumb: breadcrumb(developmentCrumbs(), origins),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.total,
      itemListElement: page.items.map((item, index) => ({
        "@type": "ListItem",
        position: offset + index + 1,
        url: absoluteFrom(origins.site, developmentPath(item)),
        name: item.name,
      })),
    },
  };
}

// ---- Editor checks ----------------------------------------------------------------------------

/** A decimal price as the API takes it ("185000", "950.50"); spaces and commas typed are removed. */
export function parsePriceInput(text: string): Parsed<string | null> {
  const value = text.replace(/[\s,]/g, "");
  if (value === "") return { ok: true, value: null };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
    return { ok: false, message: "Enter the price in numbers, with at most two decimals, such as 185000 or 950.50." };
  }
  return { ok: true, value };
}

/** Compares two decimal strings exactly: negative when a < b. */
export function compareAmounts(a: string, b: string): number {
  const [aw, af = ""] = a.split(".");
  const [bw, bf = ""] = b.split(".");
  const wa = aw.replace(/^0+(?=\d)/, "");
  const wb = bw.replace(/^0+(?=\d)/, "");
  if (wa.length !== wb.length) return wa.length - wb.length;
  if (wa !== wb) return wa < wb ? -1 : 1;
  const fa = af.padEnd(2, "0");
  const fb = bf.padEnd(2, "0");
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

/** "185000.00" for the box: "185000"; "950.50" stays. */
export const amountForInput = (amount: string | null | undefined) =>
  !amount ? "" : amount.endsWith(".00") ? amount.slice(0, -3) : amount;

/** Same rule as the API: an email address, a phone number written with + or a leading 0 and 9+ digits, or a WhatsApp link. */
export function containsContactDetails(text: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return true;
  if (/wa\.me\/|whatsapp\.com\//i.test(text)) return true;
  const phones = text.match(/(?:\+|\b0)[\d\s().-]{8,}\d/g) ?? [];
  return phones.some((candidate) => candidate.replace(/\D/g, "").length >= 9);
}

export const CONTACT_DETAILS_MESSAGE =
  "Leave out email addresses, phone numbers and WhatsApp links. Customers reach you through an enquiry.";
