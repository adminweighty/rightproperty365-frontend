"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, fieldDescribedBy, Select } from "@/components/ui/field";
import { optionText, type CountedOption, type OptionGroup } from "@/lib/search-options";

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

/** Options under a heading per parent, so the list reads well when it is not narrowed. */
function Grouped({ options, parents }: { options: CountedOption[]; parents: CountedOption[] }) {
  const groups = parents
    .map((parent) => ({ parent, items: options.filter((option) => option.parent === parent.value) }))
    .filter((group) => group.items.length > 0);
  const loose = options.filter((option) => !parents.some((parent) => parent.value === option.parent));
  return (
    <>
      {groups.map(({ parent, items }) => (
        <optgroup key={parent.value} label={parent.label}>
          {items.map((option) => (
            <option key={option.value} value={option.value}>
              {optionText(option)}
            </option>
          ))}
        </optgroup>
      ))}
      {loose.map((option) => (
        <option key={option.value} value={option.value}>
          {optionText(option)}
        </option>
      ))}
    </>
  );
}

/**
 * The four location selects of the listing search: country, region or
 * province, city or town, suburb. They are ordinary selects named for the
 * API's parameters.
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
        <Select
          id="search-country"
          name="country"
          value={values.country}
          onChange={(event) => change("country", event.target.value)}
          aria-invalid={Boolean(countryError)}
          aria-describedby={fieldDescribedBy("search-country", { error: countryError })}
        >
          <option value="">Any country</option>
          {countries.map((option) => (
            <option key={option.value} value={option.value}>
              {optionText(option)}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="search-region" label="Region or province" error={regionError}>
        <Select
          id="search-region"
          name="region"
          value={values.region}
          onChange={(event) => change("region", event.target.value)}
          aria-invalid={Boolean(regionError)}
          aria-describedby={fieldDescribedBy("search-region", { error: regionError })}
        >
          <option value="">Any region</option>
          <Grouped options={shownRegions} parents={narrowing && values.country ? [] : countries} />
        </Select>
      </Field>

      <Field id="search-city" label="City or town" error={cityError}>
        <Select
          id="search-city"
          name="city"
          value={values.city}
          onChange={(event) => change("city", event.target.value)}
          aria-invalid={Boolean(cityError)}
          aria-describedby={fieldDescribedBy("search-city", { error: cityError })}
        >
          <option value="">Any city or town</option>
          <Grouped options={shownCities} parents={narrowing && values.region ? [] : regions} />
        </Select>
      </Field>

      <Field id="search-suburb" label="Suburb" error={suburbError}>
        <Select
          id="search-suburb"
          name="suburb"
          value={values.suburb}
          onChange={(event) => change("suburb", event.target.value)}
          aria-invalid={Boolean(suburbError)}
          aria-describedby={fieldDescribedBy("search-suburb", { error: suburbError })}
        >
          <option value="">Any suburb</option>
          <Grouped options={shownSuburbs} parents={narrowing && values.city ? [] : cities} />
        </Select>
      </Field>
    </>
  );
}
