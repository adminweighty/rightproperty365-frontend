import { apiFetch, type ApiFailure } from "@/lib/api/http";
import type { ContactMethod } from "@/lib/api/property-requests";
import type { DirectoryKind } from "@/lib/data/directory";

/**
 * Client for POST /v1/business-enquiries: an enquiry to a directory profile
 * (agency, agent, developer, property manager, host or service provider).
 *
 * Profiles never show a phone number or email address. This is the only way
 * to reach them, so every business enquiry is recorded by RightProperty365
 * and lands in the recipient's inbox in the app.
 */

export type BusinessEnquiryInput = {
  recipient: { kind: DirectoryKind; slug: string };
  /** One of the recipient's listed services, when the customer picked one. */
  service?: string;
  message: string;
  preferred_contact_method: ContactMethod;
  idempotency_key: string;
  /** Omit name and email when the customer is signed in; the API uses their profile. */
  guest_contact?: { name?: string; email?: string; phone?: string };
  consent: { privacy_version: string; accepted: boolean };
};

export type BusinessEnquiryReceipt = {
  enquiry_id: string;
  reference: string;
  status: string;
  created_at: string;
};

export type BusinessEnquiryResult =
  | { ok: true; receipt: BusinessEnquiryReceipt }
  | { ok: false; failure: ApiFailure };

const messages: Record<number, string> = {
  404: "Enquiries to this profile are not available yet. Please try again later.",
  409: "We already received a different enquiry with this reference. Please try again.",
  410: "This profile is no longer accepting enquiries.",
};

export async function submitBusinessEnquiry(input: BusinessEnquiryInput): Promise<BusinessEnquiryResult> {
  const result = await apiFetch<BusinessEnquiryReceipt>("/v1/business-enquiries", {
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
