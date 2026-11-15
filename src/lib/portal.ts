/**
 * Where signed-in people go: the page after sign-in, and the page behind each
 * dashboard counter and next action. Pure functions with no imports, so
 * `npm test` can run them directly.
 */

/** The places the API's dashboard points at (`DashboardTarget` in the OpenAPI). */
export type DashboardTarget =
  | "search"
  | "my_requests"
  | "my_appointments"
  | "onboarding"
  | "requests"
  | "business_enquiries"
  | "appointments"
  | "listings"
  | "team"
  | "admin_overview";

/** Each target and the page of this site that shows it. */
export const TARGET_PATHS: Record<DashboardTarget, string> = {
  search: "/listings",
  my_requests: "/account/requests",
  my_appointments: "/account/appointments",
  onboarding: "/onboarding",
  requests: "/agent/requests",
  business_enquiries: "/agent/requests#business-enquiries",
  appointments: "/agent/appointments",
  listings: "/agent/listings",
  team: "/agent/team",
  admin_overview: "/admin",
};

/**
 * The page for a target, or null when this site has no page for it (an
 * unknown or missing target). A null target is shown as plain text, never as
 * a link that leads nowhere.
 */
export function targetHref(target: string | null | undefined): string | null {
  if (!target) return null;
  return Object.prototype.hasOwnProperty.call(TARGET_PATHS, target) ? TARGET_PATHS[target as DashboardTarget] : null;
}

/** The lead stages, in pipeline order (`LeadStage` in the OpenAPI). */
export const LEAD_STAGES = [
  "NEW_ENQUIRY",
  "ASSIGNED",
  "CONTACTED",
  "VIEWING_REQUESTED",
  "VIEWING_SCHEDULED",
  "FOLLOW_UP_REQUIRED",
  "CONVERTED",
  "CLOSED",
] as const;

/** What a customer is told about a request (`CustomerRequestStatus`). */
export const CUSTOMER_REQUEST_STATUSES = ["RECEIVED", "IN_PROGRESS", "RESPONDED", "VIEWING_SCHEDULED", "CLOSED"] as const;

const isLeadStage = (value: string) => (LEAD_STAGES as readonly string[]).includes(value);
const isCustomerStatus = (value: string) => (CUSTOMER_REQUEST_STATUSES as readonly string[]).includes(value);

/**
 * The page behind one dashboard counter. A counter for one stage or one
 * status opens the list already filtered to it; anything else uses its target.
 */
export function counterHref(counter: { key: string; target: string | null | undefined }): string | null {
  const base = targetHref(counter.target);
  if (!base) return null;
  const stage = /^requests\.stage\.([A-Z_]+)$/.exec(counter.key)?.[1];
  if (stage && isLeadStage(stage) && counter.target === "requests") return `${base}?stage=${stage}`;
  if (counter.key === "requests.new" && counter.target === "requests") return `${base}?stage=NEW_ENQUIRY`;
  const status = /^my_requests\.status\.([A-Z_]+)$/.exec(counter.key)?.[1];
  if (status && isCustomerStatus(status) && counter.target === "my_requests") return `${base}?status=${status}`;
  return base;
}

/** Pages a person should never be sent back to after signing in: they would only sign in again. */
const NOT_AFTER_SIGN_IN = ["/sign-in", "/register", "/admin/sign-in", "/verify-email", "/forgot-password", "/reset-password"];

/**
 * `next` when it is a path on this site, else null. Only a single leading
 * slash is accepted: "//host", "/\host", a scheme or any control character
 * could send people to another site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 2000) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Backslashes and control characters are read as slashes, or dropped, by some browsers.
  const unsafeChar = (char: string) => char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127;
  if (Array.from(value).some(unsafeChar)) return null;
  let url: URL;
  try {
    url = new URL(value, "https://site.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://site.invalid") return null;
  if (NOT_AFTER_SIGN_IN.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Where to go after a successful sign-in: `next` when it is safe, else the
 * person's own home. An administrator session only goes to an /admin page.
 */
export function landingPath(scope: "customer" | "admin", next: string | null | undefined): string {
  const safe = safeNextPath(next);
  if (scope === "admin") {
    return safe && (safe === "/admin" || /^\/admin[/?#]/.test(safe)) ? safe : "/admin";
  }
  return safe ?? "/dashboard";
}
