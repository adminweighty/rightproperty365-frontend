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
 * Roles a person can choose for themselves at sign-up. Platform administrator
 * roles are never in this list; the API rejects them.
 */
export const accountRoleGroups = [
  {
    legend: "Looking for property",
    professional: false,
    roles: [
      { value: "CONSUMER", label: "Buyer or renter" },
      { value: "TENANT", label: "Tenant" },
    ],
  },
  {
    legend: "Listing or managing property",
    professional: true,
    roles: [
      { value: "PRIVATE_SELLER", label: "Private seller" },
      { value: "LANDLORD", label: "Landlord or property manager" },
      { value: "HOST", label: "Host: short stays and venues" },
      { value: "DEVELOPER", label: "Property developer" },
      { value: "SERVICE_PROVIDER", label: "Service provider" },
    ],
  },
  {
    legend: "Working at an agency",
    professional: true,
    roles: [
      { value: "AGENT", label: "Estate agent" },
      { value: "AGENCY_STAFF", label: "Agency staff" },
      { value: "AGENCY_ADMIN", label: "Agency administrator" },
      { value: "AGENCY_OWNER", label: "Agency owner" },
    ],
  },
] as const;

export type AccountRole = (typeof accountRoleGroups)[number]["roles"][number]["value"];
export type AccountRoleStatus = "ACTIVE" | "PENDING_VERIFICATION";

export const accountRoleLabels = Object.fromEntries(
  accountRoleGroups.flatMap((group) => group.roles.map((role) => [role.value, role.label])),
) as Record<AccountRole, string>;

export type User = {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  /** Self-selected roles. A pending role grants no access until it is verified. */
  account_roles: { role: AccountRole; status: AccountRoleStatus }[];
  platform_roles: { role: PlatformRole; market_code: string | null }[];
  memberships: Membership[];
};

/**
 * "admin" sessions come only from the administrator sign-in and are the only
 * ones the API accepts for platform-role actions.
 */
export type SessionScope = "customer" | "admin";

export type SessionResponse = { user: User; session: { scope: SessionScope; expires_at: string } };

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
