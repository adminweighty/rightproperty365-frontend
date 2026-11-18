import { List, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  view: "list" | "map";
  /** The same search as a list and on the map (`view=map`), each from page 1. */
  listHref: string;
  mapHref: string;
  className?: string;
};

const segment =
  "flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors";

/**
 * "List" / "Map": a segmented control of two links, so the view is in the
 * address, works without JavaScript and can be shared. The current one is
 * filled and has `aria-current`. The list is the default.
 */
export function ViewToggle({ view, listHref, mapHref, className }: Props) {
  const items = [
    { key: "list", href: listHref, label: "List", icon: List },
    { key: "map", href: mapHref, label: "Map", icon: MapIcon },
  ] as const;
  return (
    <nav aria-label="Show the results as" className={className}>
      <ul className="inline-flex gap-1 rounded-lg border border-line-strong bg-surface p-1">
        {items.map(({ key, href, label, icon: Icon }) => {
          const current = view === key;
          return (
            <li key={key}>
              <Link
                href={href}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(segment, current ? "bg-primary text-on-primary" : "text-ink hover:bg-sunken")}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
