import { apiFetch, type ApiResult } from "@/lib/api/http";
import { readTimeZoneSetting, timeZonePutBody, type TimeZoneMode, type TimeZoneSetting } from "@/lib/time-zone";

/**
 * The signed-in person's display zone (API 0.62.0). Display only: nothing the
 * site sends is converted. Read in the browser with the session cookie, never
 * cached, and through the tolerant reader in `src/lib/time-zone.ts`.
 */

const toSetting = (result: ApiResult<unknown>): ApiResult<TimeZoneSetting> =>
  result.ok ? { ok: true, status: result.status, data: readTimeZoneSetting(result.data) } : result;

export const getTimeZone = async (): Promise<ApiResult<TimeZoneSetting>> =>
  toSetting(await apiFetch<unknown>("/v1/me/time-zone", { cache: "no-store" }));

/** Market time, this device's zone, or a named IANA zone. A refused zone is 400 on `zone`. */
export const saveTimeZone = async (mode: TimeZoneMode, zone?: string | null): Promise<ApiResult<TimeZoneSetting>> =>
  toSetting(await apiFetch<unknown>("/v1/me/time-zone", { method: "PUT", body: timeZonePutBody(mode, zone), cache: "no-store" }));
