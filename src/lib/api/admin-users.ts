import type { AccountDeleted } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";
import type { SubscriptionPeriod, SubscriptionStatus } from "@/lib/api/subscriptions";

/*
 * Accounts and the administrators' audit trail (API 0.25.0). Admin sessions
 * only: SUPER_ADMIN, PLATFORM_ADMIN and SUPPORT read accounts; SUPER_ADMIN and
 * PLATFORM_ADMIN suspend, reactivate and delete them and read the audit trail.
 */

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  email_verified: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  account_roles: string[];
  platform_roles: string[];
  /** Countries of the memberships that were not removed. */
  market_codes: string[];
};

export type Paged<T> = { items: T[]; page: number; page_size: number; total: number };

export type AuditAction =
  | "USER_SUSPENDED"
  | "USER_REACTIVATED"
  | "USER_DELETED"
  | "USER_SELF_DELETED"
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_RETIRED"
  | "SUBSCRIPTION_APPROVED"
  | "SUBSCRIPTION_REJECTED"
  | "SUBSCRIPTION_CANCELLED"
  // Online payment (API 0.42.0); the target is the subscription.
  | "PAYMENT_CHECKOUT_CREATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_FAILED"
  | "PAYMENT_FLAGGED"
  | "PAYMENT_REFUND_REQUESTED"
  | "PAYMENT_REFUNDED"
  | "REFERENCE_ITEM_CREATED"
  | "REFERENCE_ITEM_UPDATED"
  | "REFERENCE_ITEM_DEACTIVATED"
  | "REFERENCE_ITEM_REACTIVATED"
  // Administrator two-step sign-in (API 0.40.0); the target is the administrator's account.
  | "ADMIN_MFA_ENROLLED"
  | "ADMIN_MFA_RECOVERY_CODE_USED"
  | "ADMIN_MFA_RECOVERY_CODES_REGENERATED"
  | "ADMIN_MFA_REMOVED"
  | "ADMIN_MFA_RESET"
  | "ADMIN_MFA_CHALLENGE_LOCKED";

export type AuditTargetType = "USER" | "SUBSCRIPTION_PLAN" | "SUBSCRIPTION" | "REFERENCE_ITEM";

export type AdminAuditEvent = {
  id: string;
  actor_user_id: string | null;
  actor_name: string;
  action: AuditAction;
  target_type: AuditTargetType;
  /** A UUID, or `<set>/<code>` for a reference item. */
  target_id: string;
  target_label: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

export type AdminUserSubscription = {
  id: string;
  invoice_number: string;
  plan_name: string;
  period: SubscriptionPeriod;
  status: SubscriptionStatus;
  subscriber_kind: "INDIVIDUAL" | "ORGANISATION";
  subscriber_name: string;
  amount: string;
  currency_code: string;
  starts_at: string | null;
  ends_at: string | null;
  organisation_id: string | null;
  organisation_name?: string;
};

export type AdminUserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    status: AccountStatus;
    email_verified: boolean;
    created_at: string;
    last_sign_in_at: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    deleted_at: string | null;
    platform_roles: { role: string; market_code: string | null }[];
    account_roles: { role: string; status: string; onboarding_status: string | null }[];
    memberships: {
      organisation_id: string;
      organisation_name: string;
      organisation_kind: string;
      market_code: string;
      role: "OWNER" | "MANAGER" | "AGENT" | "STAFF";
      role_label: string;
      status: string;
    }[];
    /** By listing status. */
    listing_counts: Record<string, number>;
    listings_total: number;
  };
  subscriptions: AdminUserSubscription[];
  /** The newest 20 audit records about the account. */
  audit: AdminAuditEvent[];
};

export type UserQuery = { q?: string; role?: string; status?: AccountStatus; market?: string; page?: number };

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const USERS_PAGE_SIZE = 20;

