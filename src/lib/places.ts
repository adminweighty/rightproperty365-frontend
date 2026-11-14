/**
 * Where a listing or a profile is, as text.
 *
 * A place from the API is `{ code, label }`. The suburb and the region may be
 * missing, and a place whose `code` is null was typed by the lister (a country
 * with no reference places). So a location line is built from whatever is
 * there, and never prints "undefined", "null" or an empty part.
 *
 * Pure functions with no imports, so `npm test` can run them.
 */

type PlacePart = { label?: string | null } | null | undefined;
type CountryPart = { name?: string | null } | null | undefined;

export type Located = {
  suburb?: PlacePart;
  city?: PlacePart;
  region?: PlacePart;
  country?: CountryPart;
};

/** Joins the parts that have text with ", ", leaving out one that repeats the part before it. */
export function joinPlaces(parts: (string | null | undefined)[]): string {
  const shown: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    if (shown.at(-1)?.toLowerCase() === text.toLowerCase()) continue;
    shown.push(text);
  }
  return shown.join(", ");
}

/**
 * The whole place: suburb, city, region, country. A region with the city's
 * name ("Harare, Harare") is said once.
 */
export function fullPlace({ suburb, city, region, country }: Located): string {
  return joinPlaces([suburb?.label, city?.label, region?.label, country?.name]);
}

/**
 * The place on a card or in a title: suburb and city ("Avondale, Harare").
 * Where one of them is missing the country stands in ("Grand Baie,
 * Mauritius"), so the line still says where in the world the place is.
 */
export function shortPlace({ suburb, city, region, country }: Located): string {
  const local = joinPlaces([suburb?.label, city?.label]);
  if (local.includes(", ")) return local;
  return joinPlaces([local || region?.label, country?.name]);
}

/** The narrowest place named: the suburb, else the city, the region, the country. Empty when there is none. */
export function narrowestPlace({ suburb, city, region, country }: Located): string {
  return joinPlaces([suburb?.label]) || joinPlaces([city?.label]) || joinPlaces([region?.label]) || joinPlaces([country?.name]);
}

/** Where a professional or a business is: city and country ("London, United Kingdom"). */
export function profilePlace({ city, region, country }: Located): string {
  return joinPlaces([city?.label || region?.label, country?.name]);
}
