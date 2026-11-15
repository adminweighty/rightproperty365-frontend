import type { AgentPropertyRequest } from "@/lib/api/agent";
import type { OnboardingStatus } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/http";
import type { CustomerPropertyRequest } from "@/lib/api/my-requests";

/**
 * GET /v1/me/dashboard (new in API 0.20.0): one summary that says which home
 * page applies and what goes on it. The API decides every count and scopes it
 * as the list it summarises, so the page never works out role rules itself.
 */

export type DashboardKind = "SEEKER" | "PROFESSIONAL_PENDING" | "PROFESSIONAL" | "DIRECT_OWNER" | "ADMIN";

export type DashboardCounterGroup =
  | "my_activity"
  | "requests"
  | "requests_by_stage"
  | "business_enquiries"
  | "appointments"
  | "listings"
  | "leases";

export type DashboardCounter = {
  /** Stable: `requests.new`, `requests.stage.CONTACTED`, `listings.status.PUBLISHED`… */
  key: string;
  label: string;
  value: number;
  group: DashboardCounterGroup;
  /** Mapped to a page by `targetHref` / `counterHref` (src/lib/portal.ts). */
  target: string | null;
};

export type DashboardAction = {
  code: string;
  text: string;
  target: string;
  /** How many wait, or null when the action is not about a number. */
  count: number | null;
  /** The account role an onboarding action is about. */
  role: string | null;
};

export type DashboardOrganisation = {
  id: string;
  name: string;
  kind: string;
  market_code: string;
  role: "OWNER" | "MANAGER" | "AGENT" | "STAFF";
  role_label: string;
  can_see_members: boolean;
  can_assign_work: boolean;
  can_manage_listings: boolean;
  /** New in API 0.23.0: may invite people, decide join requests and change, suspend or remove members. Optional for older API builds. */
  can_manage_team?: boolean;
  /** New in API 0.24.0: may draft leases and send documents for signature for the organisation. Optional for older API builds. */
  can_create_leases?: boolean;
};

export type DashboardOnboarding = {
  role: string;
  role_label: string;
  status: OnboardingStatus;
  status_label: string;
  can_submit: boolean;
  can_edit: boolean;
  missing_fields: number;
  missing_documents: number;
  decision_reason: string | null;
  submitted_at: string | null;
};

export type DashboardAppointment = {
  id: string;
  reference: string;
  type: string;
  status: string;
  status_label: string;
  start_utc: string;
  timezone: string;
  listing: { slug: string; title: string; reference: string } | null;
  /** CUSTOMER: the caller asked for it. PROFESSIONAL: the caller receives it. */
  side: "CUSTOMER" | "PROFESSIONAL";
};

export type Dashboard = {
  kind: DashboardKind;
  name: string;
  roles: { role: string; label: string; status: string }[];
  organisations: DashboardOrganisation[];
  direct_owner: boolean;
  capabilities: {
    receives_requests: boolean;
    receives_business_enquiries: boolean;
    manages_appointments: boolean;
    manages_listings: boolean;
    sees_team: boolean;
    /** New in API 0.24.0: /v1/me/leases and /v1/me/agreements are open to the caller. Optional for older API builds. */
    creates_leases?: boolean;
  };
  onboarding: DashboardOnboarding[];
  counters: DashboardCounter[];
  needs_attention: number;
  next_actions: DashboardAction[];
  recent: {
    received_requests: AgentPropertyRequest[];
    my_requests: CustomerPropertyRequest[];
    appointments: DashboardAppointment[];
  };
};

export const getDashboard = () => apiFetch<Dashboard>("/v1/me/dashboard", { cache: "no-store" });
