import { Search } from "lucide-react";
import { GetForm } from "@/components/listings/get-form";
import { ListingFilterPanel } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { optionText, type SearchOptions } from "@/lib/search-options";
import type { ListingFilters } from "@/lib/seo";

type Props = {
  /** Every list in the form, built from the API by `buildSearchOptions`. */
  options: SearchOptions;
  defaults?: ListingFilters;
  className?: string;
};

/**
 * The listing search: a plain GET form, so it works without JavaScript and
 * results have a shareable URL (/listings?deal=rent&city=harare). The first
 * row holds the filters most people use; the rest are in ListingFilterPanel.
 * Submitting always returns to page 1 of the new result.
 */
export function SearchBar({ options, defaults = {}, className }: Props) {
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
          <Select id="search-deal" name="deal" defaultValue={defaults.deal ?? ""}>
            <option value="">Buy or rent</option>
            {options.deals.map((option) => (
              <option key={option.value} value={option.value}>
                {optionText(option)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="search-category" className="sr-only">
            Property category
          </label>
          <Select id="search-category" name="category" defaultValue={defaults.category ?? ""}>
            <option value="">Any category</option>
            {options.categories.map((option) => (
              <option key={option.value} value={option.value}>
                {optionText(option)}
              </option>
            ))}
          </Select>
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

      <ListingFilterPanel options={options} defaults={defaults} />
    </GetForm>
  );
}
