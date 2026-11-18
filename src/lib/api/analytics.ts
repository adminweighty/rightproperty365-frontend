import { periodQuery, type PeriodChoice } from "@/lib/analytics/report";
import { apiFetch, type ApiResult } from "@/lib/api/http";

/*
 * Listing analytics reports (API 0.30.0). Aggregates only: raw events are
 * never exposed by any endpoint. Read in the browser with the session cookie.
 *
 * The contract names what each report holds but not every field name; the
 * names below are this site's reading of it, and `normaliseReport` fills in
 * anything an older or partial answer leaves out, so a missing number reads
 * as 0 rather than breaking the page.
 */

export type AnalyticsTotals = {
  impressions: number;
  views: number;
  unique_views: number;
  contact_clicks: number;
  video_plays: number;
  saves: number;
  enquiries: number;
  viewing_requests: number;
  appointments_confirmed: number;
  relists: number;
};

/** One market-local day. */
export type AnalyticsDay = { date: string } & Partial<AnalyticsTotals>;

export type AnalyticsBreakdownRow = { key: string; count: number };

export type AnalyticsReport = {
  period: string;
  /** First and last market-local day covered (YYYY-MM-DD). */
  from?: string;
  to?: string;
  totals: AnalyticsTotals;
  /** Enquiries / views; null when there were no views. */
  conversion: number | null;
  /** Contact clicks / views; null when there were no views. */
  ctr: number | null;
  daily: AnalyticsDay[];
  /** Views by where the visit came from. */
  sources: AnalyticsBreakdownRow[];
  /** Views by device class. */
  devices: AnalyticsBreakdownRow[];
  /** When the rollups were last brought up to date (UTC). */
  refreshed_at: string | null;
  /** True for 24h: read from raw events, near real time, may change. */
  near_real_time: boolean;
  filtered_bot_events: number;
  late_events_dropped: number;
};

export type TopListing = {
  listing_id: string;
  title: string;
  reference?: string;
  slug?: string | null;
  market_code?: string;
  views: number;
  unique_views: number;
  contact_clicks: number;
  enquiries: number;
};

export type ListingAnalytics = AnalyticsReport & {
  listing?: { id: string; title: string; reference?: string; slug?: string | null; market_code?: string };
};

export type OrganisationAnalytics = AnalyticsReport & {
  organisation?: { id: string; name: string };
  top_listings: TopListing[];
};

export type MarketAnalytics = { market_code: string; totals: AnalyticsTotals };

export type AdminAnalytics = AnalyticsReport & {
  market?: string | null;
  markets: MarketAnalytics[];
  top_listings: TopListing[];
};

const ZERO: AnalyticsTotals = {
  impressions: 0,
  views: 0,
  unique_views: 0,
  contact_clicks: 0,
  video_plays: 0,
  saves: 0,
  enquiries: 0,
  viewing_requests: 0,
  appointments_confirmed: 0,
  relists: 0,
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export const totalsOf = (value: Partial<AnalyticsTotals> | undefined | null): AnalyticsTotals =>
  Object.fromEntries(Object.keys(ZERO).map((key) => [key, num(value?.[key as keyof AnalyticsTotals])])) as AnalyticsTotals;

/** A breakdown as `{ key, count }`, whether the API sends `{ source, views }`, `{ device, count }` or a map. */
function rowsOf(value: unknown, keyName: string): AnalyticsBreakdownRow[] {
  if (Array.isArray(value)) {
    return value.map((row: Record<string, unknown>) => ({
      key: String(row.key ?? row[keyName] ?? "unknown"),
      count: num(row.count ?? row.views ?? row.value),
    }));
  }
  if (value && typeof value === "object") return Object.entries(value).map(([key, count]) => ({ key, count: num(count) }));
  return [];
}

function normaliseReport<T extends AnalyticsReport>(raw: Record<string, unknown>): T {
  const totals = totalsOf(raw.totals as Partial<AnalyticsTotals>);
  const rawDaily = (raw.daily ?? raw.series ?? []) as AnalyticsDay[];
  return {
    ...raw,
    period: String(raw.period ?? ""),
    from: typeof raw.from === "string" ? raw.from.slice(0, 10) : undefined,
    to: typeof raw.to === "string" ? raw.to.slice(0, 10) : undefined,
    totals,
    conversion: typeof raw.conversion === "number" ? raw.conversion : totals.views > 0 ? totals.enquiries / totals.views : null,
    ctr: typeof raw.ctr === "number" ? raw.ctr : totals.views > 0 ? totals.contact_clicks / totals.views : null,
    daily: Array.isArray(rawDaily) ? rawDaily.map((day) => ({ ...day, date: String(day.date ?? (day as { day?: string }).day ?? "").slice(0, 10) })) : [],
    sources: rowsOf(raw.sources, "source"),
    devices: rowsOf(raw.devices, "device"),
    refreshed_at: typeof raw.refreshed_at === "string" ? raw.refreshed_at : null,
    near_real_time: raw.near_real_time === true || raw.period === "24h",
    filtered_bot_events: num(raw.filtered_bot_events),
    late_events_dropped: num(raw.late_events_dropped),
    top_listings: Array.isArray(raw.top_listings)
      ? (raw.top_listings as Record<string, unknown>[]).map((row) => ({
          ...row,
          listing_id: String(row.listing_id ?? row.id ?? ""),
          title: String(row.title ?? ""),
          views: num(row.views ?? (row.totals as AnalyticsTotals | undefined)?.views),
          unique_views: num(row.unique_views ?? (row.totals as AnalyticsTotals | undefined)?.unique_views),
          contact_clicks: num(row.contact_clicks ?? (row.totals as AnalyticsTotals | undefined)?.contact_clicks),
          enquiries: num(row.enquiries ?? (row.totals as AnalyticsTotals | undefined)?.enquiries),
        }))
      : [],
    markets: Array.isArray(raw.markets)
      ? (raw.markets as Record<string, unknown>[]).map((row) => ({ market_code: String(row.market_code ?? row.market ?? ""), totals: totalsOf((row.totals ?? row) as Partial<AnalyticsTotals>) }))
      : [],
  } as unknown as T;
}

async function read<T extends AnalyticsReport>(path: string): Promise<ApiResult<T>> {
  const result = await apiFetch<Record<string, unknown>>(path, { cache: "no-store" });
  return result.ok ? { ...result, data: normaliseReport<T>(result.data ?? {}) } : result;
}

/** GET /v1/analytics/listings/{id}: the lister, their organisation's OWNER or MANAGER, or the assigned agent. Others get 404. */
export const getListingAnalytics = (listingId: string, choice: PeriodChoice) =>
  read<ListingAnalytics>(`/v1/analytics/listings/${encodeURIComponent(listingId)}${periodQuery(choice)}`);

/** GET /v1/analytics/organisations/{orgId}: OWNER and MANAGER see every listing; an AGENT only theirs. Wrong organisation: 404. */
export const getOrganisationAnalytics = (organisationId: string, choice: PeriodChoice) =>
  read<OrganisationAnalytics>(`/v1/analytics/organisations/${encodeURIComponent(organisationId)}${periodQuery(choice)}`);

/** GET /v1/admin/analytics/summary: SUPER_ADMIN, PLATFORM_ADMIN and MARKET_ADMIN (their market only). */
export const getAdminAnalytics = (choice: PeriodChoice, market?: string) =>
  read<AdminAnalytics>(`/v1/admin/analytics/summary${periodQuery(choice, { market })}`);
