/**
 * The filters of the received-request list (`/agent/requests`) and of the
 * customer's own list (`/account/requests`): read from the page address,
 * written back to it, and turned into the API's query. Pure functions with
 * no imports, so `npm test` can run them directly.
 */

const STAGES = [
  "NEW_ENQUIRY",
  "ASSIGNED",
  "CONTACTED",
  "VIEWING_REQUESTED",
  "VIEWING_SCHEDULED",
  "FOLLOW_UP_REQUIRED",
  "CONVERTED",
  "CLOSED",
];
const TYPES = ["ENQUIRY", "PROPERTY_INFORMATION", "VIEWING_REQUEST", "CONSULTATION_REQUEST", "STAY_REQUEST"];
const STATUSES = ["RECEIVED", "IN_PROGRESS", "RESPONDED", "VIEWING_SCHEDULED", "CLOSED"];

/** The API's limit on the free-text search. */
export const QUERY_MAX = 100;

export type RequestFilters = {
  stage?: string;
  type?: string;
  /** Calendar days, YYYY-MM-DD, in the viewer's time zone. Both are included. */
  from?: string;
  to?: string;
  q?: string;
  page: number;
};

type Params = { get(name: string): string | null };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written YYYY-MM-DD. */
export function isDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** "2026-11-30" -> "2026-12-01". */
export function nextDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** A page number from the address: a whole number from 1, else 1. */
export function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** The filters in a page address. Anything the API would refuse is dropped, so the list still loads. */
export function parseRequestFilters(params: Params): RequestFilters {
  const stage = params.get("stage") ?? "";
  const type = params.get("type") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const q = (params.get("q") ?? "").trim().slice(0, QUERY_MAX);
  const filters: RequestFilters = { page: pageFrom(params.get("page")) };
  if (STAGES.includes(stage)) filters.stage = stage;
  if (TYPES.includes(type)) filters.type = type;
  if (isDay(from)) filters.from = from;
  if (isDay(to) && (!filters.from || to >= filters.from)) filters.to = to;
  if (q) filters.q = q;
  return filters;
}

/** True when any filter other than the stage and the page is set. */
export const hasNarrowingFilters = (filters: RequestFilters) =>
  Boolean(filters.type || filters.from || filters.to || filters.q);

/** The page address's query for these filters: "" or "?stage=…&page=2". Page 1 is left out. */
export function requestFiltersSearch(filters: RequestFilters): string {
  const search = new URLSearchParams();
  for (const key of ["stage", "type", "from", "to", "q"] as const) {
    const value = filters[key];
    if (value) search.set(key, value);
  }
  if (filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * The API query for these filters. A day is turned into an instant at the
 * start of that day in the viewer's time zone; `to` is the start of the next
 * day, because the API's `to` is exclusive and the form's last day is included.
 */
export function requestFiltersApiQuery(filters: RequestFilters, pageSize = 20): string {
  const search = new URLSearchParams();
  if (filters.stage) search.set("stage", filters.stage);
  if (filters.type) search.set("type", filters.type);
  if (filters.from) search.set("from", startOfLocalDay(filters.from));
  if (filters.to) search.set("to", startOfLocalDay(nextDay(filters.to)));
  if (filters.q) search.set("q", filters.q);
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search.toString()}`;
}

/** Midnight at the start of a YYYY-MM-DD day in this device's time zone, as RFC 3339 in UTC. */
export function startOfLocalDay(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toISOString();
}

/** The customer's list: one status and a page. */
export function parseStatusFilter(params: Params): { status?: string; page: number } {
  const status = params.get("status") ?? "";
  return STATUSES.includes(status) ? { status, page: pageFrom(params.get("page")) } : { page: pageFrom(params.get("page")) };
}

export function statusFilterSearch({ status, page }: { status?: string; page: number }): string {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (page > 1) search.set("page", String(page));
  const text = search.toString();
  return text ? `?${text}` : "";
}
