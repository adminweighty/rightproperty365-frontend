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

/**
 * A role a person can choose for themselves at sign-up: a code from the API's
 * `account_roles` reference set (GET /v1/reference). The roles, their groups
 * and their labels are loaded on the server and passed to the sign-up form and
 * the account page as props. Platform administrator roles are never in that
 * set, and the API rejects them.
 */
export type AccountRole = string;
export type AccountRoleStatus = "ACTIVE" | "PENDING_VERIFICATION" | "REJECTED";

/** Status of a role's onboarding application (src/lib/api/onboarding.ts). */
export type OnboardingStatus = "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";

/** One heading of the sign-up role picker with its roles, in the API's order. */
export type AccountRoleGroup = {
  code: string;
  label: string;
  roles: { code: AccountRole; label: string; requiresVerification: boolean }[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  /** Self-selected roles. A pending role grants no access until it is verified. */
  account_roles: {
    role: AccountRole;
    status: AccountRoleStatus;
    /** Null for a role that has no onboarding (buyer, tenant). Optional: older API builds do not send it. */
    onboarding_status?: OnboardingStatus | null;
  }[];
  platform_roles: { role: PlatformRole; market_code: string | null }[];
  memberships: Membership[];
};

/**
 * "admin" sessions come only from the administrator sign-in and are the only
 * ones the API accepts for platform-role actions.
 */
export type SessionScope = "customer" | "admin";

export type SessionResponse = { user: User; session: { scope: SessionScope; expires_at: string } };

// The three maps below label fixed enums of the identity API (the User schema).
// They are not reference sets, so GET /v1/reference has no rows for them.
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

/** True when the user chose a role that has an onboarding application. */
export const hasOnboarding = (user: User | null) =>
  Boolean(user?.account_roles?.some(({ onboarding_status }) => Boolean(onboarding_status)));

/** True while an application still needs something from the user. */
export const hasOnboardingToDo = (user: User | null) =>
  Boolean(
    user?.account_roles?.some(
      ({ onboarding_status }) => onboarding_status === "DRAFT" || onboarding_status === "CHANGES_REQUESTED",
    ),
  );

/** True when the user belongs to at least one organisation. */
export const isProfessional = (user: User | null) => Boolean(user?.memberships.length);

/**
 * Who is shown the request inbox: organisation members and private sellers.
 * The API decides which requests each of them may read.
 */
export const canUseInbox = (user: User | null) =>
  isProfessional(user) ||
  Boolean(user?.account_roles?.some(({ role }) => role === "PRIVATE_SELLER"));

export const getMe = () => apiFetch<SessionResponse>("/v1/me");

/** Administrator sign-in. Customer accounts get the same generic 401 as a wrong password. */
export const adminLogin = (email: string, password: string) =>
  apiFetch<SessionResponse>("/v1/admin/auth/login", { method: "POST", body: { email, password } });

export const register = (input: {
  name: string;
  email: string;
  password: string;
  roles: AccountRole[];
  accepted: boolean;
}) =>
  apiFetch<{ status: string }>("/v1/auth/register", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      roles: input.roles,
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
