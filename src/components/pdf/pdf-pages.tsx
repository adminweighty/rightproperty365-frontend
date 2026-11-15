"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadPdfJs } from "@/components/pdf/pdfjs";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

export type RenderedPage = {
  /** 0-based. */
  index: number;
  /** 1-based, as the API counts pages. */
  number: number;
  /** In PDF points. */
  width: number;
  height: number;
  /** CSS pixels per PDF point at the current width and zoom. */
  scale: number;
};

type Props = {
  /** The PDF's bytes. A copy is handed to pdf.js, so the same bytes can be shown again. */
  data: ArrayBuffer;
  /** 1 fits the page to the column (at most `maxWidth`); above 1 the pages scroll sideways. */
  zoom?: number;
  /** The widest a page is drawn at zoom 1, in CSS pixels. */
  maxWidth?: number;
  /** Names the document for assistive technology. */
  label: string;
  /** Drawn over each page, positioned in CSS pixels (use `page.scale` to convert PDF points). */
  renderOverlay?: (page: RenderedPage) => ReactNode;
  /** The sizes pdf.js read, once the document is open. */
  onLoaded?: (pages: { width: number; height: number }[]) => void;
  className?: string;
};

type Loaded = { doc: PDFDocumentProxy; sizes: { width: number; height: number }[] };

/** One page: the canvas is drawn when the page comes near the screen, and again when its size changes. */
function Page({ doc, page, children }: { doc: PDFDocumentProxy; page: RenderedPage; children?: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const cssWidth = page.width * page.scale;
  const cssHeight = page.height * page.scale;

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "1200px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !canvas.current || cssWidth <= 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    // Wait a moment while the size is still changing (a window being resized, a zoom).
    const timer = window.setTimeout(async () => {
      const pdfPage = await doc.getPage(page.number);
      if (cancelled || !canvas.current) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: page.scale * ratio });
      const element = canvas.current;
      element.width = Math.floor(viewport.width);
      element.height = Math.floor(viewport.height);
      task = pdfPage.render({ canvas: element, viewport });
      try {
        await task.promise;
        if (!cancelled) setDrawn(true);
      } catch {
        // Cancelled for a newer drawing.
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [doc, near, page.number, page.scale, cssWidth]);

  return (
    <div
      ref={frame}
      className="relative mx-auto bg-white shadow-md ring-1 ring-line"
      style={{ width: cssWidth, height: cssHeight }}
      aria-label={`Page ${page.number}`}
      role="group"
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden="true" />
      {!drawn && <div className="absolute inset-0 animate-pulse bg-sunken" aria-hidden="true" />}
      {children}
    </div>
  );
}

/**
 * The pages of a PDF drawn with pdf.js, one under the other, each with an
 * optional overlay (fields to place or fill). Pages fit the column on a phone.
 */
export function PdfPages({ data, zoom = 1, maxWidth = 880, label, renderOverlay, onLoaded, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    loadPdfJs()
      .then(async (pdfjs) => {
        // pdf.js takes over the buffer it is given: hand it a copy.
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        task = loadingTask;
        const doc = await loadingTask.promise;
        const sizes: { width: number; height: number }[] = [];
        for (let number = 1; number <= doc.numPages; number++) {
          const viewport = (await doc.getPage(number)).getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setLoaded({ doc, sizes });
        onLoadedRef.current?.(sizes);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [data]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = Math.min(width, maxWidth);
  // One scale for every page, so a smaller page looks smaller.
  const widest = loaded ? Math.max(...loaded.sizes.map((size) => size.width)) : 1;

  return (
    <div ref={container} className={cn("w-full", className)}>
      {failed ? (
        <Alert title="This PDF could not be shown here.">
          Your browser could not open it. Download it to read it instead.
        </Alert>
      ) : !loaded || fit === 0 ? (
        <div aria-busy="true" aria-label={`Loading ${label}`} className="mx-auto aspect-[1/1.414] w-full max-w-3xl animate-pulse rounded-md bg-sunken" />
      ) : (
        <div className="overflow-x-auto pb-2" role="region" aria-label={label} tabIndex={zoom > 1 ? 0 : undefined}>
          <div className="flex w-max min-w-full flex-col items-center gap-6 py-2">
            {loaded.sizes.map((size, index) => {
              const page: RenderedPage = {
                index,
                number: index + 1,
                width: size.width,
                height: size.height,
                scale: (fit * zoom) / widest,
              };
              return (
                <Page key={index} doc={loaded.doc} page={page}>
                  {renderOverlay?.(page)}
                </Page>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
