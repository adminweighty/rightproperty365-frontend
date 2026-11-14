"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { selectOption, type CountedOption, type OptionGroup } from "@/lib/search-options";

type Values = { country: string; region: string; city: string; suburb: string };

type Props = {
  /** Every place, from the API's reference data, each with the code of the place it is in. */
  countries: CountedOption[];
  regions: CountedOption[];
  cities: CountedOption[];
  /** Suburbs under their city. */
  suburbs: OptionGroup[];
  defaults: Partial<Values>;
  /** The API's message for a place it refused, by parameter name. */
  errors?: Partial<Record<keyof Values, string>>;
};

const noop = () => () => {};

/** The "any" choice, then options under a heading per parent, so the list reads well when it is not narrowed. */
function grouped(any: string, options: CountedOption[], parents: CountedOption[]): SelectItem[] {
  const groups = parents
    .map((parent) => ({
      label: parent.label,
      options: options.filter((option) => option.parent === parent.value).map((option) => selectOption(option)),
    }))
    .filter((group) => group.options.length > 0);
  const loose = options.filter((option) => !parents.some((parent) => parent.value === option.parent));
  return [{ value: "", label: any }, ...groups, ...loose.map((option) => selectOption(option))];
}

/**
 * The four location selects of the listing search: country, region or
 * province, city or town, suburb. Each is a `SearchableSelect` over an ordinary select
 * named for the API's parameter.
 *
 * Without JavaScript every option is present, grouped under its parent, and a
 * combination that does not fit (a city outside the chosen region) comes back
 * from the API as a message beside the control. With JavaScript each select
 * narrows the ones after it, and a choice that no longer fits is cleared.
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
  const inCountry = (region: CountedOption) => !values.country || region.parent === values.country;
  const shownRegions = narrowing ? regions.filter(inCountry) : regions;
  const regionCodes = new Set(shownRegions.map((region) => region.value));
  const shownCities = narrowing
    ? cities.filter((city) =>
        values.region ? city.parent === values.region : !values.country || (city.parent !== undefined && regionCodes.has(city.parent)),
      )
    : cities;
  const cityCodes = new Set(shownCities.map((city) => city.value));
  const shownSuburbs = narrowing
    ? allSuburbs.filter((suburb) =>
        values.city ? suburb.parent === values.city : suburb.parent !== undefined && cityCodes.has(suburb.parent),
      )
    : allSuburbs;

  function change(key: keyof Values, value: string) {
    const next = { ...values, [key]: value };
    // Clear what no longer sits inside the new choice.
    const countryOf = (regionCode: string | undefined) => regions.find((item) => item.value === regionCode)?.parent;
    const cityFits = (cityCode: string | undefined) => {
      const city = cities.find((item) => item.value === cityCode);
      if (!city) return false;
      if (next.region) return city.parent === next.region;
      return !next.country || countryOf(city.parent) === next.country;
    };
    if (next.region && next.country && countryOf(next.region) !== next.country) next.region = "";
    if (next.city && !cityFits(next.city)) next.city = "";
    const suburb = allSuburbs.find((item) => item.value === next.suburb);
    if (suburb && (next.city ? suburb.parent !== next.city : !cityFits(suburb.parent))) next.suburb = "";
    setValues(next);
  }

  const error = (key: keyof Values, label: string) => (errors[key] ? `${label} ${errors[key]}.` : undefined);
  const countryError = error("country", "Country");
  const regionError = error("region", "Region or province");
  const cityError = error("city", "City or town");
  const suburbError = error("suburb", "Suburb");

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
          options={grouped("Any country", countries, [])}
        />
      </Field>

      <Field id="search-region" label="Region or province" error={regionError}>
        <SearchableSelect
          id="search-region"
          name="region"
          value={values.region}
          onValueChange={(value) => change("region", value)}
          aria-invalid={Boolean(regionError)}
          aria-describedby={fieldDescribedBy("search-region", { error: regionError })}
          options={grouped("Any region", shownRegions, narrowing && values.country ? [] : countries)}
        />
      </Field>

      <Field id="search-city" label="City or town" error={cityError}>
        <SearchableSelect
          id="search-city"
          name="city"
          value={values.city}
          onValueChange={(value) => change("city", value)}
          aria-invalid={Boolean(cityError)}
          aria-describedby={fieldDescribedBy("search-city", { error: cityError })}
          options={grouped("Any city or town", shownCities, narrowing && values.region ? [] : regions)}
        />
      </Field>

      <Field id="search-suburb" label="Suburb" error={suburbError}>
        <SearchableSelect
          id="search-suburb"
          name="suburb"
          value={values.suburb}
          onValueChange={(value) => change("suburb", value)}
          aria-invalid={Boolean(suburbError)}
          aria-describedby={fieldDescribedBy("search-suburb", { error: suburbError })}
          options={grouped("Any suburb", shownSuburbs, narrowing && values.city ? [] : cities)}
        />
      </Field>
    </>
  );
}
