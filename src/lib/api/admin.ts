import type { StageCount } from "@/lib/api/agent";
import { apiFetch, type ApiResult } from "@/lib/api/http";
import { readFileScanReport, type FileScanReport } from "@/lib/file-scan";

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

/** An organisation a routing exception may be given to (API 0.49.0). */
export type RoutingCandidate = {
  organisation_id: string;
  name: string;
  kind: string;
  members: { user_id: string; name: string; role: string }[];
};

/** The organisations of the request's country that may receive it, with their owners, managers and agents. */
export const routingCandidates = (id: string) =>
  apiFetch<{ organisations: RoutingCandidate[] }>(`/v1/admin/routing-exceptions/${id}/candidates`, { cache: "no-store" });

/**
 * Gives a routing exception to an organisation's inbox, or to one of its
 * members (API 0.49.0). They are notified; the request is RECEIVED. 409
 * `ALREADY_RESOLVED` when someone dealt with it first.
 */
export const rerouteRoutingException = (id: string, input: { organisation_id: string; user_id: string | null; note: string }) =>
  apiFetch<{ request: RoutingException }>(`/v1/admin/routing-exceptions/${id}/assign`, { method: "POST", body: input });

/** Records that someone dealt with it. 409 `ALREADY_RESOLVED` when someone else did first. */
export const resolveRoutingException = (id: string, note: string) =>
  apiFetch<{ request: RoutingException }>(`/v1/admin/routing-exceptions/${id}/resolve`, {
    method: "POST",
    body: note ? { note } : {},
  });

/**
 * The malware scanning of uploads (API 0.41.0): counts, the oldest file still
 * waiting, the latest pending and unsafe files, and this API process's image
 * counters. SUPER_ADMIN and PLATFORM_ADMIN. `fetchedAt` dates the answer, for
 * the age of the oldest pending file.
 */
export async function getFileScans(): Promise<ApiResult<FileScanReport & { fetchedAt: number }>> {
  const result = await apiFetch<unknown>("/v1/admin/file-scans", { cache: "no-store" });
  return result.ok ? { ...result, data: { ...readFileScanReport(result.data), fetchedAt: Date.now() } } : result;
}
