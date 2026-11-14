import type { FacetCount, ListingFacets, ListingSort, ReferenceItem, ReferenceSets } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { listingSorts, type ListingFilters } from "@/lib/seo";

/**
 * The option lists of the search forms, built on the server from the API's
 * reference data (which values exist) and search facets (how many listings
 * each one has for the current search). Passed to the forms as props.
 */

export type CountedOption = { value: string; label: string; count?: number };
export type OptionGroup = { label: string; options: CountedOption[] };

export type SearchOptions = {
  deals: CountedOption[];
  categories: CountedOption[];
  /** Property types under their category. */
  propertyTypes: OptionGroup[];
  cities: CountedOption[];
  /** Suburbs under their city. */
  suburbs: OptionGroup[];
  /** "At least n bedrooms", for the bedroom counts that exist in the result. */
  bedrooms: CountedOption[];
  features: CountedOption[];
  sorts: CountedOption[];
  /** The price range of the result, e.g. "USD 600 to USD 640,000". Undefined when there is none. */
  priceRange?: string;
  currency?: string;
};

/**
 * `sort` is a fixed enum of the search endpoint, not a reference set, so its
 * four labels are the one list written here.
 */
const sortLabels: Record<ListingSort, string> = {
  newest: "Newest first",
  price_asc: "Price, lowest first",
  price_desc: "Price, highest first",
  relevance: "Best match",
};

const FEATURE_LIMIT = 12;

const counted = (items: ReferenceItem[], facet: FacetCount[] | undefined): CountedOption[] =>
  items.map(({ code, label }) => ({
    value: code,
    label,
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

export function buildSearchOptions(
  sets: ReferenceSets,
  facets: ListingFacets | undefined,
  filters: ListingFilters = {},
): SearchOptions {
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

  const price = facets?.price;
  const priceRange =
    price?.min && price.max
      ? `${formatMoney({ amount: price.min, currency: price.currency })} to ${formatMoney({ amount: price.max, currency: price.currency })}`
      : undefined;

  return {
    deals: counted(sets.deal_types, facets?.deal),
    categories: counted(sets.property_categories, facets?.category),
    propertyTypes: grouped(sets.property_types, sets.property_categories, facets?.property_type, filters.category),
    cities: counted(sets.cities, facets?.city),
    suburbs: grouped(sets.suburbs, sets.cities, facets?.suburb, filters.city),
    bedrooms,
    features,
    sorts: listingSorts.map((value) => ({ value, label: sortLabels[value] })),
    priceRange,
    currency: price?.currency,
  };
}

/** "Harare (12)". The count is left out when it is not known. */
export const optionText = ({ label, count }: CountedOption) =>
  count === undefined ? label : `${label} (${count})`;
