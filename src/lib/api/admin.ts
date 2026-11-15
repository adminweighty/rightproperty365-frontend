import type { StageCount } from "@/lib/api/agent";
import { apiFetch } from "@/lib/api/http";

/**
 * Administrator overview and routing exceptions (new in API 0.20.0). Admin
 * sessions only. Each platform role gets only the sections it covers; the
 * others are null and missing from `sections`.
 */

export type AdminStatusCount = { status: string; label: string; count: number };

export type AdminOverviewSection = "accounts" | "verifications" | "listings" | "requests";

export type AdminOverview = {
  roles: { role: string; market_code: string | null }[];
  sections: AdminOverviewSection[];
  accounts: {
    total: number;
    administrators: number;
    unverified: number;
    last_7_days: number;
    last_30_days: number;
    by_status: AdminStatusCount[];
    by_role: { role: string; label: string; status: string; count: number }[];
    recent: { id: string; name: string; email: string; email_verified: boolean; roles: string[]; created_at: string }[];
  } | null;
  verifications: { waiting: number; by_status: AdminStatusCount[] } | null;
  listings: { market_codes: string[] | null; total: number; by_status: AdminStatusCount[] } | null;
  requests: {
    market_codes: string[] | null;
    total: number;
    last_7_days: number;
    last_30_days: number;
    by_stage: StageCount[];
    routing_exceptions: { open: number; resolved: number };
  } | null;
};

export const getAdminOverview = () => apiFetch<AdminOverview>("/v1/admin/overview", { cache: "no-store" });

export type RoutingExceptionState = "OPEN" | "RESOLVED" | "ALL";

export type RoutingException = {
  request_id: string;
  reference: string;
  listing_id: string;
  listing: { slug: string; title: string; reference: string } | null;
  request_type: string;
  message: string;
  preferred_contact_method: string;
  contact: { name: string; email: string; phone: string | null };
  stay: { check_in: string; check_out: string; nights: number; guests: number } | null;
  created_at: string;
  state: "OPEN" | "RESOLVED";
  resolved_at: string | null;
  resolution_note: string | null;
};

export type RoutingExceptionPage = {
  items: RoutingException[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export const listRoutingExceptions = (state: RoutingExceptionState, page: number) =>
  apiFetch<RoutingExceptionPage>(`/v1/admin/routing-exceptions?state=${state}&page=${page}&page_size=20`, {
    cache: "no-store",
  });

/** Records that someone dealt with it. 409 `ALREADY_RESOLVED` when someone else did first. */
export const resolveRoutingException = (id: string, note: string) =>
  apiFetch<{ request: RoutingException }>(`/v1/admin/routing-exceptions/${id}/resolve`, {
    method: "POST",
    body: note ? { note } : {},
  });
