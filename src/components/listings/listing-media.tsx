import Image from "next/image";
import { cn } from "@/lib/cn";
import type { Listing } from "@/lib/data/listings";

type Props = {
  image: Listing["image"];
  /** The `sizes` hint for the rendered width, so the browser picks a small file. */
  sizes: string;
  /** Set on the one image that is the page's main content (listing detail). */
  priority?: boolean;
  /** Zoom slightly when the surrounding `group` is hovered. */
  zoomOnHover?: boolean;
  className?: string;
};

/**
 * A listing photo cropped to the frame given by `className` (which must set
 * an aspect ratio, so the layout never shifts while the photo loads).
 */
export function ListingMedia({ image, sizes, priority, zoomOnHover, className }: Props) {
  return (
    <div className={cn("relative overflow-hidden bg-sunken", className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        placeholder="blur"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={cn(
          "object-cover",
          zoomOnHover && "transition-transform duration-500 ease-standard group-hover:scale-105",
        )}
      />
    </div>
  );
}
