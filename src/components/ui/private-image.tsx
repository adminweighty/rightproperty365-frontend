"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** An address of the API that needs the session cookie, such as an uploaded document's file route. */
  src: string;
  alt: string;
  /** The frame: set a size, so nothing moves when the image arrives. */
  className?: string;
};

/**
 * An image that only the signed-in person may read: a logo that was uploaded
 * with an application and is not public yet. The file routes need the session
 * and answer as a download, so the image is fetched with the cookie and shown
 * from memory. If it cannot be read, a line says so in its place.
 */
export function PrivateImage({ src, alt, className }: Props) {
  const [state, setState] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(src, { credentials: "include" })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ src, url: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const frame = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface", className);
  const current = state?.src === src ? state : null;
  if (!current) return <span className={cn(frame, "bg-sunken")} aria-busy="true" aria-label="Loading the image" />;
  if (!current.url) return <span className={cn(frame, "p-2 text-center text-xs text-muted")}>The image could not be shown.</span>;
  // eslint-disable-next-line @next/next/no-img-element -- an in-memory image: there is nothing for next/image to optimise
  return <img src={current.url} alt={alt} className={cn(frame, "object-contain")} />;
}