export const adminListUsers = ({ page = 1, ...filters }: UserQuery) =>
  apiFetch<Paged<AdminUserSummary>>(`/v1/admin/users${query({ ...filters, page, page_size: USERS_PAGE_SIZE })}`, {
    cache: "no-store",
  });

export const adminGetUser = (id: string) => apiFetch<AdminUserDetail>(`/v1/admin/users/${id}`, { cache: "no-store" });

/** 403 `SELF_ACTION_FORBIDDEN` / `ADMIN_ACCOUNT_PROTECTED`, 409 `USER_STATE_CONFLICT`. */
export const adminSuspendUser = (id: string, reason: string) =>
  apiFetch<AdminUserDetail>(`/v1/admin/users/${id}/suspend`, { method: "POST", body: { reason } });

export const adminReactivateUser = (id: string, note: string) =>
  apiFetch<AdminUserDetail>(`/v1/admin/users/${id}/reactivate`, { method: "POST", body: note ? { note } : {} });

/** 409 `SOLE_OWNER` (the message names the organisations) or `USER_STATE_CONFLICT`. */
export const adminDeleteUser = (id: string, reason: string) =>
  apiFetch<AccountDeleted>(`/v1/admin/users/${id}/delete`, { method: "POST", body: { reason } });

export type AuditQuery = {
  target_type?: AuditTargetType;
  target_id?: string;
  action?: string;
  actor_user_id?: string;
  page?: number;
};

export const AUDIT_PAGE_SIZE = 25;

export const adminListAudit = ({ page = 1, ...filters }: AuditQuery) =>
  apiFetch<Paged<AdminAuditEvent>>(`/v1/admin/audit${query({ ...filters, page, page_size: AUDIT_PAGE_SIZE })}`, {
    cache: "no-store",
  });

/** Plain words for each audit action. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_SUSPENDED: "Account suspended",
  USER_REACTIVATED: "Account reactivated",
  USER_DELETED: "Account deleted by an administrator",
  USER_SELF_DELETED: "Account deleted by its owner",
  PLAN_CREATED: "Plan created",
  PLAN_UPDATED: "Plan changed",
  PLAN_RETIRED: "Plan retired",
  SUBSCRIPTION_APPROVED: "Payment recorded and subscription activated",
  SUBSCRIPTION_REJECTED: "Subscription request rejected",
  SUBSCRIPTION_CANCELLED: "Subscription cancelled",
  PAYMENT_CHECKOUT_CREATED: "Online payment started",
  PAYMENT_CONFIRMED: "Online payment confirmed",
  PAYMENT_FAILED: "Online payment failed",
  PAYMENT_FLAGGED: "Online payment flagged for review",
  PAYMENT_REFUND_REQUESTED: "Refund requested",
  PAYMENT_REFUNDED: "Refund paid",
  REFERENCE_ITEM_CREATED: "Reference row added",
  REFERENCE_ITEM_UPDATED: "Reference row changed",
  REFERENCE_ITEM_DEACTIVATED: "Reference row deactivated",
  REFERENCE_ITEM_REACTIVATED: "Reference row reactivated",
  ADMIN_MFA_ENROLLED: "Two-step sign-in set up",
  ADMIN_MFA_RECOVERY_CODE_USED: "Signed in with a recovery code",
  ADMIN_MFA_RECOVERY_CODES_REGENERATED: "New recovery codes made",
  ADMIN_MFA_REMOVED: "Two-step sign-in turned off",
  ADMIN_MFA_RESET: "Two-step sign-in reset by a Super Administrator",
  ADMIN_MFA_CHALLENGE_LOCKED: "Sign-in stopped after too many wrong codes",
};

export const AUDIT_TARGET_LABELS: Record<AuditTargetType, string> = {
  USER: "Accounts",
  SUBSCRIPTION_PLAN: "Plans",
  SUBSCRIPTION: "Subscriptions",
  REFERENCE_ITEM: "Reference data",
};

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "warning" },
  DELETED: { label: "Deleted", tone: "neutral" },
};
