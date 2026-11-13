import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const modes = [
  { value: "sale", label: "Buy" },
  { value: "rent", label: "Rent" },
];

/**
 * The landing-page search: Buy / Rent tabs over a location, type and submit
 * row. The tabs are native radio buttons and the whole thing is a GET form, so
 * it works without JavaScript and with a keyboard (arrow keys switch tabs).
 */
export function HeroSearch({ className }: { className?: string }) {
  return (
    <form
      action="/listings"
      role="search"
      aria-label="Property search"
      className={cn("frame-brand-on overflow-hidden rounded-xl bg-surface text-ink shadow-lg", className)}
    >
      <fieldset className="flex border-b border-line">
        <legend className="sr-only">Buy or rent</legend>
        {modes.map((mode, index) => (
          <label
            key={mode.value}
            className="relative flex-1 cursor-pointer px-4 py-3.5 text-center text-sm font-semibold text-muted transition-colors hover:text-ink has-checked:text-primary-ink has-checked:after:absolute has-checked:after:inset-x-0 has-checked:after:bottom-0 has-checked:after:h-0.5 has-checked:after:bg-primary has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name="deal"
              value={mode.value}
              defaultChecked={index === 0}
              className="sr-only"
            />
            {mode.label}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_12rem_auto] sm:p-4">
        <div>
          <label htmlFor="hero-q" className="sr-only">
            Suburb or city
          </label>
          <Input
            id="hero-q"
            name="q"
            type="search"
            placeholder="Search by suburb or city"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="hero-category" className="sr-only">
            Property type
          </label>
          <Select id="hero-category" name="category" defaultValue="">
            <option value="">Any property type</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="land">Land</option>
          </Select>
        </div>
        <Button type="submit" className="px-6">
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  );
}
