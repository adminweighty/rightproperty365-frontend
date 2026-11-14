import { connection } from "next/server";
import { apiBaseUrl } from "./client";

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
 * never be stored as a page. So each build worker checks once, when this
 * module loads, whether the API answers. If it does not, `load` waits for
 * `connection()` before reading. `connection()` never resolves while
 * prerendering, so the component is left out of the stored HTML (its
 * `<Suspense>` fallback is stored instead) and runs on every request, when
 * the API is there. See README, "Builds and the API".
 *
 * Every component that calls `load` must therefore sit inside `<Suspense>`.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

const building = process.env.NEXT_PHASE === "phase-production-build";

async function apiAnswers(): Promise<boolean> {
  // BUILD_WITHOUT_API=1 builds without the API on purpose, even if one is reachable.
  if (process.env.BUILD_WITHOUT_API === "1") return false;
  try {
    const response = await fetch(`${apiBaseUrl}/readyz`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** False only in a `next build` that cannot (or was told not to) use the API. */
const apiAvailable = building ? await apiAnswers() : true;

export async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  if (!apiAvailable) await connection();
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
  if (!apiAvailable) return null;
  try {
    return await read();
  } catch {
    return null;
  }
}
