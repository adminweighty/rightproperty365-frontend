import { apiFetch } from "@/lib/api/http";

/*
 * Subscriptions (API 0.25.0). There is no online payment: asking for a plan
 * creates a PENDING_PAYMENT subscription with an invoice number; it is paid
 * outside the platform, and a finance administrator records the payment,
 * which makes it ACTIVE for 3 months (QUARTERLY) or a year (YEARLY).
 */

export type SubscriptionPeriod = "QUARTERLY" | "YEARLY";
export type SubscriptionStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "REJECTED" | "CANCELLED";
export type SubscriberKind = "INDIVIDUAL" | "ORGANISATION";
export type PlanStatus = "ACTIVE" | "RETIRED";
export type FeatureCode = "MAX_ACTIVE_LISTINGS" | "MAX_FEATURED_LISTINGS" | "MAX_TEAM_MEMBERS";

export type PlanFeature = { code: FeatureCode; label?: string; /** null is unlimited. */ limit: number | null };
/** `amount` is a decimal string ("30.00"). */
export type PlanPrice = { currency_code: string; period: SubscriptionPeriod; amount: string };

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  subscriber_kind: SubscriberKind;
  eligible_roles: string[];
  features: PlanFeature[];
  benefits: string[];
  prices: PlanPrice[];
  status: PlanStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  retired_at: string | null;
};

export type SubscriptionPlanInput = {
  name?: string;
  description?: string;
  subscriber_kind?: SubscriberKind;
  eligible_roles?: string[];
  features?: { code: string; limit: number | null }[];
  benefits?: string[];
  prices?: PlanPrice[];
  sort_order?: number;
};

export type SubscriptionPayment = {
  reference: string;
  amount: string;
  received_on: string;
  note?: string;
  recorded_by_name: string;
};

export type Subscription = {
  id: string;
  invoice_number: string;
  plan_id: string;
  plan_name: string;
  period: SubscriptionPeriod;
  /** As of the answer: an ACTIVE one past its end is EXPIRED. ACTIVE with a future `starts_at` is a paid renewal. */
  status: SubscriptionStatus;
  subscriber: { kind: SubscriberKind; id: string; name: string };
  organisation_id: string | null;
  requested_by: { id: string | null; name: string };
  market_code: string;
  currency_code: string;
  amount: string;
  renewal_of: string | null;
  starts_at: string | null;
  ends_at: string | null;
  activated_at: string | null;
  renewal_opens_at: string | null;
  payment: SubscriptionPayment | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancelled_by: "SUBSCRIBER" | "ADMIN" | "SYSTEM" | null;
  refund_due: boolean;
  refund_note: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  /** PENDING_PAYMENT only. */
  payment_instructions: string | null;
};

export type SubscriptionEvent = {
  id: string;
  action: "REQUESTED" | "RENEWAL_REQUESTED" | "CANCELLED" | "PAYMENT_RECORDED" | "ACTIVATED" | "REJECTED" | "EXPIRED";
  actor_type: "SUBSCRIBER" | "ADMIN" | "SYSTEM";
  actor_name: string;
  note: string;
  at: string;
};

export type SubscriptionUsage = {
  /** Published, unexpired listings of the subscriber now. */
  active_listings: number;
  /** null: unlimited, or no plan. */
  max_active_listings: number | null;
  /** Always false in 0.25.0: the limit is shown, not enforced. */
  limit_enforced: boolean;
};

export type SubscriptionDetail = { subscription: Subscription; events: SubscriptionEvent[]; usage: SubscriptionUsage };

export type MySubscriber = {
  subscriber: { kind: SubscriberKind; id: string; name: string; market_code?: string };
  current: Subscription | null;
  upcoming: Subscription | null;
  pending: Subscription | null;
  can_renew: boolean;
  usage: SubscriptionUsage;
  history: Subscription[];
};

export type AvailablePlans = { currency_code: string | null; plans: SubscriptionPlan[]; payment_note: string };

type Envelope = { subscription: Subscription };

// The professional's own subscriptions.

export const listMyPlans = (market?: string) =>
  apiFetch<AvailablePlans>(`/v1/me/subscription-plans${market ? `?market=${encodeURIComponent(market)}` : ""}`, {
    cache: "no-store",
  });

export const listMySubscriptions = () => apiFetch<{ subscribers: MySubscriber[] }>("/v1/me/subscriptions", { cache: "no-store" });

