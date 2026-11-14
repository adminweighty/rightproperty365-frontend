import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  page: number;
  totalPages: number;
  /** The address of a page of this list. Page 1 should be the list's plain address. */
  hrefFor: (page: number) => string;
  /** Names the list for assistive technology: "Listing results". */
  label: string;
  className?: string;
};

/** The current page, its neighbours, and the first and last page; null marks a gap. */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return pages.flatMap((value, index) =>
    index > 0 && value - pages[index - 1] > 1 ? [null, value] : [value],
  );
}

const item =
  "flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-line px-3 text-sm font-medium";
const link = "bg-surface text-ink transition-colors hover:bg-sunken";

/**
 * Page links for a list that is split across addresses (`?page=2`). Every
 * page is an ordinary link, so it works without JavaScript and each page can
 * be shared and indexed on its own. Renders nothing for a single page.
 */
export function Pagination({ page, totalPages, hrefFor, label, className }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={`${label} pages`} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, link)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(item, "text-subtle")}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </span>
          )}
        </li>
        {pageWindow(page, totalPages).map((value, index) =>
          value === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={value}>
              {value === page ? (
                <span
                  aria-current="page"
                  className={cn(item, "border-primary bg-primary text-on-primary")}
                >
                  <span className="sr-only">Page </span>
                  {value}
                </span>
              ) : (
                <Link href={hrefFor(value)} className={cn(item, link)}>
                  <span className="sr-only">Page </span>
                  {value}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className={cn(item, link)}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(item, "text-subtle")}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
