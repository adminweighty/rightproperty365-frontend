import { apiFetch } from "@/lib/api/http";

/*
 * Listing packages and quotas (API 0.37.0, FR-008). A listing account (an
 * organisation, or a direct owner without one) holds at most one package per
 * market; it limits how many listings are live at once. The API enforces the
 * limit when a reviewer approves a new listing (409 LISTING_QUOTA_REACHED).
 * Submitting and relisting are never blocked: the listing views carry
 * `quota_warning` instead.
 */

export type PackageMarket = { code: string; name: string; currency: string; minor_unit: number };
export type BillingTermCode = "MONTHLY" | "QUARTERLY" | "ANNUAL";
export type BillingTerm = { code: BillingTermCode | string; label: string; months: number };

/** `amount` is a decimal string with exactly the currency's minor-unit decimals. `sample`: written by the dev seed, not an approved price. */
export type PackagePrice = {
  billing_term: BillingTermCode | string;
  billing_term_label: string;
  amount: string;
  currency: string;
  minor_unit: number;
  sample: boolean;
};

export type PackageRef = { id: string; code: string; name: string; listing_limit: number; active: boolean };
export type AccountKind = "ORGANISATION" | "DIRECT_OWNER";
export type AccountRef = { kind: AccountKind; id: string; name: string };
export type PersonRef = { user_id: string | null; name: string };

export type MarketUsage = {
  market: PackageMarket;
  package: PackageRef | null;
  basis: "ASSIGNED" | "DEFAULT" | "NONE";
  assignment: { id: string; starts_on: string; ends_on: string | null; source: string } | null;
  scheduled: { id: string; package: PackageRef; starts_on: string; ends_on: string | null; source: string } | null;
  limit: number | null;
  used: number;
  remaining: number | null;
  at_limit: boolean;
  over_limit: boolean;
  over_by: number;
  grace_until: string | null;
  message: string;
};

export type AccountUsage = { account: AccountRef; markets: MarketUsage[] };

// ---- Public -------------------------------------------------------------------------------------

export type PublicPackage = {
  code: string;
  name: string;
  description: string;
  listing_limit: number;
  is_default: boolean;
  sort: number;
  prices: PackagePrice[];
};

export type PublicPricing = { market: PackageMarket; billing_terms: BillingTerm[]; items: PublicPackage[] };

// ---- Usage (the advertiser) -------------------------------------------------------------------

/** An organisation the caller belongs to, or the caller's own user id as a direct owner. 404 PACKAGE_ACCOUNT_NOT_FOUND otherwise. */
export const getAccountPackage = (accountId: string) =>
  apiFetch<AccountUsage>(`/v1/agent/organisations/${encodeURIComponent(accountId)}/package`, { cache: "no-store" });

/** The caller's own direct-owner account. 403 FORBIDDEN when they are not an approved direct owner. */
export const getMyPackage = () => apiFetch<AccountUsage>("/v1/me/package", { cache: "no-store" });

// ---- Admin packages -----------------------------------------------------------------------------

export type ListingPackage = {
  id: string;
  code: string;
  name: string;
  market: PackageMarket;
  listing_limit: number;
  description: string;
  active: boolean;
  is_default: boolean;
  sort: number;
  prices: PackagePrice[];
  current_assignments: number;
  created_at: string;
  updated_at: string;
  can: { edit: boolean; delete: boolean };
};

export type PackageInput = {
  code?: string;
  market_code?: string;
  name?: string;
  listing_limit?: number;
  description?: string;
  active?: boolean;
  is_default?: boolean;
  sort?: number;
  prices?: { billing_term: string; amount: string }[];
};

/** `markets`: the codes the caller may manage; null for every market. */
export type AdminPackages = { items: ListingPackage[]; markets: string[] | null };

export function adminListPackages(filters: { market_code?: string; include_inactive?: boolean } = {}) {
  const search = new URLSearchParams();
  if (filters.market_code) search.set("market_code", filters.market_code);
  if (filters.include_inactive === false) search.set("include_inactive", "false");
  const text = search.toString();
  return apiFetch<AdminPackages>(`/v1/admin/packages${text ? `?${text}` : ""}`, { cache: "no-store" });
}

export const adminGetPackage = (id: string) =>
  apiFetch<{ package: ListingPackage }>(`/v1/admin/packages/${encodeURIComponent(id)}`, { cache: "no-store" });

/** 409 PACKAGE_CODE_TAKEN; 403 PACKAGE_MARKET_FORBIDDEN; 400 per field (`prices[0].amount`). */
export const adminCreatePackage = (input: PackageInput) =>
  apiFetch<{ package: ListingPackage }>("/v1/admin/packages", { method: "POST", body: input });

/** `code` and `market_code` cannot change. `prices` replaces the set. 409 PACKAGE_IS_DEFAULT when deactivating the default. */
export const adminUpdatePackage = (id: string, input: Omit<PackageInput, "code" | "market_code">) =>
  apiFetch<{ package: ListingPackage }>(`/v1/admin/packages/${encodeURIComponent(id)}`, { method: "PATCH", body: input });

/** 204; 409 PACKAGE_IN_USE or PACKAGE_IS_DEFAULT. */
export const adminDeletePackage = (id: string) =>
  apiFetch<null>(`/v1/admin/packages/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---- Admin assignment ---------------------------------------------------------------------------

export type PackageAssignment = {
  id: string;
  account: AccountRef;
  market_code: string;
  package: PackageRef;
  starts_on: string;
  ends_on: string | null;
  source: "ADMIN" | "INVOICE" | string;
  note: string;
  status: "SCHEDULED" | "CURRENT" | "ENDED" | "CANCELLED";
  assigned_by: PersonRef;
  created_at: string;
  cancelled_at: string | null;
};

export type AdminAccountPackage = { account: AccountRef; markets: MarketUsage[]; assignments: PackageAssignment[] };

const accountPath = (kind: AccountKind, id: string) =>
  `/v1/admin/${kind === "ORGANISATION" ? "organisations" : "users"}/${encodeURIComponent(id)}/package`;

export const adminGetAccountPackage = (kind: AccountKind, id: string) =>
  apiFetch<AdminAccountPackage>(accountPath(kind, id), { cache: "no-store" });

/** Replaces whatever overlaps from `starts_on` on. 409 PACKAGE_INACTIVE. */
export const adminAssignPackage = (
  kind: AccountKind,
  id: string,
  input: { package_id: string; starts_on?: string; ends_on?: string | null; note?: string },
) => apiFetch<{ assignment: PackageAssignment; usage: MarketUsage }>(accountPath(kind, id), { method: "POST", body: input });

/** Ends the current assignment of a market and cancels a scheduled one. 404 PACKAGE_ASSIGNMENT_NOT_FOUND. */
export const adminEndPackage = (kind: AccountKind, id: string, input: { market_code: string; note?: string }) =>
  apiFetch<{ usage: MarketUsage }>(`${accountPath(kind, id)}/end`, { method: "POST", body: input });
