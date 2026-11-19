import { apiFetch, type ApiFailure } from "@/lib/api/http";
import type { ContactMethod } from "@/lib/api/property-requests";

/**
 * Client for POST /v1/business-enquiries: an enquiry to a directory profile
 * (agency, agent, developer, property manager, host or service provider).
 *
 * Profiles never show a phone number or email address. This is the only way
 * to reach them, so every business enquiry is recorded by RightProperty365
 * and lands in the recipient's inbox in the app.
 */

export type BusinessEnquiryInput = {
  /**
   * `kind` is a `directory_kinds` code from the API. May be left out with
   * `development`: the recipient is then the project's developer.
   */
  recipient?: { kind: string; slug: string };
  /** An enquiry about a development project (API 0.44.0), optionally about one of its unit types. */
  development?: { market: string; slug: string; unit_type_id?: string };
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
  404: "Enquiries here are not available at the moment. Please try again later.",
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
  if (failure.code === "DEVELOPMENT_NOT_FOUND") {
    return { ok: false, failure: { ...failure, message: "This project is no longer shown on RightProperty365, so it cannot take enquiries." } };
  }
  return {
    ok: false,
    failure: failure.fields ? failure : { ...failure, message: messages[failure.status] ?? failure.message },
  };
}
