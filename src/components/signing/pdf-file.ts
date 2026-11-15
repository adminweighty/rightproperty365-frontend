"use client";

import type { ApiFailure, ApiResult } from "@/lib/api/http";

type Bytes = { bytes: ArrayBuffer; type: string };

/** "Sample lease RPA-2026-000123.pdf" with nothing a file system refuses. */
export const pdfName = (...parts: (string | null | undefined)[]) =>
  `${parts
    .filter(Boolean)
    .join(" ")
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? " " : char))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "document"}.pdf`;

/**
 * Saves a PDF the API streams (it needs the session cookie or the link's
 * token, so it is read here and saved from memory). Returns the failure, if any.
 */
export async function savePdf(read: () => Promise<ApiResult<Bytes>>, fileName: string): Promise<ApiFailure | null> {
  const result = await read();
  if (!result.ok) return result.failure;
  const url = URL.createObjectURL(new Blob([result.data.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return null;
}

/**
 * Opens a PDF in a new tab. The tab is opened at once (inside the click, so
 * it is not blocked) and given the PDF when it arrives; if the browser
 * refused the tab, the PDF is saved instead.
 */
export async function openPdf(read: () => Promise<ApiResult<Bytes>>, fileName: string): Promise<ApiFailure | null> {
  const tab = window.open("", "_blank");
  if (!tab) return savePdf(read, fileName);
  tab.document.title = fileName;
  tab.document.body.textContent = "Loading the PDF…";
  const result = await read();
  if (!result.ok) {
    tab.close();
    return result.failure;
  }
  const url = URL.createObjectURL(new Blob([result.data.bytes], { type: "application/pdf" }));
  tab.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  return null;
}
