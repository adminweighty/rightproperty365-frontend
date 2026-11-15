import { apiFetch } from "@/lib/api/http";
import type { ContactMethod, RequestType } from "@/lib/api/property-requests";

/** A customer request as seen by the organisation it was routed to. */
export type AgentPropertyRequest = {
  request_id: string;
  reference: string;
  listing_id: string;
  /**
   * A summary of the listing the request is about. Optional: older API builds
   * do not send it, and it is null when the listing can no longer be read.
   */
  listing?: { slug: string; title: string; reference: string } | null;
  request_type: RequestType;
  status: string;
  /** The lead stage (new in API 0.20.0) and its wording. Optional for older API builds. */
  stage?: LeadStage;
  stage_label?: string;
  /** When the stage last changed; null until somebody moves the request. */
  stage_changed_at?: string | null;
  message: string;
  preferred_contact_method: ContactMethod;
  contact: { name: string; email: string; phone?: string | null };
  /**
   * The dates and guests of a request to stay; null for every other type.
   * It is a request: the nights are not blocked until the lister marks them.
   */
  stay?: { check_in: string; check_out: string; nights: number; guests: number } | null;
  created_at: string;
  /**
   * The member the request is assigned to (new in API 0.23.0); null in the
   * organisation inbox and for a direct seller. Optional for older API builds.
   */
  assigned_to?: { user_id: string; name: string } | null;
};

/** An enquiry sent to a directory profile, as seen by its authorised recipient. */
export type InboxBusinessEnquiry = {
  enquiry_id: string;
  reference: string;
  recipient: { kind: string; slug: string; name: string };
  service: string | null;
  message: string;
  preferred_contact_method: ContactMethod;
  contact: { name: string; email: string; phone?: string | null };
  status: string;
  created_at: string;
};

/** Organisation members only. The API returns just the enquiries the caller may read. */
export const listBusinessEnquiries = () =>
  apiFetch<{ items: InboxBusinessEnquiry[] }>("/v1/inbox/business-enquiries");

/** The lead stages in pipeline order; their wording comes from the API. */
export type LeadStage =
  | "NEW_ENQUIRY"
  | "ASSIGNED"
  | "CONTACTED"
  | "VIEWING_REQUESTED"
  | "VIEWING_SCHEDULED"
  | "FOLLOW_UP_REQUIRED"
  | "CONVERTED"
  | "CLOSED";

export type StageCount = { stage: LeadStage; label: string; count: number };

/** One page of the received requests (changed in API 0.20.0: it used to be every request, up to 100). */
export type AgentPropertyRequestPage = {
  items: AgentPropertyRequest[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  /** Every stage with its count under every filter except `stage`. */
  stage_counts: StageCount[];
};

export type RequestTimelineEntry = {
  event: "REQUEST_RECEIVED" | "STAGE_CHANGED" | "NOTE_ADDED" | "ASSIGNED" | "UNASSIGNED" | string;
  /** "Request received", "Moved to Contacted", "Note added", "Assigned to <name>", "Returned to the organisation inbox". */
  label: string;
  /** ASSIGNED only (new in API 0.23.0): who the request was given to. */
  assignee_name?: string | null;
  from_stage: LeadStage | null;
  to_stage: LeadStage | null;
  actor: "CUSTOMER" | "PROFESSIONAL" | "SYSTEM";
  actor_name: string | null;
  at: string;
};

/** Internal to the receiving side. The customer never sees a note. */
export type RequestNote = { id: string; body: string; author_name: string; mine: boolean; created_at: string };

/** One received request in full. */
export type ReceivedPropertyRequest = AgentPropertyRequest & {
  preferred_slot_utc: string | null;
  updated_at: string;
  /** The stages it can be moved to from where it is now (may be empty). */
  allowed_stages: { stage: LeadStage; label: string }[];
  /** New in API 0.23.0: the caller may assign it (its organisation's OWNER or MANAGER). */
  can_assign?: boolean;
  timeline: RequestTimelineEntry[];
  notes: RequestNote[];
};

/**
 * The API scopes this to the caller's organisations and own listings; the
 * filters only narrow it. `query` comes from `requestFiltersApiQuery`.
 */
export const listAgentPropertyRequests = (query = "") =>
  apiFetch<AgentPropertyRequestPage>(`/v1/agent/property-requests${query}`, { cache: "no-store" });

export const getAgentPropertyRequest = (id: string) =>
  apiFetch<{ request: ReceivedPropertyRequest }>(`/v1/agent/property-requests/${id}`, { cache: "no-store" });

/** 409 `INVALID_STAGE_TRANSITION` when the move is not allowed from the current stage. */
export const moveAgentPropertyRequest = (id: string, stage: LeadStage) =>
  apiFetch<{ request: ReceivedPropertyRequest }>(`/v1/agent/property-requests/${id}`, {
    method: "PATCH",
    body: { stage },
  });

/**
 * Gives the request to a member (an ACTIVE OWNER, MANAGER or AGENT of the
 * organisation that received it), or back to the organisation inbox with
 * null. A NEW_ENQUIRY moves to ASSIGNED. OWNER and MANAGER only.
 */
export const assignAgentPropertyRequest = (id: string, userId: string | null) =>
  apiFetch<{ request: ReceivedPropertyRequest }>(`/v1/agent/property-requests/${id}/assign`, {
    method: "POST",
    body: { user_id: userId },
  });

/** 1 to 2000 characters. Answers with the whole request, notes included. */
export const addAgentPropertyRequestNote = (id: string, body: string) =>
  apiFetch<{ request: ReceivedPropertyRequest }>(`/v1/agent/property-requests/${id}/notes`, {
    method: "POST",
    body: { body },
  });
