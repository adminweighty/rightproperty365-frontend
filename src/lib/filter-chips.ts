import type { ReferenceItem } from "@/lib/api/types";
import { formatArea, formatMoney } from "@/lib/format";
import { formatStay, guestCount, isNight, formatNight } from "@/lib/nights";
import { advertiserLabels, listedWithinLabel } from "@/lib/search-options";
import { filterParams, listingsPath, type ListingFilters, type SearchContext } from "@/lib/seo";

/** One filter in use: what it says, and the address of the same search without it. */
export type FilterChip = { key: string; label: string; href: string };

const rooms = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * The filters of a search as removable chips, in the order of the form. Every
 * label comes from the API's reference data or from the value itself. Sort
 * order is not a filter, so it has no chip; removing a chip keeps it.
 */
export function activeFilterChips(
  filters: ListingFilters,
  { sets, countries = [] }: SearchContext,
  currency: string | undefined,
): FilterChip[] {
  const label = (items: ReferenceItem[], code: string) => items.find((item) => item.code === code)?.label ?? code;
  const money = (amount: string) => (currency ? formatMoney({ amount, currency }) : amount);
  const without = (key: keyof ListingFilters, feature?: string): string => {
    const next: ListingFilters = { ...filters };
    if (feature) next.features = filters.features?.filter((code) => code !== feature);
    else delete next[key];
    // The two dates of a stay are one filter: both or neither.
    if (key === "check_in") delete next.check_out;
    if (next.features?.length === 0) delete next.features;
    return listingsPath(next);
  };

  const text: { [K in keyof ListingFilters]?: (value: NonNullable<ListingFilters[K]>) => string } = {
    deal: (value) => label(sets.deal_types, value),
    category: (value) => label(sets.property_categories, value),
    property_type: (value) => label(sets.property_types, value),
    // "17–20 Nov 2026 · 3 nights": one chip for the two dates.
    check_in: (value) =>
      filters.check_out && isNight(filters.check_out) ? formatStay(value, filters.check_out) : `From ${formatNight(value)}`,
    check_out: (value) => `Until ${formatNight(value)}`,
    guests_min: (value) => guestCount(value),
    country: (value) => countries.find((country) => country.code === value)?.name ?? value,
    region: (value) => label(sets.regions, value),
    city: (value) => label(sets.cities, value),
    suburb: (value) => label(sets.suburbs, value),
    min_price: (value) => `From ${money(value)}`,
    max_price: (value) => `Up to ${money(value)}`,
    currency: (value) => `Prices in ${value}`,
    bedrooms_min: (value) => `At least ${rooms(value, "bedroom")}`,
    bedrooms_max: (value) => `At most ${rooms(value, "bedroom")}`,
    bathrooms_min: (value) => `At least ${rooms(value, "bathroom")}`,
    bathrooms_max: (value) => `At most ${rooms(value, "bathroom")}`,
    floor_area_min: (value) => `Floor area from ${formatArea(Number(value))}`,
    floor_area_max: (value) => `Floor area up to ${formatArea(Number(value))}`,
    land_area_min: (value) => `Land area from ${formatArea(Number(value))}`,
    land_area_max: (value) => `Land area up to ${formatArea(Number(value))}`,
    listed_within_days: (value) => `Listed: ${listedWithinLabel(value).toLowerCase()}`,
    advertiser_type: (value) => `Advertised by: ${advertiserLabels[value]}`,
    has_photos: () => "With photos",
    reference: (value) => `Reference ${value}`,
    q: (value) => `“${value}”`,
  };

  const chips: FilterChip[] = [];
  for (const key of filterParams) {
    if (key === "features") {
      for (const code of filters.features ?? []) {
        chips.push({ key: `features-${code}`, label: label(sets.listing_features, code), href: without("features", code) });
      }
      continue;
    }
    const value = filters[key];
    const describe = text[key] as ((value: unknown) => string) | undefined;
    if (value === undefined || !describe) continue;
    // Said by the chip of the first night.
    if (key === "check_out" && filters.check_in !== undefined) continue;
    chips.push({ key, label: describe(value), href: without(key) });
  }
  return chips;
}
