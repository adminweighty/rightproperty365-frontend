"use client";

import type * as PdfJs from "pdfjs-dist";

let loading: Promise<typeof PdfJs> | undefined;

/**
 * pdf.js, loaded the first time a page shows a PDF (it is large and never
 * needed on the server). Its worker is bundled from the package itself:
 * `new Worker(new URL(..., import.meta.url))` is recognised by the bundler,
 * which emits the worker file with the site's own assets, so nothing is
 * loaded from another origin.
 */
export function loadPdfJs(): Promise<typeof PdfJs> {
  loading ??= import("pdfjs-dist")
    .then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(
          new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" },
        );
      }
      return pdfjs;
    })
    .catch((error: unknown) => {
      // A failed load (offline, an old browser) can be tried again on the next document.
      loading = undefined;
      throw error;
    });
  return loading;
}
