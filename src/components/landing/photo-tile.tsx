import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stagger } from "@/components/motion/stagger";
import { cn } from "@/lib/cn";

type Props = {
  href: string;
  /** The place or collection the tile leads to. It is the link text. */
  title: string;
  /** What is behind the link, in words: "12 properties". */
  count: string;
  /** Decorative. A tile without a photo shows a neutral frame. */
  photo?: { src: StaticImageData | string; bundled: boolean };
};

/**
 * A photo with its title and a count underneath, on white. The photo has a
 * fixed 4:3 frame, so the row never shifts while it loads. The whole tile is
 * one link.
 */
export function PhotoTile({ href, title, count, photo }: Props) {
  return (
    <li className="w-[15.5rem] shrink-0 snap-start sm:w-[17rem] lg:w-auto">
      <Link href={href} className="group block rounded-lg">
        <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-sunken">
          {photo && (
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 280px, 272px"
              placeholder={photo.bundled ? "blur" : "empty"}
              unoptimized={!photo.bundled}
              className="object-cover transition-transform duration-500 ease-standard group-hover:scale-105"
            />
          )}
        </span>
        <span className="mt-3 block px-1 pb-1">
          <span className="block text-lg font-bold text-ink decoration-line-accent decoration-2 underline-offset-4 group-hover:underline">
            {title}
          </span>
          <span className="block text-sm tabular-nums text-muted">{count}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * A row of photo tiles: it scrolls sideways (with snapping) below `lg` and is
 * a four-column grid from `lg`. Scrolling is native, so it needs no
 * JavaScript, and the links inside it keep it reachable from the keyboard.
 * The tiles grow into place one after another when the row is scrolled to.
 */
export function PhotoTileRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Stagger
      as="ul"
      from="scale"
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 py-1 [scrollbar-width:thin] md:-mx-8 md:scroll-px-8 md:px-8",
        "lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:p-0",
        className,
      )}
    >
      {children}
    </Stagger>
  );
}
