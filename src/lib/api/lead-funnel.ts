import { apiFetch, apiFetchFile } from "@/lib/api/http";
import { SELLER_TARGET } from "@/lib/lead-funnel";

/*
 * The lead conversion funnel and response-time report (API 0.38.0). Read in
 * the browser with the session cookie; every answer is private and never
 * cached. The API scopes the requests counted as the inbox does: an OWNER or
 * MANAGER sees the organisation's, an AGENT or STAFF member the ones assigned
 * to them plus the unassigned organisation inbox, a direct seller their own.
 */

export type LeadFunnelScope = "ORGANISATION" | "MEMBER" | "DIRECT_SELLER";

/** Rates are decimal strings with exactly 4 places ("0.8333"), or null. */
export type FourPlaceRate = string | null;

export type LeadFunnelStep = {
  /** `RECEIVED`, `ASSIGNED`, `CONTACTED`, `VIEWING_REQUESTED`, `VIEWING_SCHEDULED`, `CONVERTED`. */
  step: string;
  label: string;
  reached: number;
  conversion_from_previous: FourPlaceRate;
  conversion_from_received: FourPlaceRate;
  current: number;
};

export type LeadFunnelBreakdownFigures = {
  received: number;
  contacted: number;
  converted: number;
  conversion_rate: FourPlaceRate;
  median_first_response_minutes: number | null;
};

export type LeadFunnelAgentRow = LeadFunnelBreakdownFigures & {
  /** Null for the unassigned organisation inbox. */
  user_id: string | null;
  name: string;
};

export type LeadFunnelTypeRow = LeadFunnelBreakdownFigures & { request_type: string; label: string };

export type LeadFunnelListingRow = LeadFunnelBreakdownFigures & {
  listing_id: string;
  /** Null when the listing has no public page. */
  listing: { slug: string; title: string; reference: string } | null;
};

/** One campaign (API 0.58.0); `campaign` is null on the row of the requests that came with none. */
export type LeadFunnelCampaignRow = LeadFunnelBreakdownFigures & {
  campaign: { source: string; medium: string; campaign: string } | null;
};

export type LeadFunnelReport = {
  organisation_id: string | null;
  scope: LeadFunnelScope;
  window: { from: string; to: string; days: number; timezone: string };
  filters: { agent_user_id: string | null; listing_id: string | null; request_type: string | null; market_code: string | null };
  generated_at: string;
  received: number;
  steps: LeadFunnelStep[];
  side_states: {
    closed_without_converting: number;
    converted_then_closed: number;
    follow_up_required: { current: number; ever: number };
    open: number;
    closed: number;
  };
  response_time: {
    responded: number;
    never_responded: number;
    /** Minutes, one decimal; null when none responded. */
    median_minutes: number | null;
    p90_minutes: number | null;
    within_1h: number;
    within_1h_rate: FourPlaceRate;
    within_24h: number;
    within_24h_rate: FourPlaceRate;
  };
  time_to_conversion: { converted: number; median_days: number | null };
  by_agent: LeadFunnelAgentRow[];
  by_request_type: LeadFunnelTypeRow[];
  by_listing: LeadFunnelListingRow[];
  /** The 20 campaigns with the most requests, then the requests without one (API 0.58.0; absent from older builds). */
  by_campaign?: LeadFunnelCampaignRow[];
};

/** `GET /v1/agent/organisations/{id}/reports/lead-funnel`, or `GET /v1/me/reports/lead-funnel` for `me`. */
const reportPath = (target: string) =>
  target === SELLER_TARGET ? "/v1/me/reports/lead-funnel" : `/v1/agent/organisations/${encodeURIComponent(target)}/reports/lead-funnel`;

/** `query` from `funnelApiQuery`. */
export const getLeadFunnel = (target: string, query: string) =>
  apiFetch<LeadFunnelReport>(`${reportPath(target)}${query}`, { cache: "no-store" });

/** The three breakdown tables as one CSV (`?format=csv`, `query` built with it). */
export const downloadLeadFunnelCsv = (target: string, query: string) => apiFetchFile(`${reportPath(target)}${query}`);
