import type { EmailDeliveryOverview, EmailSuppression } from "@/lib/email-delivery";
import { apiFetch } from "@/lib/api/http";

/** Email delivery for administrators (API 0.59.0): SUPER_ADMIN, PLATFORM_ADMIN and SUPPORT. */

export const getEmailDeliveries = () => apiFetch<EmailDeliveryOverview>("/v1/admin/email-deliveries", { cache: "no-store" });

/** `email` looks one address up (the API compares hashes; the address is not stored). */
export const listEmailSuppressions = (email?: string) =>
  apiFetch<{ items: EmailSuppression[] }>(
    `/v1/admin/email-deliveries/suppressions${email ? `?email=${encodeURIComponent(email)}` : ""}`,
    { cache: "no-store" },
  );

export const clearEmailSuppression = (hash: string, reason: string) =>
  apiFetch<null>(`/v1/admin/email-deliveries/suppressions/${hash}`, { method: "DELETE", body: { reason } });
