import { apiFetch } from "@/lib/api/http";
import type { AlertFrequency } from "@/lib/saved-searches";

/** Saved searches and alerts (API 0.52.0). */

export type SavedSearch = {
  id: string;
  name: string;
  /** A GET /v1/listings query string, as the search page uses it (without "?"). */
  query: string;
  frequency: AlertFrequency;
  last_alert_at: string | null;
  created_at: string;
  updated_at: string;
};

export const listSavedSearches = () => apiFetch<{ items: SavedSearch[] }>("/v1/me/saved-searches", { cache: "no-store" });

/** 400 with `fields["query.<param>"]`; 409 SAVED_SEARCH_LIMIT. */
export const createSavedSearch = (body: { name: string; query: string; frequency: AlertFrequency }) =>
  apiFetch<{ saved_search: SavedSearch }>("/v1/me/saved-searches", { method: "POST", body });

export const updateSavedSearch = (id: string, body: { name?: string; frequency?: AlertFrequency }) =>
  apiFetch<{ saved_search: SavedSearch }>(`/v1/me/saved-searches/${id}`, { method: "PATCH", body });

export const deleteSavedSearch = (id: string) => apiFetch<null>(`/v1/me/saved-searches/${id}`, { method: "DELETE" });

/** Public: the link in the alert email. 400 INVALID_TOKEN. */
export const unsubscribeSavedSearch = (token: string) =>
  apiFetch<{ name: string }>("/v1/saved-searches/unsubscribe", { method: "POST", body: { token } });
