import { env } from "@/lib/env";

/**
 * Client for POST /v1/property-requests.
 *
 * Every customer enquiry goes through the RightProperty365 Go API (BR-022 /
 * FR-059). Never send customer details straight to an agent or a push provider.
 */

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
  guest_contact: { name: string; email: string; phone?: string };
  consent: { privacy_version: string; accepted: boolean };
};

export type PropertyRequestReceipt = {
  request_id: string;
  reference: string;
  status: string;
  created_at: string;
};

export type ApiFailure = {
  code: string;
  message: string;
  fields?: Record<string, string>;
  traceId?: string;
};

export type PropertyRequestResult =
  | { ok: true; receipt: PropertyRequestReceipt }
  | { ok: false; failure: ApiFailure };

const fallbackMessages: Record<number, string> = {
  404: "This listing could not be found.",
  409: "We already received a different request with this reference. Please try again.",
  410: "This listing is no longer available for enquiries.",
  429: "Too many requests. Please wait a minute and try again.",
};

export async function submitPropertyRequest(
  input: PropertyRequestInput,
): Promise<PropertyRequestResult> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/v1/property-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotency_key,
      },
      body: JSON.stringify(input),
    });
  } catch {
    return {
      ok: false,
      failure: {
        code: "NETWORK_ERROR",
        message: "We could not reach RightProperty365. Check your connection and try again.",
      },
    };
  }

  const body: unknown = await response.json().catch(() => null);

  if (response.ok && body && typeof body === "object" && "request_id" in body) {
    return { ok: true, receipt: body as PropertyRequestReceipt };
  }

  const envelope = body as { error?: Partial<ApiFailure>; trace_id?: string } | null;
  return {
    ok: false,
    failure: {
      code: envelope?.error?.code ?? `HTTP_${response.status}`,
      message:
        envelope?.error?.message ??
        fallbackMessages[response.status] ??
        "Something went wrong on our side. Please try again.",
      fields: envelope?.error?.fields,
      traceId: envelope?.trace_id,
    },
  };
}
