"use client";

import { ExternalLink, Play, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ListingVideo } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  isPlaceholderThumbnail,
  playerSrc,
  UNAVAILABLE_ERRORS,
  watchHref,
  YOUTUBE_IFRAME_API,
  YOUTUBE_PRIVACY_URL,
} from "@/lib/youtube";

// ---- The IFrame API, loaded once and only after a press of play -----------------

type YTPlayer = { destroy: () => void };
type YTNamespace = {
  Player: new (element: HTMLIFrameElement, options: { events: { onError?: (event: { data: number }) => void } }) => YTPlayer;
};
type YTWindow = Window & { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };

let iframeApi: Promise<YTNamespace> | null = null;

/** Resolves with `window.YT`; rejects when the script cannot be loaded (blocked, offline) within 15 s. */
function loadIframeApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (iframeApi) return iframeApi;
  iframeApi = new Promise<YTNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      iframeApi = null;
      script.remove();
      reject(new Error("The YouTube IFrame API could not be loaded."));
    };
    const timer = setTimeout(fail, 15_000);
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timer);
      if (w.YT?.Player) resolve(w.YT);
      else fail();
    };
    script.src = YOUTUBE_IFRAME_API;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return iframeApi;
}

// ---- The component -------------------------------------------------------------

type Props = {
  video: ListingVideo;
  /** The listing's title, for the poster's alt text and the player's title. */
  title: string;
  className?: string;
};

type State = "poster" | "playing" | "unavailable";

const frame = "relative aspect-video w-full overflow-hidden rounded-lg";

/**
 * A listing's video tour: a poster until the visitor presses play, then the
 * official YouTube player (youtube-nocookie), with a note that YouTube may set
 * cookies from that moment. Nothing is loaded from youtube.com before the
 * press. A video that cannot be shown (removed, private, not embeddable) gets a
 * neutral frame and a link to watch it on YouTube instead. The server renders
 * the poster, the same for everyone, so the listing page stays cached.
 */
export function YouTubeTour({ video, title, className }: Props) {
  const [state, setState] = useState<State>("poster");
  const [src, setSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const player = useRef<HTMLIFrameElement>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const focusFallback = useRef(false);
  const watch = watchHref(video.watch_url, video.start_seconds);

  // The poster may have loaded, or failed, before the page became interactive.
  useEffect(() => {
    const img = image.current;
    if (img?.complete && isPlaceholderThumbnail(img.naturalWidth, img.naturalHeight)) setState("unavailable");
  }, []);

  // Once playing: the IFrame API, only to hear that the video cannot be played.
  useEffect(() => {
    if (state !== "playing" || !src) return;
    let cancelled = false;
    let instance: YTPlayer | undefined;
    loadIframeApi()
      .then((YT) => {
        if (cancelled || !player.current) return;
        instance = new YT.Player(player.current, {
          events: {
            onError: (event) => {
              if (!UNAVAILABLE_ERRORS.includes(event.data)) return;
              focusFallback.current = true;
              setState("unavailable");
            },
          },
        });
      })
      // Without the API the player still plays; it just cannot tell us about an unavailable video.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      try {
        instance?.destroy();
      } catch {
        // The iframe is already gone.
      }
    };
  }, [state, src]);

  useEffect(() => {
    if (state === "unavailable" && focusFallback.current) {
      focusFallback.current = false;
      fallback.current?.focus();
    }
  }, [state]);

  function play() {
    const next = playerSrc(video.embed_url, window.location.origin);
    if (!next) {
      setState("unavailable");
      return;
    }
    setSrc(next);
    setState("playing");
  }

  return (
    <div className={className}>
      {state === "unavailable" ? (
        <div
          ref={fallback}
          tabIndex={-1}
          className={cn(frame, "flex flex-col items-center justify-center gap-3 border border-line bg-sunken p-6 text-center outline-none")}
        >
          <VideoOff className="size-8 text-subtle" aria-hidden="true" />
          <p className="font-medium text-ink">This video can&apos;t be shown here</p>
          {watch && (
            <a
              href={watch}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-semibold text-primary-ink underline underline-offset-2 hover:no-underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Watch on YouTube
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      ) : state === "playing" && src ? (
        <div className={cn(frame, "bg-ink")}>
          <iframe
            ref={player}
            src={src}
            title={`Video tour: ${title}`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            onLoad={(event) => event.currentTarget.focus()}
            className="absolute inset-0 size-full border-0"
          />
        </div>
      ) : (
        <div className={cn(frame, "group bg-sunken")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail; a plain image keeps i.ytimg.com out of the image optimiser */}
          <img
            ref={image}
            src={video.thumbnail_url}
            alt={`Video tour of ${title}`}
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={(event) => {
              if (isPlaceholderThumbnail(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)) setState("unavailable");
            }}
            onError={() => setState("unavailable")}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
            <button
              type="button"
              onClick={play}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-surface px-5 py-3 font-semibold text-ink shadow-md hover:bg-soft motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary" aria-hidden="true">
                <Play className="size-4 translate-x-px fill-current" />
              </span>
              Play the video tour (YouTube)
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">
        Plays from YouTube. YouTube may set cookies when you press play.{" "}
        <a
          href={YOUTUBE_PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
        >
          YouTube&apos;s privacy policy
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
