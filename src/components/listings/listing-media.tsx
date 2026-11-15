import { ImageOff } from "lucide-react";
import Image from "next/image";
import type { Photo } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { resolvePhoto } from "@/lib/photos";

type Props = {
  /** A photo as the API returns it. Undefined when the listing has none. */
  photo: Photo | undefined;
  /** The `sizes` hint for the rendered width, so the browser picks a small file. */
  sizes: string;
  /** Set on the one image that is the page's main content (listing detail). */
  priority?: boolean;
  /**
   * Load at once instead of when it nears the screen, without raising its
   * priority: for photos that are on screen as the page opens.
   */
  eager?: boolean;
  /** Zoom slightly when the surrounding `group` is hovered. */
  zoomOnHover?: boolean;
  /** Ease back from a slight zoom as the page paints: the main photo of a listing. A transform, so the photo is never hidden. */
  settle?: boolean;
  /** Override the alt text, e.g. "" when the photo is decorative. */
  alt?: string;
  className?: string;
};

/**
 * A listing photo cropped to the frame given by `className` (which must set
 * an aspect ratio, so the layout never shifts while the photo loads).
 *
 * A photo whose file is bundled with the app is optimised by next/image and
 * gets a blur placeholder; an uploaded photo is a plain `<img>` with the
 * API's stored sizes as its `srcset` (src/lib/photos.ts). A listing without
 * photos shows a neutral frame.
 */
export function ListingMedia({ photo, sizes, priority, eager, zoomOnHover, settle, alt, className }: Props) {
  const resolved = photo ? resolvePhoto(photo) : undefined;
  const imageClass = cn(
    "object-cover",
    zoomOnHover && "transition-transform duration-500 ease-standard group-hover:scale-105",
    settle && "enter-settle",
  );

  return (
    <div className={cn("relative overflow-hidden bg-sunken", className)}>
      {resolved && !resolved.bundled ? (
        // An uploaded photo: the API made its sizes, so the browser picks one from the srcset.
        // eslint-disable-next-line @next/next/no-img-element -- served by the API in three stored sizes
        <img
          src={resolved.url}
          srcSet={resolved.srcSet}
          sizes={resolved.srcSet ? sizes : undefined}
          alt={alt ?? resolved.alt}
          width={resolved.width}
          height={resolved.height}
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? "sync" : "async"}
          className={cn("absolute inset-0 size-full", imageClass)}
        />
      ) : resolved ? (
        <Image
          src={resolved.src}
          alt={alt ?? resolved.alt}
          fill
          sizes={sizes}
          placeholder="blur"
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className={imageClass}
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-subtle">
          <ImageOff className="size-6" aria-hidden="true" />
          No photo yet
        </span>
      )}
    </div>
  );
}
