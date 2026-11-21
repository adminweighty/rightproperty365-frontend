import { apiFetch, type ApiFailure } from "@/lib/api/http";

/**
 * Client for POST /v1/property-requests.
 *
 * Every customer enquiry goes through the RightProperty365 Go API (BR-022 /
 * FR-059). Never send customer details straight to an agent or a push provider.
 */

export type { ApiFailure };

/**
 * Codes from the API's `request_types` and `contact_methods` reference sets
 * (GET /v1/reference). The lists and their labels are loaded on the server and
 * passed to the forms as props; nothing is listed here.
 */
export type RequestType = string;
export type ContactMethod = string;

export type PropertyRequestInput = {
  listing_id: string;
  request_type: RequestType;
  message: string;
  preferred_contact_method: ContactMethod;
  preferred_slot_utc?: string;
  /** A consultation service of the professional (API 0.51.0), with a slot. */
  service_id?: string;
  /**
   * A request to stay (`STAY_REQUEST`, short stays only): the first night, the
   * day of leaving (`YYYY-MM-DD`, the listing's time zone) and the number of
   * guests. All three are required for it and not allowed for any other type.
   */
  check_in?: string;
  check_out?: string;
  guests?: number;
  idempotency_key: string;
  /** Omit name and email when the customer is signed in; the API uses their profile. */
  guest_contact?: { name?: string; email?: string; phone?: string };
  consent: { privacy_version: string; accepted: boolean };
};

export type PropertyRequestReceipt = {
  request_id: string;
  reference: string;
  status: string;
  created_at: string;
  /** Set when a viewing or consultation request with a preferred time created an appointment. */
  appointment?: { id: string; reference: string } | null;
};

export type PropertyRequestResult =
  | { ok: true; receipt: PropertyRequestReceipt }
  | { ok: false; failure: ApiFailure };

const messages: Record<number, string> = {
  404: "This listing could not be found.",
  409: "We already received a different request with this reference. Please try again.",
  410: "This listing is no longer available for enquiries.",
};

export async function submitPropertyRequest(
  input: PropertyRequestInput,
): Promise<PropertyRequestResult> {
  const result = await apiFetch<PropertyRequestReceipt>("/v1/property-requests", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": input.idempotency_key },
  });

  if (result.ok) return { ok: true, receipt: result.data };

  const { failure } = result;
  return {
    ok: false,
    failure:
      failure.code === "DATES_UNAVAILABLE"
        ? { ...failure, message: "Those dates are no longer available." }
        : failure.fields
          ? failure
          : { ...failure, message: messages[failure.status] ?? failure.message },
  };
}