export const getMySubscription = (id: string) =>
  apiFetch<{ subscription: Subscription; events: SubscriptionEvent[] }>(`/v1/me/subscriptions/${id}`, { cache: "no-store" });

/**
 * Asks for a plan: a PENDING_PAYMENT subscription with an invoice. 403
 * `PLAN_NOT_ELIGIBLE` / `NOT_ORGANISATION_OWNER`, 409
 * `SUBSCRIPTION_PENDING_EXISTS` / `SUBSCRIPTION_ACTIVE_EXISTS`, 422
 * `PLAN_NOT_AVAILABLE` / `PRICE_NOT_AVAILABLE`.
 */
export const requestSubscription = (input: {
  plan_id: string;
  period: SubscriptionPeriod;
  market_code?: string;
  organisation_id?: string;
}) => apiFetch<Envelope>("/v1/me/subscriptions", { method: "POST", body: input });

/** Withdraws a request while it waits for payment. */
export const cancelMySubscription = (id: string) =>
  apiFetch<Envelope>(`/v1/me/subscriptions/${id}/cancel`, { method: "POST" });

/** From 30 days before the end: the next period's invoice. 409 `RENEWAL_NOT_OPEN`. */
export const renewMySubscription = (id: string, period?: SubscriptionPeriod) =>
  apiFetch<Envelope>(`/v1/me/subscriptions/${id}/renew`, { method: "POST", body: period ? { period } : {} });

// Administrators.

export type AdminPlans = { plans: SubscriptionPlan[]; feature_codes: FeatureCode[]; professional_roles: string[] };

export const adminListPlans = (includeRetired = true) =>
  apiFetch<AdminPlans>(`/v1/admin/subscription-plans${includeRetired ? "" : "?include_retired=false"}`, { cache: "no-store" });

export const adminGetPlan = (id: string) =>
  apiFetch<{ plan: SubscriptionPlan }>(`/v1/admin/subscription-plans/${id}`, { cache: "no-store" });

export const adminCreatePlan = (input: SubscriptionPlanInput) =>
  apiFetch<{ plan: SubscriptionPlan }>("/v1/admin/subscription-plans", { method: "POST", body: input });

/** Lists replace the whole list. 409 `PLAN_RETIRED`. */
export const adminUpdatePlan = (id: string, input: SubscriptionPlanInput) =>
  apiFetch<{ plan: SubscriptionPlan }>(`/v1/admin/subscription-plans/${id}`, { method: "PATCH", body: input });

export const adminRetirePlan = (id: string) =>
  apiFetch<{ plan: SubscriptionPlan }>(`/v1/admin/subscription-plans/${id}/retire`, { method: "POST" });

export type AdminSubscriptionQuery = {
  status?: SubscriptionStatus;
  plan_id?: string;
  market?: string;
  period?: SubscriptionPeriod;
  subscriber_kind?: SubscriberKind;
  q?: string;
  page?: number;
  page_size?: number;
};

export const SUBSCRIPTIONS_PAGE_SIZE = 20;

export const adminListSubscriptions = ({ page = 1, page_size = SUBSCRIPTIONS_PAGE_SIZE, ...filters }: AdminSubscriptionQuery) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) search.set(key, String(value));
  search.set("page", String(page));
  search.set("page_size", String(page_size));
  return apiFetch<{ items: Subscription[]; page: number; page_size: number; total: number }>(
    `/v1/admin/subscriptions?${search.toString()}`,
    { cache: "no-store" },
  );
};

export const adminGetSubscription = (id: string) =>
  apiFetch<SubscriptionDetail>(`/v1/admin/subscriptions/${id}`, { cache: "no-store" });

/** Records the payment and activates. 422 `PAYMENT_AMOUNT_TOO_LOW`; fields payment_reference, amount, received_on, note. */
export const adminApproveSubscription = (
  id: string,
  input: { payment_reference: string; amount: string; received_on: string; note?: string },
) => apiFetch<SubscriptionDetail>(`/v1/admin/subscriptions/${id}/approve`, { method: "POST", body: input });

export type SubscriptionDecision = { reason: string; refund_due?: boolean; refund_note?: string };

export const adminRejectSubscription = (id: string, input: SubscriptionDecision) =>
  apiFetch<SubscriptionDetail>(`/v1/admin/subscriptions/${id}/reject`, { method: "POST", body: input });

export const adminCancelSubscription = (id: string, input: SubscriptionDecision) =>
  apiFetch<SubscriptionDetail>(`/v1/admin/subscriptions/${id}/cancel`, { method: "POST", body: input });
