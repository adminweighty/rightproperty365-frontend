import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { StayFields } from "@/components/listings/stay-fields";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { selectGroups, selectOption, type SearchOptions } from "@/lib/search-options";
import { isStaySearch, SHORT_STAY, type ListingFilters } from "@/lib/seo";

type Props = {
  options: SearchOptions;
  defaults: ListingFilters;
  /** Open the panel even when none of its filters is in use (`advanced=1`). */
  open?: boolean;
  /** The API's message for a parameter it refused, by parameter name. */
  errors?: Record<string, string>;
};

/** A named group of filters: a fieldset whose legend is the group's heading. */
function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 border-t border-line pt-4 first:mt-2 first:border-0 first:pt-0">
      <legend className="float-left mb-3 w-full text-base font-semibold text-ink">{legend}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

type NumberFieldProps = {
  name: keyof ListingFilters & string;
  label: string;
  defaults: ListingFilters;
  errors: Record<string, string>;
  hint?: string;
  /** Whole numbers (rooms) or any amount (prices, areas). */
  step?: number | "any";
  max?: number;
};

/** A number input for one parameter, with the API's message under it when it was refused. */
function NumberField({ name, label, defaults, errors, hint, step = "any", max }: NumberFieldProps) {
  const id = `search-${name.replaceAll("_", "-")}`;
  // The API names the other parameter by its code ("must not be lower than bedrooms_min").
  const error = errors[name] ? `${label} ${errors[name].replace(/\b[a-z]+(_[a-z]+)+\b/g, "the lowest value")}.` : undefined;
  const value = defaults[name];
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={step}
        defaultValue={typeof value === "number" || typeof value === "string" ? value : ""}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(id, { hint, error })}
      />
    </Field>
  );
}

/**
 * The advanced search of the listing search, inside the SearchBar form, in
 * groups: Property, Short stays (when the category is short stays, or none
 * is chosen), Price and More. (Location sits above it, always visible.) It is a native `<details>`, so it opens and closes without
 * JavaScript, and it starts open when one of its filters is in use, when the
 * API refused one of them, or when the address asks for it (`advanced=1`).
 *
 * Every list comes from the API. The number beside an option is how many
 * listings it has for the current search.
 */
