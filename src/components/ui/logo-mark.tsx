"use client";

import { useEffect, useRef, useState } from "react";
import type { Logo } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { logoUrl, monogram, monogramTone } from "@/lib/logos";

type Props = {
  /** Whose logo it is. The image's alt text is "<name> logo". */
  name: string;
  /** The logo as the API gives it; its `url` is relative to the API. Null or undefined when there is none. */
  logo: Logo | null | undefined;
  /** Whose logo it is when it is not `name`’s own: an agent shown with their agency’s logo. */
  logoOf?: string;
  /** People get a round frame, businesses a rounded square. */
  person?: boolean;
  /** Size and text size: `size-8 text-xs`, `size-14 text-lg`. The box is always square. */
  className?: string;
};

// The fills a monogram can take: soft tokens with their own text colour, all AA on white.
const tones = [
  "bg-primary-soft text-primary-ink",
  "bg-accent-soft text-accent-ink",
  "bg-info-soft text-info",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-sunken text-ink",
];

/**
 * The logo of an agency, a business or a person, in a fixed square box, or
 * their initials on a soft token colour when there is no logo or it does not
 * load. The colour is chosen from the name, so one name always gets the same.
 *
 * A plain `<img>`, not `next/image`: the file is served by the API, whose
 * origin is a build-time setting that differs per environment and is absent
 * in CI, so it cannot be listed in `images.remotePatterns` once for all
 * builds; and the API already serves a small, cacheable, versioned file.
 * Width and height are set, so nothing moves when it loads.
 *
 * The monogram is decorative (`aria-hidden`): the name is always written
 * beside it, and must not be read twice.
 */
export function LogoMark({ name, logo, logoOf, person, className }: Props) {
  const src = logo ? logoUrl(logo) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);

  // An image that failed before the page became interactive fired no event we could hear.
  useEffect(() => {
    const element = image.current;
    if (element && element.complete && element.naturalWidth === 0) setFailed(element.currentSrc || element.src);
  }, [src]);

  const frame = cn("shrink-0 overflow-hidden", person ? "rounded-full" : "rounded-md", className ?? "size-14 text-lg");

  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see the note above: the API's origin is not known to next/image
      <img
        ref={image}
        src={src}
        alt={`${logoOf ?? name} logo`}
        width={logo?.width}
        height={logo?.height}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(src)}
        className={cn(frame, "border border-line bg-surface object-contain")}
      />
    );
  }

  return (
    <span aria-hidden="true" className={cn(frame, "flex items-center justify-center font-bold", tones[monogramTone(name, tones.length)])}>
      {monogram(name)}
    </span>
  );
}
