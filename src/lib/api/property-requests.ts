import { apiFetch, type ApiFailure } from "@/lib/api/http";

/**
 * Client for POST /v1/property-requests.
 *
 * Every customer enquiry goes through the RightProperty365 Go API (BR-022 /
 * FR-059). Never send customer details straight to an agent or a push provider.
 */

export type { ApiFailure };

export const requestTypes = [
  { value: "ENQUIRY", label: "General enquiry" },
  { value: "PROPERTY_INFORMATION", label: "More information" },
  { value: "VIEWING_REQUEST", label: "Book a viewing" },
  { value: "CONSULTATION_REQUEST", label: "Speak to the agent" },
] as const;

export const contactMethods = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone call" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

export type RequestType = (typeof requestTypes)[number]["value"];
export type ContactMethod = (typeof contactMethods)[number]["value"];

export type PropertyRequestInput = {
  listing_id: string;
  request_type: RequestType;
  message: string;
  preferred_contact_method: ContactMethod;
  preferred_slot_utc?: string;
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
    failure: failure.fields ? failure : { ...failure, message: messages[failure.status] ?? failure.message },
  };
}
