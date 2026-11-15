"use client";

import type * as PdfJs from "pdfjs-dist";

type Loaded = { pdfjs: typeof PdfJs; worker: PdfJs.PDFWorker };

let loading: Promise<Loaded> | undefined;

/**
 * pdf.js, loaded the first time a page shows a PDF (it is large and never
 * needed on the server), with one worker shared by every document. The worker
 * is bundled from the package itself: `new Worker(new URL(..., import.meta.url))`
 * is recognised by the bundler, which emits the worker file with the site's
 * own assets, so nothing is loaded from another origin.
 *
 * The worker is passed to `getDocument` explicitly. pdf.js then leaves it
 * running when a document is destroyed; a worker it creates itself (or one
 * set as `GlobalWorkerOptions.workerPort`) can be shut down with the first
 * document, after which every later document on the page fails to open.
 */
export function loadPdfJs(): Promise<Loaded> {
  loading ??= import("pdfjs-dist")
    .then((pdfjs) => {
      const port = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
        type: "module",
      });
      return { pdfjs, worker: pdfjs.PDFWorker.create({ port }) };
    })
    .catch((error: unknown) => {
      // A failed load (offline, an old browser) can be tried again on the next document.
      loading = undefined;
      throw error;
    });
  return loading;
}
