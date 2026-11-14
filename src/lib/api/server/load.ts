import { connection } from "next/server";

/**
 * How pages read API data, and what happens when the API is not there.
 *
 * The readers in this folder are `'use cache'` functions that THROW when the
 * API cannot be reached, so a failure is never stored in the cache.
 *
 * At request time, `load` turns that throw into `{ ok: false }` and the page
 * shows an honest error state with a retry link. The next request tries again.
 *
 * During `next build`, pages are prerendered and CI has no API. A reader that
 * throws while a page is prerendered fails the build, and an error state must
 * never be stored as a page. So `next.config.ts` checks once, when the build
 * starts, whether the API answers, and compiles the answer into the server
 * code as RP_API_AT_BUILD (`apiAtBuild` below).
 *
 * - **The API answered.** Readers are cached, so their output is part of the
 *   prerendered page. Nothing here waits for a request, and `ApiBoundary`
 *   (src/components/api-boundary.tsx) adds no `<Suspense>`, so the content is
 *   plain HTML in the page: visible without JavaScript.
 * - **It did not** (or BUILD_WITHOUT_API=1). `load` waits for `connection()`
 *   before reading. `connection()` never resolves while prerendering, so the
 *   component is left out of the stored HTML (the fallback of its
 *   `ApiBoundary` is stored instead) and runs on every request, when the API
 *   is there. It is then streamed into the page, which needs JavaScript.
 *
 * Every component that calls `load` must therefore sit inside `ApiBoundary`
 * (or a `<Suspense>`). See README, "Builds and the API".
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

/**
 * False only in the output of a `next build` that could not (or was told not
 * to) use the API. A compile-time constant, so it has the same value while
 * building and in the server that build produces.
 */
export const apiAtBuild = process.env.RP_API_AT_BUILD !== "0";

export async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  if (!apiAtBuild) await connection();
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

/**
 * For generateStaticParams, which has no error state to show: null when the
 * API is not available, and the caller prerenders nothing from the API.
 */
export async function readAtBuild<T>(read: () => Promise<T>): Promise<T | null> {
  if (!apiAtBuild) return null;
  try {
    return await read();
  } catch {
    return null;
  }
}
