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

export type Membership = {
  organisation_id: string;
  organisation_name: string;
  /** A code of the API's `organisation_kinds` reference set, which has its label. */
  organisation_kind: string;
  market_code: string;
  role: MembershipRole;
  /**
   * The role as a title for this kind of organisation: "Agency Principal" at
   * an agency, "Principal" at a law firm. Optional: older API builds do not send it.
   */
  role_label?: string | null;
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
  roles: {
    code: AccountRole;
    label: string;
    /** One line on what the role is, from the API. */
    description: string | null;
    requiresVerification: boolean;
  }[];
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

// Role names are titles (design/guidelines/content-voice.md, "Role names")
// and come from the API wherever it supplies them.

/**
 * Platform administrator roles are a fixed enum of the identity API with no
 * labels in the reference data, so their titles are the one role list
 * written in the app.
 */
export const platformRoleLabels: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super Administrator",
  PLATFORM_ADMIN: "Platform Administrator",
  MARKET_ADMIN: "Market Administrator",
  FINANCE_ADMIN: "Finance Administrator",
  CONTENT_ADMIN: "Content Administrator",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
};

/** "LAW_FIRM" becomes "Law Firm": the last resort for a code that has no label. */
export const titleFromCode = (code: string) =>
  code
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

/** Used only when the API sends a membership role without its `role_label`. */
const membershipRoleFallback: Record<string, string> = {
  OWNER: "Principal",
  MANAGER: "Manager",
  AGENT: "Agent",
  STAFF: "Staff",
};

/** The title of a membership role: the API's `role_label`, else a generic title. */
export const membershipRoleLabel = (membership: { role: string; role_label?: string | null }) =>
  membership.role_label || membershipRoleFallback[membership.role] || titleFromCode(membership.role);

/**
 * The label of an organisation kind. `labels` is code -> label of the API's
 * `organisation_kinds` reference set, loaded by the page.
 */
export const organisationKindLabel = (code: string, labels: Record<string, string>) =>
  labels[code] ?? titleFromCode(code);

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

/** Individual owners who advertise their own property and have no organisation. */
const OWNER_ROLES = ["PRIVATE_SELLER", "LANDLORD"];

/**
 * Who is shown the request inbox: organisation members, and individual owners
 * (Property Seller (Vendor), Landlord). The API decides which requests each of
 * them may read.
 */
export const canUseInbox = (user: User | null) =>
  isProfessional(user) ||
  Boolean(user?.account_roles?.some(({ role }) => OWNER_ROLES.includes(role)));

export const getMe = () => apiFetch<SessionResponse>("/v1/me");

/** Administrator sign-in. Customer accounts get the same generic 401 as a wrong password. */
export const adminLogin = (email: string, password: string) =>
  apiFetch<SessionResponse>("/v1/admin/auth/login", { method: "POST", body: { email, password } });

/**
 * One question of the site's own sign-up captcha ("What is 7 + 5?"). It can
 * be answered once, until `expires_at` (ten minutes after it was issued).
 */
export type CaptchaChallenge = {
  captcha_id: string;
  question: string;
  /** RFC 3339. */
  expires_at: string;
};

/** A new question each time: asked from the browser only and never cached. */
export const getCaptcha = () => apiFetch<CaptchaChallenge>("/v1/auth/captcha", { cache: "no-store" });

export const register = (input: {
  name: string;
  email: string;
  password: string;
  roles: AccountRole[];
  accepted: boolean;
  /** The question being answered and the answer, as digits. A wrong or expired one comes back as `fields.captcha`. */
  captcha: { captcha_id: string; answer: string };
}) =>
  apiFetch<{ status: string }>("/v1/auth/register", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      roles: input.roles,
      captcha: input.captcha,
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
