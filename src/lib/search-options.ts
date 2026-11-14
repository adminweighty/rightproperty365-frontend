import type {
  AdvertiserType,
  Country,
  FacetCount,
  ListingFacets,
  ListingSort,
  ReferenceItem,
  ReferenceSets,
} from "@/lib/api/types";
import type { SelectGroup, SelectOption } from "@/lib/searchable-select";
import { formatMoney } from "@/lib/format";
import { advertiserTypes, listedWithinChoices, listingSorts, type ListingFilters } from "@/lib/seo";

/**
 * The option lists of the search forms, built on the server from the API's
 * reference data (which values exist) and search facets (how many listings
 * each one has for the current search). Passed to the forms as props.
 */

export type CountedOption = {
  value: string;
  label: string;
  count?: number;
  /** The code of the place this one is in: a city's region, a suburb's city. */
  parent?: string;
  /** Places only: the code of the country the place is in. */
  country?: string;
};
export type OptionGroup = { label: string; options: CountedOption[] };

export type SearchOptions = {
  deals: CountedOption[];
  categories: CountedOption[];
  /** Property types under their category. */
  propertyTypes: OptionGroup[];
  /** The countries that have listings, and the chosen one. */
  countries: CountedOption[];
  /**
   * Regions, cities and suburbs of the countries on offer. A country with no
   * reference places has none: its listings name their places as free text.
   */
  regions: CountedOption[];
  cities: CountedOption[];
  /** Suburbs under their city. */
  suburbs: OptionGroup[];
  /** "Listed in the last N days". */
  listedWithin: CountedOption[];
  advertisers: CountedOption[];
  /** "At least n bedrooms", for the bedroom counts that exist in the result. */
  bedrooms: CountedOption[];
  features: CountedOption[];
  sorts: CountedOption[];
  /** The price range of the result, e.g. "USD 600 to USD 640,000". Undefined when there is none. */
  priceRange?: string;
  /**
   * The one currency of the search: the chosen one, the chosen country's, or
   * the only one the results are priced in. Undefined when the results are in
   * several and nothing was chosen: a price filter then needs a currency.
   */
  currency?: string;
  /** The currencies the results are priced in, with how many listings each has. */
  currencies: CountedOption[];
};

/**
 * `sort` is a fixed enum of the search endpoint, not a reference set, so its
 * four labels are the one list written here.
 */
const sortLabels: Record<ListingSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  price_asc: "Price, lowest first",
  price_desc: "Price, highest first",
  area_desc: "Largest first",
  relevance: "Best match",
};

/** Also enums of the search endpoint, so labelled here. "Real Estate Agency" is a role title. */
export const advertiserLabels: Record<AdvertiserType, string> = {
  agency: "Real Estate Agency",
  private: "Private owner",
};

export const listedWithinLabel = (days: number) =>
  days === 1 ? "Last 24 hours" : `Last ${days} days`;

const FEATURE_LIMIT = 12;

const counted = (items: ReferenceItem[], facet: FacetCount[] | undefined): CountedOption[] =>
  items.map(({ code, label, parent_code, market_code }) => ({
    value: code,
    label,
    parent: parent_code ?? undefined,
    country: market_code ?? undefined,
    // With facets, a value that is not in them has no listings.
    count: facet ? (facet.find((item) => item.code === code)?.count ?? 0) : undefined,
  }));

function grouped(
  items: ReferenceItem[],
  parents: ReferenceItem[],
  facet: FacetCount[] | undefined,
  onlyParent: string | undefined,
): OptionGroup[] {
  return parents
    .filter((parent) => !onlyParent || parent.code === onlyParent)
    .map((parent) => ({
      label: parent.label,
      options: counted(
        items.filter((item) => item.parent_code === parent.code),
        facet,
      ),
    }))
    .filter((group) => group.options.length > 0);
}

/**
 * `countries` are the countries that have listings. `chosen` is the country
 * of the search when the visitor chose one, which may have no listings.
 */
