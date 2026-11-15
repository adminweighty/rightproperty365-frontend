"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { ManagedPhoto, PhotoSize } from "@/lib/api/manage-listings";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { photoVariantUrl } from "@/lib/listing-photos";
import { resolvePhoto } from "@/lib/photos";

type Props = {
  photo: ManagedPhoto;
  /** The stored size to load: `small` for thumbnails. */
  size: PhotoSize;
  /** True while the public sees the listing: its approved photos need no session then. */
  listingPublic: boolean;
  alt: string;
  /** The frame (it must set a size or an aspect ratio, so nothing moves). */
  className?: string;
};

/**
 * A photo of a listing as its managers and reviewers see it.
 *
 * A photo the public may see (approved, on a public listing) is a plain
 * `<img>`, cached by the browser for a year. Any other photo is served by the
 * API only with the session, and the session cookie belongs to the API's
 * origin: an `<img>` on this site's origin sends it only when the two are the
 * same site, which is not true of every deployment. So it is fetched with
 * `credentials: "include"` and shown from an object URL, released when the
 * photo leaves the page. A bundled sample photo comes from the site's bundle.
 */
export function ListingPhotoImage({ photo, size, listingPublic, alt, className }: Props) {
  const bundled = photo.url.startsWith("/assets/images/");
  const address = bundled ? resolvePhoto(photo).url : photoVariantUrl(photo, size, env.apiUrl);
  const needsSession = !bundled && !(listingPublic && photo.status === "APPROVED");

  const [loaded, setLoaded] = useState<{ address: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!needsSession) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(address, { credentials: "include" })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ address, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ address, url: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [address, needsSession]);

  const frame = cn("relative overflow-hidden bg-sunken", className);
  const src = needsSession ? (loaded?.address === address ? loaded.url : undefined) : address;

  if (needsSession && loaded?.address === address && loaded.url === null) {
    return (
      <span className={cn(frame, "flex flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted")}>
        <ImageOff className="size-5" aria-hidden="true" />
        The photo could not be shown.
      </span>
    );
  }
  if (!src) return <span className={frame} aria-busy="true" aria-label="Loading the photo" />;
  return (
    <span className={cn(frame, "block")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an API photo (or one in memory): its sizes are made by the API */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
    </span>
  );
}
