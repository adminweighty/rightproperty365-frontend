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
  message: string;
  preferred_contact_method: ContactMethod;
  contact: { name: string; email: string; phone?: string | null };
  /**
   * The dates and guests of a request to stay; null for every other type.
   * It is a request: the nights are not blocked until the lister marks them.
   */
  stay?: { check_in: string; check_out: string; nights: number; guests: number } | null;
  created_at: string;
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

/** The API scopes this to the caller's organisations; there is nothing to filter here. */
export const listAgentPropertyRequests = () =>
  apiFetch<{ items: AgentPropertyRequest[] }>("/v1/agent/property-requests");
