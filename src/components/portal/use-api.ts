"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { displayZoneServerSnapshot, displayZoneSnapshot, subscribeDisplayZone } from "@/lib/display-zone";
import type { ApiFailure, ApiResult } from "@/lib/api/http";

export type Loadable<T> =
  /** `previous`: the last answer, while a new one is on its way (to keep counts on screen). */
  | { status: "loading"; previous?: T }
  | { status: "ready"; data: T }
  | { status: "error"; failure: ApiFailure };

type Done<T> = { load: () => Promise<ApiResult<T>>; attempt: number; result: ApiResult<T> };

/**
 * Reads something from the API in the browser (with the session cookie) and
 * reads it again whenever `load` changes, so `load` must be stable
 * (`useCallback` with the filters it depends on). `reload` asks again;
 * `replace` shows an answer the page already has (the request after a change).
 */
export function useApi<T>(load: () => Promise<ApiResult<T>>) {
  // Times on screen follow the viewer's display zone (API 0.62.0): re-render when it changes.
  useSyncExternalStore(subscribeDisplayZone, displayZoneSnapshot, displayZoneServerSnapshot);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState<Done<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (!cancelled) setDone({ load, attempt, result });
    });
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const replace = useCallback(
    (data: T) => setDone((current) => (current ? { ...current, result: { ok: true, data, status: 200 } } : current)),
    [],
  );

  // An answer to an earlier question (other filters, an earlier attempt) is not shown as current.
  const state: Loadable<T> =
    !done || done.load !== load || done.attempt !== attempt
      ? { status: "loading", previous: done?.result.ok ? done.result.data : undefined }
      : done.result.ok
        ? { status: "ready", data: done.result.data }
        : { status: "error", failure: done.result.failure };

  return { state, reload, replace };
}
