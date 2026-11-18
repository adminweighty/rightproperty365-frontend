import { cacheLife, cacheTag } from "next/cache";
import type { Country, ReferenceItem, ReferenceSets } from "@/lib/api/types";
import { apiGet } from "./client";

/**
 * Every country (249), by name. For forms where a person says which country
 * they are in: registration and onboarding. Changes rarely.
 */
export async function getAllCountries(): Promise<Country[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("markets");
  const { status, data } = await apiGet<{ data: Country[] }>("/v1/countries", [404]);
  if (status === 200) return data.data;
  // An API build from before the countries endpoint: its markets are the countries it knows.
  return (await apiGet<{ data: Country[] }>("/v1/markets")).data.data;
}

/**
 * The countries that have published listings, most listings first (the API's
 * order). These are the countries the public pages offer: search filters, the
 * hero's location list, the landing page, the footer and the curated pages.
 * The set follows the listings, so it is refreshed as often as they are.
 */
export async function getListingCountries(): Promise<Country[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("markets", "listings");
  // `/v1/markets` is the same data as `/v1/countries` and exists in every API build.
  const { data } = await apiGet<{ data: Country[] }>("/v1/markets?has_listings=true");
  // An API build that does not know the filter returns every country it has.
  return data.data.filter((country) => country.has_listings !== false);
}

/** Reference data changes rarely: revalidate hourly, or on demand by tag. */
async function getReferenceSets(): Promise<ReferenceSets> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference");
  // No `market`: the response then holds the regions, cities and suburbs of
  // every country that has them, each row with its `market_code`.
  const { data } = await apiGet<{ sets: ReferenceSets }>("/v1/reference");
  // Sets added later (`price_periods`) are missing from older API builds.
  return {
    ...data.sets,
    price_periods: data.sets.price_periods ?? [],
    regions: data.sets.regions ?? [],
    contact_types: data.sets.contact_types ?? [],
    contact_sources: data.sets.contact_sources ?? [],
    contact_stages: data.sets.contact_stages ?? [],
  };
}

/** Everything behind the drop-downs, filters and labels. There is no default country. */
export type Catalogue = {
  /** The countries that have listings, most listings first. */
  countries: Country[];
  /**
   * Every reference set. `regions`, `cities` and `suburbs` hold the places of
   * every country that has reference places; use `placesIn` for one country.
   */
  sets: ReferenceSets;
};

export async function getCatalogue(): Promise<Catalogue> {
  const [countries, sets] = await Promise.all([getListingCountries(), getReferenceSets()]);
  return { countries, sets };
}

export type Places = Pick<ReferenceSets, "regions" | "cities" | "suburbs">;

/**
 * The reference places of the given countries. A country that is not in the
 * reference data (most are not, yet) contributes nothing: its listings name
 * their places as free text.
 */
export function placesIn(sets: ReferenceSets, countryCodes: string[]): Places {
  const wanted = new Set(countryCodes);
  const keep = (items: ReferenceItem[]) => items.filter((item) => item.market_code !== null && wanted.has(item.market_code));
  return { regions: keep(sets.regions), cities: keep(sets.cities), suburbs: keep(sets.suburbs) };
}