export function ListingFilterPanel({ options, defaults, open = false, errors = {} }: Props) {
  const keys: (keyof ListingFilters)[] = [
    "property_type",
    "check_in",
    "check_out",
    "guests_min",
    "min_price",
    "max_price",
    "currency",
    "bedrooms_min",
    "bedrooms_max",
    "bathrooms_min",
    "bathrooms_max",
    "floor_area_min",
    "floor_area_max",
    "land_area_min",
    "land_area_max",
    "listed_within_days",
    "advertiser_type",
    "has_photos",
    "reference",
    "sort",
  ];
  const inUse =
    keys.filter((key) => defaults[key] !== undefined).length + (defaults.features?.length ?? 0);
  const refused = keys.some((key) => errors[key] !== undefined) || errors.features !== undefined;

  // Without a keyword the API sorts newest first; with one, by best match.
  const defaultSort = defaults.q ? "relevance" : "newest";
  const currency = options.currency ? ` (${options.currency})` : "";
  const priceHint = options.priceRange ? `This search has prices from ${options.priceRange}.` : undefined;
  // One currency per search. Results in several, with neither a currency nor a
  // country chosen, cannot be filtered by price until one is.
  const needsCurrency = !options.currency && options.currencies.length > 1;
  const offerCurrency = options.currencies.length > 1 || defaults.currency !== undefined || errors.currency !== undefined;
  const currencyHint = needsCurrency
    ? "Choose a currency or a country to filter by price."
    : "Prices are compared in this currency. Nothing is converted.";
  // The price boxes stay when they hold a value, so a refused search can be put right in one go.
  const showPrices = !needsCurrency || defaults.min_price !== undefined || defaults.max_price !== undefined;
  const shared = { defaults, errors };
  // Nights and guests belong to short stays: offered for that category, when
  // no category is chosen (they then narrow the search to short stays), and
  // whenever they are in use, so they can always be seen and changed.
  const offerStay =
    (defaults.category ?? SHORT_STAY) === SHORT_STAY || isStaySearch(defaults) || ["check_in", "check_out", "guests_min"].some((key) => errors[key]);
  const stayCategoryError = isStaySearch(defaults) ? errors.category : undefined;

  return (
    <details
      id="advanced-search"
      open={open || inUse > 0 || refused}
      className="group mt-4 scroll-mt-24 border-t border-line pt-1"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold text-primary-ink [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="group-open:hidden">Advanced search</span>
        <span className="hidden group-open:inline">Hide advanced search</span>
        {inUse > 0 && (
          <Badge tone="primary">
            {inUse} <span className="sr-only">in use</span>
          </Badge>
        )}
      </summary>

      <Group legend="Property">
        <Field id="search-property-type" label="Property type">
          <SearchableSelect
            id="search-property-type"
            name="property_type"
            defaultValue={defaults.property_type ?? ""}
            options={[{ value: "", label: "Any property type" }, ...selectGroups(options.propertyTypes)]}
          />
        </Field>
        <NumberField name="bedrooms_min" label="Bedrooms, at least" step={1} max={50} {...shared} />
        <NumberField name="bedrooms_max" label="Bedrooms, at most" step={1} max={50} {...shared} />
        <NumberField name="bathrooms_min" label="Bathrooms, at least" step={1} max={50} {...shared} />
        <NumberField name="bathrooms_max" label="Bathrooms, at most" step={1} max={50} {...shared} />
        <NumberField name="floor_area_min" label="Floor area, at least (m²)" {...shared} />
        <NumberField name="floor_area_max" label="Floor area, at most (m²)" {...shared} />
        <NumberField name="land_area_min" label="Land area, at least (m²)" {...shared} />
        <NumberField name="land_area_max" label="Land area, at most (m²)" {...shared} />
      </Group>

      {offerStay && (
        <Group legend="Short stays">
          <StayFields
            key={[defaults.check_in, defaults.check_out, defaults.guests_min].join("|")}
            defaults={defaults}
            errors={errors}
          />
          <p className="text-sm leading-relaxed text-muted sm:col-span-2 lg:col-span-4">
            {stayCategoryError ? (
              <span className="text-danger">
                Dates and guests can only be used with short stays. Choose the short stays category, or clear them.
              </span>
            ) : (
              "Dates and guests find places let by the night that are free for every night of the stay. Availability is the host’s own calendar; a stay is agreed with the host, not booked here."
            )}
          </p>
        </Group>
      )}

      <Group legend="Price">
        {offerCurrency && (
          <Field id="search-currency" label="Currency" hint={currencyHint} error={errors.currency}>
            <SearchableSelect
              id="search-currency"
              name="currency"
              defaultValue={defaults.currency ?? ""}
              aria-invalid={Boolean(errors.currency)}
              aria-describedby={fieldDescribedBy("search-currency", { hint: currencyHint, error: errors.currency })}
              options={[
                { value: "", label: needsCurrency ? "Choose a currency" : "No currency chosen" },
                ...options.currencies.map((option) => selectOption(option)),
              ]}
            />
          </Field>
        )}
        {showPrices && (
          <>
            <NumberField name="min_price" label={`Lowest price${currency}`} hint={priceHint} {...shared} />
            <NumberField name="max_price" label={`Highest price${currency}`} {...shared} />
          </>
        )}
      </Group>

      <Group legend="More">
        <Field id="search-listed-within" label="Listed">
          <SearchableSelect
            id="search-listed-within"
            name="listed_within_days"
            defaultValue={defaults.listed_within_days === undefined ? "" : String(defaults.listed_within_days)}
            options={[{ value: "", label: "At any time" }, ...options.listedWithin.map(({ value, label }) => ({ value, label }))]}
          />
        </Field>

        <Field id="search-advertiser" label="Advertised by">
          <SearchableSelect
            id="search-advertiser"
            name="advertiser_type"
            defaultValue={defaults.advertiser_type ?? ""}
            options={[{ value: "", label: "Anyone" }, ...options.advertisers.map(({ value, label }) => ({ value, label }))]}
          />
        </Field>

        <Field id="search-reference" label="Listing reference" error={errors.reference ? `Listing reference ${errors.reference}.` : undefined}>
          <Input
            id="search-reference"
            name="reference"
            maxLength={40}
            autoComplete="off"
            defaultValue={defaults.reference ?? ""}
            aria-invalid={Boolean(errors.reference)}
            aria-describedby={fieldDescribedBy("search-reference", { error: errors.reference })}
          />
        </Field>

        <Field id="search-sort" label="Sort by">
          {/* The API's default order is the empty option, so it adds nothing to the address. */}
          <SearchableSelect
            id="search-sort"
            name="sort"
            defaultValue={defaults.sort === defaultSort ? "" : (defaults.sort ?? "")}
            options={[
              ...options.sorts.filter((option) => option.value === defaultSort).map(({ label }) => ({ value: "", label })),
              ...options.sorts.filter((option) => option.value !== defaultSort).map(({ value, label }) => ({ value, label })),
            ]}
          />
        </Field>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            name="has_photos"
            value="true"
            defaultChecked={defaults.has_photos}
            className="size-5 shrink-0 accent-(--rp-color-primary-base)"
          />
          Only listings with photos
        </label>
      </Group>

      {options.features.length > 0 && (
        <fieldset className="mt-4">
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
