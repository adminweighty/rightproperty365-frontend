import { apiFetch } from "@/lib/api/http";

/** Account security (API 0.50.0): password, signed-in devices, email address. */

export type DeviceSession = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  /** "Chrome on Windows", "RightProperty365 app on Android" or "Unknown device". */
  client: string;
  current: boolean;
};

/** 204; other devices are signed out. 400 with `fields.current_password` / `fields.new_password`. */
export const changePassword = (current_password: string, new_password: string) =>
  apiFetch<null>("/v1/me/password", { method: "POST", body: { current_password, new_password } });

export const listSessions = () => apiFetch<{ items: DeviceSession[] }>("/v1/me/sessions", { cache: "no-store" });

export const revokeSession = (id: string) => apiFetch<null>(`/v1/me/sessions/${id}`, { method: "DELETE" });

export const revokeOtherSessions = () => apiFetch<{ revoked: number }>("/v1/me/sessions/revoke-others", { method: "POST", body: {} });

/** 202: a link goes to the new address, a notice to the current one. */
export const requestEmailChange = (new_email: string, current_password: string) =>
  apiFetch<null>("/v1/me/email", { method: "POST", body: { new_email, current_password } });

/** Public: the link may be opened signed out. 400 INVALID_TOKEN, 409 EMAIL_TAKEN. */
export const confirmEmailChange = (token: string) =>
  apiFetch<{ user: { id: string; email: string } }>("/v1/auth/email-change/confirm", { method: "POST", body: { token } });
