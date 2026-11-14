import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { APP_LINKS_PLACEHOLDER_NOTE, appLinks, appLinksArePlaceholders } from "@/lib/app-links";

type Props = {
  /** Show the "being prepared for the stores" sentence under the links while they are placeholders. */
  note?: boolean;
  className?: string;
};

/**
 * The two links to the app stores, as plain buttons in words. The stores'
 * badge artwork is not used: it has its own usage rules. The addresses and
 * whether they are still placeholders come from `src/lib/app-links.ts`.
 */
export function AppLinks({ note = true, className }: Props) {
  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {appLinks.map((link) => (
          <li key={link.store}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener"
              className={cn(buttonClasses("secondary", "md"), "whitespace-normal text-center")}
            >
              {link.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      {note && appLinksArePlaceholders && (
        <p className="mt-2 text-sm leading-relaxed text-muted">{APP_LINKS_PLACEHOLDER_NOTE}</p>
      )}
    </div>
  );
}
