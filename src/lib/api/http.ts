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
};

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; failure: ApiFailure };

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, or as multipart/form-data when it is a FormData (file uploads). */
  body?: unknown;
  headers?: Record<string, string>;
};

const fallbackMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You do not have access to this.",
  404: "We could not find that.",
  413: "That file is too large.",
  415: "That file type is not accepted.",
  429: "Too many attempts. Please wait a minute and try again.",
};

export async function apiFetch<T>(path: string, options: Options = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, headers = {} } = options;

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      credentials: "include",
      // For FormData the browser sets the multipart Content-Type and its boundary.
      headers:
        body === undefined || body instanceof FormData
          ? headers
          : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      failure: {
        code: "NETWORK_ERROR",
        status: 0,
        message: "We could not reach RightProperty365. Check your connection and try again.",
      },
    };
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.ok) {
    return { ok: true, data: payload as T, status: response.status };
  }

  const envelope = payload as {
    error?: { code?: string; message?: string; fields?: Record<string, string> };
    trace_id?: string;
  } | null;

  return {
    ok: false,
    failure: {
      code: envelope?.error?.code ?? `HTTP_${response.status}`,
      status: response.status,
      message:
        envelope?.error?.message ??
        fallbackMessages[response.status] ??
        "Something went wrong on our side. Please try again.",
      fields: envelope?.error?.fields,
      traceId: envelope?.trace_id,
    },
  };
}
