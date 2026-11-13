import { apiFetch } from "@/lib/api/http";
import type { ContactMethod, RequestType } from "@/lib/api/property-requests";

/** A customer request as seen by the organisation it was routed to. */
export type AgentPropertyRequest = {
  request_id: string;
  reference: string;
  listing_id: string;
  request_type: RequestType;
  status: string;
  message: string;
  preferred_contact_method: ContactMethod;
  contact: { name: string; email: string; phone?: string | null };
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
