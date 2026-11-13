import { apiFetch } from "@/lib/api/http";
import { PRIVACY_NOTICE_VERSION } from "@/lib/env";

/**
 * Client for the identity endpoints of the Go API.
 *
 * The web session is an HttpOnly cookie set by the API; this code never sees
 * or stores a token. Roles returned here are for showing the right UI only.
 * The API re-checks every request, so never treat them as authorisation.
 */

export type PlatformRole =
  | "SUPER_ADMIN"
  | "PLATFORM_ADMIN"
  | "MARKET_ADMIN"
  | "FINANCE_ADMIN"
  | "CONTENT_ADMIN"
  | "MODERATOR"
  | "SUPPORT";

export type MembershipRole = "OWNER" | "MANAGER" | "AGENT" | "STAFF";
export type OrganisationKind = "AGENCY" | "LANDLORD" | "HOST" | "DEVELOPER" | "SERVICE_PROVIDER";

export type Membership = {
  organisation_id: string;
  organisation_name: string;
  organisation_kind: OrganisationKind;
  market_code: string;
  role: MembershipRole;
};

export type User = {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  platform_roles: { role: PlatformRole; market_code: string | null }[];
  memberships: Membership[];
};

type SessionResponse = { user: User; session: { expires_at: string } };

export const platformRoleLabels: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super admin",
  PLATFORM_ADMIN: "Platform admin",
  MARKET_ADMIN: "Market admin",
  FINANCE_ADMIN: "Finance admin",
  CONTENT_ADMIN: "Content admin",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
};

export const membershipRoleLabels: Record<MembershipRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  AGENT: "Agent",
  STAFF: "Staff",
};

export const organisationKindLabels: Record<OrganisationKind, string> = {
  AGENCY: "Agency",
  LANDLORD: "Landlord",
  HOST: "Host",
  DEVELOPER: "Developer",
  SERVICE_PROVIDER: "Service provider",
};

/** True when the user belongs to at least one organisation. */
export const isProfessional = (user: User | null) => Boolean(user?.memberships.length);

export const getMe = () => apiFetch<{ user: User }>("/v1/me");

export const register = (input: { name: string; email: string; password: string; accepted: boolean }) =>
  apiFetch<{ status: string }>("/v1/auth/register", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      consent: { privacy_version: PRIVACY_NOTICE_VERSION, accepted: input.accepted },
    },
  });

export const verifyEmail = (token: string) =>
  apiFetch<SessionResponse>("/v1/auth/verify-email", { method: "POST", body: { token } });

export const resendVerification = (email: string) =>
  apiFetch<{ status: string }>("/v1/auth/resend-verification", { method: "POST", body: { email } });

export const login = (email: string, password: string) =>
  apiFetch<SessionResponse>("/v1/auth/login", { method: "POST", body: { email, password } });

export const logout = () => apiFetch<null>("/v1/auth/logout", { method: "POST" });

export const requestPasswordReset = (email: string) =>
  apiFetch<{ status: string }>("/v1/auth/password-reset/request", { method: "POST", body: { email } });

export const confirmPasswordReset = (token: string, password: string) =>
  apiFetch<null>("/v1/auth/password-reset/confirm", { method: "POST", body: { token, password } });
