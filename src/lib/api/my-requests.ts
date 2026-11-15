import { apiFetch } from "@/lib/api/http";

/**
 * The property requests the signed-in account sent, in the customer's own
 * terms (new in API 0.20.0). Never the lead stage, an internal note or who
 * handles the request. A request sent as a guest is not linked to an account.
 */

export type CustomerRequestStatus = "RECEIVED" | "IN_PROGRESS" | "RESPONDED" | "VIEWING_SCHEDULED" | "CLOSED";

export type CustomerPropertyRequest = {
  request_id: string;
  reference: string;
  listing_id: string;
  /** Null when the listing no longer has a public page. */
  listing: { slug: string; title: string; reference: string } | null;
  request_type: string;
  status: CustomerRequestStatus;
  /** The API's wording for `status`; show this. */
  status_label: string;
  message: string;
  preferred_contact_method: string;
  preferred_slot_utc: string | null;
  stay: { check_in: string; check_out: string; nights: number; guests: number } | null;
  created_at: string;
  /** Only on a single request. Oldest first. */
  timeline?: { event: "RECEIVED" | "STATUS_CHANGED"; status: CustomerRequestStatus; status_label: string; at: string }[];
};

export type CustomerPropertyRequestPage = {
  items: CustomerPropertyRequest[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  /** Every status with the account's count, whatever the filter. */
  status_counts: { status: CustomerRequestStatus; label: string; count: number }[];
};

export const listMyPropertyRequests = ({ status, page }: { status?: string; page: number }) => {
  const search = new URLSearchParams({ page: String(page), page_size: "20" });
  if (status) search.set("status", status);
  return apiFetch<CustomerPropertyRequestPage>(`/v1/me/property-requests?${search}`, { cache: "no-store" });
};

export const getMyPropertyRequest = (id: string) =>
  apiFetch<{ request: CustomerPropertyRequest }>(`/v1/me/property-requests/${id}`, { cache: "no-store" });

/** Badge tones for the customer statuses. The badge always carries the word too. */
export const customerStatusTones: Record<string, "info" | "primary" | "success" | "accent" | "neutral"> = {
  RECEIVED: "info",
  IN_PROGRESS: "primary",
  RESPONDED: "success",
  VIEWING_SCHEDULED: "accent",
  CLOSED: "neutral",
};
