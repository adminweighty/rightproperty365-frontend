/**
 * Server-side reader for the public catalogue endpoints of the Go API.
 * Only Server Components, route handlers and metadata functions import this
 * folder; browsers keep using src/lib/api/http.ts (with the session cookie).
 *
 * API_URL is the address the web server uses to reach the API (for example a
 * cluster-internal one). It is read at run time and never sent to browsers.
 * When it is not set, the public NEXT_PUBLIC_API_URL is used.
 */
export const apiBaseUrl = (
  // || rather than ??: an empty value (an unset Docker build argument) means "not set".
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

const TIMEOUT_MS = 8000;

/** The API could not be reached, timed out, or answered with something unexpected. */
export class ApiUnavailableError extends Error {
  constructor(path: string, reason: string) {
    super(`RightProperty365 API unavailable for GET ${path}: ${reason}`);
    this.name = "ApiUnavailableError";
  }
}

export type ApiResponse<T> = { status: number; data: T };

/**
 * GET a public endpoint. Resolves for 200 and for the statuses listed in
 * `expected` (a 404 or 410 that the caller turns into a page state). Anything
 * else throws, so a failure is never stored by a `'use cache'` function.
 */
export async function apiGet<T>(path: string, expected: number[] = []): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ApiUnavailableError(path, error instanceof Error ? error.message : "network error");
  }

  if (response.status !== 200 && !expected.includes(response.status)) {
    throw new ApiUnavailableError(path, `HTTP ${response.status}`);
  }

  try {
    return { status: response.status, data: (await response.json()) as T };
  } catch {
    throw new ApiUnavailableError(path, "the response was not JSON");
  }
}

type QueryValue = string | number | boolean | string[] | undefined;

/** Builds a query string, leaving out empty values and repeating array values. */
export function queryString(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