export function buildSearchOptions(
  sets: ReferenceSets,
  facets: ListingFacets | undefined,
  filters: ListingFilters = {},
  countries: Country[] = [],
  chosen?: Pick<Country, "code" | "name" | "currency_code">,
): SearchOptions {
  const offered = chosen && !countries.some((country) => country.code === chosen.code) ? [...countries, chosen] : countries;
  // Places are offered for the countries on offer only. With no country chosen
  // those are the countries that have listings.
  const codes = new Set(offered.map((country) => country.code));
  const onOffer = (items: ReferenceItem[]) => items.filter((item) => item.market_code === null || codes.has(item.market_code));
  const regions = onOffer(sets.regions);
  const cities = onOffer(sets.cities);
  const suburbs = onOffer(sets.suburbs);

  // "n+ bedrooms" counts every listing with at least n.
  const bedroomFacet = (facets?.bedrooms ?? []).filter((item) => Number(item.code) > 0);
  const bedrooms: CountedOption[] = bedroomFacet.map((item) => ({
    value: item.code,
    label: `${item.code}+`,
    count: bedroomFacet
      .filter((other) => Number(other.code) >= Number(item.code))
      .reduce((sum, other) => sum + other.count, 0),
  }));
  if (filters.bedrooms_min && !bedrooms.some((option) => option.value === String(filters.bedrooms_min))) {
    bedrooms.push({ value: String(filters.bedrooms_min), label: `${filters.bedrooms_min}+`, count: 0 });
    bedrooms.sort((a, b) => Number(a.value) - Number(b.value));
  }

  // The most common features of the result, plus any that are ticked.
  const featureFacet = facets?.features ?? [];
  const features: CountedOption[] = featureFacet
    .slice(0, FEATURE_LIMIT)
    .map(({ code, label, count }) => ({ value: code, label, count }));
  for (const code of filters.features ?? []) {
    if (features.some((option) => option.value === code)) continue;
    const label = sets.listing_features.find((item) => item.code === code)?.label ?? code;
    features.push({ value: code, label, count: featureFacet.find((item) => item.code === code)?.count ?? 0 });
  }

  const price = facets?.price ?? undefined;
  const priceRange =
    price?.min && price.max
      ? `${formatMoney({ amount: price.min, currency: price.currency })} to ${formatMoney({ amount: price.max, currency: price.currency })}`
      : undefined;
  const currencies: CountedOption[] = (facets?.currencies ?? []).map(({ code, count }) => ({ value: code, label: code, count }));
  if (filters.currency && !currencies.some((option) => option.value === filters.currency)) {
    currencies.push({ value: filters.currency, label: filters.currency, count: facets ? 0 : undefined });
  }
  const currency =
    price?.currency ?? filters.currency ?? chosen?.currency_code ?? (currencies.length === 1 ? currencies[0].value : undefined);

  return {
    deals: counted(sets.deal_types, facets?.deal),
    categories: counted(sets.property_categories, facets?.category),
    propertyTypes: grouped(sets.property_types, sets.property_categories, facets?.property_type, filters.category),
    countries: offered.map(({ code, name }) => ({
      value: code,
      label: name,
      count: facets?.country ? (facets.country.find((item) => item.code === code)?.count ?? 0) : undefined,
    })),
    // The API counts regions only within a country; without one the facet is empty, so no counts are shown.
    regions: counted(regions, facets?.region?.length ? facets.region : undefined),
    cities: counted(cities, facets?.city),
    // Every suburb on offer, so the form is complete without JavaScript; LocationFields narrows it with.
    suburbs: grouped(suburbs, cities, facets?.suburb, undefined),
    listedWithin: [...new Set([...listedWithinChoices, ...(filters.listed_within_days ? [filters.listed_within_days] : [])])]
      .sort((a, b) => a - b)
      .map((days) => ({ value: String(days), label: listedWithinLabel(days) })),
    advertisers: advertiserTypes.map((value) => ({ value, label: advertiserLabels[value] })),
    bedrooms,
    features,
    sorts: listingSorts.map((value) => ({ value, label: sortLabels[value] })),
    priceRange,
    currency,
    currencies,
  };
}

/** "Harare (12)". The count is left out when it is not known. */
export const optionText = ({ label, count }: CountedOption) =>
  count === undefined ? label : `${label} (${count})`;

/** A counted option for `SearchableSelect`: the count becomes its secondary text, "Harare (12)". */
export const selectOption = ({ value, label, count }: CountedOption, prefix = ""): SelectOption => ({
  value: `${prefix}${value}`,
  label,
  secondary: count === undefined ? undefined : `(${count})`,
});

/** Groups of counted options for `SearchableSelect`. */
export const selectGroups = (groups: OptionGroup[], prefix = ""): SelectGroup[] =>
  groups.map((group) => ({ label: group.label, options: group.options.map((option) => selectOption(option, prefix)) }));
