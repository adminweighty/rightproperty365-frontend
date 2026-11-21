import { apiFetch } from "@/lib/api/http";
import type { AppointmentSettings, ConsultationService, SlotAnswer } from "@/lib/appointment-availability";

/** Appointment availability (API 0.51.0): the professional's hours and services, and the slots customers see. */

export const getAppointmentSettings = () => apiFetch<AppointmentSettings>("/v1/me/appointment-settings", { cache: "no-store" });

export const saveAppointmentSettings = (body: Omit<AppointmentSettings, "updated_at">) =>
  apiFetch<AppointmentSettings>("/v1/me/appointment-settings", { method: "PUT", body });

export const listConsultationServices = () =>
  apiFetch<{ items: ConsultationService[] }>("/v1/me/consultation-services", { cache: "no-store" });

export type ServiceInput = {
  name?: string;
  duration_minutes?: number;
  channel?: string;
  location?: string;
  notes?: string;
  active?: boolean;
};

export const createConsultationService = (body: ServiceInput) =>
  apiFetch<{ service: ConsultationService }>("/v1/me/consultation-services", { method: "POST", body });

export const updateConsultationService = (id: string, body: ServiceInput) =>
  apiFetch<{ service: ConsultationService }>(`/v1/me/consultation-services/${id}`, { method: "PATCH", body });

export const archiveConsultationService = (id: string) =>
  apiFetch<null>(`/v1/me/consultation-services/${id}`, { method: "DELETE" });

export type SlotTarget =
  | { type: "VIEWING" | "CONSULTATION"; listingId: string }
  | { type: "CONSULTATION"; recipientKind: string; recipientSlug: string };

/** Public. `configured: false` means: no calendar, keep the free time field. */
export function getSlots(target: SlotTarget, opts: { from?: string; days?: number; serviceId?: string } = {}) {
  const q = new URLSearchParams({ type: target.type });
  if ("listingId" in target) q.set("listing_id", target.listingId);
  else {
    q.set("recipient_kind", target.recipientKind);
    q.set("recipient_slug", target.recipientSlug);
  }
  if (opts.from) q.set("from", opts.from);
  if (opts.days) q.set("days", String(opts.days));
  if (opts.serviceId) q.set("service_id", opts.serviceId);
  return apiFetch<SlotAnswer>(`/v1/appointments/slots?${q.toString()}`, { cache: "no-store" });
}
