import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input, Select } from "@/components/ui/field";
import { optionText, type OptionGroup, type SearchOptions } from "@/lib/search-options";
import type { ListingFilters } from "@/lib/seo";

type Props = { options: SearchOptions; defaults: ListingFilters };

function GroupedOptions({ groups }: { groups: OptionGroup[] }) {
  return groups.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.options.map((option) => (
        <option key={option.value} value={option.value}>
          {optionText(option)}
        </option>
      ))}
    </optgroup>
  ));
}

/**
 * The extra filters of the listing search, inside the SearchBar form: property
 * type, city, suburb, price range, bedrooms, bathrooms, features and sort
 * order. It is a native `<details>`, so it opens and closes without
 * JavaScript, and it starts open when one of its filters is in use.
 *
 * Every list comes from the API. The number beside an option is how many
 * listings it has for the current search.
 */
export function ListingFilterPanel({ options, defaults }: Props) {
  const inUse = [
    defaults.property_type,
    defaults.city,
    defaults.suburb,
    defaults.min_price,
    defaults.max_price,
    defaults.bedrooms_min,
    defaults.bathrooms_min,
    defaults.sort,
    ...(defaults.features ?? []),
  ].filter((value) => value !== undefined).length;

  // Without a keyword the API sorts newest first; with one, by best match.
  const defaultSort = defaults.q ? "relevance" : "newest";

  const priceHint = options.priceRange
    ? `This search has prices from ${options.priceRange}.`
    : undefined;

  return (
    <details open={inUse > 0} className="group mt-3 border-t border-line pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="group-open:hidden">More filters</span>
        <span className="hidden group-open:inline">Fewer filters</span>
        {inUse > 0 && (
          <Badge tone="primary">
            {inUse} <span className="sr-only">in use</span>
          </Badge>
        )}
      </summary>

      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="search-property-type" label="Property type">
          <Select id="search-property-type" name="property_type" defaultValue={defaults.property_type ?? ""}>
            <option value="">Any property type</option>
            <GroupedOptions groups={options.propertyTypes} />
          </Select>
        </Field>

        <Field id="search-city" label="City or town">
          <Select id="search-city" name="city" defaultValue={defaults.city ?? ""}>
            <option value="">Any city or town</option>
            {options.cities.map((option) => (
              <option key={option.value} value={option.value}>
                {optionText(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="search-suburb" label="Suburb">
          <Select id="search-suburb" name="suburb" defaultValue={defaults.suburb ?? ""}>
            <option value="">Any suburb</option>
            <GroupedOptions groups={options.suburbs} />
          </Select>
        </Field>

        <Field id="search-sort" label="Sort by">
          {/* The API's default order is the empty option, so it adds nothing to the address. */}
          <Select
            id="search-sort"
            name="sort"
            defaultValue={defaults.sort === defaultSort ? "" : (defaults.sort ?? "")}
          >
            {options.sorts
              .filter((option) => option.value === defaultSort)
              .map((option) => (
                <option key={option.value} value="">
                  {option.label}
                </option>
              ))}
            {options.sorts
              .filter((option) => option.value !== defaultSort)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </Select>
        </Field>

        <Field
          id="search-min-price"
          label={`Lowest price${options.currency ? ` (${options.currency})` : ""}`}
          hint={priceHint}
        >
          <Input
            id="search-min-price"
            name="min_price"
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            defaultValue={defaults.min_price ?? ""}
            aria-describedby={fieldDescribedBy("search-min-price", { hint: priceHint })}
          />
        </Field>

        <Field id="search-max-price" label={`Highest price${options.currency ? ` (${options.currency})` : ""}`}>
          <Input
            id="search-max-price"
            name="max_price"
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            defaultValue={defaults.max_price ?? ""}
          />
        </Field>

        <Field id="search-bedrooms" label="Bedrooms">
          <Select id="search-bedrooms" name="bedrooms_min" defaultValue={defaults.bedrooms_min ?? ""}>
            <option value="">Any number</option>
            {options.bedrooms.map((option) => (
              <option key={option.value} value={option.value}>
                {optionText(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="search-bathrooms" label="Bathrooms, at least">
          <Input
            id="search-bathrooms"
            name="bathrooms_min"
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            step={1}
            defaultValue={defaults.bathrooms_min ?? ""}
          />
        </Field>
      </div>

      {options.features.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink">Features</legend>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            {options.features.map((option) => (
              <li key={option.value}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="features"
                    value={option.value}
                    defaultChecked={defaults.features?.includes(option.value)}
                    className="size-5 shrink-0 accent-(--rp-color-primary-base)"
                  />
                  <span>
                    {option.label}
                    {option.count !== undefined && <span className="text-muted"> ({option.count})</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap gap-3 pb-1">
        <Button type="submit">Apply filters</Button>
        {/* A link, not a reset button: clearing is a navigation, and it works without JavaScript. */}
        <ButtonLink href="/listings" variant="secondary">
          Clear filters
        </ButtonLink>
      </div>
    </details>
  );
}
