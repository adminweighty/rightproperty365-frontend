import { env } from "@/lib/env";

/**
 * Shared fetch wrapper for the RightProperty365 Go API.
 *
 * Requests always include credentials so the HttpOnly session cookie set by
 * the API travels with them. The cookie is never readable from JavaScript.
 */

export type ApiFailure = {
  code: string;
  message: string;
  status: number;
  fields?: Record<string, string>;
  traceId?: string;
  /** Seconds to wait before trying again, from a 429 answer's Retry-After header. */
  retryAfter?: number;
};

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; failure: ApiFailure };

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, or as multipart/form-data when it is a FormData (file uploads). */
  body?: unknown;
  headers?: Record<string, string>;
  /** "no-store" for an answer that must never be reused, such as a captcha question. */
  cache?: RequestCache;
};

const fallbackMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You do not have access to this.",
  404: "We could not find that.",
  413: "That file is too large.",
  415: "That file type is not accepted.",
  429: "Too many attempts. Please wait a minute and try again.",
};

/** Retry-After as whole seconds (it may also be an HTTP date). Undefined when absent or unreadable. */
function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, headers = {}, cache } = options;

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      credentials: "include",
      cache,
      // For FormData the browser sets the multipart Content-Type and its boundary.
      headers:
        body === undefined || body instanceof FormData
          ? headers
          : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    return { ok: false, failure: networkFailure };
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.ok) {
    return { ok: true, data: payload as T, status: response.status };
  }
  return { ok: false, failure: failureFrom(response, payload) };
}

const networkFailure: ApiFailure = {
  code: "NETWORK_ERROR",
  status: 0,
  message: "We could not reach RightProperty365. Check your connection and try again.",
};

/** The failure an unsuccessful answer describes: its error envelope, or a plain message for its status. */
function failureFrom(response: Response, payload: unknown): ApiFailure {
  const envelope = payload as {
    error?: { code?: string; message?: string; fields?: Record<string, string> };
    trace_id?: string;
  } | null;

  return {
    code: envelope?.error?.code ?? `HTTP_${response.status}`,
    status: response.status,
    message:
      envelope?.error?.message ??
      fallbackMessages[response.status] ??
      "Something went wrong on our side. Please try again.",
    fields: envelope?.error?.fields,
    traceId: envelope?.trace_id,
    retryAfter: retryAfterSeconds(response.headers.get("Retry-After")),
  };
}

/**
 * A file the API streams (a PDF), as bytes, with the session cookie. Errors
 * come back in the same shape as `apiFetch`. Never cached.
 */
export async function apiFetchBytes(path: string): Promise<ApiResult<{ bytes: ArrayBuffer; type: string }>> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, { credentials: "include", cache: "no-store" });
  } catch {
    return { ok: false, failure: networkFailure };
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    return { ok: false, failure: failureFrom(response, payload) };
  }
  try {
    const bytes = await response.arrayBuffer();
    return { ok: true, status: response.status, data: { bytes, type: response.headers.get("Content-Type") ?? "" } };
  } catch {
    return { ok: false, failure: networkFailure };
  }
}
