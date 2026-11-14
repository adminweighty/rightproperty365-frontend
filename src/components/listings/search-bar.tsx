import { Search } from "lucide-react";
import { GetForm } from "@/components/listings/get-form";
import { ListingFilterPanel } from "@/components/listings/listing-filters";
import { LocationFields } from "@/components/listings/location-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/cn";
import { selectOption, type SearchOptions } from "@/lib/search-options";
import type { ListingFilters } from "@/lib/seo";

type Props = {
  /** Every list in the form, built from the API by `buildSearchOptions`. */
  options: SearchOptions;
  defaults?: ListingFilters;
  /** Open the advanced search panel (`advanced=1`). */
  advanced?: boolean;
  /** The API's message for each parameter it refused. */
  errors?: Record<string, string>;
  /** The earliest night the stay dates accept (`YYYY-MM-DD`). */
  today: string;
  className?: string;
};

/**
 * The listing search: a plain GET form, so it works without JavaScript and
 * results have a shareable URL (/listings?deal=rent&region=harare). First the
 * filters most people use (buy or rent, category, keyword), then Location
 * (country, region, city, suburb), then the advanced search panel.
 * Submitting always returns to page 1 of the new result.
 */
export function SearchBar({ options, defaults = {}, advanced, errors = {}, today, className }: Props) {
  // A new key when the address changes, so the selects show the new search after a client navigation.
  const locationKey = [defaults.country, defaults.region, defaults.city, defaults.suburb].join("|");

  return (
    <GetForm
      action="/listings"
      role="search"
      aria-label="Property search"
      className={cn("rounded-xl border border-line bg-surface p-3 shadow-sm sm:p-4", className)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[11rem_12rem_1fr_auto]">
        <div>
          <label htmlFor="search-deal" className="sr-only">
            Buy or rent
          </label>
          <SearchableSelect
            id="search-deal"
            name="deal"
            defaultValue={defaults.deal ?? ""}
            options={[{ value: "", label: "Buy or rent" }, ...options.deals.map((option) => selectOption(option))]}
          />
        </div>
        <div>
          <label htmlFor="search-category" className="sr-only">
            Property category
          </label>
          <SearchableSelect
            id="search-category"
            name="category"
            defaultValue={defaults.category ?? ""}
            options={[{ value: "", label: "Any category" }, ...options.categories.map((option) => selectOption(option))]}
          />
        </div>
        <div>
          <label htmlFor="search-q" className="sr-only">
            Keyword: suburb, city, property type or reference
          </label>
          <Input
            id="search-q"
            name="q"
            type="search"
            defaultValue={defaults.q ?? ""}
            maxLength={100}
            placeholder="Suburb, city, property type or reference"
            autoComplete="off"
          />
        </div>
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
      </div>

      <fieldset className="mt-4 border-t border-line pt-3">
        <legend className="float-left mb-3 w-full text-base font-semibold text-ink">Location</legend>
        <div className="clear-both grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LocationFields
            key={locationKey}
            countries={options.countries}
            regions={options.regions}
            cities={options.cities}
            suburbs={options.suburbs}
            defaults={defaults}
            errors={errors}
          />
        </div>
      </fieldset>

      <ListingFilterPanel options={options} defaults={defaults} open={advanced} errors={errors} today={today} />
    </GetForm>
  );
}
