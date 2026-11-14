import { siAppgallery, siApple, siGoogleplay } from "simple-icons";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { APP_LINKS_PLACEHOLDER_NOTE, appLinks, appLinksArePlaceholders, type AppLink } from "@/lib/app-links";

type Props = {
  /** Show the "being prepared for the stores" sentence under the links while they are placeholders. */
  note?: boolean;
  className?: string;
};

/**
 * Each store's own mark, from the `simple-icons` package (CC0-1.0; the marks
 * remain trade marks of their owners). Only these three are imported, and
 * they are drawn on the server: no JavaScript reaches the browser for them.
 */
const storeIcons: Record<AppLink["store"], { path: string }> = {
  appStore: siApple,
  playStore: siGoogleplay,
  appGallery: siAppgallery,
};

/**
 * A store's mark as the package draws it: one path on a 24 by 24 grid, in
 * the colour of the text beside it, at 20px. Not recoloured in parts, not
 * stretched, and decorative, because the link's words already name the store.
 */
function StoreIcon({ store }: { store: AppLink["store"] }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      <path d={storeIcons[store].path} />
    </svg>
  );
}

/**
 * The links to the app stores: a button per store with its mark and plain
 * words. One row from `sm`, stacked at equal width on phones. The stores'
 * official badge artwork is not used while the apps are unpublished: it may
 * only be shown for an app that is in the store (see README, "Mobile app
 * links"). The addresses and whether they are still placeholders come from
 * `src/lib/app-links.ts`.
 */
export function AppLinks({ note = true, className }: Props) {
  return (
    <div className={className}>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {appLinks.map((link) => (
          <li key={link.store} className="flex">
            <a
              href={link.url}
              target="_blank"
              rel="noopener"
              className={cn(buttonClasses("secondary", "md"), "h-auto! min-h-11 w-full justify-start! gap-2.5 whitespace-normal py-2 text-left sm:w-auto")}
            >
              <StoreIcon store={link.store} />
              <span>
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </span>
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
