import { Search } from "lucide-react";
import { GetForm } from "@/components/listings/get-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import type { DevelopmentFilters } from "@/lib/developments";
import { cn } from "@/lib/cn";

type Props = {
  defaults: DevelopmentFilters;
  markets: SelectItem[];
  cities: SelectItem[];
  statuses: SelectItem[];
  className?: string;
};

/**
 * The filters of /developments: country, city, status and words. A plain GET
 * form (empty fields left out of the address with JavaScript), so it works
 * without JavaScript and every result can be bookmarked. Submitting always
 * starts again at page 1.
 */
export function DevelopmentFiltersForm({ defaults, markets, cities, statuses, className }: Props) {
  return (
    <GetForm
      action="/developments"
      role="search"
      aria-label="Filter developments"
      className={cn(
        "grid gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]",
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor="developments-market" className="text-sm font-medium text-ink">
          Country
        </label>
        <SearchableSelect
          id="developments-market"
          name="market"
          defaultValue={defaults.market ?? ""}
          options={[{ value: "", label: "Any country" }, ...markets]}
          className="mt-1"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="developments-city" className="text-sm font-medium text-ink">
          City
        </label>
        <SearchableSelect
          id="developments-city"
          name="city"
          defaultValue={defaults.city ?? ""}
          options={[{ value: "", label: "Any city" }, ...cities]}
          className="mt-1"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="developments-status" className="text-sm font-medium text-ink">
          Status
        </label>
        <SearchableSelect
          id="developments-status"
          name="status"
          defaultValue={defaults.status ?? ""}
          options={[{ value: "", label: "Any status" }, ...statuses]}
          className="mt-1"
        />
      </div>
      <div className="min-w-0">
        <label htmlFor="developments-q" className="text-sm font-medium text-ink">
          Search
        </label>
        <Input
          id="developments-q"
          name="q"
          type="search"
          defaultValue={defaults.q ?? ""}
          key={defaults.q ?? ""}
          maxLength={100}
          placeholder="Name, suburb or city"
          autoComplete="off"
          className="mt-1"
        />
      </div>
      <Button type="submit" className="self-end sm:col-span-2 lg:col-span-1">
        <Search className="size-4" aria-hidden="true" />
        Search
      </Button>
    </GetForm>
  );
}
