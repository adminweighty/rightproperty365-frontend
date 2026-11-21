import { apiFetch } from "@/lib/api/http";
import type { ListingPage } from "@/lib/api/types";

/** Featured and sponsored placements (API 0.53.0), for administrators. */

export type PlacementKind = "FEATURED" | "SPONSORED";
export type PlacementStatus = "ACTIVE" | "SCHEDULED" | "ENDED";

export type Placement = {
  id: string;
  listing: { id: string; slug: string; title: string; reference: string; market_code: string };
  kind: PlacementKind;
  label: string;
  starts_at: string;
  ends_at: string;
  status: PlacementStatus;
  subscription_id: string | null;
  note: string | null;
  granted_by: string;
  granted_at: string;
  ended_at: string | null;
  end_reason: string | null;
};

export function listPlacements(status: PlacementStatus | "", page = 1) {
  const q = new URLSearchParams({ page: String(page) });
  if (status) q.set("status", status);
  return apiFetch<{ items: Placement[]; total: number; page: number; page_size: number }>(`/v1/admin/placements?${q}`, { cache: "no-store" });
}

export type PlacementInput = {
  listing_id: string;
  kind: PlacementKind;
  starts_at?: string;
  ends_at: string;
  subscription_id?: string;
  note?: string;
};

/** 409 PLACEMENT_OVERLAP, PLACEMENT_LIMIT, LISTING_NOT_PUBLISHED. */
export const grantPlacement = (body: PlacementInput) =>
  apiFetch<{ placement: Placement }>("/v1/admin/placements", { method: "POST", body });

export const endPlacement = (id: string, reason: string) =>
  apiFetch<{ placement: Placement }>(`/v1/admin/placements/${id}/end`, { method: "POST", body: { reason } });

/** A public listing by its reference (the grant form looks it up). */
export const listingByReference = (reference: string) =>
  apiFetch<ListingPage>(`/v1/listings?reference=${encodeURIComponent(reference.trim())}&page_size=1`, { cache: "no-store" });

/** The wording of a placement error code. */
export function placementErrorText(code: string | undefined): string | null {
  switch (code) {
    case "PLACEMENT_OVERLAP":
      return "This listing already has a placement in that period. End it first, or choose other dates.";
    case "PLACEMENT_LIMIT":
      return "The subscription's featured listings are all in use in that period.";
    case "LISTING_NOT_PUBLISHED":
      return "Only a published listing can be given a placement.";
    case "PLACEMENT_ENDED":
      return "This placement has already ended.";
    case "PLACEMENT_NOT_FOUND":
    case "LISTING_NOT_FOUND":
      return "Not found, or not in your markets.";
    default:
      return null;
  }
}
