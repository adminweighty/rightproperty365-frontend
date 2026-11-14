import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { GetForm } from "@/components/listings/get-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { cn } from "@/lib/cn";
import { selectGroups, selectOption, type SearchOptions } from "@/lib/search-options";

type Props = {
  /** Every list in the form, built from the API by `buildSearchOptions`. */
  options: SearchOptions;
  className?: string;
};

/**
 * The landing-page search, inside the hero's white panel: one tab per deal
 * type over one Location select (countries, regions, cities and suburbs in
 * one list, sent as `location=region:harare`), property type, highest price
 * and bedrooms, with a link to the advanced search. The tabs
 * are native radio buttons and the whole thing is a GET form, so it works
 * without JavaScript and with a keyboard (arrow keys switch tabs). All lists
 * come from the API.
 */
export function HeroSearch({ options, className }: Props) {
  // One list of every kind of place. The value says which kind: "region:harare".
  const places = (label: string, kind: string, items: SearchOptions["countries"]): SelectItem[] =>
    items.length > 0 ? [{ label, options: items.map((option) => selectOption(option, `${kind}:`)) }] : [];
  const locations: SelectItem[] = [
    { value: "", label: "Any location" },
    ...places("Country", "country", options.countries),
    ...places("Region or province", "region", options.regions),
    ...places("City or town", "city", options.cities),
    ...selectGroups(options.suburbs, "suburb:").map((group) => ({ ...group, label: `Suburbs of ${group.label}` })),
  ];

  return (
    <GetForm
      action="/listings"
      role="search"
      aria-label="Property search"
      className={cn("text-left", className)}
    >
      {options.deals.length > 0 && (
        <fieldset className="flex justify-center border-b border-line">
          <legend className="sr-only">Buy or rent</legend>
          {options.deals.map((deal, index) => (
            <label
              key={deal.value}
              className="relative flex min-h-12 min-w-28 cursor-pointer items-center justify-center px-5 text-base font-semibold text-muted transition-colors hover:text-ink has-checked:text-primary-ink has-checked:after:absolute has-checked:after:inset-x-0 has-checked:after:-bottom-px has-checked:after:h-[3px] has-checked:after:rounded-full has-checked:after:bg-primary has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="deal"
                value={deal.value}
                defaultChecked={index === 0}
                className="sr-only"
              />
              {deal.label}
            </label>
          ))}
        </fieldset>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="hero-location" className="sr-only">
            Location: country, region, city or suburb
          </label>
          <SearchableSelect id="hero-location" name="location" defaultValue="" options={locations} />
        </div>
        <div>
          <label htmlFor="hero-property-type" className="sr-only">
            Property type
          </label>
          <SearchableSelect
            id="hero-property-type"
            name="property_type"
            defaultValue=""
            options={[{ value: "", label: "Any property type" }, ...selectGroups(options.propertyTypes)]}
          />
        </div>
        <div>
          <label htmlFor="hero-max-price" className="sr-only">
            Highest price{options.currency ? ` in ${options.currency}` : ""}
          </label>
          <Input
            id="hero-max-price"
            name="max_price"
            type="number"
            inputMode="numeric"
            min={0}
            step="any"
            placeholder={`Highest price${options.currency ? ` (${options.currency})` : ""}`}
          />
        </div>
        <div>
          <label htmlFor="hero-bedrooms" className="sr-only">
            Bedrooms
          </label>
          <SearchableSelect
            id="hero-bedrooms"
            name="bedrooms_min"
            defaultValue=""
            options={[
              { value: "", label: "Any bedrooms" },
              ...options.bedrooms.map((option) => ({ value: option.value, label: `${option.label} bedrooms` })),
            ]}
          />
        </div>
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
      </div>
      <p className="mt-3 text-center">
        <Link
          href="/listings?advanced=1#advanced-search"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Advanced search
        </Link>
      </p>
    </GetForm>
  );
}
