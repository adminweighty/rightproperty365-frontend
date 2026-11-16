import { apiFetch, apiFetchFile } from "@/lib/api/http";

/*
 * Reports (API 0.25.0): counts over a date range per market for
 * SUPER_ADMIN, PLATFORM_ADMIN and FINANCE_ADMIN, and CSV exports.
 */

export type ReportSection = {
  total: number;
  /** `group` is a status (an account role for new users; NONE for none). */
  rows: { group: string; market_code: string | null; count: number }[];
};

export type ReportSummary = {
  from: string;
  to: string;
  market_codes: string[] | null;
  new_users: ReportSection;
  onboarding_applications: ReportSection;
  listings: ReportSection;
  property_requests: ReportSection;
  business_enquiries: ReportSection;
  leases: ReportSection;
  agreements: ReportSection;
  subscriptions: ReportSection;
  /** The payments administrators recorded, by the day they were received. */
  revenue: { currency_code: string; market_code: string | null; total: string; payments: number }[];
};

/** `from` and `to` are UTC days (YYYY-MM-DD), both included; `markets` country codes. */
export type ReportRange = { from?: string; to?: string; markets?: string[] };

const rangeQuery = ({ from, to, markets }: ReportRange) => {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  if (markets?.length) search.set("market", markets.join(","));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const adminReportSummary = (range: ReportRange) =>
  apiFetch<ReportSummary>(`/v1/admin/reports/summary${rangeQuery(range)}`, { cache: "no-store" });

export type ReportExport = "users" | "listings" | "subscriptions";

/** The CSV as a Blob. `X-Total-Count` / `X-Export-Truncated` are read when the API exposes them. */
export const adminReportExport = (kind: ReportExport, range: ReportRange) =>
  apiFetchFile(`/v1/admin/reports/${kind}.csv${rangeQuery(range)}`);
