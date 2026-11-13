import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { ListingFilters } from "@/lib/data/listings";

/**
 * A plain GET form, so search works without JavaScript and results have a
 * shareable URL (/listings?deal=rent&q=avondale).
 */
export function SearchBar({ defaults = {}, className }: { defaults?: ListingFilters; className?: string }) {
  return (
    <form
      action="/listings"
      role="search"
      aria-label="Property search"
      className={cn(
        "grid gap-3 rounded-xl border border-line bg-surface p-3 shadow-md sm:grid-cols-2 lg:grid-cols-[10rem_11rem_1fr_auto]",
        className,
      )}
    >
      <div>
        <label htmlFor="search-deal" className="sr-only">
          Buy or rent
        </label>
        <Select id="search-deal" name="deal" defaultValue={defaults.deal ?? ""}>
          <option value="">Buy or rent</option>
          <option value="sale">For sale</option>
          <option value="rent">To rent</option>
        </Select>
      </div>
      <div>
        <label htmlFor="search-category" className="sr-only">
          Property category
        </label>
        <Select id="search-category" name="category" defaultValue={defaults.category ?? ""}>
          <option value="">Any category</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="land">Land</option>
        </Select>
      </div>
      <div>
        <label htmlFor="search-q" className="sr-only">
          Suburb, city or property type
        </label>
        <Input
          id="search-q"
          name="q"
          type="search"
          defaultValue={defaults.q ?? ""}
          placeholder="Suburb, city or property type"
          autoComplete="off"
        />
      </div>
      <Button type="submit">
        <Search className="size-4" aria-hidden="true" />
        Search
      </Button>
    </form>
  );
}
