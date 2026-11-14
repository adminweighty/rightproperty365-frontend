"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { selectOption, type CountedOption, type OptionGroup } from "@/lib/search-options";

type Values = { country: string; region: string; city: string; suburb: string };

type Props = {
  /** The countries on offer: those that have listings, and the chosen one. */
  countries: CountedOption[];
  /**
   * The reference places of those countries, each with the code of its
   * country (`country`) and of the place it is in (`parent`). A country
   * without reference places has none.
   */
  regions: CountedOption[];
  cities: CountedOption[];
  /** Suburbs under their city. */
  suburbs: OptionGroup[];
  defaults: Partial<Values>;
  /** The API's message for a place it refused, by parameter name. */
  errors?: Partial<Record<keyof Values, string>>;
};

const noop = () => () => {};

const byCountry = (option: CountedOption) => option.country;
const byParent = (option: CountedOption) => option.parent;

/** The "any" choice, then options under a heading per parent, so the list reads well when it is not narrowed. */
function grouped(
  any: string,
  options: CountedOption[],
  parents: CountedOption[],
  parentOf: (option: CountedOption) => string | undefined,
): SelectItem[] {
  const groups = parents
    .map((parent) => ({
      label: parent.label,
      options: options.filter((option) => parentOf(option) === parent.value).map((option) => selectOption(option)),
    }))
    .filter((group) => group.options.length > 0);
  const loose = options.filter((option) => !parents.some((parent) => parent.value === parentOf(option)));
  return [{ value: "", label: any }, ...groups, ...loose.map((option) => selectOption(option))];
}

/**
 * The location selects of the listing search: country, region or province,
 * city or town, suburb. Each is a `SearchableSelect` over an ordinary select
 * named for the API's parameter.
 *
 * Without JavaScript every option is present, grouped under its parent, and a
 * combination that does not fit (a city outside the chosen region) comes back
 * from the API as a message beside the control. With JavaScript each select
 * narrows the ones after it, and a choice that no longer fits is cleared.
 *
 * A kind of place the chosen country has no reference list for is not asked
 * for. Most countries have none at all: their listings name the city as free
 * text, which only the keyword box can search, and a line says so.
 */
export function LocationFields({ countries, regions, cities, suburbs, defaults, errors = {} }: Props) {
  const [values, setValues] = useState<Values>({
    country: defaults.country ?? "",
    region: defaults.region ?? "",
    city: defaults.city ?? "",
    suburb: defaults.suburb ?? "",
  });
  // False on the server and for the first client render, so the HTML holds every option.
  const narrowing = useSyncExternalStore(noop, () => true, () => false);

  const allSuburbs = suburbs.flatMap((group) => group.options);
  const inCountry = (place: CountedOption) => !values.country || place.country === values.country;

  // What the chosen country has. With no country chosen, every kind is offered.
  const hasRegions = regions.some(inCountry);
  const hasCities = cities.some(inCountry);
  const hasSuburbs = allSuburbs.some(inCountry);
  const countryName = countries.find((country) => country.value === values.country)?.label;

  const shownRegions = narrowing ? regions.filter(inCountry) : regions;
  const shownCities = narrowing
    ? cities.filter((city) => (values.region ? city.parent === values.region : inCountry(city)))
    : cities;
  const shownSuburbs = narrowing
    ? allSuburbs.filter((suburb) =>
        values.city ? suburb.parent === values.city : shownCities.some((city) => city.value === suburb.parent),
      )
    : allSuburbs;

  function change(key: keyof Values, value: string) {
    const next = { ...values, [key]: value };
    // Clear what no longer sits inside the new choice.
    const fits = (place: CountedOption | undefined) =>
      place !== undefined && (!next.country || place.country === next.country);
    if (next.region && !fits(regions.find((item) => item.value === next.region))) next.region = "";
    const city = cities.find((item) => item.value === next.city);
    if (next.city && (!fits(city) || (next.region && city?.parent !== next.region))) next.city = "";
    const suburb = allSuburbs.find((item) => item.value === next.suburb);
    const suburbCity = cities.find((item) => item.value === suburb?.parent);
    if (
      next.suburb &&
      (!fits(suburb) ||
        (next.city ? suburb?.parent !== next.city : Boolean(next.region) && suburbCity?.parent !== next.region))
    ) {
      next.suburb = "";
    }
    setValues(next);
  }

  const error = (key: keyof Values, label: string) => (errors[key] ? `${label} ${errors[key]}.` : undefined);
  const countryError = error("country", "Country");
  const regionError = error("region", "Region or province");
  const cityError = error("city", "City or town");
  const suburbError = error("suburb", "Suburb");
  // Cities sit under their region; in a country without regions, under the country.
  const cityParents = regions.length > 0 ? regions : countries;

  return (
    <>
      <Field id="search-country" label="Country" error={countryError}>
        <SearchableSelect
          id="search-country"
          name="country"
          value={values.country}
          onValueChange={(value) => change("country", value)}
          aria-invalid={Boolean(countryError)}
          aria-describedby={fieldDescribedBy("search-country", { error: countryError })}
          options={grouped("Any country", countries, [], byCountry)}
        />
      </Field>

      {(hasRegions || regionError) && (
        <Field id="search-region" label="Region or province" error={regionError}>
          <SearchableSelect
            id="search-region"
            name="region"
            value={values.region}
            onValueChange={(value) => change("region", value)}
            aria-invalid={Boolean(regionError)}
            aria-describedby={fieldDescribedBy("search-region", { error: regionError })}
            options={grouped("Any region", shownRegions, narrowing && values.country ? [] : countries, byCountry)}
          />
        </Field>
      )}

      {(hasCities || cityError) && (
        <Field id="search-city" label="City or town" error={cityError}>
          <SearchableSelect
            id="search-city"
            name="city"
            value={values.city}
            onValueChange={(value) => change("city", value)}
            aria-invalid={Boolean(cityError)}
            aria-describedby={fieldDescribedBy("search-city", { error: cityError })}
            options={grouped(
              "Any city or town",
              shownCities,
              narrowing && values.region ? [] : cityParents,
              regions.length > 0 ? byParent : byCountry,
            )}
          />
        </Field>
      )}

      {(hasSuburbs || suburbError) && (
        <Field id="search-suburb" label="Suburb" error={suburbError}>
          <SearchableSelect
            id="search-suburb"
            name="suburb"
            value={values.suburb}
            onValueChange={(value) => change("suburb", value)}
            aria-invalid={Boolean(suburbError)}
            aria-describedby={fieldDescribedBy("search-suburb", { error: suburbError })}
            options={grouped("Any suburb", shownSuburbs, narrowing && values.city ? [] : cities, byParent)}
          />
        </Field>
      )}

      {values.country && !hasCities && (
        <p className="self-end text-sm leading-relaxed text-muted sm:col-span-2 lg:col-span-3" role="status">
          We have no list of regions, cities or suburbs for {countryName ?? "this country"} yet. To narrow
          the search to a town or an area, type its name in the keyword box.
        </p>
      )}
    </>
  );
}
