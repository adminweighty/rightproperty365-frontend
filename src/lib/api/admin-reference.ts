import { apiFetch } from "@/lib/api/http";
import type { ReferenceItem } from "@/lib/api/types";

/*
 * Reference data for administrators (API 0.25.0): SUPER_ADMIN,
 * PLATFORM_ADMIN, CONTENT_ADMIN, and MARKET_ADMIN for the rows of its own
 * market. Rows are relabelled, reordered, deactivated and reactivated, never
 * deleted; only `creatable` sets take new rows.
 */

export type AdminReferenceSet = {
  set: string;
  /** Rows may be added (property types, listing features, service trades, regions, cities, suburbs). */
  creatable: boolean;
  /** Rows belong to one market (market_code required). */
  market_bound: boolean;
  /** The set `parent_code` points into. */
  parent_set: string | null;
};

export type AdminReferenceItem = ReferenceItem & { active: boolean };

export type AdminReferenceInput = {
  code?: string;
  label?: string;
  singular_label?: string;
  description?: string;
  sort_order?: number;
  market_code?: string;
  parent_code?: string;
};

const setPath = (set: string) => `/v1/admin/reference/${encodeURIComponent(set)}`;
const rowPath = (set: string, code: string) => `${setPath(set)}/${encodeURIComponent(code)}`;

export const adminReferenceSets = () => apiFetch<{ sets: AdminReferenceSet[] }>("/v1/admin/reference", { cache: "no-store" });

export const adminReferenceRows = (set: string, market?: string) =>
  apiFetch<{ set: string; items: AdminReferenceItem[] }>(`${setPath(set)}${market ? `?market=${market}` : ""}`, {
    cache: "no-store",
  });

/** 409 `REFERENCE_ITEM_EXISTS` (also when inactive), 422 `REFERENCE_SET_NOT_EXTENSIBLE`, 403 `REFERENCE_MARKET_FORBIDDEN`. */
export const adminReferenceCreate = (set: string, input: AdminReferenceInput) =>
  apiFetch<{ item: AdminReferenceItem }>(setPath(set), { method: "POST", body: input });

/** `code` and `market_code` never change. */
export const adminReferenceUpdate = (set: string, code: string, input: AdminReferenceInput) =>
  apiFetch<{ item: AdminReferenceItem }>(rowPath(set, code), { method: "PATCH", body: input });

export const adminReferenceDeactivate = (set: string, code: string) =>
  apiFetch<{ item: AdminReferenceItem }>(`${rowPath(set, code)}/deactivate`, { method: "POST" });

export const adminReferenceReactivate = (set: string, code: string) =>
  apiFetch<{ item: AdminReferenceItem }>(`${rowPath(set, code)}/reactivate`, { method: "POST" });

/** Plain names for the sets (the API sends codes only). */
export const REFERENCE_SET_LABELS: Record<string, string> = {
  deal_types: "Deal types",
  property_categories: "Property categories",
  property_types: "Property types",
  request_types: "Request types",
  contact_methods: "Contact methods",
  account_roles: "Account roles",
  directory_kinds: "Directory sections",
  service_trades: "Service trades",
  regions: "Regions",
  cities: "Cities and towns",
  suburbs: "Suburbs",
  listing_features: "Listing features",
  onboarding_documents: "Onboarding documents",
  organisation_kinds: "Organisation kinds",
  price_periods: "Price periods",
};

export const referenceSetLabel = (set: string) =>
  REFERENCE_SET_LABELS[set] ?? set.charAt(0).toUpperCase() + set.slice(1).replace(/_/g, " ");
