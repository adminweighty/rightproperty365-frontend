import { apiFetch } from "@/lib/api/http";

/*
 * Subscriptions (API 0.25.0). Asking for a plan creates a PENDING_PAYMENT
 * subscription with an invoice number; it is paid by bank transfer and a
 * finance administrator records the payment, which makes it ACTIVE for 3
 * months (QUARTERLY) or a year (YEARLY).
 *
 * Online payment (API 0.42.0) is offered only when the server has a payment
 * gateway (`online_payment_available`, `online_payment.enabled`). It is off
 * by default (`PAYMENT_GATEWAY=none`): then nothing below is offered and every
 * flow is as before. Only the provider's signed webhook activates a
 * subscription; the web app never does.
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
  /** The listing package the plan grants when it activates (API 0.42.0); null when none. */
  package_code?: string | null;
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
  /** `^[A-Z][A-Z0-9_]{1,31}$`; "" clears it (API 0.42.0). */
  package_code?: string;
};

export type SubscriptionPayment = {
  reference: string;
  amount: string;
  received_on: string;
  note?: string;
  recorded_by_name: string;
  /** API 0.42.0: ADMIN (recorded by finance) or GATEWAY (confirmed by the payment provider). */
  recorded_by?: "ADMIN" | "GATEWAY";
  /** The gateway's name when GATEWAY, else null. */
  provider?: string | null;
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
  /** API 0.42.0: true only when PENDING_PAYMENT and the server has a gateway. Show "Pay online" exactly then. */
  online_payment_available?: boolean;
};

export type SubscriptionEvent = {
  id: string;
  action: "REQUESTED" | "RENEWAL_REQUESTED" | "CANCELLED" | "PAYMENT_RECORDED" | "ACTIVATED" | "REJECTED" | "EXPIRED" | "REFUNDED";
  actor_type: "SUBSCRIBER" | "ADMIN" | "SYSTEM" | "GATEWAY";
  actor_name: string;
  note: string;
  at: string;
};

export type SubscriptionUsage = {
  /** Published, unexpired listings of the subscriber now. */
  active_listings: number;
  /** null: unlimited, or no plan. */
  max_active_listings: number | null;
  /** True when the plan has a `package_code` (API 0.42.0): the package's listing limit is enforced. */
  limit_enforced: boolean;
  /** The listing package that enforces the limit (API 0.42.0). */
  package_code?: string | null;
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

export type AvailablePlans = {
  currency_code: string | null;
  plans: SubscriptionPlan[];
  payment_note: string;
  /** API 0.42.0: `enabled` false and `provider` null with PAYMENT_GATEWAY=none. */
  online_payment?: { enabled: boolean; provider: string | null };
};

// Online payment (API 0.42.0).

export type PaymentStatus = "OPEN" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "REVIEW" | "PARTIALLY_REFUNDED" | "REFUNDED";

/** One checkout attempt of an invoice. Money is a decimal string with two decimals. */
export type PaymentView = {
  id: string;
  subscription_id: string;
  invoice_number: string;
  provider: string;
  status: PaymentStatus;
  amount: string;
  currency_code: string;
  refunded_amount: string;
  /** Null unless OPEN and not expired. */
  hosted_url: string | null;
  expires_at: string | null;
  created_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
};

export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export type RefundView = {
  id: string;
  amount: string;
  currency_code: string;
  reason: string;
  status: RefundStatus;
  provider_refund_ref: string | null;
  requested_by: { id: string | null; name: string };
  created_at: string;
  completed_at: string | null;
  failure_reason: string | null;
};

export type AdminPaymentView = PaymentView & {
  subscriber: { kind: SubscriberKind; id: string; name: string };
  market_code: string;
  provider_ref: string | null;
  payment_ref: string | null;
  paid_amount: string | null;
  paid_currency_code: string | null;
  review_reason: string | null;
  failure_reason: string | null;
  /** `id` is null after the person's account was deleted. */
  opened_by: { id: string | null; name: string } | null;
  refunds: RefundView[];
};

export type Checkout = { hosted_url: string; expires_at: string; reused: boolean; payment: PaymentView };

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

/**
 * Starts (201) or reuses (200, `reused: true`) the online checkout of a
 * PENDING_PAYMENT invoice. Send the browser to `hosted_url` as a full page.
 * 404 `ONLINE_PAYMENT_NOT_OFFERED` / `SUBSCRIPTION_NOT_FOUND`, 409
 * `SUBSCRIPTION_STATE_CONFLICT` / `CHECKOUT_IN_PROGRESS` (retry after 2 s),
 * 502 `PAYMENT_PROVIDER_ERROR` (nothing was charged).
 */
export const startMyCheckout = (id: string) =>
  apiFetch<Checkout>(`/v1/me/subscriptions/${id}/checkout`, { method: "POST", body: {} });

/** Every checkout attempt of the subscription, newest first. Reading it never activates anything. */
export const listMySubscriptionPayments = (id: string) =>
  apiFetch<{ payments: PaymentView[] }>(`/v1/me/subscriptions/${id}/payments`, { cache: "no-store" });

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

// Online payments (API 0.42.0), administrators.

/** SUBSCRIPTION_READ_ROLES. */
export const adminListSubscriptionPayments = (id: string) =>
  apiFetch<{ payments: AdminPaymentView[] }>(`/v1/admin/subscriptions/${id}/payments`, { cache: "no-store" });

export type RefundResult = { refund: RefundView; payment: AdminPaymentView; subscription: Subscription };

/**
 * SUPER_ADMIN, FINANCE_ADMIN. `amount` two decimals, at most what is left;
 * `reason` 3-1000 characters. A full refund cancels the subscription at once.
 * 400 `VALIDATION_FAILED`, 404 `ONLINE_PAYMENT_NOT_OFFERED`, 409
 * `NO_GATEWAY_PAYMENT`, 422 `REFUND_EXCEEDS_PAYMENT`, 502
 * `PAYMENT_PROVIDER_ERROR` (recorded FAILED; the same key may be sent again).
 */
export const adminRefundSubscription = (id: string, input: { amount: string; reason: string }, idempotencyKey?: string) =>
  apiFetch<RefundResult>(`/v1/admin/subscriptions/${id}/refund`, {
    method: "POST",
    body: input,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 100) } : undefined,
  });

export type AdminPaymentQuery = { status?: PaymentStatus; provider?: string; q?: string; page?: number; page_size?: number };

export const PAYMENTS_PAGE_SIZE = 20;

/** SUBSCRIPTION_READ_ROLES. `q` matches the invoice number, subscriber name or a provider reference. */
export const adminListPayments = ({ page = 1, page_size = PAYMENTS_PAGE_SIZE, ...filters }: AdminPaymentQuery) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) search.set(key, String(value));
  search.set("page", String(page));
  search.set("page_size", String(page_size));
  return apiFetch<{ items: AdminPaymentView[]; page: number; page_size: number; total: number }>(
    `/v1/admin/payments?${search.toString()}`,
    { cache: "no-store" },
  );
};
