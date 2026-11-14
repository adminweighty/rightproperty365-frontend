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
  /** Zoom slightly when the surrounding `group` is hovered. */
  zoomOnHover?: boolean;
  /** Override the alt text, e.g. "" when the photo is decorative. */
  alt?: string;
  className?: string;
};

/**
 * A listing photo cropped to the frame given by `className` (which must set
 * an aspect ratio, so the layout never shifts while the photo loads).
 *
 * A photo whose file is bundled with the app is optimised and gets a blur
 * placeholder; any other photo is loaded from the URL the API gave
 * (src/lib/photos.ts). A listing without photos shows a neutral frame.
 */
export function ListingMedia({ photo, sizes, priority, zoomOnHover, alt, className }: Props) {
  const resolved = photo ? resolvePhoto(photo) : undefined;

  return (
    <div className={cn("relative overflow-hidden bg-sunken", className)}>
      {resolved ? (
        <Image
          src={resolved.src}
          alt={alt ?? resolved.alt}
          fill
          sizes={sizes}
          placeholder={resolved.bundled ? "blur" : "empty"}
          // Photos outside the bundle come from a host we do not know yet.
          unoptimized={!resolved.bundled}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className={cn(
            "object-cover",
            zoomOnHover && "transition-transform duration-500 ease-standard group-hover:scale-105",
          )}
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
